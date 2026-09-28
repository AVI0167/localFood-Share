# FoodShare Local — Email + Password + Mobile OTP

This package preserves the existing FoodShare Local UI and adds:

- Email + Password login
- Mobile + OTP login
- Phone verification during registration
- Phone credential linked to the SAME Firebase user
- Donor / Recipient role routing

## IMPORTANT

Phone OTP login only works for users whose phone number was verified and linked during registration. The registration flow in this package performs that linking.

## Firebase Console

Open:

Firebase Console → Build → Authentication → Sign-in method

Enable:

1. Email/Password
2. Phone

For testing, use Firebase Authentication's test phone numbers if available in your project.

## Run

Open the extracted `foodshare-local` folder in VS Code.

Run `index.html` with Live Server.

Do not open the ZIP file or `__MACOSX` metadata files.

## Login

Email:
- Email
- Password

Mobile:
- Mobile number in international format, e.g. `+919876543210`
- reCAPTCHA
- Send OTP
- Verify OTP

## Registration

Registration now:
1. Creates the Email/Password Firebase user.
2. Sends a phone OTP.
3. Links the verified phone number to that SAME Firebase user.
4. Creates `users/{uid}`.
5. Creates `donorContacts/{uid}` for Donors.

This same UID is then used for both email login and mobile OTP login.

## Existing accounts

Users that were registered before phone linking was added may already have a phone field in Firestore, but their Firebase Authentication account may NOT have the phone provider linked.

Those users should complete a phone-linking flow before mobile OTP login can work for them. Do not create a second Firebase account for the same person just to enable phone login.

## Firestore

Your current rules can remain for this authentication flow.
