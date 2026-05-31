import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore"; // لازم تزيد السطر ده

const firebaseConfig = {
    apiKey: "AIzaSyAp-ZSJ5vnzanVg6ypeP1FmjCiDWg9Pj3Y",
    authDomain: "nexora-erp-86d44.firebaseapp.com",
    projectId: "nexora-erp-86d44",
    storageBucket: "nexora-erp-86d44.firebasestorage.app",
    messagingSenderId: "171452622167",
    appId: "1:171452622167:web:097339c8a662cbf012ca12"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// التعديل الأهم: تصدير الداتا بيز عشان ملف sales.js يشوفها
export const db = getFirestore(app);