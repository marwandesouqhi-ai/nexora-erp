import { db } from "../firebaseConfig";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { fetchTenantDocs, withTenant } from "@/lib/tenantFirestore";

// 1. دالة تسجيل نشاط جديد (تُستدعى من داخل كل العمليات التانية)
export const logActivity = async (userId, userName, action, details) => {
    try {
        await addDoc(collection(db, "activity_logs"), withTenant({
            user_id: userId,          // ID الموظف
            user_name: userName,      // اسم الموظف
            action: action,           // نوع العملية (مثلاً: "إضافة فاتورة"، "تعديل سعر")
            details: details,         // تفاصيل دقيقة (مثلاً: "قام بتغيير سعر الصنف X من 50 لـ 70")
            timestamp: serverTimestamp(),
            ip_address: "",           // (اختياري) لو حابب تسجل الـ IP للزيادة في الأمان
        }));
    } catch (error) {
        console.error("Failed to log activity: ", error);
    }
};

// 2. دالة جلب آخر النشاطات لعرضها للمدير
export const getRecentActivities = async (limitCount = 50, companyId = null) => {
    try {
        const items = await fetchTenantDocs("activity_logs", {
            companyId,
            sortFn: (a, b) => {
                const timeA = a.timestamp?.toMillis ? a.timestamp.toMillis() : new Date(a.timestamp || 0).getTime();
                const timeB = b.timestamp?.toMillis ? b.timestamp.toMillis() : new Date(b.timestamp || 0).getTime();
                return timeB - timeA;
            },
        });
        return items.slice(0, limitCount);
    } catch (error) {
        console.error("Error fetching logs: ", error);
        return [];
    }
};