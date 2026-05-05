import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { db } from '@/api/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { useRole } from '@/lib/RoleContext'; // استدعاء الصلاحيات
import { format, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { Link } from 'react-router-dom';
import { Button } from "@/components/ui/button"; // تأكد من وجود المكون
import {
    TrendingUp, Package, AlertTriangle,
    Users, ArrowUpRight, FileText, Loader2
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

// مكون كارت الإحصائيات
function StatCard({ title, value, sub, icon: Icon, color, linkTo }) {
    const card = (
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all cursor-pointer group flex flex-col gap-3">
            <div className="flex items-start justify-between">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
                    <Icon className="w-5 h-5 text-white" />
                </div>
                <ArrowUpRight className="w-4 h-4 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div>
                <p className="text-slate-500 text-xs font-bold">{title}</p>
                <p className="text-2xl font-black mt-1 text-slate-800">{value}</p>
                {sub && <p className="text-[10px] text-slate-400 mt-0.5 font-medium">{sub}</p>}
            </div>
        </div>
    );
    return linkTo ? <Link to={linkTo}>{card}</Link> : card;
}

export default function Dashboard() {
    const { can } = useRole(); // استخدام دالة فحص الصلاحيات
    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    // جلب البيانات من Firebase
    const fetchData = async (collectionName) => {
        const snap = await getDocs(collection(db, collectionName));
        return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    };

    // جلب المبيعات فقط إذا كان مسموحاً له
    const { data: sales = [], isLoading: salesLoading } = useQuery({
        queryKey: ['sales'],
        queryFn: () => fetchData('sales'),
        enabled: can('can_view_sales')
    });

    const { data: products = [] } = useQuery({ queryKey: ['products'], queryFn: () => fetchData('products') });
    const { data: customers = [] } = useQuery({ queryKey: ['customers'], queryFn: () => fetchData('customers') });

    // حسابات الداشبورد
    const stats = useMemo(() => {
        const thisMonthSales = sales.filter(s => {
            const saleDate = s.created_date?.toDate ? s.created_date.toDate() : new Date(s.created_date);
            return isWithinInterval(saleDate, { start: monthStart, end: monthEnd });
        });

        const revenue = thisMonthSales.reduce((sum, x) => sum + (Number(x.total) || 0), 0);
        const lowStockItems = products.filter(p => (Number(p.stock) || 0) <= (Number(p.min_stock) || 10));
        const activeCustomers = customers.filter(c => c.status !== 'inactive').length;

        const chart = Array.from({ length: 7 }, (_, i) => {
            const d = new Date();
            d.setDate(d.getDate() - (6 - i));
            const dayStr = format(d, 'yyyy-MM-dd');
            const dayLabel = format(d, 'dd/MM');
            const dailyTotal = sales
                .filter(s => {
                    const sDate = s.created_date?.toDate ? s.created_date.toDate() : new Date(s.created_date);
                    return format(sDate, 'yyyy-MM-dd') === dayStr;
                })
                .reduce((sum, x) => sum + (Number(x.total) || 0), 0);
            return { day: dayLabel, total: dailyTotal };
        });

        return { revenue, thisMonthSales, lowStockItems, activeCustomers, chart };
    }, [sales, products, customers]);

    if (salesLoading) return (
        <div className="h-screen flex items-center justify-center bg-slate-50">
            <Loader2 className="w-10 h-10 animate-spin text-indigo-600" />
        </div>
    );

    return (
        <div className="p-6 space-y-6 bg-slate-50/50 min-h-screen" dir="rtl">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black text-slate-800">لوحة التحكم</h1>
                    <p className="text-sm text-slate-500 font-medium mt-1">
                        {format(now, 'EEEE، dd MMMM yyyy')} — أهلاً بك في Nexora ERP
                    </p>
                </div>
                <div className="bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-full px-4 py-1.5 flex items-center gap-2">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                    <span className="text-xs font-black">النظام متصل</span>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* الإيرادات تظهر فقط لمن يملك صلاحية عرض الماليات */}
                {can('can_view_financials') && (
                    <StatCard title="إيرادات الشهر" value={`${stats.revenue.toLocaleString()} ج.م`} sub={`${stats.thisMonthSales.length} فاتورة حالية`} icon={TrendingUp} color="bg-indigo-600" linkTo="/sales" />
                )}

                <StatCard title="العملاء النشطين" value={stats.activeCustomers} sub={`من إجمالي ${customers.length} عميل`} icon={Users} color="bg-cyan-600" linkTo="/customers" />
                <StatCard title="تنبيهات المخزون" value={stats.lowStockItems.length} sub="منتجات وصلت للحد الأدنى" icon={AlertTriangle} color="bg-amber-500" linkTo="/inventory" />
                <StatCard title="إجمالي المنتجات" value={products.length} sub="صنف مسجل في المخزن" icon={Package} color="bg-emerald-600" linkTo="/inventory" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* الشارت يظهر للمدير والمحاسب فقط */}
                {can('can_view_reports') && (
                    <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="font-black text-slate-700 text-lg">تحليل المبيعات (آخر 7 أيام)</h3>
                            <Link to="/sales" className="text-xs font-bold text-indigo-600 hover:text-indigo-700 underline-offset-4 hover:underline">عرض التقارير</Link>
                        </div>
                        <div className="h-72">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={stats.chart}>
                                    <defs>
                                        <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.1} />
                                            <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 12, fontWeight: 600, fill: '#94a3b8' }} dy={10} />
                                    <YAxis hide />
                                    <Tooltip
                                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                                        formatter={(v) => [`${v.toLocaleString()} ج.م`, 'المبيعات']}
                                    />
                                    <Area type="monotone" dataKey="total" stroke="#4f46e5" strokeWidth={4} fill="url(#salesGrad)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )}

                {/* Low Stock List - متاح للجميع */}
                <div className={`${!can('can_view_reports') ? 'lg:col-span-3' : ''} bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col`}>
                    <h3 className="font-black text-slate-700 text-lg mb-6 flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-amber-500" />
                        نواقص المخزن
                    </h3>
                    <div className="space-y-4 overflow-y-auto max-h-[280px] pr-2">
                        {stats.lowStockItems.length > 0 ? stats.lowStockItems.map(p => (
                            <div key={p.id} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100">
                                <span className="text-sm font-bold text-slate-700">{p.name}</span>
                                <span className="text-xs font-black px-2 py-1 bg-amber-100 text-amber-700 rounded-lg">{p.stock} قطعة</span>
                            </div>
                        )) : (
                            <div className="text-center py-10 text-slate-400">
                                <Package className="w-12 h-12 mx-auto opacity-20 mb-2" />
                                <p className="text-xs font-bold">المخزن بحالة ممتازة</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Recent Sales Table - يظهر فقط لمن يملك صلاحية عرض المبيعات */}
            {can('can_view_sales') && (
                <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-slate-50 flex items-center justify-between">
                        <h3 className="font-black text-slate-700 text-lg flex items-center gap-2">
                            <FileText className="w-5 h-5 text-indigo-600" />
                            أحدث الفواتير
                        </h3>
                        <Button variant="ghost" asChild className="text-indigo-600 font-bold">
                            <Link to="/sales">عرض الكل</Link>
                        </Button>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-right">
                            <thead className="bg-slate-50/50">
                                <tr className="text-slate-400 text-xs font-black uppercase">
                                    <th className="px-6 py-4">رقم الفاتورة</th>
                                    <th className="px-6 py-4">العميل</th>
                                    {can('can_view_financials') && <th className="px-6 py-4">الإجمالي</th>}
                                    <th className="px-6 py-4">الحالة</th>
                                    <th className="px-6 py-4">التاريخ</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {sales.slice(0, 5).map(s => (
                                    <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-6 py-4 font-mono text-xs text-indigo-600 font-bold">#{s.id?.slice(-6)}</td>
                                        <td className="px-6 py-4 font-bold text-slate-700 text-sm">{s.customer_name || 'عميل نقدي'}</td>
                                        {can('can_view_financials') && (
                                            <td className="px-6 py-4 font-black text-slate-900 text-sm">{Number(s.total).toLocaleString()} ج.م</td>
                                        )}
                                        <td className="px-6 py-4">
                                            <span className={`text-[10px] font-black px-2 py-1 rounded-full ${s.payment_status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                                {s.payment_status === 'paid' ? 'مدفوعة' : 'معلقة'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-xs text-slate-400 font-medium">
                                            {s.created_date?.toDate ? format(s.created_date.toDate(), 'dd/MM/yyyy') : '—'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}