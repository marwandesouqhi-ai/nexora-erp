import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSales } from '@/firebase/collections/sales';
import { getExpenses } from '@/firebase/collections/expenses';
import { saveProfitReport, getProfitReports } from '@/firebase/collections/profit_reports';
import { useRole } from '@/lib/RoleContext';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { FileBarChart, Save, Loader2, ShoppingCart, Package, Receipt, TrendingUp } from 'lucide-react';
import { startOfWeek, startOfMonth, startOfDay, isWithinInterval, format } from 'date-fns';
import { useToast } from '@/components/ui/use-toast';

import { PageHero, StatCard, EmptyState } from '@/components/page';
const PERIODS = [
    { value: 'daily', label: 'يومي' },
    { value: 'weekly', label: 'أسبوعي' },
    { value: 'monthly', label: 'شهري' },
];

export default function ProfitReports() {
    const { can } = useRole();
    const { user } = useAuth();
    const { toast } = useToast();
    const qc = useQueryClient();
    const [periodType, setPeriodType] = useState('monthly');

    const { data: sales = [] } = useQuery({ queryKey: ['sales-profit-report'], queryFn: getSales });
    const { data: expenses = [] } = useQuery({ queryKey: ['expenses-profit-report'], queryFn: getExpenses });
    const { data: savedReports = [], isLoading } = useQuery({ queryKey: ['saved-profit-reports'], queryFn: getProfitReports });

    const summary = useMemo(() => {
        const now = new Date();
        const start = periodType === 'daily' ? startOfDay(now) : periodType === 'weekly' ? startOfWeek(now) : startOfMonth(now);
        const inRange = (d) => d && isWithinInterval(d, { start, end: now });

        const filteredSales = sales.filter((s) => inRange(s.created_date?.toDate ? s.created_date.toDate() : new Date(s.created_date || now)));
        const filteredExpenses = expenses.filter((e) => inRange(e.expense_date?.toDate ? e.expense_date.toDate() : new Date(e.expense_date || now)));

        const totalSales = filteredSales.reduce((sum, s) => sum + Number(s.total || 0), 0);
        const totalCost = filteredSales.reduce((sum, s) => sum + (s.items?.reduce((a, i) => a + Number(i.cost_price || 0) * Number(i.quantity || 0), 0) || 0), 0);
        const totalExpenses = filteredExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
        const netProfit = totalSales - totalCost - totalExpenses;

        return { totalSales, totalCost, totalExpenses, netProfit, startDate: format(start, 'yyyy-MM-dd'), endDate: format(now, 'yyyy-MM-dd') };
    }, [sales, expenses, periodType]);

    const saveMutation = useMutation({
        mutationFn: () => saveProfitReport({
            periodLabel: `${PERIODS.find((p) => p.value === periodType).label} - ${summary.endDate}`,
            periodType,
            startDate: summary.startDate,
            endDate: summary.endDate,
            totalSales: summary.totalSales,
            totalCost: summary.totalCost,
            totalExpenses: summary.totalExpenses,
            netProfit: summary.netProfit,
            userId: user?.uid,
        }),
        onSuccess: () => { qc.invalidateQueries(['saved-profit-reports']); toast({ title: 'تم حفظ التقرير في الأرشيف الدوري' }); },
    });

    if (!can('can_view_financials')) {
        return <div className="p-8 text-center text-muted-foreground">غير مسموح لك بالوصول إلى هذه الصفحة.</div>;
    }

    return (
        <div className="space-y-6" dir="rtl">
            <PageHero
                className="mb-0"
                icon={FileBarChart}
                tone="indigo"
                title="تقرير الأرباح الدورية"
                subtitle="إنشاء وحفظ تقارير أرباح يومية/أسبوعية/شهرية في أرشيف دوري."
                actions={
                    <Select value={periodType} onValueChange={setPeriodType}>
                        <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                        <SelectContent>{PERIODS.map((p) => (<SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>))}</SelectContent>
                    </Select>
                }
            />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard title="إجمالي المبيعات" value={`${summary.totalSales.toLocaleString('en-US')} ج.م`} icon={ShoppingCart} tone="indigo" />
                <StatCard title="تكلفة البضاعة" value={`${summary.totalCost.toLocaleString('en-US')} ج.م`} icon={Package} tone="amber" />
                <StatCard title="المصاريف" value={`${summary.totalExpenses.toLocaleString('en-US')} ج.م`} valueClassName="text-danger" icon={Receipt} tone="rose" />
                <StatCard title="صافي الربح" value={`${summary.netProfit.toLocaleString('en-US')} ج.م`} valueClassName={summary.netProfit >= 0 ? 'text-success' : 'text-danger'} icon={TrendingUp} tone="emerald" />
            </div>

            <Button className="gap-2" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                <Save className="h-4 w-4" /> {saveMutation.isPending ? 'جاري الحفظ...' : 'حفظ التقرير في الأرشيف'}
            </Button>

            <Card className="rounded-2xl border border-border bg-card shadow-sm">
                <CardHeader><CardTitle className="flex items-center gap-2 text-lg font-black text-foreground"><FileBarChart className="h-5 w-5" /> الأرشيف الدوري</CardTitle></CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
                    ) : savedReports.length === 0 ? (
                        <EmptyState text="لا توجد تقارير محفوظة بعد." />
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="text-right">الفترة</TableHead>
                                    <TableHead className="text-right">المبيعات</TableHead>
                                    <TableHead className="text-right">المصاريف</TableHead>
                                    <TableHead className="text-right">صافي الربح</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {savedReports.map((r) => (
                                    <TableRow key={r.id}>
                                        <TableCell className="font-bold">{r.period_label}</TableCell>
                                        <TableCell>{Number(r.total_sales).toLocaleString('ar')} ج.م</TableCell>
                                        <TableCell>{Number(r.total_expenses).toLocaleString('ar')} ج.م</TableCell>
                                        <TableCell className="font-black text-success">{Number(r.net_profit).toLocaleString('ar')} ج.م</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
