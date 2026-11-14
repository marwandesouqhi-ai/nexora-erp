import { db } from "../firebaseConfig";
import {
    collection,
    doc,
    updateDoc,
    addDoc,
    serverTimestamp,
    onSnapshot
} from "@/data/firestoreCompat";
import { fetchTenantDocs, createTenantQuery, withTenant } from "@/lib/tenantFirestore";

const RECONCILIATIONS_COLLECTION = "daily_reconciliations";

export const RECONCILIATION_STATUS_LABELS = {
    pending_review: "بانتظار المراجعة والتدقيق",
    approved: "معتمد ومرحل محاسبياً ✅",
};

export const RECONCILIATION_STATUS_COLORS = {
    pending_review: "bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400",
    approved: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400",
};

/**
 * دالة مساعدة لتحديد حالة الفارق المالي وتلوين المؤشر
 * 🟢 أخضر: مطابق تماماً (الفارق = 0)
 * 🔴 أحمر: عجز في العهدة (الفارق < 0)
 * 🟡 أصفر: فائض نقدي (الفارق > 0)
 */
export const getDifferenceStatus = (diff) => {
    const d = Number(diff) || 0;
    if (d === 0) {
        return {
            type: "exact",
            label: "مطابق تماماً 🟢",
            badgeClass: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30 dark:text-emerald-400",
            textClass: "text-emerald-600 font-bold",
            icon: "check",
        };
    }
    if (d < 0) {
        return {
            type: "deficit",
            label: `عجز مالي (${Math.abs(d).toLocaleString('ar')} ج.م) 🔴`,
            badgeClass: "bg-rose-500/10 text-rose-600 border-rose-500/30 dark:text-rose-400",
            textClass: "text-rose-600 font-black",
            icon: "alert",
        };
    }
    return {
        type: "surplus",
        label: `فائض نقدي (+${d.toLocaleString('ar')} ج.م) 🟡`,
        badgeClass: "bg-amber-500/10 text-amber-600 border-amber-500/30 dark:text-amber-400",
        textClass: "text-amber-600 font-bold",
        icon: "plus",
    };
};

/**
 * جلب جميع محاضر إغلاق اليومية
 */
export const getDailyReconciliations = async (companyId = null) => {
    try {
        return await fetchTenantDocs(RECONCILIATIONS_COLLECTION, {
            companyId,
            sortFn: (a, b) => {
                const dateCmp = (b.date || '').localeCompare(a.date || '');
                if (dateCmp !== 0) return dateCmp;
                const tA = a.created_at?.toMillis ? a.created_at.toMillis() : new Date(a.created_at || 0).getTime();
                const tB = b.created_at?.toMillis ? b.created_at.toMillis() : new Date(b.created_at || 0).getTime();
                return tB - tA;
            },
        });
    } catch (error) {
        console.error("Error fetching daily reconciliations:", error);
        return [];
    }
};

/**
 * استماع لحظي لمحاضر تصفية اليومية (Real-time onSnapshot)
 */
export const subscribeDailyReconciliations = (onData, onError) => {
    try {
        const q = createTenantQuery(RECONCILIATIONS_COLLECTION);
        return onSnapshot(
            q,
            (snap) => {
                const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                list.sort((a, b) => {
                    const dateCmp = (b.date || '').localeCompare(a.date || '');
                    if (dateCmp !== 0) return dateCmp;
                    const tA = a.created_at?.toMillis?.() || 0;
                    const tB = b.created_at?.toMillis?.() || 0;
                    return tB - tA;
                });
                onData(list);
            },
            (err) => {
                console.error("subscribeDailyReconciliations error:", err);
                if (onError) onError(err);
            }
        );
    } catch (err) {
        console.error("subscribeDailyReconciliations setup error:", err);
        if (onError) onError(err);
        return () => {};
    }
};

/**
 * اعتماد محضر التصفية وإغلاقه محاسبياً
 */
export const approveReconciliation = async (recordId, auditorName = 'المحاسب المالي', auditNotes = '') => {
    const docRef = doc(db, RECONCILIATIONS_COLLECTION, recordId);
    const payload = {
        status: "approved",
        audited_by: auditorName,
        audited_at: serverTimestamp(),
    };
    if (auditNotes) payload.audit_notes = auditNotes;
    await updateDoc(docRef, payload);
};

/**
 * إضافة محضر تصفية جديد
 */
export const createDailyReconciliation = async (recData) => {
    const colRef = collection(db, RECONCILIATIONS_COLLECTION);
    const sysCash = Number(recData.system_cash) || 0;
    const actCash = Number(recData.actual_cash) || 0;
    const cashDiff = recData.cash_difference != null ? Number(recData.cash_difference) : (actCash - sysCash);

    const payload = withTenant({
        ...recData,
        system_cash: sysCash,
        actual_cash: actCash,
        cash_difference: cashDiff,
        status: recData.status || "pending_review",
        created_at: serverTimestamp(),
    });
    const res = await addDoc(colRef, payload);
    return res.id;
};
