import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";

import {
    getAuth,
    RecaptchaVerifier,
    signInWithPhoneNumber,
    linkWithPhoneNumber
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
    getFirestore
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

import {
    getStorage
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-storage.js";


const firebaseConfig = {
    apiKey: "AIzaSyCjhSixvZGjGSu_AgB3_tp7cHwFCySVXYI",
    authDomain: "foodshare-local.firebaseapp.com",
    projectId: "foodshare-local",
    storageBucket: "foodshare-local.firebasestorage.app",
    messagingSenderId: "443902986069",
    appId: "1:443902986069:web:b97f98ac67acc22dd291dc",
    measurementId: "G-MT868ZHKLM"
};

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);

const db = getFirestore(app);

const storage = getStorage(app);


export {
    auth,
    db,
    storage,
    RecaptchaVerifier,
    signInWithPhoneNumber,
    linkWithPhoneNumber
};
