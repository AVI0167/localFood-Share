import {
    auth,
    db
} from "./firebase.js";


import {
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";


import {
    doc,
    getDoc
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";



const welcomeText =
    document.getElementById("welcomeText");


const userName =
    document.getElementById("userName");


const userEmail =
    document.getElementById("userEmail");


const userRole =
    document.getElementById("userRole");


const roleDescription =
    document.getElementById("roleDescription");


const logoutButton =
    document.getElementById("logoutButton");



onAuthStateChanged(
    auth,
    async function (user) {

        if (!user) {

            window.location.href =
                "index.html";

            return;

        }


        try {

            const userDocument =
                await getDoc(
                    doc(db, "users", user.uid)
                );


            if (userDocument.exists()) {

                const data =
                    userDocument.data();


                welcomeText.textContent =
                    `Welcome, ${data.name}`;


                userName.textContent =
                    data.name;


                userEmail.textContent =
                    data.email;


                userRole.textContent =
                    data.role;


                if (data.role === "Donor") {

                    roleDescription.textContent =
                        "You can share surplus food with people in your local community.";

                } else {

                    roleDescription.textContent =
                        "You can discover and claim available food near you.";

                }

            }

        } catch (error) {

            console.error(
                "Error loading profile:",
                error
            );

        }

    }
);



function redirectToLandingPage() {
    window.location.href = "index.html";
}


logoutButton.addEventListener(
    "click",
    async function () {

        try {

            await signOut(auth);

            redirectToLandingPage();

        } catch (error) {

            console.error(error);

        }

    }
);