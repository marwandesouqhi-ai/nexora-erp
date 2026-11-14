import { fetchTenantDocs } from '@/lib/tenantFirestore';

export const getInventoryMovements = async (limitCount = 100, companyId = null) => {
    try {
        const items = await fetchTenantDocs('inventory_movements', {
            companyId,
            sortFn: (a, b) => {
                const timeA = a.created_at?.toMillis ? a.created_at.toMillis() : new Date(a.created_at || 0).getTime();
                const timeB = b.created_at?.toMillis ? b.created_at.toMillis() : new Date(b.created_at || 0).getTime();
                return timeB - timeA;
            },
        });
        return items.slice(0, limitCount);
    } catch (error) {
        console.error("Error getting inventory movements: ", error);
        return [];
    }
};