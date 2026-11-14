import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSupabase, supabaseConfigValid } from '@/api/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, Loader2, LockKeyhole, ShieldCheck } from 'lucide-react';

/**
 * Landing page of the Supabase invitation / password-reset e-mail
 * (redirectTo = <ERP>/set-password). supabase-js turns the link's token into a session
 * automatically (detectSessionInUrl); here the invited person only chooses a password.
 */
export default function SetPassword() {
    const navigate = useNavigate();
    const [checking, setChecking] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [done, setDone] = useState(false);
    const [error, setError] = useState(supabaseConfigValid ? '' : 'إعدادات الاتصال بالخادم غير مكتملة.');

    useEffect(() => {
        if (!supabaseConfigValid) return undefined;
        const sb = getSupabase();
        let active = true;

        const accept = (session) => {
            if (!active || !session) return;
            setEmail(session.user?.email || '');
            setChecking(false);
        };

        const { data: sub } = sb.auth.onAuthStateChange((_event, session) => accept(session));
        sb.auth.getSession().then(({ data }) => accept(data.session));

        // The session is created asynchronously from the link; give it a moment before giving up.
        const timer = setTimeout(() => {
            if (!active) return;
            setChecking(false);
            sb.auth.getSession().then(({ data }) => {
                if (active && !data.session) setError('رابط الدعوة غير صالح أو انتهت صلاحيته. اطلب دعوة جديدة من مدير النظام.');
            });
        }, 4000);

        return () => {
            active = false;
            clearTimeout(timer);
            sub.subscription.unsubscribe();
        };
    }, []);

    const submit = async (event) => {
        event.preventDefault();
        setError('');
        if (password.length < 8) return setError('كلمة المرور يجب أن تتكون من 8 أحرف على الأقل.');
        if (password !== confirmPassword) return setError('تأكيد كلمة المرور غير مطابق.');
        setSubmitting(true);
        try {
            const { error: updateError } = await getSupabase().auth.updateUser({ password });
            if (updateError) throw updateError;
            setDone(true);
            setTimeout(() => navigate('/', { replace: true }), 1500);
        } catch (err) {
            setError(err?.message || 'تعذر تعيين كلمة المرور. حاول مرة أخرى.');
        } finally {
            setSubmitting(false);
        }
    };

    const hasSession = Boolean(email);

    return (
        <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-white via-[#F6F8FC] to-[#EEEAFE] p-4 dark:from-[#0E1729] dark:via-[#0E1729] dark:to-[#0E1729]" dir="rtl">
            <Card className="relative w-full max-w-lg rounded-3xl border-border p-2 shadow-float">
                <CardHeader className="text-center">
                    <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/25"><ShieldCheck /></div>
                    <CardTitle className="text-2xl font-extrabold text-foreground">تعيين كلمة المرور</CardTitle>
                    <CardDescription>اختر كلمة مرور لحسابك في NEXORA ERP.</CardDescription>
                </CardHeader>
                <CardContent>
                    {checking ? (
                        <div className="flex justify-center p-10"><Loader2 className="animate-spin text-primary" /></div>
                    ) : done ? (
                        <div className="flex flex-col items-center gap-3 p-6 text-center">
                            <CheckCircle2 className="h-10 w-10 text-success" />
                            <p className="font-bold">تم تعيين كلمة المرور. جارٍ تحويلك...</p>
                        </div>
                    ) : !hasSession ? (
                        <Alert variant="destructive"><AlertDescription>{error || 'رابط الدعوة غير مكتمل.'}</AlertDescription></Alert>
                    ) : (
                        <form className="space-y-5" onSubmit={submit}>
                            <div className="rounded-xl border border-border bg-card-muted p-4 text-sm">
                                <p className="text-muted-foreground">{email}</p>
                            </div>
                            {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
                            <label className="block space-y-2 text-sm font-medium">كلمة المرور
                                <div className="relative">
                                    <LockKeyhole className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                                    <Input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className="pr-9" required />
                                </div>
                            </label>
                            <label className="block space-y-2 text-sm font-medium">تأكيد كلمة المرور
                                <Input type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
                            </label>
                            <Button type="submit" className="w-full" disabled={submitting}>
                                {submitting ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : null}
                                حفظ كلمة المرور
                            </Button>
                        </form>
                    )}
                </CardContent>
            </Card>
        </main>
    );
}
