import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Eye, EyeOff, Loader2, LogIn, ShieldCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      setError('');
      setLoading(true);
      await login(email, password);
      navigate('/');
    } catch (err: any) {
      console.error(err);
      setError('فشل تسجيل الدخول. تأكد من البريد وكلمة المرور.');
    } finally {
      setLoading(false);
    }
  };

  const fieldClass =
    'h-12 w-full rounded-xl border-0 bg-input px-4 text-left text-sm text-foreground outline-none transition-shadow placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/40';

  return (
    <div
      className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-white via-[#F6F8FC] to-[#EEEAFE] px-4 py-10 dark:from-[#0E1729] dark:via-[#0E1729] dark:to-[#0E1729]"
      dir="rtl"
    >
      <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-[#4F6FE5]/15 blur-3xl dark:bg-[#4F6FE5]/10" />
      <div className="pointer-events-none absolute -bottom-24 -left-24 h-80 w-80 rounded-full bg-[#7C5CE6]/15 blur-3xl dark:bg-[#7C5CE6]/10" />

      <div className="relative flex w-full max-w-[445px] animate-slide-up flex-col items-center rounded-3xl border border-border bg-card p-8 shadow-float">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/25">
          <Building2 className="h-8 w-8 text-white" aria-hidden="true" />
        </div>
        <h1 className="mt-4 text-2xl font-extrabold text-foreground">تسجيل الدخول للنظام</h1>
        <p className="mt-1 text-center text-[12.5px] text-muted-foreground">أدخل بياناتك للوصول إلى لوحة التحكم</p>

        <form className="mt-6 flex w-full flex-col gap-4" onSubmit={handleSubmit}>
          <div className="flex h-11 items-center justify-center gap-2 rounded-xl border border-success/25 bg-success-soft text-[12.5px] font-semibold text-success">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            الوصول الآمن عبر حسابك الداخلي
          </div>

          {error && (
            <div className="rounded-xl border border-danger/25 bg-danger-soft px-3 py-2 text-center text-[12.5px] font-medium text-danger" role="alert">
              {error}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label htmlFor="email-address" className="text-right text-[12.5px] font-semibold text-foreground">
              البريد الإلكتروني
            </label>
            <input
              id="email-address"
              name="email"
              type="email"
              autoComplete="email"
              required
              dir="ltr"
              placeholder="Email Address"
              className={fieldClass}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-right text-[12.5px] font-semibold text-foreground">
              كلمة المرور
            </label>
            <div className="relative">
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                dir="ltr"
                placeholder="Password"
                className={`${fieldClass} pr-12`}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-1 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-bold text-white shadow-sm shadow-primary/30 transition-colors hover:bg-primary-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-card disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <LogIn className="h-4 w-4 -scale-x-100" aria-hidden="true" />}
            {loading ? 'جاري التحقق...' : 'تسجيل الدخول'}
          </button>
        </form>
      </div>
    </div>
  );
}
