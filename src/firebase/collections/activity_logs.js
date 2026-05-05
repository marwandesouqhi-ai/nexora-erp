import { db } from "../firebaseConfig";
import { collection, addDoc, query, orderBy, limit, getDocs, serverTimestamp } from "firebase/firestore";

// 1. دالة تسجيل نشاط جديد (تُستدعى من داخل كل العمليات التانية)
export const logActivity = async (userId, userName, action, details) => {
    try {
        await addDoc(collection(db, "activity_logs"), {
            user_id: userId,          // ID الموظف
            user_name: userName,      // اسم الموظف
            action: action,           // نوع العملية (مثلاً: "إضافة فاتورة"، "تعديل سعر")
            details: details,         // تفاصيل دقيقة (مثلاً: "قام بتغيير سعر الصنف X من 50 لـ 70")
            timestamp: serverTimestamp(),
            ip_address: "",           // (اختياري) لو حابب تسجل الـ IP للزيادة في الأمان
        });
    } catch (error) {
        console.error("Failed to log activity: ", error);
    }
};

// 2. دالة جلب آخر النشاطات لعرضها للمدير
export const getRecentActivities = async (limitCount = 50) => {
    try {
        const q = query(
            collection(db, "activity_logs"),
            orderBy("timestamp", "desc"),
            limit(limitCount)
        );

        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    } catch (error) {
        console.error("Error fetching logs: ", error);
        return [];
    }
};