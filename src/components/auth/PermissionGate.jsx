import { Navigate, useLocation } from 'react-router-dom';
import { useRole } from '@/lib/RoleContext';
import { useToast } from '@/components/ui/use-toast';
import { useEffect } from 'react';

/**
 * مكون غلاف يحمي المسارات بناءً على الصلاحيات
 * @param {Object} props
 * @param {string|string[]} props.permission - الصلاحية المطلوبة، يمكن أن تكون سلسلة نصية أو مصفوفة من الصلاحيات (أي منها يكفي)
 * @param {React.ReactNode} props.children - المكونات التي سيتم عرضها في حال توفر الصلاحية
 */
export default function PermissionGate({ permission, children }) {
    const { can, isSuperAdmin } = useRole();
    const { toast } = useToast();
    const location = useLocation();

    // السوبر أدمن لديه وصول كامل، وعدم وجود صلاحية مطلوبة = وصول مسموح
    let hasAccess = true;
    if (!isSuperAdmin && permission) {
        hasAccess = Array.isArray(permission)
            ? permission.some((p) => can(p))
            : can(permission);
    }

    useEffect(() => {
        if (!hasAccess) {
            toast({
                title: 'صلاحيات غير كافية',
                description: 'عذراً، ليس لديك الصلاحية للوصول إلى هذه الصفحة.',
                variant: 'destructive',
                duration: 3000,
            });
        }
    }, [hasAccess, toast]);

    if (!hasAccess) {
        return <Navigate to="/" replace state={{ from: location }} />;
    }

    return children;
}
