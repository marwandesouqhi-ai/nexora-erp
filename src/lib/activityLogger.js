// src/lib/activityLogger.js
import { db } from "../api/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

export const logActivity = async (userId, action, details) => {
    try {
        await addDoc(collection(db, "activity_logs"), {
            userId,
            action,
            details,
            timestamp: serverTimestamp(),
        });
    } catch (error) {
        console.error("خطأ في تسجيل النشاط:", error);
    }
};