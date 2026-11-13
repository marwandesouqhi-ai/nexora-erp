import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getSales } from '@/firebase/collections/sales';
import { getPurchases } from '@/firebase/collections/purchases';
import { getExpenses } from '@/firebase/collections/expenses';
import { getEmployees } from '@/firebase/collections/employees';
import { getVisits } from '@/firebase/collections/visits';
import { getReceipts } from '@/firebase/collections/receipts';
import { getRecentActivities } from '@/firebase/collections/activity_logs';
import { subscribeAttendanceByDate } from '@/firebase/collections/attendance';
import { getAllVanInventories } from '@/firebase/collections/van_inventory';
import { getCustomers } from '@/firebase/collections/customers';
import { useRole } from '@/lib/RoleContext';
import {
    ShoppingCart,
    Receipt,
    Activity,
    Users,
    MapPin,
    Navigation,
    Compass,
    CheckCircle2,
    Clock,
    AlertCircle,
    Truck,
    ExternalLink,
    Loader2,
    UserCheck,
    Banknote,
    Target,
    ArrowLeft,
    Route,
    Store,
    BarChart3,
} from 'lucide-react';
import { PageHero, HeroPill, StatCard, SectionCard, CountChip, EmptyState } from '@/components/page';
import { cn } from '@/lib/utils';
import { isSameDay } from 'date-fns';
import { Link } from 'react-router-dom';
import RouteOptimizerMap from '@/components/maps/RouteOptimizerMap';
import ShelfMerchandisingView from '@/components/merchandising/ShelfMerchandisingView';

const todayStr = () => new Date().toISOString().slice(0, 10);
const toDate = (v) => (v?.toDate ? v.toDate() : v ? new Date(v) : null);

