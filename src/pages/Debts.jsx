import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRole } from '@/lib/RoleContext';
import { useAuth } from '@/lib/AuthContext';
import { logActivity } from '@/lib/activityLogger';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Search, CheckCircle, CalendarClock, Shield, Wallet, Banknote, HandCoins } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/components/ui/use-toast';
import ExportMenu from '@/components/shared/ExportMenu';
import { getDebts, settleDebt } from '@/firebase/collections/debts';
import FieldCollectionsManager from '@/components/debts/FieldCollectionsManager';

import { PageHero, EmptyState } from '@/components/page';
const statusColors = { pending: 'bg-red-500/15 text-red-400', partial: 'bg-amber-500/15 text-amber-400', settled: 'bg-emerald-500/15 text-emerald-400' };
const statusLabels = { pending: 'معلق', partial: 'جزئي', settled: 'مدفوع' };
const directionColors = { owed_to_us: 'bg-blue-500/15 text-blue-400', we_owe: 'bg-rose-500/15 text-rose-400' };
const directionLabels = { owed_to_us: 'مستحق لنا', we_owe: 'مستحق علينا' };

const parseDate = (value) => {
    if (!value) return null;
    if (value?.toDate) return value.toDate();
    return new Date(value);
};

export default function Debts() {
    const { can } = useRole();
    const { user } = useAuth();
    const { toast } = useToast();
    const qc = useQueryClient();

    const [activeTab, setActiveTab] = useState('debts'); // 'debts' | 'field_collections'
    const [search, setSearch] = useState('');
    const [dirFilter, setDirFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
    const [settleId, setSettleId] = useState(null);
    const [settleAmount, setSettleAmount] = useState('');

    const { data: debts = [], isLoading } = useQuery({
        queryKey: ['debts'],
        queryFn: getDebts,
    });

    const settleDebtMutation = useMutation({
        mutationFn: async ({ id, amount }) => settleDebt(id, amount),
        onSuccess: async (_, variables) => {
            qc.invalidateQueries({ queryKey: ['debts'] });
            await logActivity({ user, action: 'settle_debt', entity_type: 'Debt', details: `تسوية دين بمبلغ ${variables.amount}` });
            toast({ title: 'تمت تسوية الدين بنجاح', variant: 'success' });
            setSettleId(null);
            setSettleAmount('');
        },
        onError: (error) => {
            toast({ title: 'حدث خطأ', description: error.message, variant: 'destructive' });
        },
    });

    if (!can('can_view_debts')) {
        return (
            <div className="flex h-64 items-center justify-center">
                <div className="text-center">
                    <Shield className="mx-auto mb-3 h-12 w-12 text-muted-foreground" />
                    <p className="font-bold text-muted-foreground">غير مسموح لك بالوصول إلى هذه الصفحة.</p>
                </div>
            </div>
        );
    }

    const filtered = debts.filter((d) => {
        const matchSearch = (d.party_name || '').toLowerCase().includes(search.toLowerCase());
        const matchDir = dirFilter === 'all' || d.direction === dirFilter;
        const matchStatus = statusFilter === 'all' || (statusFilter === 'active' ? d.status !== 'settled' : d.status === 'settled');
        return matchSearch && matchDir && matchStatus;
    });

    const owedToUs = debts.filter((d) => d.direction === 'owed_to_us' && d.status !== 'settled').reduce((sum, d) => sum + ((Number(d.amount) || 0) - (Number(d.paid_amount) || 0)), 0);
    const weOwe = debts.filter((d) => d.direction === 'we_owe' && d.status !== 'settled').reduce((sum, d) => sum + ((Number(d.amount) || 0) - (Number(d.paid_amount) || 0)), 0);

    const exportData = filtered.map((d) => ({
        'الطرف': d.party_name,
        'النوع': d.party_type,
        'الاتجاه': directionLabels[d.direction] || d.direction,
        'المبلغ': d.amount,
        'المدفوع': d.paid_amount || 0,
        'المتبقي': (Number(d.amount) || 0) - (Number(d.paid_amount) || 0),
        'الحالة': statusLabels[d.status] || d.status,
        'تاريخ الاستحقاق': d.due_date || '',
    }));

    const settleDebtData = debts.find((d) => d.id === settleId);
    const settleRemaining = settleDebtData ? Math.max(0, (Number(settleDebtData.amount) || 0) - (Number(settleDebtData.paid_amount) || 0)) : 0;

    return (
        <div className="space-y-6" dir="rtl">
            <PageHero
                className="mb-0"
                icon={HandCoins}
                tone="magenta"
                title="إدارة الديون والتحصيلات الميدانية"
                subtitle="تتبع المستحقات، وسندات القبض الميدانية، وتصفية العهد النقدية مع الخزينة."
                actions={
                    <>
                        <div className="flex items-center gap-1 rounded-full border border-border bg-card-muted p-1">
                            <Button
                                type="button"
                                size="sm"
                                variant={activeTab === 'debts' ? 'default' : 'ghost'}
                                onClick={() => setActiveTab('debts')}
                                className="h-8 gap-2 rounded-full text-xs font-bold"
                            >
                                <Banknote className="h-4 w-4" />
                                الديون والمستحقات
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                variant={activeTab === 'field_collections' ? 'default' : 'ghost'}
                                onClick={() => setActiveTab('field_collections')}
                                className="h-8 gap-2 rounded-full text-xs font-bold"
                            >
                                <Wallet className="h-4 w-4" />
                                التحصيلات الميدانية والعهد
                            </Button>
                        </div>

                        {activeTab === 'debts' && (
                            <ExportMenu data={exportData} filename="debts" title="تصدير الديون" disabled={!filtered.length} />
                        )}
                    </>
                }
            />

            {/* Tab 1: Field Collections & Cash Custody */}
            {activeTab === 'field_collections' && <FieldCollectionsManager />}

            {/* Tab 2: Classic Debts Management */}
            {activeTab === 'debts' && (
                <div className="space-y-6">
                    <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                    <p className="text-xs font-bold uppercase text-muted-foreground">مستحقاتنا</p>
                    <p className="mt-2 text-2xl font-black text-blue-600">{owedToUs.toLocaleString('ar')} ج.م</p>
                </div>
                <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                    <p className="text-xs font-bold uppercase text-muted-foreground">مستحقات علينا</p>
                    <p className="mt-2 text-2xl font-black text-rose-600">{weOwe.toLocaleString('ar')} ج.م</p>
                </div>
                <div className="rounded-2xl border border-border bg-primary p-5 text-white shadow-sm">
                    <p className="text-xs font-bold uppercase opacity-80">صافي الدين</p>
                    <p className="mt-2 text-2xl font-black">{(owedToUs - weOwe).toLocaleString('ar')} ج.م</p>
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
                <div className="relative flex-1 min-w-[220px]">
                    <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input placeholder="بحث بالاسم أو الوصف..." value={search} onChange={(e) => setSearch(e.target.value)} className="pr-10" />
                </div>
                <Select value={dirFilter} onValueChange={setDirFilter}>
                    <SelectTrigger className="w-44"><SelectValue placeholder="كل الاتجاهات" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">كل الاتجاهات</SelectItem>
                        <SelectItem value="owed_to_us">مستحق لنا</SelectItem>
                        <SelectItem value="we_owe">مستحق علينا</SelectItem>
                    </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-36"><SelectValue placeholder="كل الحالات" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">كل الحالات</SelectItem>
                        <SelectItem value="active">قيد العمل</SelectItem>
                        <SelectItem value="settled">مدفوع</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
                <table className="w-full text-sm text-right">
                    <thead className="border-b border-border bg-muted/50">
                        <tr>
                            <th className="px-5 py-3 font-bold">الطرف</th>
                            <th className="px-4 py-3 font-bold">الاتجاه</th>
                            <th className="px-4 py-3 font-bold">المبلغ</th>
                            <th className="px-4 py-3 font-bold">المتبقي</th>
                            <th className="px-4 py-3 font-bold">تاريخ الاستحقاق</th>
                            <th className="px-4 py-3 font-bold">الحالة</th>
                            <th className="px-4 py-3 text-left">الإجراءات</th>
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading ? (
                            <tr><td colSpan={7} className="py-20 text-center text-muted-foreground">جاري التحميل...</td></tr>
                        ) : filtered.length === 0 ? (
                            <tr><td colSpan={7}><EmptyState text="لا توجد ديون في هذا العرض." /></td></tr>
                        ) : filtered.map((d) => {
                            const remaining = Math.max(0, (Number(d.amount) || 0) - (Number(d.paid_amount) || 0));
                            const isOverdue = d.due_date && parseDate(d.due_date) < new Date() && d.status !== 'settled';
                            return (
                                <tr key={d.id} className="border-b border-border/50 transition-colors hover:bg-muted/20">
                                    <td className="px-5 py-4">
                                        <div className="font-black text-foreground">{d.party_name}</div>
                                        <div className="text-[10px] text-muted-foreground">{d.description || 'بدون وصف'}</div>
                                    </td>
                                    <td className="px-4 py-4">
                                        <span className={`rounded-lg px-2 py-0.5 text-[10px] font-bold ${directionColors[d.direction]}`}>
                                            {directionLabels[d.direction]}
                                        </span>
                                    </td>
                                    <td className="px-4 py-4 font-medium text-foreground">{Number(d.amount || 0).toLocaleString('ar')}</td>
                                    <td className="px-4 py-4">
                                        <div className={`text-base font-black ${remaining > 0 ? 'text-amber-500' : 'text-emerald-500'}`}>
                                            {remaining.toLocaleString('ar')} ج.م
                                        </div>
                                    </td>
                                    <td className="px-4 py-4">
                                        <div className={`flex items-center gap-1.5 text-[11px] font-bold ${isOverdue ? 'text-red-500' : 'text-muted-foreground'}`}>
                                            <CalendarClock className="h-3 w-3" /> {d.due_date ? format(parseDate(d.due_date), 'dd/MM/yyyy') : 'بدون تاريخ'}
                                        </div>
                                    </td>
                                    <td className="px-4 py-4"><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${statusColors[d.status]}`}>{statusLabels[d.status] || d.status}</span></td>
                                    <td className="px-4 py-4 text-left">
                                        <div className="flex items-center justify-end gap-1">
                                            {can('can_edit_debts') && d.status !== 'settled' && (
                                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-emerald-500 hover:bg-emerald-500/10" onClick={() => { setSettleId(d.id); setSettleAmount(remaining.toString()); }}>
                                                    <CheckCircle className="h-4 w-4" />
                                                </Button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <Dialog open={!!settleId} onOpenChange={() => setSettleId(null)}>
                <DialogContent className="max-w-sm rounded-2xl" dir="rtl">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-black">تسوية الدين</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-muted-foreground">المبلغ المطلوب تسويته</label>
                            <Input
                                type="number"
                                value={settleAmount}
                                onChange={(e) => setSettleAmount(e.target.value)}
                                className="h-14 rounded-2xl border-2 border-primary/20 text-center text-2xl font-black text-primary focus:border-primary"
                            />
                            <p className="text-center text-[10px] text-muted-foreground">المتبقي الآن: {settleRemaining.toLocaleString('ar')} ج.م</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Button
                            className="flex-1 h-12 rounded-xl bg-primary font-bold"
                            onClick={() => settleDebtMutation.mutate({ id: settleId, amount: settleAmount })}
                            disabled={settleDebtMutation.isPending || !settleAmount || Number(settleAmount) <= 0}
                        >
                            {settleDebtMutation.isPending ? 'جاري التسوية...' : 'تأكيد التسوية'}
                        </Button>
                        <Button variant="ghost" onClick={() => setSettleId(null)} className="h-12 rounded-xl">إلغاء</Button>
                    </div>
                </DialogContent>
            </Dialog>
                </div>
            )}
        </div>
    );
}
