import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { db } from '@/api/firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { getExpenses } from '@/firebase/collections/expenses';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DollarSign, TrendingUp, Package, Loader2, Calendar, ShoppingBag } from 'lucide-react';
import { format, isWithinInterval, startOfDay, startOfWeek, startOfMonth, subDays } from 'date-fns';
import { ar } from 'date-fns/locale';

export default function Reports() {
    const [timeRange, setTimeRange] = useState('all'); // 'today', 'week', 'month', 'all'

    const { data: sales = [], isLoading } = useQuery({
        queryKey: ['sales-reports'],
        queryFn: async () => {
            const q = query(collection(db, 'sales'), orderBy('created_date', 'desc'));
            const snap = await getDocs(q);
            return snap.docs.map(d => ({
                id: d.id,
                ...d.data(),
                // تحويل التاريخ من Firebase Timestamp إلى Date object
                date: d.data().created_date?.toDate() || new Date()
            }));
        }
    });

    const { data: expenses = [] } = useQuery({
        queryKey: ['expenses-reports'],
        queryFn: getExpenses
    });

    const reportData = useMemo(() => {
        const now = new Date();
        let filteredSales = sales;
        let filteredExpenses = expenses.map(e => ({
            ...e,
            date: e.expense_date?.toDate() || new Date()
        }));

        // 1. منطق الفلترة الزمنية
        if (timeRange === 'today') {
            filteredSales = sales.filter(s => isWithinInterval(s.date, { start: startOfDay(now), end: now }));
            filteredExpenses = filteredExpenses.filter(e => isWithinInterval(e.date, { start: startOfDay(now), end: now }));
        } else if (timeRange === 'week') {
            filteredSales = sales.filter(s => isWithinInterval(s.date, { start: startOfWeek(now), end: now }));
            filteredExpenses = filteredExpenses.filter(e => isWithinInterval(e.date, { start: startOfWeek(now), end: now }));
        } else if (timeRange === 'month') {
            filteredSales = sales.filter(s => isWithinInterval(s.date, { start: startOfMonth(now), end: now }));
            filteredExpenses = filteredExpenses.filter(e => isWithinInterval(e.date, { start: startOfMonth(now), end: now }));
        }

        let totalSales = 0;
        let totalCost = 0;
        let totalExpenses = filteredExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
        const productStats = {}; // لحساب الأصناف الأكثر مبيعاً

        const chartData = [...filteredSales].reverse().map(sale => {
            const saleTotal = Number(sale.total || 0);
            const saleCost = sale.items?.reduce((acc, item) => {
                // تجميع إحصائيات المنتجات
                productStats[item.product_name] = (productStats[item.product_name] || 0) + item.quantity;
                return acc + (Number(item.cost_price || 0) * item.quantity);
            }, 0) || 0;

            totalSales += saleTotal;
            totalCost += saleCost;

            return {
                name: format(sale.date, 'HH:mm'), // عرض الوقت بدلاً من رقم الفاتورة للوضوح
                total: saleTotal,
                profit: saleTotal - saleCost
            };
        });

        // ترتيب أكثر 5 أصناف مبيعاً
        const topProducts = Object.entries(productStats)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5);

        return {
            totalSales,
            totalCost,
            totalExpenses,
            netProfit: totalSales - totalCost - totalExpenses,
            chartData,
            topProducts
        };
    }, [sales, expenses, timeRange]);

    if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-indigo-600" /></div>;

    return (
        <div className="p-6 space-y-6 bg-slate-50/50 min-h-screen" dir="rtl">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-black text-slate-800">التحليل المالي لـ Nexora</h1>
                    <p className="text-slate-500">راقب نمو أرباحك ومبيعاتك بدقة</p>
                </div>

                <div className="flex items-center gap-2 bg-white p-1 rounded-xl shadow-sm border">
                    <Calendar className="w-4 h-4 mr-2 text-slate-400" />
                    <Select value={timeRange} onValueChange={setTimeRange}>
                        <SelectTrigger className="w-[140px] border-none shadow-none focus:ring-0 font-bold">
                            <SelectValue placeholder="اختر الفترة" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">كل المبيعات</SelectItem>
                            <SelectItem value="today">اليوم</SelectItem>
                            <SelectItem value="week">هذا الأسبوع</SelectItem>
                            <SelectItem value="month">هذا الشهر</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </header>

            {/* بطاقات الملخص */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <SummaryCard
                    title="إجمالي المبيعات"
                    value={reportData.totalSales}
                    icon={<DollarSign className="text-blue-600" />}
                    color="blue"
                />
                <SummaryCard
                    title="صافي الربح"
                    value={reportData.netProfit}
                    icon={<TrendingUp className="text-emerald-600" />}
                    color="emerald"
                    isProfit
                />
                <SummaryCard
                    title="تكلفة السلع"
                    value={reportData.totalCost}
                    icon={<Package className="text-amber-600" />}
                    color="amber"
                />
                <SummaryCard
                    title="المصاريف"
                    value={reportData.totalExpenses}
                    icon={<DollarSign className="text-red-600" />}
                    color="red"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* الرسم البياني */}
                <Card className="lg:col-span-2 rounded-3xl shadow-sm border-none p-4 bg-white">
                    <CardHeader>
                        <CardTitle className="text-lg font-black flex items-center gap-2">
                            حركة المبيعات والأرباح
                            <span className="text-xs font-normal text-slate-400">({timeRange})</span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="h-[350px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={reportData.chartData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="name" fontSize={10} tickLine={false} axisLine={false} />
                                <YAxis fontSize={10} tickLine={false} axisLine={false} />
                                <Tooltip
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                                />
                                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                                <Bar dataKey="total" name="المبيعات" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={20} />
                                <Bar dataKey="profit" name="المكسب" fill="#10b981" radius={[4, 4, 0, 0]} barSize={20} />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* الأكثر مبيعاً */}
                <Card className="rounded-3xl shadow-sm border-none bg-white">
                    <CardHeader>
                        <CardTitle className="text-lg font-black flex items-center gap-2">
                            <ShoppingBag className="w-5 h-5 text-indigo-600" />
                            الأكثر طلباً
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {reportData.topProducts.map(([name, count], index) => (
                                <div key={name} className="flex items-center justify-between group">
                                    <div className="flex items-center gap-3">
                                        <span className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                                            {index + 1}
                                        </span>
                                        <span className="font-bold text-slate-700">{name}</span>
                                    </div>
                                    <span className="text-indigo-600 font-black">{count} قطعة</span>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

// بعد حساب totalProfit (اللي هو حالياً ربح المبيعات فقط)
const finalNetProfit = totalProfit - totalExpensesFromDB;
// مكون فرعي للبطاقات لتقليل تكرار الكود
function SummaryCard({ title, value, icon, color, isProfit }) {
    const colors = {
        blue: "bg-blue-50 text-blue-700",
        emerald: "bg-emerald-50 text-emerald-700",
        amber: "bg-amber-50 text-amber-700"
    };

    return (
        <Card className="border-none shadow-sm bg-white overflow-hidden">
            <CardContent className="p-6">
                <div className="flex justify-between items-start">
                    <div>
                        <p className="text-sm font-bold text-slate-500 mb-1">{title}</p>
                        <h3 className={`text-2xl font-black ${isProfit ? 'text-emerald-600' : 'text-slate-800'}`}>
                            {value.toLocaleString()} <span className="text-xs font-normal">ج.م</span>
                        </h3>
                    </div>
                    <div className={`p-3 rounded-2xl ${colors[color]}`}>
                        {icon}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}