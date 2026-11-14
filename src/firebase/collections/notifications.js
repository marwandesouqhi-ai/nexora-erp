import { db } from "../firebaseConfig";
import { collection, addDoc, serverTimestamp, updateDoc, doc } from "@/data/firestoreCompat";
import { fetchTenantDocs, withTenant } from "@/lib/tenantFirestore";

// 1. دالة إنشاء تنبيه جديد
export const createNotification = async (payloadOrType, messageOrUndefined, severity = "info", extra = {}) => {
    try {
        // Backward-compatible: allow (type, message, severity, extra) or a single object
        let payload = {};
        if (typeof payloadOrType === 'object' && payloadOrType !== null) {
            payload = payloadOrType;
        } else {
            payload = {
                type: payloadOrType,
                message: messageOrUndefined,
                severity,
                extra,
            };
        }

        await addDoc(collection(db, "notifications"), withTenant({
            type: payload.type || 'system',
            message: payload.message || '',
            severity: payload.severity || 'info',
            channel: (payload.extra && payload.extra.channel) || payload.channel || 'system',
            recipient_type: (payload.extra && payload.extra.recipient_type) || payload.recipient_type || 'system',
            recipient_id: (payload.extra && payload.extra.recipient_id) || payload.recipient_id || null,
            metadata: (payload.extra && payload.extra.metadata) || payload.metadata || {},
            is_read: false,
            created_at: serverTimestamp(),
        }));
    } catch (error) {
        console.error("Error creating notification: ", error);
    }
};

// 2. دالة جلب التنبيهات غير المقروءة أو كلها حسب الفلتر
export const getNotifications = async (filter = {}, companyId = null) => {
    try {
        return await fetchTenantDocs("notifications", {
            companyId,
            filterFn: (item) => {
                if (filter.unreadOnly && item.is_read) return false;
                if (filter.channel && item.channel !== filter.channel) return false;
                return true;
            },
            sortFn: (a, b) => {
                const timeA = a.created_at?.toMillis ? a.created_at.toMillis() : new Date(a.created_at || 0).getTime();
                const timeB = b.created_at?.toMillis ? b.created_at.toMillis() : new Date(b.created_at || 0).getTime();
                return timeB - timeA;
            },
        });
    } catch (error) {
        console.error("Error fetching notifications: ", error);
        return [];
    }
};

export const getUnreadNotifications = async (companyId = null) => getNotifications({ unreadOnly: true }, companyId);

// 3. دالة تحديد التنبيه كـ "تمت القراءة"
export const markAsRead = async (notificationId) => {
    try {
        const docRef = doc(db, "notifications", notificationId);
        await updateDoc(docRef, { is_read: true, read: true });
    } catch (error) {
        console.error("Error updating notification status: ", error);
    }
};

// 4. دالة إرسال إشعار موجه لمندوب ميداني أو لكافة المناديب
export const sendRepNotification = async ({
    targetEmployeeId = "all",
    title,
    body,
    type = "general",
    metadata = {}
}) => {
    try {
        const ref = await addDoc(collection(db, "notifications"), withTenant({
            target_employee_id: targetEmployeeId,
            recipient_id: targetEmployeeId,
            recipient_type: targetEmployeeId === "all" ? "all_reps" : "employee",
            title: title || "إشعار إداري",
            body: body || "",
            message: body || title || "",
            type: type || "general",
            severity: type === "rejection" || type === "alert" ? "warning" : "info",
            read: false,
            is_read: false,
            channel: "field_app",
            metadata: metadata || {},
            created_at: serverTimestamp(),
        }));
        return { success: true, id: ref.id };
    } catch (error) {
        console.error("Error sending targeted rep notification: ", error);
        return { success: false, error };
    }
};