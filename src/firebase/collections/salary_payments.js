import { db } from '../firebaseConfig';
import { collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { fetchTenantDocs, withTenant } from '@/lib/tenantFirestore';
import { isSupabaseBackend } from "@/api/backend";
import { callRpc } from "@/data/supabaseRpc";

// payroll_operation payload (the server recomputes net_salary and validates everything).
const toPayrollPayload = (data) => ({
    employee_id: data.employee_id,
    month_year: data.month_year,
    base_salary: Number(data.base_salary) || 0,
    commission_amount: Number(data.commission_amount) || 0,
    allowances: Number(data.allowances) || 0,
    bonus: Number(data.bonus) || 0,
    deductions: Number(data.deductions) || 0,
    tax_deducted: Number(data.tax_deducted) || 0,
    payment_status: data.payment_status || data.status || 'paid',
    payment_date: data.payment_date || undefined,
    account_id: data.account_id || undefined,
    adjustment_ids_to_apply: data.adjustment_ids_to_apply || [],
    payment_method: data.payment_method || 'cash',
    notes: data.notes || '',
});

export const addNewSalaryPayment = async (paymentData) => {
    try {
        if (isSupabaseBackend) {
            const result = await callRpc('payroll_operation', {
                operation: 'create',
                payment_id: null,
                payload: toPayrollPayload(paymentData),
            });
            return { success: true, id: result.id };
        }
        const baseSalary = Number(paymentData.base_salary) || 0;
        const commissionAmount = Number(paymentData.commission_amount) || 0;
        const allowances = Number(paymentData.allowances) || 0;
        const bonus = Number(paymentData.bonus) || 0;
        const deductions = Number(paymentData.deductions) || 0;
        const taxDeducted = Number(paymentData.tax_deducted) || 0;
        const netSalary = baseSalary + commissionAmount + allowances + bonus - (deductions + taxDeducted);

        const payload = withTenant({
            employee_id: paymentData.employee_id || '',
            employee_name: paymentData.employee_name || '',
            month_year: paymentData.month_year || '',
            base_salary: baseSalary,
            commission_amount: commissionAmount,
            allowances,
            bonus,
            deductions,
            tax_deducted: taxDeducted,
            net_salary: netSalary,
            payment_method: paymentData.payment_method || 'cash',
            payment_status: paymentData.payment_status || 'paid',
            payment_date: paymentData.payment_date || '',
            approved_by: paymentData.approved_by || '',
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
                const timeA = a.created_at?.toMillis ? a.created_at.toMillis() : new Date(a.created_at || a.payment_date || 0).getTime();
                const timeB = b.created_at?.toMillis ? b.created_at.toMillis() : new Date(b.created_at || b.payment_date || 0).getTime();
                return timeB - timeA;
            },
        });
    } catch (error) {
        console.error('Error getting salary payments:', error);
        return [];
    }
};

export const getSalaryPaymentsByEmployee = async (employeeId, companyId = null) => {
    try {
        return await fetchTenantDocs('salary_payments', {
            companyId,
            filterFn: (p) => p.employee_id === employeeId,
            sortFn: (a, b) => {
                const timeA = a.created_at?.toMillis ? a.created_at.toMillis() : new Date(a.created_at || a.payment_date || 0).getTime();
                const timeB = b.created_at?.toMillis ? b.created_at.toMillis() : new Date(b.created_at || b.payment_date || 0).getTime();
                return timeB - timeA;
            },
        });
    } catch (error) {
        console.error('Error getting employee salary payments:', error);
        return [];
    }
};

export const updateSalaryPayment = async (id, updatedData) => {
    try {
        if (isSupabaseBackend) {
            await callRpc('payroll_operation', {
                operation: 'update',
                payment_id: id,
                payload: toPayrollPayload(updatedData),
            });
            return { success: true };
        }
        const ref = doc(db, 'salary_payments', id);
        const baseSalary = Number(updatedData.base_salary) || 0;
        const commissionAmount = Number(updatedData.commission_amount) || 0;
        const allowances = Number(updatedData.allowances) || 0;
        const bonus = Number(updatedData.bonus) || 0;
        const deductions = Number(updatedData.deductions) || 0;
        const taxDeducted = Number(updatedData.tax_deducted) || 0;
        const netSalary = baseSalary + commissionAmount + allowances + bonus - (deductions + taxDeducted);

        await updateDoc(ref, {
            ...updatedData,
            base_salary: baseSalary,
            commission_amount: commissionAmount,
            allowances,
            bonus,
            deductions,
            tax_deducted: taxDeducted,
            net_salary: netSalary,
            updated_at: serverTimestamp(),
        });
        return { success: true };
    } catch (error) {
        console.error('Error updating salary payment:', error);
        return { success: false, error };
    }
};

export const deleteSalaryPaymentDoc = async (id) => {
    try {
        if (isSupabaseBackend) {
            await callRpc('payroll_operation', { operation: 'delete', payment_id: id, payload: {} });
            return { success: true };
        }
        await deleteDoc(doc(db, 'salary_payments', id));
        return { success: true };
    } catch (error) {
        console.error('Error deleting salary payment:', error);
        return { success: false, error };
    }
};
