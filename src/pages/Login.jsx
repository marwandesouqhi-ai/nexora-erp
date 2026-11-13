import { useState } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth, firebaseConfigValid, functions } from '@/api/firebase';
import { httpsCallable } from 'firebase/functions';
import { useAuth } from '@/lib/AuthContext';
import { logActivity } from '@/lib/activityLogger';
import { getClientDevice, getClientIp } from '@/lib/clientIp';
import { LogIn, Store, ShieldCheck, Eye, EyeOff, Loader2 } from 'lucide-react';

export default function Login() {
    const { user, loading: authLoading } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    // لو المستخدم مسجل دخول بالفعل، رجّعه للصفحة اللي كان رايحلها
    if (!authLoading && user) {
        const from = location.state?.from?.pathname || '/';
        return <Navigate to={from} replace />;
    }

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSubmitting(true);
        try {
            if (!firebaseConfigValid) {
                setError('إعدادات Firebase غير مكتملة. تأكد من ضبط متغيرات البيئة VITE_FIREBASE_ في .env');
                return;
            }

            const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
            await httpsCallable(functions, 'recordAuthenticationEvent')({ action: 'login' });
            await logActivity({
                user: credential.user,
                action: 'login',
                entity_type: 'authentication',
                details: 'تسجيل دخول ناجح إلى النظام',
                ip_address: await getClientIp(),
                device: getClientDevice(),
            });
            navigate(location.state?.from?.pathname || '/', { replace: true });
        } catch (err) {
            console.error('خطأ تسجيل الدخول:', err);
            switch (err?.code) {
                case 'auth/invalid-credential':
                case 'auth/wrong-password':
                case 'auth/user-not-found':
                    setError('البريد الإلكتروني أو كلمة المرور غير صحيحة.');
                    break;
                case 'auth/invalid-email':
                    setError('صيغة البريد الإلكتروني غير صحيحة.');
                    break;
                case 'auth/too-many-requests':
                    setError('محاولات كتيرة جدًا، حاول تاني بعد شوية.');
                    break;
                default:
                    setError('حصل خطأ أثناء تسجيل الدخول، تحقق من إعدادات Firebase ومفتاح الـ API.');
            }
        } finally {
            setSubmitting(false);
        }
    };

    const fieldClass =
        'h-12 w-full rounded-xl border-0 bg-input px-4 text-right text-sm text-foreground outline-none transition-shadow placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/40';

    return (
        <div
            className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-white via-[#F6F8FC] to-[#EEEAFE] px-4 py-10 dark:from-[#0E1729] dark:via-[#0E1729] dark:to-[#0E1729]"
            dir="rtl"
        >
            {/* blooms */}
            <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-[#4F6FE5]/15 blur-3xl dark:bg-[#4F6FE5]/10" />
            <div className="pointer-events-none absolute -bottom-24 -left-24 h-80 w-80 rounded-full bg-[#7C5CE6]/15 blur-3xl dark:bg-[#7C5CE6]/10" />
            <div className="pointer-events-none absolute -left-16 top-10 h-56 w-56 rounded-full bg-[#4F6FE5]/10 blur-3xl dark:bg-[#4F6FE5]/[0.06]" />

            <div className="relative flex w-full max-w-[445px] animate-fade-slide-up flex-col items-center rounded-3xl border border-border bg-card p-8 shadow-float">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/25">
                    <Store className="h-8 w-8 text-white" aria-hidden="true" />
                </div>
                <h1 className="mt-4 text-2xl font-extrabold text-foreground">Nexora ERP</h1>
                <p className="mt-1 text-center text-[12.5px] text-muted-foreground">
                    منصة موحدة لإدارة شركات التوزيع و التصنيع
                </p>

                <form onSubmit={handleSubmit} className="mt-6 flex w-full flex-col gap-4">
                    <div className="flex h-11 items-center justify-center gap-2 rounded-xl border border-success/25 bg-success-soft text-[12.5px] font-semibold text-success">
                        <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                        الوصول الآمن عبر حسابك الداخلي
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label htmlFor="login-email" className="text-right text-[12.5px] font-semibold text-foreground">
                            البريد الإلكتروني
                        </label>
                        <input
                            id="login-email"
                            type="email"
                            autoComplete="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className={fieldClass}
                        />
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label htmlFor="login-password" className="text-right text-[12.5px] font-semibold text-foreground">
                            كلمة المرور
                        </label>
                        <div className="relative">
                            <input
                                id="login-password"
                                type={showPassword ? 'text' : 'password'}
                                autoComplete="current-password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                className={`${fieldClass} pl-12`}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword((v) => !v)}
                                aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                                className="absolute left-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                            >
                                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                        </div>
                    </div>

                    {error && (
                        <p className="rounded-xl border border-danger/25 bg-danger-soft px-3 py-2 text-[12.5px] font-medium text-danger" role="alert">
                            {error}
                        </p>
                    )}

                    <button
                        type="submit"
                        disabled={submitting}
                        className="mt-1 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-bold text-white shadow-sm shadow-primary/30 transition-colors hover:bg-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-card disabled:cursor-not-allowed disabled:opacity-70"
                    >
                        {submitting ? (
                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                        ) : (
                            <LogIn className="h-4 w-4 -scale-x-100" aria-hidden="true" />
                        )}
                        تسجيل الدخول
                    </button>
                </form>
            </div>
        </div>
    );
}
