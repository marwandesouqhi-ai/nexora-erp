import { db } from '../firebaseConfig';
import { collection, addDoc, doc, updateDoc, deleteDoc, serverTimestamp } from "@/data/firestoreCompat";
import { fetchTenantDocs, withTenant } from '@/lib/tenantFirestore';

export const addNewEmployee = async (employeeData) => {
    try {
        const payload = withTenant({
            name: employeeData.name || '',
            email: employeeData.email || '',
            role: employeeData.role || 'sales_rep',
            phone: employeeData.phone || '',
            national_id: employeeData.national_id || '',
            base_salary: Number(employeeData.base_salary) || 0,
            commission_rate: Number(employeeData.commission_rate) || 0,
            allowances: Number(employeeData.allowances) || 0,
            current_balance: Number(employeeData.current_balance) || 0,
            status: employeeData.status || 'active',
            join_date: employeeData.join_date || '',
            resignation_date: employeeData.resignation_date || '',
            emergency_contact: employeeData.emergency_contact || '',
            bank_account: employeeData.bank_account || '',
            notes: employeeData.notes || '',
            created_at: serverTimestamp(),
        });
        const ref = await addDoc(collection(db, 'employees'), payload);
        return { success: true, id: ref.id };
    } catch (error) {
        console.error('Error adding employee:', error);
        return { success: false, error };
    }
};

export const getEmployees = async (companyId = null) => {
    try {
        return await fetchTenantDocs('employees', {
            companyId,
            sortFn: (a, b) => (a.name || '').localeCompare(b.name || ''),
        });
    } catch (error) {
        console.error('Error getting employees:', error);
        return [];
    }
};

export const updateEmployee = async (id, updatedData) => {
    try {
        const ref = doc(db, 'employees', id);
        await updateDoc(ref, {
            ...updatedData,
            base_salary: Number(updatedData.base_salary) || 0,
            commission_rate: Number(updatedData.commission_rate) || 0,
            allowances: Number(updatedData.allowances) || 0,
            current_balance: Number(updatedData.current_balance) || 0,
            updated_at: serverTimestamp(),
        });
        return { success: true };
    } catch (error) {
        console.error('Error updating employee:', error);
        return { success: false, error };
    }
};

export const deleteEmployeeDoc = async (id) => {
    try {
        await deleteDoc(doc(db, 'employees', id));
        return { success: true };
    } catch (error) {
        console.error('Error deleting employee:', error);
        return { success: false, error };
    }
};
