import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getRecentActivities } from '@/firebase/collections/activity_logs';
import { getSales } from '@/firebase/collections/sales';
import { getPurchases } from '@/firebase/collections/purchases';
import { getExpenses } from '@/firebase/collections/expenses';
import { getAttendanceByDate } from '@/firebase/collections/attendance';
import { useRole } from '@/lib/RoleContext';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import {
    History, Search, User as UserIcon, Activity, Filter, Trash2,
    PlusCircle, AlertCircle, RefreshCcw, LogIn, LogOut, ShoppingCart,
    ShoppingBag, Receipt, Users, Loader2,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import ExportMenu from '@/components/shared/ExportMenu';

import { PageHero, StatCard } from '@/components/page';
const toDate = (value) => value?.toDate?.() || (value ? new Date(value) : null);
const today = () => new Date().toISOString().slice(0, 10);

const getActionStyles = (action = '') => {
    if (action === 'login') return { icon: <LogIn className="h-4 w-4" />, color: 'bg-emerald-500/10 text-emerald-600 border-emerald-200', label: 'تسجيل دخول' };
    if (action === 'logout') return { icon: <LogOut className="h-4 w-4" />, color: 'bg-amber-500/10 text-amber-600 border-amber-200', label: 'تسجيل خروج' };
    if (action.includes('حذف') || action.includes('delete')) return { icon: <Trash2 className="h-4 w-4" />, color: 'bg-red-500/10 text-red-600 border-red-200', label: action };
    if (action.includes('إنشاء') || action.includes('إضافة') || action.includes('create')) return { icon: <PlusCircle className="h-4 w-4" />, color: 'bg-emerald-500/10 text-emerald-600 border-emerald-200', label: action };
    return { icon: <Activity className="h-4 w-4" />, color: 'bg-indigo-500/10 text-indigo-600 border-indigo-200', label: action };
};

export default function ActivityLog() {
    const { can } = useRole();
    const [search, setSearch] = useState('');
    const [filterType, setFilterType] = useState('all');

    const { data: logs = [], isLoading: logsLoading, isError, refetch } = useQuery({
        queryKey: ['activity_logs'],
        queryFn: async () => (await getRecentActivities(500)).map((entry) => ({ ...entry, date: toDate(entry.timestamp) })),
        enabled: can('can_view_activity_log'),
    });

    const { data: sales = [], isLoading: salesLoading } = useQuery({ queryKey: ['activity-sales-today'], queryFn: getSales, enabled: can('can_view_activity_log') });
    const { data: purchases = [], isLoading: purchasesLoading } = useQuery({ queryKey: ['activity-purchases-today'], queryFn: getPurchases, enabled: can('can_view_activity_log') });
    const { data: expenses = [], isLoading: expensesLoading } = useQuery({ queryKey: ['activity-expenses-today'], queryFn: getExpenses, enabled: can('can_view_activity_log') });
    const { data: attendance = [] } = useQuery({ queryKey: ['activity-attendance-today'], queryFn: () => getAttendanceByDate(today()), enabled: can('can_view_activity_log') });

    const currentDay = new Date();
    const sameDay = (value) => toDate(value)?.toDateString() === currentDay.toDateString();
    const todaySales = sales.filter((sale) => sameDay(sale.created_date || sale.created_at));
    const todayPurchases = purchases.filter((purchase) => sameDay(purchase.created_at || purchase.purchase_date));
    const todayExpenses = expenses.filter((expense) => sameDay(expense.created_at || expense.expense_date));
    const isLoading = logsLoading || salesLoading || purchasesLoading || expensesLoading;

    const filteredLogs = useMemo(() => logs.filter((log) => {
        const haystack = [log.user_name, log.user_email, log.user_id, log.action, log.details, log.ip_address].filter(Boolean).join(' ').toLowerCase();
        const matchesSearch = haystack.includes(search.toLowerCase());
        const matchesType = filterType === 'all'
            || (filterType === 'login' && log.action === 'login')
            || (filterType === 'logout' && log.action === 'logout')
            || (filterType === 'delete' && (log.action.includes('حذف') || log.action.includes('delete')))
            || (filterType === 'create' && (log.action.includes('إضافة') || log.action.includes('إنشاء') || log.action.includes('create')));
        return matchesSearch && matchesType;
    }), [filterType, logs, search]);

    const exportData = filteredLogs.map((log) => ({
        'المستخدم': log.user_name || log.user_email || log.user_id || 'النظام',
        'البريد الإلكتروني': log.user_email || '',
        'معرف المستخدم': log.user_id || '',
        'العملية': getActionStyles(log.action).label,
        'التفاصيل': log.details || '',
        'عنوان IP': log.ip_address || '',
        'الجهاز': log.device || '',
        'التوقيت': log.date ? format(log.date, 'dd/MM/yyyy hh:mm:ss a', { locale: ar }) : '',
    }));

    if (!can('can_view_activity_log')) {
        return <div className="p-8 text-center text-muted-foreground">غير مسموح لك بالوصول إلى سجل العمليات.</div>;
    }

    return (
        <div className="space-y-6" dir="rtl">
            <PageHero
                className="mb-0"
                icon={History}
                tone="slate"
                title="سجل العمليات والمراقبة"
                subtitle="مؤشرات اليوم، نشاط المستخدمين، وتسجيل الدخول والخروج مع IP الجهاز"
                actions={
                    <>
                        <ExportMenu data={exportData} filename="activity_log" title="تصدير سجل العمليات" disabled={!filteredLogs.length} />
                        <Button variant="outline" onClick={() => refetch()} className="gap-2"><RefreshCcw className={`h-4 w-4 ${logsLoading ? 'animate-spin' : ''}`} /> تحديث السجل</Button>
                    </>
                }
            />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard title="مبيعات اليوم" value={`${todaySales.reduce((sum, sale) => sum + Number(sale.total || sale.total_amount || 0), 0).toLocaleString('en-US')} ج.م`} caption={`${todaySales.length} فاتورة`} icon={ShoppingCart} tone="indigo" />
                <StatCard title="مشتريات اليوم" value={`${todayPurchases.reduce((sum, purchase) => sum + Number(purchase.total || 0), 0).toLocaleString('en-US')} ج.م`} caption={`${todayPurchases.length} عملية`} icon={ShoppingBag} tone="amber" />
                <StatCard title="مصاريف اليوم" value={`${todayExpenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0).toLocaleString('en-US')} ج.م`} valueClassName="text-danger" caption={`${todayExpenses.length} عملية`} icon={Receipt} tone="rose" />
                <StatCard title="الحاضرون اليوم" value={attendance.filter((entry) => entry.status === 'present').length} caption="موظف" icon={Users} tone="emerald" />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                <div className="relative md:col-span-3"><Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input placeholder="ابحث بالاسم أو البريد أو العملية أو IP..." className="pr-10" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
                <Select value={filterType} onValueChange={setFilterType}><SelectTrigger><Filter className="ml-2 h-4 w-4 text-indigo-600" /><SelectValue placeholder="نوع العملية" /></SelectTrigger><SelectContent><SelectItem value="all">كل العمليات</SelectItem><SelectItem value="login">تسجيل الدخول</SelectItem><SelectItem value="logout">تسجيل الخروج</SelectItem><SelectItem value="create">الإضافة</SelectItem><SelectItem value="delete">الحذف</SelectItem></SelectContent></Select>
            </div>

            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                {isLoading ? <div className="p-24 text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin text-indigo-500" /></div> : isError ? <div className="space-y-4 p-20 text-center"><AlertCircle className="mx-auto h-12 w-12 text-red-500" /><p className="font-bold">حدث خطأ أثناء تحميل البيانات</p><Button onClick={() => refetch()}>إعادة المحاولة</Button></div> : filteredLogs.length === 0 ? <div className="p-24 text-center"><Search className="mx-auto mb-4 h-8 w-8 text-muted-foreground/60" /><p className="text-lg font-bold text-muted-foreground">لا توجد سجلات مطابقة</p></div> : (
                    <div className="overflow-x-auto"><table className="w-full text-right"><thead><tr className="border-b bg-card-muted/70"><th className="px-5 py-4 text-xs font-black text-muted-foreground">المستخدم</th><th className="px-5 py-4 text-xs font-black text-muted-foreground">العملية</th><th className="px-5 py-4 text-xs font-black text-muted-foreground">التفاصيل</th><th className="px-5 py-4 text-xs font-black text-muted-foreground">IP الجهاز</th><th className="px-5 py-4 text-xs font-black text-muted-foreground">التوقيت</th></tr></thead><tbody className="divide-y divide-border">{filteredLogs.map((log) => { const style = getActionStyles(log.action); return <tr key={log.id} className="hover:bg-card-muted"><td className="px-5 py-4"><div className="flex items-center gap-3"><div className="flex h-8 w-8 items-center justify-center rounded-full bg-card-muted text-muted-foreground"><UserIcon className="h-4 w-4" /></div><div><p className="text-sm font-bold text-secondary-text">{log.user_name || log.user_email || log.user_id || 'النظام'}</p><p className="text-xs text-muted-foreground">{log.user_email || ''}</p></div></div></td><td className="px-5 py-4"><Badge className={`${style.color} gap-1.5 border px-2 py-1 shadow-none`}>{style.icon}{style.label}</Badge></td><td className="px-5 py-4 text-sm font-medium text-secondary-text">{log.details || '—'}{log.device && <p className="mt-1 max-w-xs truncate text-[10px] text-muted-foreground" title={log.device}>{log.device}</p>}</td><td className="px-5 py-4 font-mono text-xs text-secondary-text">{log.ip_address || 'غير معروف'}</td><td className="px-5 py-4"><div className="flex flex-col"><span className="text-xs font-bold text-secondary-text">{log.date ? format(log.date, 'dd MMMM yyyy', { locale: ar }) : '—'}</span><span className="font-mono text-[10px] text-muted-foreground">{log.date ? format(log.date, 'hh:mm:ss a', { locale: ar }) : '—'}</span></div></td></tr>; })}</tbody></table></div>
                )}
            </div>
        </div>
    );
}
