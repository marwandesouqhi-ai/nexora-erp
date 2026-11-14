import { Navigate, useLocation } from 'react-router-dom';
import { signOutUser } from '@/lib/authService';
import { useAuth } from '@/lib/AuthContext';
import { useTenant } from '@/lib/TenantContext';
import { Loader2 } from 'lucide-react';

/**
 * حماية الصفحات والمسارات بناءً على:
 * 1. تسجيل الدخول (Authentication)
 */
export default function ProtectedRoute({ children }) {
    const { user, loading: authLoading } = useAuth();
    const { loading: tenantLoading } = useTenant();
    const location = useLocation();

    if (authLoading || tenantLoading) {
        return (
            <div
                className="flex h-screen w-full items-center justify-center bg-card-muted "
                role="status"
                aria-live="polite"
            >
                <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
                <span className="sr-only">جاري التحقق من الجلسة...</span>
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/login" replace state={{ from: location }} />;
    }

    // Do not leave a previously-issued browser session usable after an admin
    // suspends its Firestore profile. The Cloud Function also disables the Auth
    // account; this guards the UI during token/session propagation.
    if (user.status === 'suspended' || user.status === 'inactive' || user.is_active === false) {
        void signOutUser();
        return <Navigate to="/login" replace state={{ accountDisabled: true }} />;
    }

    return children ?? null;
}
