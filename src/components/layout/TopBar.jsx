import { useState, useEffect, useCallback, memo } from 'react';
import { useLocation } from 'react-router-dom';
import {
    LogOut, Clock, CalendarDays, Loader2, Building2, LayoutGrid, Moon, Sun, LayoutDashboard,
} from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { useRole } from '@/lib/RoleContext';
import { useTheme } from '@/lib/ThemeContext';
import { recordAuthenticationEvent, signOutUser } from '@/lib/authService';
import { useToast } from '@/components/ui/use-toast';
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
    AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import NotificationBell from './NotificationBell';
import { logActivity } from '@/lib/activityLogger';
import { getClientDevice, getClientIp } from '@/lib/clientIp';
import { findNavContext, getDisplayName, ROLE_LABELS } from '@/lib/navigation';
import { cn } from '@/lib/utils';

const NEUTRAL_PILL =
    'inline-flex h-9 items-center gap-2 rounded-full border border-border bg-card-muted px-3.5 text-xs font-semibold text-secondary-text';
const GHOST_ROUND =
    'inline-flex h-9 w-9 items-center justify-center rounded-full text-secondary-text transition-colors hover:bg-card-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary';

function TopBar({ onPortalToggle }) {
    const { user } = useAuth();
    const { role } = useRole();
    const { isDark, toggleTheme } = useTheme() || {};
    const { toast } = useToast();
    const location = useLocation();
    const [now, setNow] = useState(() => new Date());
    const [loggingOut, setLoggingOut] = useState(false);
    const [showLogoutDialog, setShowLogoutDialog] = useState(false);

    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 30000);
        return () => clearInterval(timer);
    }, []);

    const displayName = getDisplayName(user);
    const ctx = findNavContext(location.pathname);
    const PageIcon = ctx?.item?.icon || LayoutDashboard;
    const pageTitle = ctx?.item?.label || 'لوحة التحكم';

    const dateLabel = now.toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' });
    const timeLabel = now.toLocaleTimeString('ar-EG', { hour: 'numeric', minute: '2-digit' });

    const handleLogout = useCallback(async () => {
        if (loggingOut) return;
        setLoggingOut(true);
        try {
            await recordAuthenticationEvent('logout');
            await logActivity({
                user,
                action: 'logout',
                entity_type: 'authentication',
                details: 'تسجيل خروج من النظام',
                ip_address: await getClientIp(),
                device: getClientDevice(),
            });
            await signOutUser();
        } catch (err) {
            console.error('Logout failed:', err);
            toast({
                title: 'تعذر تسجيل الخروج',
                description: 'حاول مرة أخرى خلال لحظات.',
                variant: 'destructive',
            });
            setLoggingOut(false);
        }
    }, [loggingOut, toast, user]);

    return (
        <header className="sticky top-0 z-30 grid h-16 flex-shrink-0 grid-cols-[1fr_auto] items-center gap-3 border-b border-border bg-card px-4 lg:grid-cols-[1fr_auto_1fr]">
            {/* ── Right (start): brand + pills ─────────────────────────────── */}
            <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-sm">
                    <span className="text-base font-extrabold text-white">N</span>
                </div>
                <div className="hidden flex-col leading-tight lg:flex">
                    <span className="text-sm font-extrabold text-foreground">Nexora ERP</span>
                    <span className="text-[10px] text-muted-foreground">الجيل الذكي</span>
                </div>

                <div className="hidden h-6 w-px bg-border lg:block" />

                <button
                    type="button"
                    onClick={onPortalToggle}
                    className={cn(NEUTRAL_PILL, 'transition-colors hover:border-border-strong hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary')}
                    aria-label="فتح بوابة الموديولات"
                    aria-keyshortcuts="Control+K"
                >
                    <LayoutGrid className="h-4 w-4" aria-hidden="true" />
                    <span>التطبيقات</span>
                    <kbd className="hidden rounded border border-border bg-background px-1.5 font-sans text-[10px] font-semibold text-muted-foreground sm:inline" dir="ltr">
                        Ctrl K
                    </kbd>
                </button>

                <span className="hidden h-9 items-center gap-2 rounded-full border border-primary/20 bg-primary-soft px-3.5 text-xs font-bold text-primary lg:inline-flex">
                    <PageIcon className="h-4 w-4" aria-hidden="true" />
                    <span className="max-w-[180px] truncate">{pageTitle}</span>
                    <span className="relative flex h-1.5 w-1.5">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
                        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
                    </span>
                </span>

                <span className={cn(NEUTRAL_PILL, 'hidden xl:inline-flex')}>
                    <Building2 className="h-4 w-4" aria-hidden="true" />
                    نظام الإدارة
                </span>
            </div>

            {/* ── Center: date / time ─────────────────────────────────────── */}
            <div className="hidden items-center gap-3 text-xs text-muted-foreground lg:flex">
                <span className="inline-flex items-center gap-1.5">
                    <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                    {dateLabel}
                </span>
                <span className="h-4 w-px bg-border" />
                <span className="inline-flex items-center gap-1.5 tabular-nums">
                    <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                    {timeLabel}
                </span>
            </div>

            {/* ── Left (end): theme, bell, user, logout ───────────────────── */}
            <div className="flex items-center justify-end gap-1.5">
                <button
                    type="button"
                    onClick={toggleTheme}
                    className={cn(GHOST_ROUND, 'hidden lg:inline-flex')}
                    aria-label={isDark ? 'التبديل للوضع الفاتح' : 'التبديل للوضع الداكن'}
                    title={isDark ? 'الوضع الفاتح' : 'الوضع الداكن'}
                >
                    {isDark ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
                </button>

                <div className="hidden lg:block">
                    <NotificationBell />
                </div>

                <div className="flex h-10 items-center gap-2 rounded-full border border-border bg-card-muted p-1 lg:pe-3">
                    <div className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600">
                        <span className="text-xs font-extrabold text-white">{displayName.charAt(0).toUpperCase()}</span>
                    </div>
                    <div className="hidden flex-col leading-tight lg:flex">
                        <span className="max-w-[140px] truncate text-xs font-bold text-foreground">{displayName}</span>
                        <span className="text-[10px] text-muted-foreground">{ROLE_LABELS[role] || role}</span>
                    </div>
                </div>

                <button
                    type="button"
                    onClick={() => setShowLogoutDialog(true)}
                    disabled={loggingOut}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-danger-soft hover:text-danger focus:outline-none focus-visible:ring-2 focus-visible:ring-danger disabled:opacity-60"
                    title="تسجيل الخروج"
                    aria-label="تسجيل الخروج"
                >
                    {loggingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
                </button>

                <AlertDialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>تسجيل الخروج؟</AlertDialogTitle>
                            <AlertDialogDescription>
                                هل تريد الخروج من الجلسة الحالية؟ ستحتاج إلى تسجيل الدخول مرة أخرى للوصول إلى لوحة التحكم.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel onClick={() => setShowLogoutDialog(false)}>إلغاء</AlertDialogCancel>
                            <AlertDialogAction onClick={handleLogout} className="bg-danger text-white hover:bg-danger/90">
                                تسجيل الخروج
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </header>
    );
}

export default memo(TopBar);
