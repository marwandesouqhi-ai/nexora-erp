import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getExpenses } from '@/firebase/collections/expenses';
import { getSales } from '@/firebase/collections/sales';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DollarSign, TrendingUp, Package, Loader2, Calendar, ShoppingBag, BarChart3, Receipt } from 'lucide-react';
import { format, isWithinInterval, startOfDay, startOfWeek, startOfMonth } from 'date-fns';

import { PageHero, StatCard } from '@/components/page';
export default function Reports() {
    const [timeRange, setTimeRange] = useState('all'); // 'today', 'week', 'month', 'all'

    const { data: sales = [], isLoading } = useQuery({
        queryKey: ['sales-reports'],
        queryFn: async () => {
            const records = await getSales();
            return records.map((data) => ({
                ...data,
                // تحويل التاريخ من Firebase Timestamp إلى Date object
                date: data.created_date?.toDate() || new Date()
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

        const totalExpenses = filteredExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
        const productStats = {};

        const chartData = [...filteredSales].reverse().map(sale => {
            const saleTotal = Number(sale.total || 0);
            const saleCost = sale.items?.reduce((acc, item) => {
                const quantity = Number(item.quantity || 0);
                productStats[item.product_name] = (productStats[item.product_name] || 0) + quantity;
                return acc + (Number(item.cost_price || 0) * quantity);
            }, 0) || 0;

            return {
                name: format(sale.date, 'HH:mm'),
                total: saleTotal,
                cost: saleCost,
                profit: saleTotal - saleCost
            };
        });

        const totalSales = chartData.reduce((sum, d) => sum + d.total, 0);
        const totalCost = chartData.reduce((sum, d) => sum + d.cost, 0);

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
        <div className="min-h-screen space-y-6 bg-background/70 p-6" dir="rtl">
            <PageHero
                className="mb-0"
                icon={BarChart3}
                tone="indigo"
                title="التحليل المالي لـ Nexora"
                subtitle="راقب نمو أرباحك ومبيعاتك بدقة"
                actions={
                    <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <Select value={timeRange} onValueChange={setTimeRange}>
                            <SelectTrigger className="w-[160px]">
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
                }
            />

            {/* بطاقات الملخص */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard title="إجمالي المبيعات" value={`${reportData.totalSales.toLocaleString('en-US')} ج.م`} icon={DollarSign} tone="blue" />
                <StatCard title="صافي الربح" value={`${reportData.netProfit.toLocaleString('en-US')} ج.م`} valueClassName="text-success" icon={TrendingUp} tone="emerald" />
                <StatCard title="تكلفة السلع" value={`${reportData.totalCost.toLocaleString('en-US')} ج.م`} icon={Package} tone="amber" />
                <StatCard title="المصاريف" value={`${reportData.totalExpenses.toLocaleString('en-US')} ج.م`} valueClassName="text-danger" icon={Receipt} tone="rose" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* الرسم البياني */}
                <Card className="lg:col-span-2 rounded-2xl border border-border bg-card p-4 shadow-card">
                    <CardHeader>
                        <CardTitle className="text-lg font-black flex items-center gap-2">
                            حركة المبيعات والأرباح
                            <span className="text-xs font-normal text-muted-foreground">({timeRange})</span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="h-[350px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={reportData.chartData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
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
                <Card className="rounded-2xl border border-border bg-card shadow-card">
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
                                        <span className="w-6 h-6 rounded-full bg-card-muted flex items-center justify-center text-xs font-bold text-muted-foreground group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                                            {index + 1}
                                        </span>
                                        <span className="font-bold text-secondary-text">{name}</span>
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
