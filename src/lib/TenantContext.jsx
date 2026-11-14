/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { db } from '../api/firebase';
import { doc, onSnapshot } from '@/data/firestoreCompat';
import { setActiveCompanyId, getActiveCompanyId } from './currentTenant';
import { setCompanyAdminWhatsapp } from '@/utils/whatsapp';

const TenantContext = createContext();

export const TenantProvider = ({ children }) => {
    const { user, loading: authLoading } = useAuth();
    const [tenant, setTenant] = useState(null);
    const [loading, setLoading] = useState(true);

    const activeCompanyId = user?.company_id || getActiveCompanyId();

    useEffect(() => {
        if (authLoading) return;

        if (!activeCompanyId) {
            setTenant(null);
            setLoading(false);
            return;
        }

        // مزامنة المعرف النشط
        setActiveCompanyId(activeCompanyId);

        // الاستماع المباشر (Realtime) لتغييرات مستند الشركة في Firestore
        const companyDocRef = doc(db, 'companies', activeCompanyId);
        const unsubscribe = onSnapshot(
            companyDocRef,
            (docSnap) => {
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setCompanyAdminWhatsapp(data.admin_whatsapp || '');
                    setTenant({ id: docSnap.id, ...data });
                } else {
                    setCompanyAdminWhatsapp('');
                    // في حال لم يتم العثور على مستند الشركة، نوفر قيماً افتراضية لضمان عدم توقف العمل المفاجئ
                    setTenant({
                        id: activeCompanyId,
                        name: user.company_name || 'شركتي',
                        status: 'active',
                    });
                }
                setLoading(false);
            },
            (error) => {
                console.error('Error listening to tenant updates:', error);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [authLoading, activeCompanyId, user]);


    const value = {
        tenant,
        loading: authLoading || loading,
    };

    return (
        <TenantContext.Provider value={value}>
            {children}
        </TenantContext.Provider>
    );
};

export const useTenant = () => {
    const context = useContext(TenantContext);
    if (context === undefined) {
        throw new Error('useTenant must be used within a TenantProvider');
    }
    return context;
};

