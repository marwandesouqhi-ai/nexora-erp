/**
 * إدارة وتتبع معرف الشركة النشطة (Active Tenant Company ID)
 * يدعم المزامنة اللحظية والتخزين المحلي والتنبيه عند التغيير
 */

let inMemoryCompanyId = null;
const listeners = new Set();

export const subscribeToCompanyChange = (callback) => {
    listeners.add(callback);
    return () => listeners.delete(callback);
};

export const setActiveCompanyId = (companyId) => {
    const nextId = companyId ? String(companyId).trim() : '';
    if (inMemoryCompanyId !== nextId) {
        inMemoryCompanyId = nextId;
        try {
            if (nextId) {
                localStorage.setItem('nexora_active_company_id', nextId);
            } else {
                localStorage.removeItem('nexora_active_company_id');
            }
        } catch {
            // تجاهل أخطاء التخزين المحلي في البيئات المقيدة
        }
        listeners.forEach((cb) => {
            try {
                cb(nextId);
            } catch (err) {
                console.error('[currentTenant] Listener error:', err);
            }
        });
    }
};

export const getActiveCompanyId = () => {
    if (inMemoryCompanyId) return inMemoryCompanyId;
    try {
        const stored = localStorage.getItem('nexora_active_company_id');
        if (stored) {
            inMemoryCompanyId = stored;
            return stored;
        }
    } catch {
        // ignore
    }
    return '';
};
