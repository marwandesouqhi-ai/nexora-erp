import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRole } from '@/lib/RoleContext';
import { useTenant } from '@/lib/TenantContext';
import { fetchTenantDocs } from '@/lib/tenantFirestore';
import {
    format, startOfMonth, endOfMonth, isWithinInterval, subDays,
    startOfDay, endOfDay, subMonths, startOfMonth as startOfMonthFn
} from 'date-fns';
import { ar } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import {
    TrendingUp, Package, AlertTriangle, Users, LayoutDashboard,
    FileText, Receipt, ShoppingCart, HandCoins, PiggyBank, Boxes, MessageCircle, MessagesSquare,
    BarChart3, PieChart as PieChartIcon, Trophy,
} from 'lucide-react';
import { normalizeWaNumber, formatWaDisplay, openCompanyWa } from '@/utils/whatsapp';
import {
    AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis,
    Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { PageHero, HeroPill, StatCard, SectionCard, EmptyState } from '@/components/page';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/* ثوابت وألوان                                                        */
/* ------------------------------------------------------------------ */

const CATEGORY_LABELS = { medication: 'دواء', supplement: 'مكمل', vaccine: 'لقاح', equipment: 'معدات', feed: 'أعلاف', other: 'أخرى' };
const CATEGORY_COLORS = { medication: '#4F6FE5', supplement: '#7C5CE6', vaccine: '#16A34A', equipment: '#F0A020', feed: '#F97316', other: '#94A3B8' };
const PAYMENT_STATUS_LABELS = { paid: 'مدفوعة', unpaid: 'غير مدفوعة', partial: 'مدفوعة جزئياً' };
const PAYMENT_STATUS_STYLES = {
    paid: { pill: 'bg-success-soft text-success', dot: 'bg-success' },
    unpaid: { pill: 'bg-danger-soft text-danger', dot: 'bg-danger' },
    partial: { pill: 'bg-warning-soft text-warning', dot: 'bg-warning' },
};
const PERIOD_OPTIONS = [
    { key: 7, label: '7 أيام' },
    { key: 14, label: '14 يوم' },
    { key: 30, label: '30 يوم' },
];

const CHART = {
    revenue: '#4F6FE5',
    expenses: '#F0A020',
    purchases: '#0EA5C4',
};
const TOOLTIP_STYLE = {
    borderRadius: '12px',
    border: '1px solid var(--border)',
    boxShadow: 'var(--shadow-float-value)',
    background: 'var(--card)',
    color: 'var(--foreground)',
    fontFamily: 'inherit',
    fontSize: 12,
};
const AXIS_TICK = { fontSize: 11, fontWeight: 600, fill: 'var(--muted-foreground)' };

// الأرقام تبقى لاتينية
const currency = (n) => `${(Number(n) || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })} ج.م`;
const toDate = (v) => (v?.toDate ? v.toDate() : v ? new Date(v) : null);
const formatDelta = (trend) => `${Math.abs(Number(trend) || 0).toFixed(0)}%`;

/* ------------------------------------------------------------------ */
/* مكونات مساعدة                                                       */
/* ------------------------------------------------------------------ */

function LegendKey({ color, label }) {
    return (
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-secondary-text">
            <span className="h-2.5 w-2.5 rounded-[4px]" style={{ background: color }} />
            {label}
        </span>
    );
}

function DashboardSkeleton() {
    return (
        <div className="flex flex-col gap-5" dir="rtl">
            <Skeleton className="h-24 w-full rounded-2xl" />
            <Skeleton className="h-20 w-full rounded-2xl" />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-2xl" />)}
            </div>
            <div className="flex flex-col gap-5 xl:flex-row">
                <Skeleton className="h-80 flex-1 rounded-2xl" />
                <Skeleton className="h-80 rounded-2xl xl:w-[380px]" />
            </div>
        </div>
    );
}

/* ------------------------------------------------------------------ */
/* الصفحة الرئيسية                                                     */
/* ------------------------------------------------------------------ */

export default function Dashboard() {
    const { can } = useRole();
    const { currentCompanyId, tenant } = useTenant();
    const adminWa = normalizeWaNumber(tenant?.admin_whatsapp);
    const [trendDays, setTrendDays] = useState(7);

    const now = new Date();

    const fetchCollection = async (name) => {
        return await fetchTenantDocs(name, { companyId: currentCompanyId });
    };

    const { data: sales = [], isLoading: salesLoading } = useQuery({
        queryKey: ['dashboard-sales', currentCompanyId], queryFn: () => fetchCollection('sales'), enabled: can('can_view_sales'),
    });
    const { data: products = [], isLoading: productsLoading } = useQuery({
        queryKey: ['dashboard-products', currentCompanyId], queryFn: () => fetchCollection('products'),
    });
    const { data: customers = [], isLoading: customersLoading } = useQuery({
        queryKey: ['dashboard-customers', currentCompanyId], queryFn: () => fetchCollection('customers'),
    });
    const { data: expenses = [] } = useQuery({
        queryKey: ['dashboard-expenses', currentCompanyId], queryFn: () => fetchCollection('expenses'), enabled: can('can_view_financials'),
    });
    const { data: purchases = [] } = useQuery({
        queryKey: ['dashboard-purchases', currentCompanyId], queryFn: () => fetchCollection('purchases'), enabled: can('can_view_purchases'),
    });
    const { data: debts = [] } = useQuery({
        queryKey: ['dashboard-debts', currentCompanyId], queryFn: () => fetchCollection('debts'), enabled: can('can_view_debts'),
    });

    const isLoading = salesLoading || productsLoading || customersLoading;

    /* ---------------------------------------------------------------- */
    /* حسابات مشتقة                                                       */
    /* ---------------------------------------------------------------- */

    const stats = useMemo(() => {
        const now = new Date();
        const monthStart = startOfMonth(now);
        const monthEnd = endOfMonth(now);
        const lastMonthStart = startOfMonth(subMonths(now, 1));
        const lastMonthEnd = endOfMonth(subMonths(now, 1));
        const inRange = (date, start, end) => date && isWithinInterval(date, { start, end });

        const thisMonthSales = sales.filter((s) => inRange(toDate(s.created_at), monthStart, monthEnd));
        const lastMonthSales = sales.filter((s) => inRange(toDate(s.created_at), lastMonthStart, lastMonthEnd));

        const revenue = thisMonthSales.reduce((sum, s) => sum + (Number(s.total_amount) || 0), 0);
        const lastMonthRevenue = lastMonthSales.reduce((sum, s) => sum + (Number(s.total_amount) || 0), 0);
        const revenueTrend = lastMonthRevenue > 0 ? ((revenue - lastMonthRevenue) / lastMonthRevenue) * 100 : (revenue > 0 ? 100 : 0);

        const cogs = thisMonthSales.reduce((sum, s) => (
            sum + (s.items || []).reduce((iSum, it) => iSum + (Number(it.cost_price) || 0) * (Number(it.quantity) || 0), 0)
        ), 0);

        const thisMonthExpenses = expenses.filter((e) => inRange(toDate(e.expense_date || e.created_at), monthStart, monthEnd));
        const expensesTotal = thisMonthExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

        const thisMonthPurchases = purchases.filter((p) => inRange(toDate(p.created_at), monthStart, monthEnd));
        const purchasesTotal = thisMonthPurchases.reduce((sum, p) => sum + (Number(p.total) || 0), 0);

        const netProfit = revenue - cogs - expensesTotal;
        const lastMonthCogs = lastMonthSales.reduce((sum, s) => (
            sum + (s.items || []).reduce((iSum, it) => iSum + (Number(it.cost_price) || 0) * (Number(it.quantity) || 0), 0)
        ), 0);
        const lastMonthExpensesTotal = expenses.filter((e) => inRange(toDate(e.expense_date || e.created_at), lastMonthStart, lastMonthEnd))
            .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
        const lastMonthProfit = lastMonthRevenue - lastMonthCogs - lastMonthExpensesTotal;
        const profitTrend = lastMonthProfit !== 0 ? ((netProfit - lastMonthProfit) / Math.abs(lastMonthProfit)) * 100 : (netProfit > 0 ? 100 : 0);

        const lowStockItems = products.filter((p) => (Number(p.stock) || 0) <= (Number(p.min_stock) || 10));
        const activeCustomers = customers.filter((c) => c.status !== 'inactive').length;

        const owedToUs = debts.filter((d) => d.direction === 'owed_to_us' && d.status !== 'settled')
            .reduce((sum, d) => sum + ((Number(d.amount) || 0) - (Number(d.paid_amount) || 0)), 0);
        const weOwe = debts.filter((d) => d.direction === 'we_owe' && d.status !== 'settled')
            .reduce((sum, d) => sum + ((Number(d.amount) || 0) - (Number(d.paid_amount) || 0)), 0);

        /* اتجاه المبيعات - عدد الأيام القابل للتغيير */
        const trend = Array.from({ length: trendDays }, (_, i) => {
            const d = subDays(now, trendDays - 1 - i);
            const dayStart = startOfDay(d);
            const dayEnd = endOfDay(d);
            const dayTotal = sales
                .filter((s) => inRange(toDate(s.created_at), dayStart, dayEnd))
                .reduce((sum, s) => sum + (Number(s.total_amount) || 0), 0);
            return { day: format(d, 'dd/MM'), total: dayTotal };
        });

        /* مقارنة شهرية: إيرادات / مصاريف / مشتريات - آخر 6 أشهر */
        const monthly = Array.from({ length: 6 }, (_, i) => {
            const m = subMonths(now, 5 - i);
            const mStart = startOfMonthFn(m);
            const mEnd = endOfMonth(m);
            const rev = sales.filter((s) => inRange(toDate(s.created_at), mStart, mEnd))
                .reduce((sum, s) => sum + (Number(s.total_amount) || 0), 0);
            const exp = expenses.filter((e) => inRange(toDate(e.expense_date || e.created_at), mStart, mEnd))
                .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
            const pur = purchases.filter((p) => inRange(toDate(p.created_at), mStart, mEnd))
                .reduce((sum, p) => sum + (Number(p.total) || 0), 0);
            return { month: format(m, 'MMM', { locale: ar }), revenue: rev, expenses: exp, purchases: pur };
        });

        /* توزيع المبيعات حسب فئة المنتج (خلال آخر 30 يوم) */
        const productsById = Object.fromEntries(products.map((p) => [p.id, p]));
        const categoryTotals = {};
        sales
            .filter((s) => toDate(s.created_at) && toDate(s.created_at) >= subDays(now, 30))
            .forEach((s) => {
                (s.items || []).forEach((it) => {
                    const cat = productsById[it.product_id]?.category || 'other';
                    categoryTotals[cat] = (categoryTotals[cat] || 0) + (Number(it.total) || 0);
                });
            });
        const categoryChart = Object.entries(categoryTotals)
            .map(([cat, value]) => ({ key: cat, name: CATEGORY_LABELS[cat] || cat, value, color: CATEGORY_COLORS[cat] || '#94a3b8' }))
            .sort((a, b) => b.value - a.value);

        /* أفضل 5 منتجات مبيعاً (آخر 30 يوم) */
        const productTotals = {};
        sales
            .filter((s) => toDate(s.created_at) && toDate(s.created_at) >= subDays(now, 30))
            .forEach((s) => {
                (s.items || []).forEach((it) => {
                    const key = it.product_name || 'غير معروف';
                    if (!productTotals[key]) productTotals[key] = { name: key, qty: 0, total: 0 };
                    productTotals[key].qty += Number(it.quantity) || 0;
                    productTotals[key].total += Number(it.total) || 0;
                });
            });
        const topProducts = Object.values(productTotals).sort((a, b) => b.total - a.total).slice(0, 5);

        const recentSales = [...sales]
            .sort((a, b) => (toDate(b.created_at)?.getTime() || 0) - (toDate(a.created_at)?.getTime() || 0))
            .slice(0, 5);

        return {
            revenue, revenueTrend, netProfit, profitTrend, expensesTotal, purchasesTotal,
            thisMonthSales, lowStockItems, activeCustomers, owedToUs, weOwe,
            trend, monthly, categoryChart, topProducts, recentSales,
        };
    }, [sales, products, customers, expenses, purchases, debts, trendDays]);

    if (isLoading) return <DashboardSkeleton />;

    const showFinancials = can('can_view_financials');
    const showReports = can('can_view_reports');
    const showDebts = can('can_view_debts');
    const showPurchases = can('can_view_purchases');

    return (
        <div className="flex flex-col gap-5" dir="rtl">
            {/* Hero */}
            <PageHero
                className="mb-0"
                icon={LayoutDashboard}
                title="لوحة التحكم"
                subtitle={`${format(now, 'EEEE، d MMMM yyyy', { locale: ar })} — أهلاً بك في Nexora ERP`}
                actions={
                    <HeroPill dot="success" pulse className="border-success/20 bg-success-soft text-success">
                        النظام متصل
                    </HeroPill>
                }
            />

            {/* شريط واتساب إدارة الشركة (رقم خاص بكل شركة من مستند الشركة) */}
            {adminWa ? (
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-success/20 bg-success-soft p-4 sm:p-5">
                <div className="flex min-w-0 items-center gap-3.5">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#16A34A] text-white shadow-sm">
                        <MessageCircle className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[13.5px] font-bold text-foreground">رقم الواتساب الرسمي الموحد للإدارة:</span>
                            <span className="rounded-lg bg-success/15 px-2 py-0.5 font-mono text-[13px] font-bold text-success" dir="ltr">
                                {formatWaDisplay(adminWa)}
                            </span>
                        </div>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                            الرقم المعتمد لاستقبال ومزامنة طلبات المناديب، ومحاضر تصفية العهد، والتقارير الميدانية من تطبيق Nexora Field.
                        </p>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={() => openCompanyWa(adminWa, `مرحباً إدارة ${tenant?.name || 'الشركة'}`)}
                    className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full bg-[#16A34A] px-5 text-xs font-bold text-white shadow-sm transition-colors hover:bg-[#15803D] focus:outline-none focus-visible:ring-2 focus-visible:ring-success focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                    <MessagesSquare className="h-4 w-4" aria-hidden="true" />
                    فتح محادثة فورية (WhatsApp)
                </button>
            </div>
            ) : can('can_manage_users') ? (
                <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-dashed border-warning/40 bg-warning-soft p-4 sm:p-5">
                    <div className="flex min-w-0 items-center gap-3.5">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-warning/15 text-warning">
                            <MessageCircle className="h-5 w-5" aria-hidden="true" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-[13.5px] font-bold text-foreground">لم يُضف رقم واتساب الإدارة لشركتك بعد</p>
                            <p className="mt-1 text-[11px] text-muted-foreground">
                                أضف الرقم الذي يستقبل طلبات المناديب ومحاضر تصفية العهد والتقارير الميدانية وتنبيهات المخزون.
                            </p>
                        </div>
                    </div>
                    <Link
                        to="/company-settings"
                        className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full border border-warning/40 bg-card px-5 text-xs font-bold text-foreground transition-colors hover:bg-card-muted"
                    >
                        إضافة الرقم من إعدادات الشركة
                    </Link>
                </div>
            ) : null}


            {/* KPI grid */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                {showFinancials && (
                    <StatCard
                        title="إيرادات الشهر" value={currency(stats.revenue)}
                        caption={`${stats.thisMonthSales.length} فاتورة هذا الشهر`}
                        icon={TrendingUp} tone="indigo" linkTo="/sales"
                        delta={formatDelta(stats.revenueTrend)} deltaDown={stats.revenueTrend < 0}
                    />
                )}
                {showFinancials && (
                    <StatCard
                        title="الربح التقديري" value={currency(stats.netProfit)}
                        caption="بعد خصم التكلفة والمصاريف"
                        icon={PiggyBank} tone={stats.netProfit >= 0 ? 'emerald' : 'rose'} linkTo="/financial-overview"
                        delta={formatDelta(stats.profitTrend)} deltaDown={stats.profitTrend < 0}
                    />
                )}
                <StatCard title="العملاء النشطين" value={stats.activeCustomers} caption={`من إجمالي ${customers.length} عميل`} icon={Users} tone="blue" linkTo="/customers" />
                <StatCard title="تنبيهات المخزون" value={stats.lowStockItems.length} caption="منتجات وصلت للحد الأدنى" icon={AlertTriangle} tone="amber" linkTo="/inventory" />

                <StatCard title="إجمالي المنتجات" value={products.length} caption="صنف مسجل في المخزن" icon={Package} tone="emerald" linkTo="/inventory" />
                {showFinancials && (
                    <StatCard title="مصاريف الشهر" value={currency(stats.expensesTotal)} caption="إجمالي المصروفات التشغيلية" icon={Receipt} tone="orange" linkTo="/expenses" />
                )}
                {showPurchases && (
                    <StatCard title="مشتريات الشهر" value={currency(stats.purchasesTotal)} caption="من الموردين" icon={ShoppingCart} tone="blue" linkTo="/purchases" />
                )}
                {showDebts && (
                    <StatCard title="مستحق لنا" value={currency(stats.owedToUs)} caption={`مقابل ${currency(stats.weOwe)} علينا`} icon={HandCoins} tone="magenta" linkTo="/debts" />
                )}
            </div>

            {/* Sales trend + category distribution */}
            <div className="flex flex-col gap-5 xl:flex-row">
                {showReports && (
                    <SectionCard
                        className="min-w-0 flex-1"
                        title="تحليل المبيعات"
                        subtitle={`إجمالي آخر ${trendDays} يوم`}
                        icon={BarChart3}
                        actions={
                            <div className="flex items-center gap-1 rounded-full border border-border bg-card-muted p-1" role="tablist" aria-label="فترة التحليل">
                                {PERIOD_OPTIONS.map((opt) => (
                                    <button
                                        key={opt.key}
                                        type="button"
                                        role="tab"
                                        aria-selected={trendDays === opt.key}
                                        onClick={() => setTrendDays(opt.key)}
                                        className={cn(
                                            'h-7 rounded-full px-3 text-[11px] font-bold transition-colors',
                                            trendDays === opt.key ? 'bg-primary text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'
                                        )}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        }
                    >
                        <div className="h-72" dir="ltr">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={stats.trend} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor={CHART.revenue} stopOpacity={0.28} />
                                            <stop offset="95%" stopColor={CHART.revenue} stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="var(--border)" />
                                    <XAxis dataKey="day" axisLine={false} tickLine={false} tick={AXIS_TICK} dy={10} />
                                    <YAxis hide />
                                    <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [currency(v), 'المبيعات']} />
                                    <Area type="monotone" dataKey="total" stroke={CHART.revenue} strokeWidth={2.5} fill="url(#salesGrad)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </SectionCard>
                )}

                <SectionCard
                    className={cn('flex flex-col', showReports ? 'xl:w-[380px] xl:shrink-0' : 'flex-1')}
                    bodyClassName="flex flex-1 flex-col"
                    title="مبيعات حسب الفئة"
                    subtitle="آخر 30 يوم"
                    icon={PieChartIcon}
                    tone="violet"
                >
                    {stats.categoryChart.length > 0 ? (
                        <div className="flex h-72 flex-col">
                            <ResponsiveContainer width="100%" height="80%">
                                <PieChart>
                                    <Pie data={stats.categoryChart} dataKey="value" nameKey="name" innerRadius="58%" outerRadius="85%" paddingAngle={3}>
                                        {stats.categoryChart.map((entry) => (
                                            <Cell key={entry.key} fill={entry.color} stroke="var(--card)" strokeWidth={2} />
                                        ))}
                                    </Pie>
                                    <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v, n) => [currency(v), n]} />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 px-2">
                                {stats.categoryChart.map((c) => (
                                    <LegendKey key={c.key} color={c.color} label={c.name} />
                                ))}
                            </div>
                        </div>
                    ) : (
                        <EmptyState icon={Boxes} text="لا توجد مبيعات كافية لعرض التوزيع" className="flex-1" />
                    )}
                </SectionCard>
            </div>

            {/* Monthly comparison */}
            {showFinancials && (
                <SectionCard
                    title="الإيرادات مقابل المصاريف والمشتريات"
                    subtitle="آخر 6 أشهر"
                    icon={BarChart3}
                    actions={
                        <div className="flex flex-wrap items-center gap-4">
                            <LegendKey color={CHART.expenses} label="المصاريف" />
                            <LegendKey color={CHART.purchases} label="المشتريات" />
                            <LegendKey color={CHART.revenue} label="الإيرادات" />
                        </div>
                    }
                >
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={stats.monthly} barGap={4} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="var(--border)" />
                                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={AXIS_TICK} dy={10} />
                                <YAxis hide />
                                <Tooltip
                                    contentStyle={TOOLTIP_STYLE}
                                    cursor={{ fill: 'var(--card-muted)' }}
                                    formatter={(v, n) => [currency(v), n === 'revenue' ? 'الإيرادات' : n === 'expenses' ? 'المصاريف' : 'المشتريات']}
                                />
                                <Bar dataKey="revenue" fill={CHART.revenue} radius={[6, 6, 0, 0]} maxBarSize={28} />
                                <Bar dataKey="expenses" fill={CHART.expenses} radius={[6, 6, 0, 0]} maxBarSize={28} />
                                <Bar dataKey="purchases" fill={CHART.purchases} radius={[6, 6, 0, 0]} maxBarSize={28} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </SectionCard>
            )}

            {/* Low stock + debts summary + top products */}
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-3">
                <SectionCard title="نواقص المخزن" icon={AlertTriangle} tone="warning">
                    <div className="max-h-[280px] space-y-2 overflow-y-auto">
                        {stats.lowStockItems.length > 0 ? stats.lowStockItems.map((p) => (
                            <Link
                                key={p.id} to="/inventory"
                                className="flex h-12 items-center justify-between rounded-xl border border-border bg-card-muted px-3 transition-colors hover:border-border-strong"
                            >
                                <span className="truncate text-[13px] font-semibold text-foreground">{p.name}</span>
                                <span className="shrink-0 rounded-full bg-warning-soft px-2.5 py-0.5 text-[11px] font-bold text-warning">{p.stock ?? 0} قطعة</span>
                            </Link>
                        )) : (
                            <EmptyState icon={Package} text="المخزن بحالة ممتازة" />
                        )}
                    </div>
                </SectionCard>

                {showDebts && (
                    <SectionCard title="ملخص الديون" icon={HandCoins} tone="magenta">
                        <div className="flex flex-col gap-3">
                            <div className="rounded-xl bg-success-soft p-4">
                                <p className="text-xs font-semibold text-success">مستحق لنا (على العملاء)</p>
                                <p className="mt-1 text-xl font-extrabold text-success">{currency(stats.owedToUs)}</p>
                            </div>
                            <div className="rounded-xl bg-danger-soft p-4">
                                <p className="text-xs font-semibold text-danger">مستحق علينا (للموردين)</p>
                                <p className="mt-1 text-xl font-extrabold text-danger">{currency(stats.weOwe)}</p>
                            </div>
                            <Link
                                to="/debts"
                                className="flex h-11 w-full items-center justify-center rounded-xl border border-border bg-card text-[13px] font-bold text-foreground transition-colors hover:bg-card-muted"
                            >
                                عرض تفاصيل الديون
                            </Link>
                        </div>
                    </SectionCard>
                )}

                <SectionCard title="الأكثر مبيعاً" subtitle="آخر 30 يوم" icon={Trophy} tone="emerald">
                    {stats.topProducts.length > 0 ? (
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={stats.topProducts} layout="vertical" margin={{ left: 0 }}>
                                    <CartesianGrid strokeDasharray="4 4" horizontal={false} stroke="var(--border)" />
                                    <XAxis type="number" hide />
                                    <YAxis type="category" dataKey="name" orientation="right" axisLine={false} tickLine={false} width={90} tick={AXIS_TICK} />
                                    <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'var(--card-muted)' }} formatter={(v) => [currency(v), 'المبيعات']} />
                                    <Bar dataKey="total" fill="#16A34A" radius={[6, 0, 0, 6]} maxBarSize={22} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <EmptyState icon={Boxes} text="لا توجد بيانات مبيعات بعد" />
                    )}
                </SectionCard>
            </div>

            {/* Recent invoices */}
            {can('can_view_sales') && (
                <SectionCard
                    title="أحدث الفواتير"
                    icon={FileText}
                    actions={
                        <Link to="/sales" className="text-[13px] font-bold text-primary hover:underline">
                            عرض الكل
                        </Link>
                    }
                >
                    {stats.recentSales.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="w-full text-right">
                                <thead>
                                    <tr className="bg-card-muted text-xs font-semibold text-muted-foreground">
                                        <th className="rounded-r-lg px-4 py-3 font-semibold">رقم الفاتورة</th>
                                        <th className="px-4 py-3 font-semibold">العميل</th>
                                        {showFinancials && <th className="px-4 py-3 font-semibold">الإجمالي</th>}
                                        <th className="px-4 py-3 font-semibold">الحالة</th>
                                        <th className="rounded-l-lg px-4 py-3 font-semibold">التاريخ</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {stats.recentSales.map((s) => {
                                        const st = PAYMENT_STATUS_STYLES[s.payment_status];
                                        return (
                                            <tr key={s.id} className="h-14 transition-colors hover:bg-card-muted/60">
                                                <td className="px-4 font-mono text-xs font-bold text-primary">
                                                    {s.invoice_number || `#${s.id?.slice(-6)}`}
                                                </td>
                                                <td className="px-4 text-[13px] font-semibold text-foreground">{s.customer_name || 'عميل نقدي'}</td>
                                                {showFinancials && (
                                                    <td className="px-4 text-[13px] font-bold text-foreground">{currency(s.total_amount)}</td>
                                                )}
                                                <td className="px-4">
                                                    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold', st?.pill || 'bg-card-muted text-muted-foreground')}>
                                                        <span className={cn('h-1.5 w-1.5 rounded-full', st?.dot || 'bg-muted-foreground')} />
                                                        {PAYMENT_STATUS_LABELS[s.payment_status] || s.payment_status || '—'}
                                                    </span>
                                                </td>
                                                <td className="px-4 text-xs text-muted-foreground">
                                                    {toDate(s.created_at) ? format(toDate(s.created_at), 'dd/MM/yyyy') : '—'}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <EmptyState icon={FileText} text="لا توجد فواتير مسجلة بعد" />
                    )}
                </SectionCard>
            )}
        </div>
    );
}
