import {
    auth,
    db,
    RecaptchaVerifier,
    signInWithPhoneNumber,
    linkWithPhoneNumber
} from "./firebase.js";

import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
    doc,
    getDoc,
    setDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";


/* =====================================================
   SHARED HELPERS
===================================================== */

function setMessage(element, text, color = "") {
    if (!element) return;
    element.textContent = text;
    if (color) element.style.color = color;
}

function isValidIndianOrInternationalPhone(phone) {
    return /^\+[1-9]\d{7,14}$/.test(phone);
}

async function redirectUserByRole(uid, messageElement = null) {
    const userRef = doc(db, "users", uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
        if (messageElement) {
            setMessage(
                messageElement,
                "Authentication succeeded, but no FoodShare profile was found. Please register first.",
                "#d04435"
            );
        }
        await signOut(auth);
        return false;
    }

    const userData = userSnap.data();

    if (userData.role === "Donor") {
        if (messageElement) {
            setMessage(messageElement, "Login successful. Opening Donor Dashboard...", "#579323");
        }
        window.location.href = "donor-dashboard.html";
        return true;
    }

    if (userData.role === "Recipient") {
        if (messageElement) {
            setMessage(messageElement, "Login successful. Opening Recipient Dashboard...", "#579323");
        }
        window.location.href = "recipient-dashboard.html";
        return true;
    }

    await signOut(auth);

    if (messageElement) {
        setMessage(messageElement, "Invalid account role.", "#d04435");
    }

    return false;
}


/* =====================================================
   LOGIN — EMAIL + PASSWORD
===================================================== */

const loginForm = document.getElementById("loginForm");

if (loginForm) {

    loginForm.addEventListener("submit", async function (e) {

        e.preventDefault();

        const emailInput =
            document.getElementById("email") ||
            document.getElementById("loginEmail");

        const passwordInput =
            document.getElementById("password") ||
            document.getElementById("loginPassword");

        const message =
            document.getElementById("loginMessage");

        if (!emailInput || !passwordInput) {
            setMessage(message, "Login form is not configured correctly.", "#d04435");
            return;
        }

        const email = emailInput.value.trim();
        const password = passwordInput.value;

        if (!email || !password) {
            setMessage(message, "Please enter email and password.", "#d04435");
            return;
        }

        try {

            setMessage(message, "Logging in...", "#579323");

            const result = await signInWithEmailAndPassword(
                auth,
                email,
                password
            );

            await redirectUserByRole(result.user.uid, message);

        } catch (error) {

            console.error("EMAIL LOGIN ERROR:", error);

            let text = "Login failed.";

            if (error.code === "auth/invalid-credential") {
                text = "Incorrect email or password.";
            } else if (error.code === "auth/invalid-email") {
                text = "Invalid email address.";
            } else if (error.code === "auth/user-not-found") {
                text = "Account not found.";
            } else if (error.code === "auth/wrong-password") {
                text = "Incorrect password.";
            } else if (error.code === "auth/too-many-requests") {
                text = "Too many attempts. Try again later.";
            } else if (error.code === "permission-denied") {
                text = "Firestore permission denied.";
            } else {
                text = error.message || text;
            }

            setMessage(message, text, "#d04435");
        }
    });
}


/* =====================================================
   LOGIN — MOBILE + OTP
===================================================== */

const emailLoginTab = document.getElementById("emailLoginTab");
const phoneLoginTab = document.getElementById("phoneLoginTab");
const phoneLoginPanel = document.getElementById("phoneLoginPanel");
const phoneLoginForm = document.getElementById("loginForm");
const sendLoginOtp = document.getElementById("sendLoginOtp");
const verifyLoginOtp = document.getElementById("verifyLoginOtp");
const phoneNumberInput = document.getElementById("phoneNumber");
const loginOtp = document.getElementById("loginOtp");
const loginOtpArea = document.getElementById("loginOtpArea");
const phoneLoginMessage = document.getElementById("phoneLoginMessage");

let loginRecaptchaVerifier = null;
let loginConfirmationResult = null;

