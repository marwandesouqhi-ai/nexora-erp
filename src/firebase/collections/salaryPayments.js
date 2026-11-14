import { db } from '../firebaseConfig';
import { collection, addDoc, doc, updateDoc, deleteDoc, serverTimestamp } from "@/data/firestoreCompat";
import { fetchTenantDocs, withTenant } from '@/lib/tenantFirestore';

export const addSalaryPayment = async (paymentData) => {
    try {
        const payload = withTenant({
            employee_id: paymentData.employee_id || '',
            employee_name: paymentData.employee_name || '',
            month: paymentData.month || '',
            year: Number(paymentData.year) || new Date().getFullYear(),
            base_salary: Number(paymentData.base_salary) || 0,
            allowances: Number(paymentData.allowances) || 0,
            deductions: Number(paymentData.deductions) || 0,
            commission: Number(paymentData.commission) || 0,
            net_salary: Number(paymentData.net_salary) || 0,
            payment_method: paymentData.payment_method || 'cash',
            status: paymentData.status || 'paid',
            notes: paymentData.notes || '',
            created_at: serverTimestamp(),
        });
        const ref = await addDoc(collection(db, 'salary_payments'), payload);
        return { success: true, id: ref.id };
    } catch (error) {
        console.error('Error adding salary payment:', error);
        return { success: false, error };
    }
};

export const getSalaryPayments = async (companyId = null) => {
    try {
        return await fetchTenantDocs('salary_payments', {
            companyId,
            sortFn: (a, b) => {
                const timeA = a.created_at?.toMillis ? a.created_at.toMillis() : new Date(a.created_at || 0).getTime();
                const timeB = b.created_at?.toMillis ? b.created_at.toMillis() : new Date(b.created_at || 0).getTime();
                return timeB - timeA;
            },
        });
    } catch (error) {
        console.error('Error getting salary payments:', error);
        return [];
    }
};

export const updateSalaryPayment = async (id, updatedData) => {
    try {
        const ref = doc(db, 'salary_payments', id);
        await updateDoc(ref, {
            ...updatedData,
            updated_at: serverTimestamp(),
        });
        return { success: true };
    } catch (error) {
        console.error('Error updating salary payment:', error);
        return { success: false, error };
    }
};

export const deleteSalaryPayment = async (id) => {
    try {
        await deleteDoc(doc(db, 'salary_payments', id));
        return { success: true };
    } catch (error) {
        console.error('Error deleting salary payment:', error);
        return { success: false, error };
    }
};
