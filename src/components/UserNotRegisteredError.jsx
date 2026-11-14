import { ShieldAlert, LogOut, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getCurrentAuthUser, signOutUser } from '@/lib/authService';
import { logActivity } from '@/lib/activityLogger';
import { getClientDevice, getClientIp } from '@/lib/clientIp';

/**
 * تُعرض عندما يكون المستخدم مسجّل دخول في Firebase Auth
 * لكن لا يوجد له سجل صلاحيات (role) في قاعدة البيانات.
 */
export default function UserNotRegisteredError({ email }) {
    const handleLogout = async () => {
        try {
            await logActivity({
                user: await getCurrentAuthUser(),
                action: 'logout',
                entity_type: 'authentication',
                details: 'تسجيل خروج من شاشة الحساب غير المفعّل',
                ip_address: await getClientIp(),
                device: getClientDevice(),
            });
            await signOutUser();
        } catch (err) {
            console.error('فشل تسجيل الخروج:', err);
        }
    };

    return (
        <div
            className="flex min-h-screen flex-col items-center justify-center gap-4 bg-card-muted px-6 text-center "
            role="alert"
        >
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100 dark:bg-amber-500/10">
                <ShieldAlert className="h-8 w-8 text-amber-600 dark:text-amber-400" aria-hidden="true" />
            </div>

            <h1 className="text-xl font-black text-foreground ">
                حسابك غير مُفعّل بعد
            </h1>

            <p className="max-w-sm text-sm font-medium text-muted-foreground ">
                {email
                    ? `الحساب (${email}) مسجّل دخول بنجاح لكن لا توجد له صلاحيات معرّفة في النظام.`
                    : 'هذا الحساب مسجّل دخول بنجاح لكن لا توجد له صلاحيات معرّفة في النظام.'}
                {' '}تواصل مع مدير النظام لإضافة صلاحياتك.
            </p>

            <div className="mt-2 flex items-center gap-3">
                <Button variant="outline" onClick={() => window.location.reload()} className="gap-2">
                    <RefreshCw className="h-4 w-4" />
                    إعادة المحاولة
                </Button>
                <Button variant="ghost" onClick={handleLogout} className="gap-2 text-red-600 dark:text-red-400 hover:bg-red-500/10 hover:text-red-700">
                    <LogOut className="h-4 w-4" />
                    تسجيل الخروج
                </Button>
            </div>
        </div>
    );
}