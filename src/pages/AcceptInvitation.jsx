import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { signInWithCustomToken } from 'firebase/auth';
import { auth } from '@/api/firebase';
import { isSupabaseBackend } from '@/api/backend';
import { signInWithPassword, recordAuthenticationEvent } from '@/lib/authService';
import { acceptInvitation, verifyInvitation } from '@/services/invitationService';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, Loader2, LockKeyhole, ShieldCheck } from 'lucide-react';

export default function AcceptInvitation() {
    const [params] = useSearchParams();
    const navigate = useNavigate();
    const token = params.get('token') || '';
    const [invite, setInvite] = useState(null);
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(Boolean(token));
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        let mounted = true;
        if (!token) {
            return undefined;
        }
        verifyInvitation(token)
            .then((data) => mounted && setInvite(data))
            .catch((err) => mounted && setError(err?.message || 'هذه الدعوة غير صالحة أو انتهت.'))
            .finally(() => mounted && setLoading(false));
        return () => { mounted = false; };
    }, [token]);

    const submit = async (event) => {
        event.preventDefault();
        setError('');
        if (password.length < 8) return setError('كلمة المرور يجب أن تتكون من 8 أحرف على الأقل.');
        if (password !== confirmPassword) return setError('تأكيد كلمة المرور غير مطابق.');
        setSubmitting(true);
        try {
            const result = await acceptInvitation(token, password);
            if (isSupabaseBackend) {
                await signInWithPassword(result.email || invite.email, password);
            } else {
                await signInWithCustomToken(auth, result.custom_token);
            }
            await recordAuthenticationEvent('login');
            navigate('/', { replace: true });
        } catch (err) {
            setError(err?.message || 'تعذر قبول الدعوة. حاول مرة أخرى.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-white via-[#F6F8FC] to-[#EEEAFE] p-4 dark:from-[#0E1729] dark:via-[#0E1729] dark:to-[#0E1729]" dir="rtl">
            <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-[#4F6FE5]/15 blur-3xl dark:bg-[#4F6FE5]/10" />
            <div className="pointer-events-none absolute -bottom-24 -left-24 h-80 w-80 rounded-full bg-[#7C5CE6]/15 blur-3xl dark:bg-[#7C5CE6]/10" />
            <Card className="relative w-full max-w-lg rounded-3xl border-border p-2 shadow-float">
                <CardHeader className="text-center">
                    <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/25"><ShieldCheck /></div>
                    <CardTitle className="text-2xl font-extrabold text-foreground">انضم إلى NEXORA ERP</CardTitle>
                    <CardDescription>أكمل إعداد حسابك من خلال دعوة آمنة لمرة واحدة.</CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? <div className="flex justify-center p-10"><Loader2 className="animate-spin text-primary" /></div> : (error || !token) && !invite ? (
                        <Alert variant="destructive"><AlertDescription>{error || 'رابط الدعوة غير مكتمل.'}</AlertDescription></Alert>
                    ) : invite ? (
                        <form className="space-y-5" onSubmit={submit}>
                            <div className="rounded-xl border border-border bg-card-muted p-4 text-sm">
                                <p className="font-bold">{invite.organization_name}</p>
                                <p className="mt-1 text-muted-foreground">{invite.email}{invite.job_title ? ` · ${invite.job_title}` : ''}</p>
                            </div>
                            {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
                            <label className="block space-y-2 text-sm font-medium">كلمة المرور
                                <div className="relative"><LockKeyhole className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pr-10" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
                            </label>
                            <label className="block space-y-2 text-sm font-medium">تأكيد كلمة المرور
                                <Input type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
                            </label>
                            <p className="text-xs text-muted-foreground">باستمرارك، يتم تأكيد استخدامك لرابط الدعوة الآمن المرسل إلى بريدك. لا يمكنك تعديل الدور أو الصلاحيات المعيّنة.</p>
                            <Button className="w-full" disabled={submitting}>{submitting ? <Loader2 className="animate-spin" /> : <CheckCircle2 />} قبول الدعوة وإنشاء الحساب</Button>
                        </form>
                    ) : null}
                </CardContent>
            </Card>
        </main>
    );
}
