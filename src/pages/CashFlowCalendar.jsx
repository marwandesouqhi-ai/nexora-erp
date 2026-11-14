import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRole } from '@/lib/RoleContext';
import { fetchTenantDocs } from '@/lib/tenantFirestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { Wallet, TrendingUp, TrendingDown, Loader2, CalendarDays } from 'lucide-react';

import { PageHero, EmptyState } from '@/components/page';
async function getAllCashflow() {
    return fetchTenantDocs('cashflow', {
        sortFn: (a, b) => (b.timestamp?.toMillis?.() || 0) - (a.timestamp?.toMillis?.() || 0),
    });
}

function toDateKey(entry) {
    const ts = entry.timestamp?.toDate ? entry.timestamp.toDate() : (entry.timestamp ? new Date(entry.timestamp) : new Date());
    return ts.toISOString().slice(0, 10);
}

export default function CashFlowCalendar() {
    const { can } = useRole();
    const [selectedDate, setSelectedDate] = useState(new Date());

    const { data: movements = [], isLoading } = useQuery({ queryKey: ['cashflow-all'], queryFn: getAllCashflow });

    const byDay = useMemo(() => {
        const map = {};
        movements.forEach((m) => {
            const key = toDateKey(m);
            if (!map[key]) map[key] = { income: 0, outcome: 0, items: [] };
            const amount = Number(m.amount || 0);
            if (amount >= 0) map[key].income += amount; else map[key].outcome += Math.abs(amount);
            map[key].items.push(m);
        });
        return map;
    }, [movements]);

    const selectedKey = selectedDate.toISOString().slice(0, 10);
    const dayData = byDay[selectedKey] || { income: 0, outcome: 0, items: [] };
    const monthTotal = useMemo(() => {
        const monthKey = selectedKey.slice(0, 7);
        return Object.entries(byDay).filter(([k]) => k.startsWith(monthKey)).reduce((sum, [, v]) => sum + v.income - v.outcome, 0);
    }, [byDay, selectedKey]);

    if (!can('can_view_financials')) {
        return <div className="p-8 text-center text-muted-foreground">غير مسموح لك بالوصول إلى هذه الصفحة.</div>;
    }

    return (
        <div className="space-y-6" dir="rtl">
            <PageHero
                className="mb-0"
                icon={CalendarDays}
                title="تقويم التدفق النقدي"
                subtitle="استعراض حركة الدخل والخروج المالية يومًا بيوم."
            />

            {isLoading ? (
                <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : (
                <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
                    <Card className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                        <Calendar selected={selectedDate} onSelect={setSelectedDate} />
                        <div className="mt-4 flex items-center justify-between rounded-xl bg-muted/50 px-4 py-3">
                            <span className="text-xs font-bold text-muted-foreground">صافي هذا الشهر</span>
                            <span className={`font-black ${monthTotal >= 0 ? 'text-success' : 'text-destructive'}`}>{monthTotal.toLocaleString('ar')} ج.م</span>
                        </div>
                    </Card>

                    <Card className="rounded-2xl border border-border bg-card shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-lg font-black text-foreground">حركات يوم {selectedKey}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="flex items-center justify-between rounded-xl border border-border bg-emerald-500/5 px-4 py-3">
                                    <TrendingUp className="h-5 w-5 text-emerald-500" />
                                    <span className="font-black text-emerald-600">+{dayData.income.toLocaleString('ar')}</span>
                                </div>
                                <div className="flex items-center justify-between rounded-xl border border-border bg-red-500/5 px-4 py-3">
                                    <TrendingDown className="h-5 w-5 text-destructive" />
                                    <span className="font-black text-destructive">-{dayData.outcome.toLocaleString('ar')}</span>
                                </div>
                            </div>

                            {dayData.items.length === 0 ? (
                                <EmptyState text="لا توجد حركات مالية في هذا اليوم." />
                            ) : (
                                <div className="space-y-2">
                                    {dayData.items.map((m) => (
                                        <div key={m.id} className="flex items-center justify-between rounded-xl border border-border px-4 py-2.5">
                                            <div className="flex items-center gap-2">
                                                <Wallet className="h-4 w-4 text-muted-foreground" />
                                                <div>
                                                    <p className="text-sm font-bold text-foreground">{m.description || m.type}</p>
                                                    <Badge variant="outline" className="mt-0.5 text-[10px]">{m.type}</Badge>
                                                </div>
                                            </div>
                                            <span className={`font-black ${Number(m.amount) >= 0 ? 'text-success' : 'text-destructive'}`}>
                                                {Number(m.amount) >= 0 ? '+' : ''}{Number(m.amount).toLocaleString('ar')}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}