function clearLoginRecaptcha() {
    if (loginRecaptchaVerifier) {
        try {
            loginRecaptchaVerifier.clear();
        } catch (e) {
            console.warn("reCAPTCHA clear:", e);
        }
        loginRecaptchaVerifier = null;
    }

    const container = document.getElementById("login-recaptcha-container");
    if (container) container.innerHTML = "";
}

function setupLoginRecaptcha() {
    if (loginRecaptchaVerifier) return loginRecaptchaVerifier;

    loginRecaptchaVerifier = new RecaptchaVerifier(
        auth,
        "login-recaptcha-container",
        {
            size: "normal",
            callback: () => {
                setMessage(phoneLoginMessage, "reCAPTCHA verified.", "#579323");
            },
            "expired-callback": () => {
                setMessage(phoneLoginMessage, "reCAPTCHA expired. Please verify again.", "#d04435");
            }
        }
    );

    loginRecaptchaVerifier.render().catch((error) => {
        console.error("Login reCAPTCHA render:", error);
    });

    return loginRecaptchaVerifier;
}

if (emailLoginTab && phoneLoginTab && phoneLoginPanel && phoneLoginForm) {

    emailLoginTab.addEventListener("click", () => {
        emailLoginTab.classList.add("active");
        phoneLoginTab.classList.remove("active");
        emailLoginTab.setAttribute("aria-selected", "true");
        phoneLoginTab.setAttribute("aria-selected", "false");

        phoneLoginPanel.hidden = true;
        phoneLoginForm.hidden = false;

        clearLoginRecaptcha();
        setMessage(phoneLoginMessage, "");
    });

    phoneLoginTab.addEventListener("click", () => {
        phoneLoginTab.classList.add("active");
        emailLoginTab.classList.remove("active");
        phoneLoginTab.setAttribute("aria-selected", "true");
        emailLoginTab.setAttribute("aria-selected", "false");

        phoneLoginForm.hidden = true;
        phoneLoginPanel.hidden = false;

        setupLoginRecaptcha();
    });
}

if (sendLoginOtp) {

    sendLoginOtp.addEventListener("click", async () => {

        const phone = phoneNumberInput?.value.trim();

        if (!phone) {
            setMessage(phoneLoginMessage, "Please enter your mobile number.", "#d04435");
            return;
        }

        if (!isValidIndianOrInternationalPhone(phone)) {
            setMessage(
                phoneLoginMessage,
                "Use international format, e.g. +919876543210.",
                "#d04435"
            );
            return;
        }

        try {

            sendLoginOtp.disabled = true;
            sendLoginOtp.querySelector("span").textContent = "Sending OTP...";
            setMessage(phoneLoginMessage, "Preparing OTP verification...", "#579323");

            setupLoginRecaptcha();

            loginConfirmationResult = await signInWithPhoneNumber(
                auth,
                phone,
                loginRecaptchaVerifier
            );

            loginOtpArea.hidden = false;

            setMessage(
                phoneLoginMessage,
                "OTP sent. Enter the 6-digit code.",
                "#579323"
            );

            loginOtp?.focus();

        } catch (error) {

            console.error("PHONE LOGIN OTP ERROR:", error);

            clearLoginRecaptcha();

            let text = "Unable to send OTP.";

            if (error.code === "auth/invalid-phone-number") {
                text = "Invalid mobile number.";
            } else if (error.code === "auth/operation-not-allowed") {
                text = "Phone Authentication is not enabled in Firebase.";
            } else if (error.code === "auth/quota-exceeded") {
                text = "SMS quota exceeded. Try again later.";
            } else if (error.code === "auth/too-many-requests") {
                text = "Too many attempts. Try again later.";
            } else if (error.code === "auth/captcha-check-failed") {
                text = "reCAPTCHA verification failed. Please try again.";
            } else {
                text = error.message || text;
            }

            setMessage(phoneLoginMessage, text, "#d04435");

        } finally {

            sendLoginOtp.disabled = false;
            sendLoginOtp.querySelector("span").textContent = "Send OTP";
        }
    });
}