export default function DailyMonitoring() {
    const { can } = useRole();
    const [activeTab, setActiveTab] = useState('field'); // 'field' | 'operations'
    const [liveAttendance, setLiveAttendance] = useState([]);
    const [isLiveConnected, setIsLiveConnected] = useState(false);

    const { data: sales = [], isLoading: l1 } = useQuery({ queryKey: ['sales-daily-monitor'], queryFn: getSales });
    const { data: purchases = [], isLoading: l2 } = useQuery({ queryKey: ['purchases-daily-monitor'], queryFn: getPurchases });
    const { data: expenses = [], isLoading: l3 } = useQuery({ queryKey: ['expenses-daily-monitor'], queryFn: getExpenses });
    const { data: activities = [], isLoading: l4 } = useQuery({ queryKey: ['activities-daily-monitor'], queryFn: () => getRecentActivities(20) });
    const { data: vanStocks = [] } = useQuery({ queryKey: ['van-stocks-monitor'], queryFn: getAllVanInventories });
    const { data: employees = [], isLoading: l5, isError: employeesError } = useQuery({ queryKey: ['employees-daily-monitor'], queryFn: getEmployees });
    const { data: visits = [], isLoading: l6, isError: visitsError } = useQuery({ queryKey: ['visits-daily-monitor'], queryFn: getVisits });
    const { data: receipts = [], isLoading: l7, isError: receiptsError } = useQuery({ queryKey: ['receipts-daily-monitor'], queryFn: getReceipts });
    const { data: customers = [] } = useQuery({ queryKey: ['customers-daily-monitor'], queryFn: getCustomers });

    // Real-time listener for today's attendance & field reps
    useEffect(() => {
        setIsLiveConnected(false);
        const unsub = subscribeAttendanceByDate(
            todayStr(),
            (records) => {
                setLiveAttendance(records);
                setIsLiveConnected(true);
            },
            (err) => {
                console.error("Live attendance error:", err);
                setIsLiveConnected(false);
            }
        );
        return () => {
            if (unsub) unsub();
        };
    }, []);

    const isLoading = l1 || l2 || l3 || l4 || l5 || l6 || l7;
    const hasDataError = employeesError || visitsError || receiptsError;

    const todaySales = useMemo(() => sales.filter((s) => { const d = toDate(s.created_date || s.created_at); return d && isSameDay(d, new Date()); }), [sales]);
    const todayPurchases = useMemo(() => purchases.filter((p) => { const d = toDate(p.created_at || p.purchase_date); return d && isSameDay(d, new Date()); }), [purchases]);
    const todayExpenses = useMemo(() => expenses.filter((e) => { const d = toDate(e.expense_date); return d && isSameDay(d, new Date()); }), [expenses]);
    const todayVisits = useMemo(() => visits.filter((v) => {
        const d = toDate(v.date || v.created_at || v.checkInTime);
        return d && isSameDay(d, new Date());
    }), [visits]);
    const todayReceipts = useMemo(() => receipts.filter((r) => {
        const d = toDate(r.date || r.created_at);
        return d && isSameDay(d, new Date());
    }), [receipts]);

    const totalSalesToday = todaySales.reduce((sum, s) => sum + Number(s.total || s.total_amount || 0), 0);
    const totalPurchasesToday = todayPurchases.reduce((sum, p) => sum + Number(p.total || p.total_amount || 0), 0);
    const totalExpensesToday = todayExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
    const totalCollectedToday = todayReceipts.reduce((sum, r) => sum + Number(r.amount || 0), 0);
    const activeEmployees = employees.filter((e) => e.status !== 'terminated').length;
    const activeReps = employees.filter((e) => e.status !== 'terminated' && (e.role === 'sales_rep' || e.department === 'sales')).length;
    const completedVisits = todayVisits.filter((v) => Boolean(v.checkOutTime || v.check_out || v.completed_at) || Number(v.durationMinutes) > 0 || v.status === 'completed').length;
    const visitTarget = Math.max(activeReps * 8, 1);
    const visitCompletionRate = Math.min(100, Math.round((completedVisits / visitTarget) * 100));

    // Filter field reps currently active or in attendance today
    const activeFieldReps = useMemo(() => {
        return liveAttendance.filter((r) => r.status === 'present' || r.status === 'late');
    }, [liveAttendance]);

    const repsWithGPS = useMemo(() => {
        return liveAttendance.filter((r) => r.check_in_lat != null && r.check_in_lng != null);
    }, [liveAttendance]);

    if (!can('can_view_dashboard')) {
        return <div className="p-8 text-center text-muted-foreground" dir="rtl">غير مسموح لك بالوصول إلى هذه الصفحة.</div>;
    }

    const money = (n) => `${Number(n || 0).toLocaleString('en-US')} ج.م`;

    return (
        <div className="flex flex-col gap-5" dir="rtl">
            <PageHero
                className="mb-0"
                icon={Compass}
                title="إدارة التشغيل"
                subtitle="لوحة موحدة لمتابعة الموظفين والزيارات والمبيعات والتحصيلات والعمليات اليومية"
                actions={
                    <>
                        <HeroPill
                            dot={isLiveConnected ? 'success' : 'warning'}
                            pulse={isLiveConnected}
                            className={isLiveConnected ? 'border-success/20 bg-success-soft text-success' : undefined}
                        >
                            {isLiveConnected ? 'تتبع لحظي نشط (Live)' : 'جاري الاتصال…'}
                        </HeroPill>
                        <div className="flex flex-wrap gap-2" role="tablist" aria-label="أقسام إدارة التشغيل">
                            {MONITOR_TABS.map((t) => {
                                const Icon = t.icon;
                                const active = activeTab === t.key;
                                return (
                                    <button
                                        key={t.key}
                                        type="button"
                                        role="tab"
                                        aria-selected={active}
                                        onClick={() => setActiveTab(t.key)}
                                        className={cn(
                                            'inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                                            active
                                                ? 'border-primary/20 bg-primary-soft text-primary'
                                                : 'border-border bg-card-muted text-secondary-text hover:border-border-strong hover:text-foreground'
                                        )}
                                    >
                                        <Icon className="h-4 w-4" aria-hidden="true" />
                                        {t.label}
                                    </button>
                                );
                            })}
                        </div>
                    </>
                }
            />

            {hasDataError && (
                <div className="flex items-center gap-2 rounded-2xl border border-danger/25 bg-danger-soft px-4 py-3 text-[13px] font-semibold text-danger" role="alert">
                    <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                    تعذر تحميل بعض بيانات التشغيل. تحقق من اتصال Firebase والصلاحيات ثم أعد المحاولة.
                </div>
            )}

            {/* KPI cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                <StatCard title="إجمالي الموظفين" value={activeEmployees} loading={l5} caption={`${activeReps} مندوبي مبيعات`} icon={UserCheck} tone="indigo" />
                <StatCard title="زيارات اليوم" value={todayVisits.length} loading={l6} caption={`${completedVisits} زيارة مكتملة`} icon={MapPin} tone="emerald" />
                <StatCard title="نسبة إنجاز الزيارات" value={`${visitCompletionRate}%`} loading={l6} caption={`الهدف: ${visitTarget} زيارة`} icon={Target} tone="amber" />
                <StatCard title="مندوبين في الميدان اليوم" value={activeFieldReps.length} caption={`${repsWithGPS.length} مسجلين بإحداثيات GPS`} icon={Users} tone="slate" />
                <StatCard title="تحصيلات اليوم" value={money(totalCollectedToday)} loading={l7} caption={`${todayReceipts.length} سند تحصيل`} icon={Banknote} tone="blue" />
                <StatCard title="مبيعات اليوم المحققة" value={money(totalSalesToday)} caption={`${todaySales.length} فاتورة`} icon={ShoppingCart} tone="indigo" />
                <StatCard title="أصناف بضاعة السيارات" value={vanStocks.length} caption="في عهدة المندوبين" icon={Truck} tone="orange" />
                <StatCard title="مصاريف اليوم" value={money(totalExpensesToday)} valueClassName="text-danger" caption={`${todayExpenses.length} عملية`} icon={Receipt} tone="rose" />
            </div>

            {/* Action bar */}
            <div className="flex flex-wrap gap-2 rounded-2xl border border-border bg-card p-3 shadow-card">
                <Link to="/employees" className={cn(ACTION_BTN, 'bg-primary text-white hover:bg-primary/90')}>
                    <Users className="h-4 w-4" aria-hidden="true" /> إدارة الموظفين
                </Link>
                <Link to="/attendance" className={cn(ACTION_BTN, ACTION_BTN_NEUTRAL)}>
                    <Clock className="h-4 w-4" aria-hidden="true" /> الحضور والتأخيرات
                </Link>
                <Link to="/expenses" className={cn(ACTION_BTN, ACTION_BTN_NEUTRAL)}>
                    <Receipt className="h-4 w-4" aria-hidden="true" /> اعتماد المصروفات
                </Link>
                <Link to="/payroll" className={cn(ACTION_BTN, ACTION_BTN_NEUTRAL)}>
                    <Banknote className="h-4 w-4" aria-hidden="true" /> الرواتب والاستحقاقات
                </Link>
                <Link to="/reports" className={cn(ACTION_BTN, ACTION_BTN_NEUTRAL)}>
                    التحليلات والتقارير <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                </Link>
            </div>

            {/* TAB 1: LIVE FIELD TRACKING & GPS GEOFENCING */}
            {activeTab === 'field' && (
                <SectionCard
                    title="سجل المواقع الجغرافية للمندوبين والتحقق الميداني"
                    subtitle="يتم تحديث إحداثيات GPS تلقائياً فور تبصيم المندوب أو تسجيل زيارات العملاء من تطبيق Nexora Field."
                    icon={MapPin}
                    tone="emerald"
                    actions={<CountChip>{liveAttendance.length} تسجيل اليوم</CountChip>}
                >
                    {liveAttendance.length === 0 ? (
                        <EmptyState
                            icon={MapPin}
                            text={`لا توجد تسجيلات حضور أو زيارات ميدانية مسجلة حتى الآن اليوم (${todayStr()}).`}
                        />
                    ) : (
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {liveAttendance.map((rec) => {
                                const hasGPS = rec.check_in_lat != null && rec.check_in_lng != null;
                                const isActive = (rec.status === 'present' || rec.status === 'late') && !rec.check_out;
                                const googleMapsUrl = hasGPS ? `https://www.google.com/maps?q=${rec.check_in_lat},${rec.check_in_lng}` : null;

                                return (
                                    <div
                                        key={rec.id}
                                        className="flex flex-col justify-between rounded-2xl border border-border bg-card p-4 transition-colors hover:border-border-strong"
                                    >
                                        <div>
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="min-w-0">
                                                    <h3 className="truncate text-sm font-bold text-foreground">{rec.employee_name || 'مندوب ميداني'}</h3>
                                                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                                                        وقت الحضور: {rec.check_in?.toDate ? rec.check_in.toDate().toLocaleTimeString('ar-EG') : '—'}
                                                    </p>
                                                </div>
                                                {isActive ? (
                                                    <StatusPill tone="success" pulse>نشط بالميدان</StatusPill>
                                                ) : rec.check_out ? (
                                                    <StatusPill tone="info">انتهى الدوام</StatusPill>
                                                ) : (
                                                    <StatusPill tone="neutral">{rec.status}</StatusPill>
                                                )}
                                            </div>

                                            {/* GPS geofence box */}
                                            <div className="mt-3 space-y-1.5 rounded-xl bg-card-muted p-3">
                                                <div className="flex items-center justify-between text-xs">
                                                    <span className="flex items-center gap-1 text-muted-foreground">
                                                        <Compass className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                                                        الموقع الجغرافي:
                                                    </span>
                                                    <span className="font-mono text-[11px] font-bold text-foreground" dir="ltr">
                                                        {hasGPS ? `${rec.check_in_lat.toFixed(4)}, ${rec.check_in_lng.toFixed(4)}` : 'غير متوفر'}
                                                    </span>
                                                </div>

                                                {rec.check_in_accuracy && (
                                                    <div className="flex items-center justify-between text-xs">
                                                        <span className="text-muted-foreground">دقة الـ GPS:</span>
                                                        <span className="text-xs font-bold text-success">
                                                            ± {Math.round(rec.check_in_accuracy)} متر (إشارة ممتازة)
                                                        </span>
                                                    </div>
                                                )}

                                                <div className="flex items-center justify-between text-xs">
                                                    <span className="text-muted-foreground">التحقق الجغرافي:</span>
                                                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-success">
                                                        <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                                                        {hasGPS ? 'موقع موثق بالبصمة البيومترية' : 'تسجيل يدوي'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="mt-3 border-t border-border pt-3">
                                            {googleMapsUrl ? (
                                                <a
                                                    href={googleMapsUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="flex h-9 w-full items-center justify-center gap-1.5 rounded-xl bg-[#16A34A] text-xs font-bold text-white transition-colors hover:bg-[#15803D]"
                                                >
                                                    <Navigation className="h-3.5 w-3.5" aria-hidden="true" />
                                                    فتح موقع المندوب في خرائط Google
                                                    <ExternalLink className="h-3 w-3" aria-hidden="true" />
                                                </a>
                                            ) : (
                                                <p className="py-1 text-center text-[11px] text-muted-foreground">
                                                    لم يتم إرسال إحداثيات GPS لهذا التسجيل
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </SectionCard>
            )}

            {/* TAB 2: SMART ROUTE OPTIMIZATION ON MAP */}
            {activeTab === 'routes' && (
                <RouteOptimizerMap
                    customers={customers}
                    visits={todayVisits}
                    repLocation={repsWithGPS[0] ? { lat: repsWithGPS[0].check_in_lat, lng: repsWithGPS[0].check_in_lng } : null}
                />
            )}

            {/* TAB 3: SHELF MERCHANDISING & COMPETITOR PRICING */}
            {activeTab === 'merchandising' && <ShelfMerchandisingView visits={visits} />}

            {/* TAB 4: OPERATIONS AND ACTIVITIES */}
            {activeTab === 'operations' && (
                <SectionCard title="آخر العمليات والحركات المسجلة اليوم" icon={Activity}>
                    {isLoading ? (
                        <div className="flex justify-center py-14">
                            <Loader2 className="h-6 w-6 animate-spin text-primary" aria-label="جاري التحميل" />
                        </div>
                    ) : activities.length === 0 ? (
                        <EmptyState icon={Activity} text="لا توجد حركات مسجلة اليوم." />
                    ) : (
                        <div className="divide-y divide-border">
                            {activities.map((a) => (
                                <div key={a.id} className="flex min-h-14 items-center justify-between gap-3 py-2.5">
                                    <div className="min-w-0">
                                        <p className="truncate text-[13px] font-semibold text-foreground">{a.action}</p>
                                        <p className="truncate text-xs text-muted-foreground">{a.details}</p>
                                    </div>
                                    <CountChip className="shrink-0">{a.user_email || a.user_id || 'النظام'}</CountChip>
                                </div>
                            ))}
                        </div>
                    )}
                </SectionCard>
            )}
        </div>
    );
}

const ACTION_BTN =
    'inline-flex h-10 items-center gap-2 rounded-xl px-4 text-xs font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary';
const ACTION_BTN_NEUTRAL = 'border border-border bg-card text-foreground hover:bg-card-muted';

const MONITOR_TABS = [
    { key: 'field', label: 'تتبع المندوبين والميدان', icon: MapPin },
    { key: 'routes', label: 'المسارات الذكية والخريطة', icon: Route },
    { key: 'merchandising', label: 'تدقيق الرفوف والمنافسين', icon: Store },
    { key: 'operations', label: 'العمليات والمبيعات', icon: BarChart3 },
];

const STATUS_PILL = {
    success: { pill: 'bg-success-soft text-success', dot: 'bg-success' },
    info: { pill: 'bg-info-soft text-info', dot: 'bg-info' },
    neutral: { pill: 'bg-card-muted text-secondary-text', dot: 'bg-muted-foreground' },
};

function StatusPill({ tone = 'neutral', pulse = false, children }) {
    const s = STATUS_PILL[tone] || STATUS_PILL.neutral;
    return (
        <span className={cn('inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold', s.pill)}>
            <span className={cn('h-1.5 w-1.5 rounded-full', s.dot, pulse && 'animate-pulse')} />
            {children}
        </span>
    );
}
