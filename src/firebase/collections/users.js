import { functions } from '@/api/firebase';
import { httpsCallable } from 'firebase/functions';
import { fetchTenantDocs, withTenant } from '@/lib/tenantFirestore';

export const getUsers = async (companyId = null) => {
    return await fetchTenantDocs('users', {
        companyId,
        sortFn: (a, b) => {
            const dateA = a.created_at?.toDate?.()?.getTime?.() || 0;
            const dateB = b.created_at?.toDate?.()?.getTime?.() || 0;
            return dateB - dateA;
        },
    });
};

export const addUser = async (data) => {
    const payload = withTenant(data);
    return httpsCallable(functions, 'createManagedUser')(payload);
};

export const updateUser = async (id, data) => {
    const payload = withTenant(data);
    await httpsCallable(functions, 'updateManagedUser')({ id, ...payload });
};

export const deleteUserDoc = async (id) => {
    await httpsCallable(functions, 'deleteManagedUser')({ id });
};