if (verifyLoginOtp) {

    verifyLoginOtp.addEventListener("click", async () => {

        const code = loginOtp?.value.trim();

        if (!loginConfirmationResult) {
            setMessage(phoneLoginMessage, "Request an OTP first.", "#d04435");
            return;
        }

        if (!/^\d{6}$/.test(code || "")) {
            setMessage(phoneLoginMessage, "Enter the 6-digit OTP.", "#d04435");
            return;
        }

        try {

            verifyLoginOtp.disabled = true;
            verifyLoginOtp.querySelector("span").textContent = "Verifying...";
            setMessage(phoneLoginMessage, "Verifying OTP...", "#579323");

            const result = await loginConfirmationResult.confirm(code);

            await redirectUserByRole(result.user.uid, phoneLoginMessage);

        } catch (error) {

            console.error("PHONE LOGIN VERIFY ERROR:", error);

            let text = "OTP verification failed.";

            if (error.code === "auth/invalid-verification-code") {
                text = "Incorrect OTP.";
            } else if (error.code === "auth/code-expired") {
                text = "OTP expired. Request a new OTP.";
            } else {
                text = error.message || text;
            }

            setMessage(phoneLoginMessage, text, "#d04435");

        } finally {

            verifyLoginOtp.disabled = false;
            verifyLoginOtp.querySelector("span").textContent = "Verify OTP & Login";
        }
    });
}


/* =====================================================
   REGISTER — EMAIL/PASSWORD + VERIFIED PHONE
===================================================== */

const registerForm = document.getElementById("registerForm");

let registrationRecaptchaVerifier = null;
let registrationConfirmationResult = null;

function clearRegistrationRecaptcha() {
    if (registrationRecaptchaVerifier) {
        try {
            registrationRecaptchaVerifier.clear();
        } catch (e) {
            console.warn("Registration reCAPTCHA clear:", e);
        }
        registrationRecaptchaVerifier = null;
    }

    const container = document.getElementById("register-recaptcha-container");
    if (container) container.innerHTML = "";
}

function setupRegistrationRecaptcha() {
    if (registrationRecaptchaVerifier) return registrationRecaptchaVerifier;

    registrationRecaptchaVerifier = new RecaptchaVerifier(
        auth,
        "register-recaptcha-container",
        {
            size: "normal",
            callback: () => {
                const m = document.getElementById("registerMessage");
                setMessage(m, "reCAPTCHA verified.", "#579323");
            },
            "expired-callback": () => {
                const m = document.getElementById("registerMessage");
                setMessage(m, "reCAPTCHA expired. Please verify again.", "#d04435");
            }
        }
    );

    registrationRecaptchaVerifier.render().catch(console.error);

    return registrationRecaptchaVerifier;
}

async function createFoodShareProfile(user, name, email, phone, role) {
    await setDoc(
        doc(db, "users", user.uid),
        {
            uid: user.uid,
            name,
            email,
            phone,
            role,
            createdAt: serverTimestamp()
        }
    );

    if (role === "Donor") {
        await setDoc(
            doc(db, "donorContacts", user.uid),
            {
                donorId: user.uid,
                phone,
                createdAt: serverTimestamp()
            }
        );
    }
}

