import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getAccounts } from '@/firebase/collections/accounts';
import {
    subscribeReceipts,
    settleRepCustodyToSafe,
    PAYMENT_METHOD_LABELS
} from '@/firebase/collections/receipts';
import { useRole } from '@/lib/RoleContext';
import { useAuth } from '@/lib/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter
} from '@/components/ui/dialog';
import { Banknote, Wallet, CheckCircle2, Clock, Search, User, ArrowDownLeft, ShieldCheck, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

import { EmptyState } from '@/components/page';
export default function FieldCollectionsManager() {
    const { can } = useRole();
    const { user } = useAuth();
    const { toast } = useToast();

    const [receipts, setReceipts] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'unsettled' | 'settled'
    const [methodFilter, setMethodFilter] = useState('all');

    // Settlement modal state
    const [settlingRep, setSettlingRep] = useState(null); // { repId, repName, receipts, totalAmount }
    const [destinationAccountId, setDestinationAccountId] = useState('');
    const [isSettling, setIsSettling] = useState(false);

    // Accounts / safes
    const { data: accounts = [] } = useQuery({
        queryKey: ['safes-for-clearance'],
        queryFn: getAccounts,
    });

    // Real-time listener for receipts
    useEffect(() => {
        setIsLoading(true);
        const unsub = subscribeReceipts(
            (data) => {
                setReceipts(data);
                setIsLoading(false);
            },
            (err) => {
                console.error("Receipts subscribe error:", err);
                setIsLoading(false);
            }
        );
        return () => {
            if (unsub) unsub();
        };
    }, []);

    // Filtered receipts
    const filteredReceipts = useMemo(() => {
        return receipts.filter((r) => {
            const q = search.trim().toLowerCase();
            const matchSearch =
                !q ||
                (r.customerName || r.customer_name || '').toLowerCase().includes(q) ||
                (r.employeeName || r.employee_name || '').toLowerCase().includes(q) ||
                (r.receiptNumber || r.receipt_number || '').toLowerCase().includes(q);

            const isSettled = Boolean(r.is_settled_to_safe || r.settlement_status === 'deposited_to_safe');
            const matchStatus =
                statusFilter === 'all' ||
                (statusFilter === 'settled' ? isSettled : !isSettled);

            const method = r.paymentMethod || r.payment_method || 'cash';
            const matchMethod = methodFilter === 'all' || method === methodFilter;

            return matchSearch && matchStatus && matchMethod;
        });
    }, [receipts, search, statusFilter, methodFilter]);

    // Aggregate cash custody per sales rep (العهد النقدية المحصلة في الميدان وغير الموردة بعد)
    const repsCustody = useMemo(() => {
        const map = new Map();

        receipts.forEach((r) => {
            const repId = r.employeeId || r.employee_id || 'unknown';
            const repName = r.employeeName || r.employee_name || 'مندوب غير محدد';
            const isCash = (r.paymentMethod || r.payment_method || 'cash') === 'cash';
            const isSettled = Boolean(r.is_settled_to_safe || r.settlement_status === 'deposited_to_safe');
            const amount = Number(r.amount || 0);

            if (!map.has(repId)) {
                map.set(repId, {
                    repId,
                    repName,
                    totalCollected: 0,
                    unsettledCash: 0,
                    unsettledReceipts: [],
                    settledCount: 0,
                });
            }

            const repData = map.get(repId);
            repData.totalCollected += amount;

            if (isCash && !isSettled) {
                repData.unsettledCash += amount;
                repData.unsettledReceipts.push(r);
            } else if (isSettled) {
                repData.settledCount += 1;
            }
        });

        return Array.from(map.values());
    }, [receipts]);

    const totalUnsettledCashAll = repsCustody.reduce((sum, r) => sum + r.unsettledCash, 0);
    const totalCollectedToday = receipts.reduce((sum, r) => sum + Number(r.amount || 0), 0);

    // Execute Cash Clearance
    const handleConfirmSettlement = async () => {
        if (!settlingRep) return;
        const accountId = destinationAccountId || accounts[0]?.id;
        if (!accountId) {
            toast({ title: 'يرجى اختيار الخزينة المودع بها المبلغ', variant: 'destructive' });
            return;
        }

        setIsSettling(true);
        try {
            const receiptIds = settlingRep.unsettledReceipts.map((r) => r.id);
            const res = await settleRepCustodyToSafe({
                repId: settlingRep.repId,
                repName: settlingRep.repName,
                receiptIds,
                totalAmount: settlingRep.unsettledCash,
                accountId,
                cashierUser: user?.displayName || user?.email || 'أمين الخزينة',
            });

            if (res.success) {
                toast({
                    title: 'تمت تصفية وتوريد العهدة بنجاح',
                    description: `تم إيداع مبلغ ${settlingRep.unsettledCash.toLocaleString()} جنيه بالخزينة وإشعار المندوب.`,
                    variant: 'success',
                });
                setSettlingRep(null);
                setDestinationAccountId('');
            } else {
                toast({
                    title: 'فشل التوريد للخزينة',
                    description: res.error || 'حدث خطأ غير متوقع',
                    variant: 'destructive',
                });
            }
        } catch (err) {
            toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
        } finally {
            setIsSettling(false);
        }
    };

    return (
        <div className="space-y-6" dir="rtl">
            {/* Top Summary Banner */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Card className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                                إجمالي العهد النقدية في الميدان (غير موردة)
                            </p>
                            <p className="mt-1 text-2xl font-black text-amber-700 dark:text-amber-400">
                                {totalUnsettledCashAll.toLocaleString()} جنيه
                            </p>
                        </div>
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20 text-amber-600">
                            <Clock className="h-5 w-5" />
                        </span>
                    </div>
                </Card>

                <Card className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                                إجمالي التحصيلات المسجلة
                            </p>
                            <p className="mt-1 text-2xl font-black text-emerald-700 dark:text-emerald-400">
                                {totalCollectedToday.toLocaleString()} جنيه
                            </p>
                        </div>
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-600">
                            <Banknote className="h-5 w-5" />
                        </span>
                    </div>
                </Card>

                <Card className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs font-semibold text-muted-foreground">
                                عدد سندات التحصيل
                            </p>
                            <p className="mt-1 text-2xl font-black text-foreground">
                                {receipts.length} سند قبض
                            </p>
                        </div>
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                            <CheckCircle2 className="h-5 w-5" />
                        </span>
                    </div>
                </Card>
            </div>

            {/* Reps Cash Custody Section */}
            <div>
                <h2 className="text-sm font-black text-foreground mb-3 flex items-center gap-2">
                    <Wallet className="h-4 w-4 text-primary" />
                    متابعة وتصفية العهد النقدية للمناديب (نهاية اليوم)
                </h2>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {repsCustody.map((rep) => {
                        const hasCustody = rep.unsettledCash > 0;
                        return (
                            <Card
                                key={rep.repId}
                                className={`rounded-2xl border p-4 shadow-sm transition-all ${
                                    hasCustody ? 'border-amber-500/30 bg-card' : 'border-border bg-muted/20 opacity-80'
                                }`}
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-2.5">
                                        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                                            <User className="h-4 w-4" />
                                        </span>
                                        <div>
                                            <p className="text-sm font-bold text-foreground">{rep.repName}</p>
                                            <p className="text-[11px] text-muted-foreground">
                                                {rep.unsettledReceipts.length} سندات نقدية غير موردة
                                            </p>
                                        </div>
                                    </div>
                                    <Badge
                                        variant="outline"
                                        className={hasCustody ? 'border-amber-500/30 bg-amber-500/10 text-amber-600 text-[10px]' : 'text-[10px]'}
                                    >
                                        {hasCustody ? 'بعهدته نقدية' : 'مصفاة'}
                                    </Badge>
                                </div>

                                <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-3">
                                    <div>
                                        <span className="text-[10px] text-muted-foreground block">العهدة النقدية المعلقة:</span>
                                        <span className="font-mono text-base font-black text-foreground">
                                            {rep.unsettledCash.toLocaleString()} جنيه
                                        </span>
                                    </div>

                                    {hasCustody && can('can_manage_accounts') && (
                                        <Button
                                            size="sm"
                                            onClick={() => {
                                                setSettlingRep(rep);
                                                setDestinationAccountId(accounts[0]?.id || '');
                                            }}
                                            className="h-8 gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
                                        >
                                            <ArrowDownLeft className="h-3.5 w-3.5" />
                                            تصفية وتوريد للخزينة
                                        </Button>
                                    )}
                                </div>
                            </Card>
                        );
                    })}
                </div>
            </div>

            {/* Filter Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
                <div className="flex flex-wrap items-center gap-2 flex-1">
                    <div className="relative min-w-[200px] flex-1">
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="بحث برقم السند، العميل، أو المندوب..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pr-9 rounded-xl border-border text-xs"
                        />
                    </div>

                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-44 rounded-xl border-border text-xs">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent dir="rtl">
                            <SelectItem value="all">كافة السندات</SelectItem>
                            <SelectItem value="unsettled">في عهدة المندوب (غير موردة)</SelectItem>
                            <SelectItem value="settled">تم التوريد للخزينة</SelectItem>
                        </SelectContent>
                    </Select>

                    <Select value={methodFilter} onValueChange={setMethodFilter}>
                        <SelectTrigger className="w-40 rounded-xl border-border text-xs">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent dir="rtl">
                            <SelectItem value="all">كافة طرق الدفع</SelectItem>
                            <SelectItem value="cash">نقداً (كاش)</SelectItem>
                            <SelectItem value="bank_transfer">تحويل بنكي</SelectItem>
                            <SelectItem value="cheque">شيك</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Receipts Log Table */}
            <Card className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
                <CardHeader className="border-b border-border/50 px-6 py-4">
                    <CardTitle className="text-sm font-black text-foreground">
                        سجل سندات التحصيل الميدانية اللحظية
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    {isLoading ? (
                        <div className="py-16 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin text-primary" />
                            جارٍ تحميل سندات التحصيل...
                        </div>
                    ) : filteredReceipts.length === 0 ? (
                        <EmptyState text="لا توجد سندات تحصيل مطابقة." />
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow className="border-border bg-muted/30">
                                        <TableHead className="text-right font-black">رقم السند</TableHead>
                                        <TableHead className="text-right font-black">العميل</TableHead>
                                        <TableHead className="text-right font-black">المندوب</TableHead>
                                        <TableHead className="text-right font-black">طريقة الدفع</TableHead>
                                        <TableHead className="text-right font-black">المبلغ المحصل</TableHead>
                                        <TableHead className="text-right font-black">التاريخ</TableHead>
                                        <TableHead className="text-right font-black">حالة الخزينة</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredReceipts.map((r) => {
                                        const isSettled = Boolean(r.is_settled_to_safe || r.settlement_status === 'deposited_to_safe');
                                        const method = r.paymentMethod || r.payment_method || 'cash';
                                        return (
                                            <TableRow key={r.id} className="border-border hover:bg-muted/20">
                                                <TableCell className="font-mono text-xs font-bold text-foreground">
                                                    {r.receiptNumber || r.receipt_number || r.id}
                                                </TableCell>
                                                <TableCell className="font-bold text-foreground">
                                                    {r.customerName || r.customer_name || 'عميل'}
                                                </TableCell>
                                                <TableCell className="text-xs text-foreground">
                                                    {r.employeeName || r.employee_name || 'مندوب'}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="outline" className="text-[10px] gap-1 border-border">
                                                        {PAYMENT_METHOD_LABELS[method] || method}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <span className="font-mono text-sm font-black text-emerald-600 dark:text-emerald-400">
                                                        {Number(r.amount || 0).toLocaleString()} جنيه
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-xs text-muted-foreground font-mono">
                                                    {r.date} {r.time || ''}
                                                </TableCell>
                                                <TableCell>
                                                    {isSettled ? (
                                                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                                            <CheckCircle2 className="h-3 w-3" />
                                                            موردة للخزينة
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-bold text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                                            <Clock className="h-3 w-3" />
                                                            في عهدة المندوب
                                                        </span>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Modal: Cash Clearance & Safe Deposit */}
            <Dialog open={!!settlingRep} onOpenChange={(v) => !v && setSettlingRep(null)}>
                <DialogContent className="max-w-md rounded-2xl p-6" dir="rtl">
                    <DialogHeader className="space-y-1">
                        <DialogTitle className="flex items-center gap-2 text-lg font-black text-foreground">
                            <ShieldCheck className="h-5 w-5 text-emerald-600" />
                            تصفية وتوريد العهدة النقدية للخزينة
                        </DialogTitle>
                        <DialogDescription className="text-xs text-muted-foreground">
                            تأكيد استلام النقدية المحصلة من المندوب في نهاية اليوم وتوريدها إلى الخزينة.
                        </DialogDescription>
                    </DialogHeader>

                    {settlingRep && (
                        <div className="space-y-4 mt-2">
                            <div className="rounded-xl border border-border bg-muted/40 p-3 space-y-1.5 text-xs">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">المندوب:</span>
                                    <span className="font-bold text-foreground">{settlingRep.repName}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">عدد سندات القبض:</span>
                                    <span className="font-bold text-foreground">{settlingRep.unsettledReceipts.length} سندات</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">إجمالي المبلغ المسلّم:</span>
                                    <span className="font-bold font-mono text-emerald-600 text-sm">
                                        {settlingRep.unsettledCash.toLocaleString()} جنيه
                                    </span>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                                    <Wallet className="h-3.5 w-3.5 text-primary" />
                                    الخزينة المودع بها المبلغ
                                </label>
                                <Select value={destinationAccountId} onValueChange={setDestinationAccountId}>
                                    <SelectTrigger className="rounded-xl border-border">
                                        <SelectValue placeholder="اختر الخزينة..." />
                                    </SelectTrigger>
                                    <SelectContent dir="rtl">
                                        {accounts.map((acc) => (
                                            <SelectItem key={acc.id} value={acc.id}>
                                                {acc.name} (رصيدها الحالي: {Number(acc.balance || 0).toLocaleString()} ج)
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    )}

                    <DialogFooter className="flex items-center justify-end gap-2 pt-4 border-t border-border mt-3">
                        <Button variant="ghost" onClick={() => setSettlingRep(null)} className="rounded-xl text-xs">
                            إلغاء
                        </Button>
                        <Button
                            disabled={isSettling}
                            onClick={handleConfirmSettlement}
                            className="rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
                        >
                            {isSettling ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                            تأكيد استلام النقدية وتوريد الخزينة
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
