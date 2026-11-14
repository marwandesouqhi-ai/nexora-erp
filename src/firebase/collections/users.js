import { callFunction } from '@/api/functions';
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
    return callFunction('createManagedUser', payload);
};

export const updateUser = async (id, data) => {
    const payload = withTenant(data);
    await callFunction('updateManagedUser', { id, ...payload });
};

export const deleteUserDoc = async (id) => {
    await callFunction('deleteManagedUser', { id });
};
