import { db } from "../firebaseConfig";
import { collection, addDoc, query, where, orderBy, getDocs, serverTimestamp, updateDoc, doc } from "firebase/firestore";

// 1. دالة إنشاء تنبيه جديد
export const createNotification = async (type, message, severity = "info") => {
    try {
        await addDoc(collection(db, "notifications"), {
            type: type,               // (stock_low, expiry_near, debt_limit_exceeded)
            message: message,         // نص التنبيه (مثلاً: "صنف X رصيده أقل من حد الأمان")
            severity: severity,       // (warning, error, info)
            is_read: false,           // حالة التنبيه
            created_at: serverTimestamp(),
        });
    } catch (error) {
        console.error("Error creating notification: ", error);
    }
};

// 2. دالة جلب التنبيهات غير المقروءة (عشان تظهر في الجرس فوق)
export const getUnreadNotifications = async () => {
    try {
        const q = query(
            collection(db, "notifications"),
            where("is_read", "==", false),
            orderBy("created_at", "desc")
        );

        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error("Error fetching notifications: ", error);
        return [];
    }
};

// 3. دالة تحديد التنبيه كـ "تمت القراءة"
export const markAsRead = async (notificationId) => {
    try {
        const docRef = doc(db, "notifications", notificationId);
        await updateDoc(docRef, { is_read: true });
    } catch (error) {
        console.error("Error updating notification status: ", error);
    }
};