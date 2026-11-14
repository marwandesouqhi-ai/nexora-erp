import { db } from "../firebaseConfig";
import {
    collection,
    addDoc,
    doc,
    updateDoc,
    deleteDoc,
    onSnapshot,
    serverTimestamp,
    writeBatch
} from "@/data/firestoreCompat";
import { fetchTenantDocs, createTenantQuery, withTenant } from "@/lib/tenantFirestore";
import { isSupabaseBackend } from "@/api/backend";
import { updateRow } from "@/data/supabaseTenantDb";

/**
 * إضافة بند تسوية مالية (حافز، جزاء إداري، خصم سلفة)
 */
export const addNewAdjustment = async (adjustmentData) => {
    try {
        const payload = withTenant({
            employee_id: adjustmentData.employee_id || '',
            employee_name: adjustmentData.employee_name || '',
            type: adjustmentData.type || 'incentive', // incentive, penalty, deduction
            title: adjustmentData.title || '',
            amount: Math.abs(Number(adjustmentData.amount) || 0),
            reason: adjustmentData.reason || '',
            date: adjustmentData.date || new Date().toISOString().slice(0, 10),
            status: adjustmentData.status || 'approved', // approved, pending, applied
            created_by: adjustmentData.created_by || 'الإدارة',
            created_at: serverTimestamp(),
        });

        const ref = await addDoc(collection(db, 'payroll_adjustments'), payload);
        return { success: true, id: ref.id };
    } catch (error) {
        console.error('Error adding payroll adjustment:', error);
        return { success: false, error };
    }
};

// تحديث بند تسوية
export const updateAdjustment = async (id, updatedData) => {
    try {
        const ref = doc(db, 'payroll_adjustments', id);
        const payload = { ...updatedData };
        if (payload.amount !== undefined) {
            payload.amount = Math.abs(Number(payload.amount) || 0);
        }
        payload.updated_at = serverTimestamp();

        await updateDoc(ref, payload);
        return { success: true };
    } catch (error) {
        console.error('Error updating payroll adjustment:', error);
        return { success: false, error };
    }
};

// حذف بند تسوية
export const deleteAdjustmentDoc = async (id) => {
    try {
        await deleteDoc(doc(db, 'payroll_adjustments', id));
        return { success: true };
    } catch (error) {
        console.error('Error deleting payroll adjustment:', error);
        return { success: false, error };
    }
};

// جلب جميع التسويات
export const getAdjustments = async (companyId = null) => {
    try {
        return await fetchTenantDocs('payroll_adjustments', {
            companyId,
            sortFn: (a, b) => (b.date || '').localeCompare(a.date || ''),
        });
    } catch (error) {
        console.error('Error getting payroll adjustments:', error);
        return [];
    }
};

// جلب تسويات موظف معين
export const getAdjustmentsByEmployee = async (employeeId, companyId = null) => {
    try {
        return await fetchTenantDocs('payroll_adjustments', {
            companyId,
            filterFn: (item) => item.employee_id === employeeId,
            sortFn: (a, b) => (b.date || '').localeCompare(a.date || ''),
        });
    } catch (error) {
        console.error('Error getting employee adjustments:', error);
        return [];
    }
};

// جلب تسويات شهر معين (YYYY-MM)
export const getAdjustmentsByMonth = async (monthStr, companyId = null) => {
    try {
        const start = `${monthStr}-01`;
        const end = `${monthStr}-31`;
        return await fetchTenantDocs('payroll_adjustments', {
            companyId,
            filterFn: (item) => item.date >= start && item.date <= end,
            sortFn: (a, b) => (b.date || '').localeCompare(a.date || ''),
        });
    } catch (error) {
        console.error('Error getting monthly adjustments:', error);
        return [];
    }
};

// اشتراك لحظي (Real-Time Subscription) لجميع التسويات
export const subscribeAdjustments = (onData, onError) => {
    try {
        const q = createTenantQuery('payroll_adjustments');
        return onSnapshot(
            q,
            (snap) => {
                const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
                list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
                onData(list);
            },
            (error) => {
                console.warn('subscribeAdjustments index fallback: ', error);
                if (onError) onError(error);
            }
        );
    } catch (err) {
        console.error('subscribeAdjustments setup error:', err);
        if (onError) onError(err);
        return () => {};
    }
};

// اشتراك لحظي لتسويات شهر معين
export const subscribeAdjustmentsByMonth = (monthStr, onData, onError) => {
    try {
        const start = `${monthStr}-01`;
        const end = `${monthStr}-31`;
        const q = createTenantQuery('payroll_adjustments');
        return onSnapshot(
            q,
            (snap) => {
                const list = snap.docs
                    .map((d) => ({ id: d.id, ...d.data() }))
                    .filter((item) => item.date >= start && item.date <= end);
                list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
                onData(list);
            },
            (error) => {
                console.error('subscribeAdjustmentsByMonth error: ', error);
                if (onError) onError(error);
            }
        );
    } catch (err) {
        console.error('subscribeAdjustmentsByMonth setup error:', err);
        if (onError) onError(err);
        return () => {};
    }
};

// تحديث حالة مجموعة من البنود دفعة واحدة (مثلاً عند اعتماد التسوية الشهرية للرواتب وتحويلها إلى 'applied')
export const batchUpdateAdjustmentStatus = async (adjustmentIds = [], newStatus = 'applied') => {
    if (!adjustmentIds.length) return { success: true };
    try {
        if (isSupabaseBackend) {
            // Salary runs apply adjustments through payroll_operation; this only flips status.
            await Promise.all(adjustmentIds.map((id) => updateRow('payroll_adjustments', id, { status: newStatus })));
            return { success: true };
        }
        const batch = writeBatch(db);
        adjustmentIds.forEach((id) => {
            const ref = doc(db, 'payroll_adjustments', id);
            batch.update(ref, { status: newStatus, updated_at: serverTimestamp() });
        });
        await batch.commit();
        return { success: true };
    } catch (error) {
        console.error('Error batch updating adjustments status:', error);
        return { success: false, error };
    }
};
