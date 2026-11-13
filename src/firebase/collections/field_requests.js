import { db } from "../firebaseConfig";
import {
    collection,
    doc,
    updateDoc,
    addDoc,
    serverTimestamp,
    onSnapshot
} from "firebase/firestore";
import { fetchTenantDocs, createTenantQuery, withTenant } from "@/lib/tenantFirestore";

const FIELD_REQUESTS_COLLECTION = "field_requests";

export const REQUEST_TYPE_LABELS = {
    stock_replenishment: "نواقص بضاعة سيارة",
    urgent_cash: "سلفة نقدية عاجلة",
    customer_issue: "مشكلة عميل / نزاع",
    general_support: "دعم فني / عام",
};

export const REQUEST_TYPE_COLORS = {
    stock_replenishment: "bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400",
    urgent_cash: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400",
    customer_issue: "bg-rose-500/10 text-rose-600 border-rose-500/20 dark:text-rose-400",
    general_support: "bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400",
};

export const REQUEST_PRIORITY_LABELS = {
    urgent: "عاجل طارئ 🚨",
    normal: "عادي",
};

export const REQUEST_STATUS_LABELS = {
    pending: "قيد المراجعة",
    approved: "معتمد من الإدارة",
    fulfilled: "تم تجهيز البضاعة / الصرف",
    rejected: "مرفوض",
};

export const REQUEST_STATUS_COLORS = {
    pending: "bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400",
    approved: "bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400",
    fulfilled: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400",
    rejected: "bg-rose-500/10 text-rose-600 border-rose-500/20 dark:text-rose-400",
};

/**
 * جلب جميع طلبات الميدان
 */
export const getFieldRequests = async (companyId = null) => {
    try {
        return await fetchTenantDocs(FIELD_REQUESTS_COLLECTION, {
            companyId,
            sortFn: (a, b) => {
                const tA = a.created_at?.toMillis ? a.created_at.toMillis() : new Date(a.created_at || 0).getTime();
                const tB = b.created_at?.toMillis ? b.created_at.toMillis() : new Date(b.created_at || 0).getTime();
                return tB - tA;
            },
        });
    } catch (error) {
        console.error("Error fetching field requests:", error);
        return [];
    }
};

/**
 * استماع لحظي لكافة طلبات الميدان (Real-time onSnapshot)
 */
export const subscribeFieldRequests = (onData, onError) => {
    try {
        const q = createTenantQuery(FIELD_REQUESTS_COLLECTION);
        return onSnapshot(
            q,
            (snap) => {
                const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                list.sort((a, b) => {
                    const tA = a.created_at?.toMillis?.() || (a.created_at ? new Date(a.created_at).getTime() : 0);
                    const tB = b.created_at?.toMillis?.() || (b.created_at ? new Date(b.created_at).getTime() : 0);
                    return tB - tA;
                });
                onData(list);
            },
            (err) => {
                console.error("subscribeFieldRequests error:", err);
                if (onError) onError(err);
            }
        );
    } catch (err) {
        console.error("subscribeFieldRequests setup error:", err);
        if (onError) onError(err);
        return () => {};
    }
};

/**
 * تحديث حالة طلب ميداني (اعتماد، تجهيز بضاعة، رفض)
 */
export const updateFieldRequestStatus = async (requestId, status, notes = '', adminUser = null) => {
    const docRef = doc(db, FIELD_REQUESTS_COLLECTION, requestId);
    const updatePayload = {
        status,
        updated_at: serverTimestamp(),
    };
    if (notes) updatePayload.admin_notes = notes;
    if (adminUser) {
        updatePayload.reviewed_by = adminUser.displayName || adminUser.email || 'إدارة النظام';
        updatePayload.reviewed_at = serverTimestamp();
    }
    await updateDoc(docRef, updatePayload);
};

/**
 * إنشاء طلب ميداني جديد
 */
export const createFieldRequest = async (requestData) => {
    const colRef = collection(db, FIELD_REQUESTS_COLLECTION);
    const payload = withTenant({
        ...requestData,
        status: requestData.status || 'pending',
        priority: requestData.priority || 'normal',
        created_at: serverTimestamp(),
    });
    const res = await addDoc(colRef, payload);
    return res.id;
};
