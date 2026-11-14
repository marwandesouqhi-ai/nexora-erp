import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getAccounts } from '@/firebase/collections/accounts';
import { getExpenses } from '@/firebase/collections/expenses';
import { getDebts } from '@/firebase/collections/debts';
import { getSales } from '@/firebase/collections/sales';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Wallet, Receipt, BadgeAlert, TrendingUp, ArrowLeft, Banknote } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useRole } from '@/lib/RoleContext';

import { PageHero, StatCard } from '@/components/page';
export default function FinancialOverview() {
    const navigate = useNavigate();
    const { can } = useRole();

    const { data: accounts = [], isLoading: accountsLoading } = useQuery({ queryKey: ['accounts-overview'], queryFn: getAccounts });
    const { data: expenses = [], isLoading: expensesLoading } = useQuery({ queryKey: ['expenses-overview'], queryFn: getExpenses });
    const { data: debts = [], isLoading: debtsLoading } = useQuery({ queryKey: ['debts-overview'], queryFn: getDebts });
    const { data: sales = [], isLoading: salesLoading } = useQuery({ queryKey: ['sales-overview'], queryFn: getSales });

    const totalLiquidity = accounts.reduce((sum, account) => sum + (Number(account.balance) || 0), 0);
    const totalExpenses = expenses.reduce((sum, expense) => sum + (Number(expense.amount) || 0), 0);
    const outstandingDebts = debts.filter((debt) => debt.status !== 'settled').reduce((sum, debt) => sum + Math.max(0, (Number(debt.amount) || 0) - (Number(debt.paid_amount) || 0)), 0);
    const totalRevenue = sales.reduce((sum, sale) => sum + (Number(sale.total_amount ?? sale.total) || 0), 0);
    const netRevenueAfterExpenses = totalRevenue - totalExpenses;
    const monthlyTrend = useMemo(() => {
        const now = new Date();
        const toDate = (value) => value?.toDate?.() || (value ? new Date(value) : null);

        return Array.from({ length: 6 }, (_, index) => {
            const monthDate = new Date(now.getFullYear(), now.getMonth() - 5 + index, 1);
            const nextMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1);
            const inMonth = (value) => {
                const date = toDate(value);
                return date && date >= monthDate && date < nextMonth;
            };

            return {
                month: new Intl.DateTimeFormat('ar-EG', { month: 'long' }).format(monthDate),
                revenue: sales.filter((sale) => inMonth(sale.created_at || sale.created_date)).reduce((sum, sale) => sum + (Number(sale.total_amount ?? sale.total) || 0), 0),
                expenses: expenses.filter((expense) => inMonth(expense.created_at || expense.expense_date)).reduce((sum, expense) => sum + (Number(expense.amount) || 0), 0),
            };
        });
    }, [expenses, sales]);

    if (!can('can_view_financials')) {
        return <div className="p-8 text-center text-muted-foreground">غير مسموح لك بالوصول إلى هذه الصفحة.</div>;
    }

    return (
        <div className="space-y-6" dir="rtl">
            <PageHero
                className="mb-0"
                icon={Banknote}
                title="نظرة مالية عامة"
                subtitle="مؤشرات سريعة عن السيولة والمصاريف والديون وأداء النشاط."
                actions={
                    <Button variant="outline" className="gap-2" onClick={() => navigate('/accounts')}>
                        <ArrowLeft className="h-4 w-4" /> العودة للحسابات
                    </Button>
                }
            />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard title="إجمالي السيولة في الحسابات" loading={accountsLoading} value={`${totalLiquidity.toLocaleString('en-US')} ج.م`} icon={Wallet} tone="indigo" />
                <StatCard title="إجمالي المصروفات هذا الشهر" loading={expensesLoading} value={`${totalExpenses.toLocaleString('en-US')} ج.م`} valueClassName="text-danger" icon={Receipt} tone="rose" />
                <StatCard title="إجمالي الديون المستحقة" loading={debtsLoading} value={`${outstandingDebts.toLocaleString('en-US')} ج.م`} icon={BadgeAlert} tone="amber" />
                <StatCard title="صافي الإيرادات بعد المصروفات" loading={salesLoading || expensesLoading} value={`${netRevenueAfterExpenses.toLocaleString('en-US')} ج.م`} valueClassName="text-success" icon={TrendingUp} tone="emerald" />
            </div>

            <div className="grid gap-6 lg:grid-cols-[1.4fr_0.8fr]">
                <Card className="rounded-2xl border border-border bg-card shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-lg font-black text-foreground">المصروفات مقابل الإيرادات (آخر 6 أشهر)</CardTitle>
                    </CardHeader>
                    <CardContent className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={monthlyTrend}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                                <Tooltip />
                                <Area type="monotone" dataKey="revenue" stroke="#2563eb" fill="#bfdbfe" strokeWidth={2} />
                                <Area type="monotone" dataKey="expenses" stroke="#ef4444" fill="#fecaca" strokeWidth={2} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                <Card className="rounded-2xl border border-border bg-card shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-lg font-black text-foreground">آخر الحركات المالية</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {[...expenses.slice(0, 4), ...accounts.slice(0, 4)].sort((a, b) => (b.created_at?.seconds || 0) - (a.created_at?.seconds || 0)).slice(0, 6).map((entry, index) => (
                            <div key={`${entry.id || index}-${entry.description || entry.name}`} className="flex items-center justify-between rounded-2xl border border-border bg-muted/40 px-4 py-3">
                                <div>
                                    <p className="font-bold text-foreground">{entry.description || entry.name || 'حركة مالية'}</p>
                                    <p className="text-xs text-muted-foreground">{entry.category || entry.type || 'عمليات مالية'}</p>
                                </div>
                                <p className={`font-black ${entry.amount ? 'text-destructive' : 'text-success'}`}>
                                    {entry.amount ? `-${Number(entry.amount).toLocaleString('ar')} ج.م` : `${Number(entry.balance || 0).toLocaleString('ar')} ج.م`}
                                </p>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