if (registerForm) {

    registerForm.addEventListener("submit", async function (e) {

        e.preventDefault();

        const name = document.getElementById("name")?.value.trim();
        const email = document.getElementById("email")?.value.trim();
        const phone = document.getElementById("phone")?.value.trim();
        const password = document.getElementById("password")?.value;
        const confirmPassword = document.getElementById("confirmPassword")?.value;

        const roleElement =
            document.querySelector('input[name="role"]:checked');

        const message =
            document.getElementById("registerMessage");

        if (!name || !email || !phone || !password || !confirmPassword) {
            setMessage(message, "Please fill all fields.", "#d04435");
            return;
        }

        if (!roleElement) {
            setMessage(message, "Please select Donor or Recipient.", "#d04435");
            return;
        }

        if (password !== confirmPassword) {
            setMessage(message, "Passwords do not match.", "#d04435");
            return;
        }

        if (!isValidIndianOrInternationalPhone(phone)) {
            setMessage(
                message,
                "Use international phone format, e.g. +919876543210.",
                "#d04435"
            );
            return;
        }

        try {

            setMessage(
                message,
                "Creating your account. You will verify your phone next...",
                "#579323"
            );

            const result =
                await createUserWithEmailAndPassword(
                    auth,
                    email,
                    password
                );

            const user = result.user;

            /*
             * IMPORTANT:
             * Link the verified phone number to the SAME Firebase user.
             * This is what makes future Mobile OTP login resolve to the
             * same users/{uid} document.
             */
            setupRegistrationRecaptcha();

            registrationConfirmationResult =
                await linkWithPhoneNumber(
                    user,
                    phone,
                    registrationRecaptchaVerifier
                );

            // Store registration state temporarily in memory.
            window.__foodShareRegistration = {
                user,
                name,
                email,
                phone,
                role: roleElement.value
            };

            // Show OTP UI if those elements were added to register.html.
            const phoneOtpArea =
                document.getElementById("registrationOtpArea");

            if (phoneOtpArea) {
                phoneOtpArea.hidden = false;
            }

            setMessage(
                message,
                "OTP sent to your mobile number. Enter it to finish registration.",
                "#579323"
            );

            const registrationOtp =
                document.getElementById("registrationOtp");

            registrationOtp?.focus();

        } catch (error) {

            console.error("REGISTER ERROR:", error);

            const message =
                document.getElementById("registerMessage");

            let text = error.message || "Registration failed.";

            if (error.code === "auth/email-already-in-use") {
                text = "This email is already registered.";
            } else if (error.code === "auth/invalid-phone-number") {
                text = "Invalid mobile number.";
            } else if (error.code === "auth/credential-already-in-use") {
                text = "This mobile number is already linked to another account.";
            } else if (error.code === "auth/provider-already-linked") {
                text = "This mobile number is already linked to this account.";
            } else if (error.code === "auth/quota-exceeded") {
                text = "SMS quota exceeded. Try again later.";
            }

            setMessage(message, text, "#d04435");
        }
    });

    const sendRegistrationOtpButton =
        document.getElementById("sendRegistrationOtp");

    const verifyRegistrationOtpButton =
        document.getElementById("verifyRegistrationOtp");

    if (verifyRegistrationOtpButton) {

        verifyRegistrationOtpButton.addEventListener("click", async () => {

            const message =
                document.getElementById("registerMessage");

            const code =
                document.getElementById("registrationOtp")?.value.trim();

            const registration =
                window.__foodShareRegistration;

            if (!registrationConfirmationResult || !registration) {
                setMessage(message, "Start registration first.", "#d04435");
                return;
            }

            if (!/^\d{6}$/.test(code || "")) {
                setMessage(message, "Enter the 6-digit OTP.", "#d04435");
                return;
            }

            try {

                verifyRegistrationOtpButton.disabled = true;
                verifyRegistrationOtpButton.textContent = "Verifying...";

                await registrationConfirmationResult.confirm(code);

                await createFoodShareProfile(
                    registration.user,
                    registration.name,
                    registration.email,
                    registration.phone,
                    registration.role
                );

                setMessage(
                    message,
                    "Registration completed successfully.",
                    "#579323"
                );

                setTimeout(() => {

                    if (registration.role === "Donor") {
                        window.location.href = "donor-dashboard.html";
                    } else {
                        window.location.href = "recipient-dashboard.html";
                    }

                }, 800);

            } catch (error) {

                console.error("REGISTRATION OTP ERROR:", error);

                let text = error.message || "OTP verification failed.";

                if (error.code === "auth/invalid-verification-code") {
                    text = "Incorrect OTP.";
                } else if (error.code === "auth/code-expired") {
                    text = "OTP expired. Request a new OTP.";
                }

                setMessage(message, text, "#d04435");

            } finally {

                verifyRegistrationOtpButton.disabled = false;
                verifyRegistrationOtpButton.textContent = "Verify OTP & Create Account";
            }
        });
    }
}
