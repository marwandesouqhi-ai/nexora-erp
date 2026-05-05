import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
    apiKey: "AIzaSyAp-ZSJ5vnzanVg6ypeP1FmjCiDWg9Pj3Y",
    authDomain: "nexora-erp-86d44.firebaseapp.com",
    projectId: "nexora-erp-86d44",
    storageBucket: "nexora-erp-86d44.firebasestorage.app",
    messagingSenderId: "171452622167",
    appId: "1:171452622167:web:097339c8a662cbf012ca12"
};

// تشغيل Firebase
const app = initializeApp(firebaseConfig);

// تصدير الأدوات لاستخدامها في Nexora ERP
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export default app;