import { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Bell, CalendarDays, Clock, LayoutDashboard, LogOut, Moon, Sun } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { getNotifications, markNotificationRead } from '../services/notificationsService';
import type { Notification, UserRole } from '../types';
import { findActive, roleLabel, type NavItem } from '../lib/navigation';
import { cn } from './page';

const GHOST_ROUND =
    'inline-flex h-9 w-9 items-center justify-center rounded-full text-secondary-text transition-colors hover:bg-card-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary';

/**
 * الشريط العلوي — نفس تصميم nexora-erp (بدون Sidebar).
 * items = الصفحات المسموح بها (بعد فلترة الأدوار)، تظهر في شريط التبويبات أسفله.
 */
export function TopBar({
    items,
    role,
    subtitle,
    groupLabel,
    showNotifications = true,
}: {
    items: NavItem[];
    role: string;
    subtitle: string;
    groupLabel: string;
    showNotifications?: boolean;
}) {
    const { user, logout } = useAuth();
    const { isDark, toggleTheme } = useTheme();
    const location = useLocation();
    const [now, setNow] = useState(() => new Date());

    useEffect(() => {
        const t = setInterval(() => setNow(new Date()), 30000);
        return () => clearInterval(t);
    }, []);

    const active = findActive(items, location.pathname);
    const PageIcon = active?.icon || LayoutDashboard;
    const displayName = user?.email?.split('@')[0] || 'مستخدم';

    return (
        <>
            <header className="sticky top-0 z-30 grid h-16 shrink-0 grid-cols-[1fr_auto] items-center gap-3 border-b border-border bg-card px-4 lg:grid-cols-[1fr_auto_1fr]">
                {/* Right: brand + current page */}
                <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-sm">
                        <span className="text-base font-extrabold text-white">N</span>
                    </div>
                    <div className="hidden flex-col leading-tight sm:flex">
                        <span className="text-sm font-extrabold text-foreground">Nexora ERP</span>
                        <span className="text-[10px] text-muted-foreground">{subtitle}</span>
                    </div>
                    <div className="hidden h-6 w-px bg-border lg:block" />
                    <span className="hidden h-9 items-center gap-2 rounded-full border border-primary/20 bg-primary-soft px-3.5 text-xs font-bold text-primary lg:inline-flex">
                        <PageIcon className="h-4 w-4" />
                        <span className="max-w-[180px] truncate">{active?.name || groupLabel}</span>
                        <span className="relative flex h-1.5 w-1.5">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
                            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
                        </span>
                    </span>
                </div>

                {/* Center: date / time */}
                <div className="hidden items-center gap-3 text-xs text-muted-foreground lg:flex">
                    <span className="inline-flex items-center gap-1.5">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {now.toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </span>
                    <span className="h-4 w-px bg-border" />
                    <span className="inline-flex items-center gap-1.5 tabular-nums">
                        <Clock className="h-3.5 w-3.5" />
                        {now.toLocaleTimeString('ar-EG', { hour: 'numeric', minute: '2-digit' })}
                    </span>
                </div>

                {/* Left: theme, bell, user, logout */}
                <div className="flex items-center justify-end gap-1.5">
                    <button
                        type="button"
                        onClick={toggleTheme}
                        className={GHOST_ROUND}
                        aria-label={isDark ? 'التبديل للوضع الفاتح' : 'التبديل للوضع الداكن'}
                        title={isDark ? 'الوضع الفاتح' : 'الوضع الداكن'}
                    >
                        {isDark ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
                    </button>

                    {showNotifications ? <NotificationsMenu role={role} /> : null}

                    <div className="flex h-10 items-center gap-2 rounded-full border border-border bg-card-muted p-1 sm:pe-3">
                        <div className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600">
                            <span className="text-xs font-extrabold text-white">{displayName.charAt(0).toUpperCase()}</span>
                        </div>
                        <div className="hidden flex-col leading-tight sm:flex">
                            <span className="max-w-[140px] truncate text-xs font-bold text-foreground">{displayName}</span>
                            <span className="text-[10px] text-muted-foreground">{roleLabel(role)}</span>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={logout}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-danger-soft hover:text-danger focus:outline-none focus-visible:ring-2 focus-visible:ring-danger"
                        title="تسجيل الخروج"
                        aria-label="تسجيل الخروج"
                    >
                        <LogOut className="h-4 w-4" />
                    </button>
                </div>
            </header>

            <PageTabs items={items} label={groupLabel} />
        </>
    );
}

/** شريط الصفحات أسفل الـ TopBar — نفس GroupTabs في nexora-erp */
function PageTabs({ items, label }: { items: NavItem[]; label: string }) {
    if (!items.length) return null;
    return (
        <nav aria-label={label} className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-card px-4 lg:px-6">
            <div className="flex shrink-0 items-center gap-2">
                <span className="flex h-[26px] w-[26px] items-center justify-center rounded-lg bg-indigo-100 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-400">
                    <LayoutDashboard className="h-[15px] w-[15px]" />
                </span>
                <span className="hidden text-[13px] font-bold text-foreground sm:inline">{label}</span>
            </div>
            <div className="no-scrollbar flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto">
                {items.map((item) => (
                    <NavLink
                        key={item.href}
                        to={item.href}
                        end={item.end}
                        className={({ isActive }) =>
                            cn(
                                'inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                                isActive ? 'bg-primary text-white shadow-sm shadow-primary/30' : 'text-secondary-text hover:bg-card-muted hover:text-foreground'
                            )
                        }
                    >
                        <item.icon className="h-[15px] w-[15px]" />
                        {item.name}
                    </NavLink>
                ))}
            </div>
            <span className="hidden shrink-0 text-[11px] text-muted-foreground sm:inline">{items.length} صفحات</span>
        </nav>
    );
}

/** نفس منطق الإشعارات اللي كان في Header.tsx */
function NotificationsMenu({ role }: { role: string }) {
    const { user } = useAuth();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (user?.email && role) {
            getNotifications(user.email, role as UserRole).then(setNotifications);
        }
    }, [user, role]);

    useEffect(() => {
        if (!open) return;
        const onDown = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
        document.addEventListener('mousedown', onDown);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onDown);
            document.removeEventListener('keydown', onKey);
        };
    }, [open]);

    const unreadCount = notifications.filter((n) => !n.read).length;

    const handleRead = async (id: string) => {
        await markNotificationRead(id);
        setNotifications(notifications.map((n) => (n.id === id ? { ...n, read: true } : n)));
    };

    return (
        <div className="relative" ref={ref}>
            <button
                type="button"
                onClick={() => setOpen(!open)}
                className={cn(GHOST_ROUND, 'relative')}
                aria-label={unreadCount ? `${unreadCount} إشعارات جديدة` : 'الإشعارات'}
                aria-expanded={open}
            >
                <Bell className="h-[18px] w-[18px]" />
                {unreadCount > 0 && (
                    <span className="absolute right-1.5 top-1.5 flex h-2.5 w-2.5">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-danger opacity-60" />
                        <span className="relative inline-flex h-2.5 w-2.5 rounded-full border-2 border-card bg-danger" />
                    </span>
                )}
            </button>

            {open && (
                <div className="absolute left-0 z-50 mt-2 w-80 animate-pop-in overflow-hidden rounded-2xl border border-border bg-card shadow-float">
                    <div className="flex items-center justify-between border-b border-border bg-card-muted px-4 py-3">
                        <span className="text-sm font-bold text-foreground">الإشعارات</span>
                        <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-white">{unreadCount} جديد</span>
                    </div>
                    <div className="max-h-80 divide-y divide-border overflow-y-auto">
                        {notifications.length === 0 ? (
                            <div className="p-6 text-center text-[13px] text-muted-foreground">لا توجد إشعارات حالياً</div>
                        ) : (
                            notifications.map((n) => (
                                <button
                                    type="button"
                                    key={n.id}
                                    onClick={() => handleRead(n.id)}
                                    className={cn('block w-full p-3 text-start transition-colors hover:bg-card-muted', !n.read && 'bg-primary-soft/60')}
                                >
                                    <div className="text-[13px] font-semibold text-foreground">{n.title}</div>
                                    <div className="mt-1 text-xs text-secondary-text">{n.message}</div>
                                    <div className="mt-1 text-[10px] text-muted-foreground">
                                        {format(new Date(n.created_at), 'dd MMM yyyy - hh:mm a', { locale: ar })}
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
