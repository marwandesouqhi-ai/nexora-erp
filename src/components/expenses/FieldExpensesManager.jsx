import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getAccounts } from '@/firebase/collections/accounts';
import {
    subscribeFieldExpenses,
    approveFieldExpense,
    rejectFieldExpense,
    CATEGORY_LABELS
} from '@/firebase/collections/field_expenses';
import { useAuth } from '@/lib/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { Fuel, Receipt, Wrench, Coffee, CreditCard, CheckCircle2, XCircle, Clock, Eye, ExternalLink, Search, ShieldCheck, Loader2, Wallet, User } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

import { EmptyState } from '@/components/page';
const CATEGORY_ICONS = {
    fuel: Fuel,
    toll: CreditCard,
    maintenance: Wrench,
    hospitality: Coffee,
    other: Receipt,
};

export default function FieldExpensesManager() {
    const { user } = useAuth();
    const { toast } = useToast();

    const [expenses, setExpenses] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('pending'); // 'all' | 'pending' | 'approved' | 'rejected'
    const [categoryFilter, setCategoryFilter] = useState('all');

    // Modals state
    const [previewImage, setPreviewImage] = useState(null);
    const [approvingExpense, setApprovingExpense] = useState(null);
    const [selectedAccountId, setSelectedAccountId] = useState('');
    const [approvalNotes, setApprovalNotes] = useState('');
    const [isApproving, setIsApproving] = useState(false);

    const [rejectingExpense, setRejectingExpense] = useState(null);
    const [rejectionReason, setRejectionReason] = useState('');
    const [isRejecting, setIsRejecting] = useState(false);

    // Accounts for safe deduction
    const { data: accounts = [] } = useQuery({
        queryKey: ['expense-accounts-field'],
        queryFn: getAccounts,
    });

    // Real-time listener for field expenses
    useEffect(() => {
        setIsLoading(true);
        const unsub = subscribeFieldExpenses(
            (data) => {
                setExpenses(data);
                setIsLoading(false);
            },
            (err) => {
                console.error("Field expenses subscription error:", err);
                setIsLoading(false);
            }
        );
        return () => {
            if (unsub) unsub();
        };
    }, []);

    // Filtered expenses
    const filtered = useMemo(() => {
        return expenses.filter((e) => {
            const matchesSearch =
                !search.trim() ||
                (e.employee_name || '').toLowerCase().includes(search.toLowerCase()) ||
                (e.notes || '').toLowerCase().includes(search.toLowerCase());

            const matchesStatus = statusFilter === 'all' || e.status === statusFilter;
            const matchesCategory = categoryFilter === 'all' || e.category === categoryFilter;

            return matchesSearch && matchesStatus && matchesCategory;
        });
    }, [expenses, search, statusFilter, categoryFilter]);

    // KPI Counters
    const stats = useMemo(() => {
        let pendingCount = 0;
        let pendingTotal = 0;
        let approvedCount = 0;
        let approvedTotal = 0;
        let rejectedCount = 0;

        expenses.forEach((e) => {
            const amt = Number(e.amount) || 0;
            if (e.status === 'pending' || !e.status) {
                pendingCount++;
                pendingTotal += amt;
            } else if (e.status === 'approved') {
                approvedCount++;
                approvedTotal += amt;
            } else if (e.status === 'rejected') {
                rejectedCount++;
            }
        });

        return { pendingCount, pendingTotal, approvedCount, approvedTotal, rejectedCount };
    }, [expenses]);

    // Handle Approve Submit
    const handleConfirmApprove = async () => {
        if (!approvingExpense) return;
        setIsApproving(true);
        try {
            const res = await approveFieldExpense(approvingExpense.id, {
                accountId: selectedAccountId || (accounts[0]?.id || ''),
                approvedBy: user?.displayName || user?.email || 'المسؤول المالي',
                notes: approvalNotes,
            });

            if (res.success) {
                toast({
                    title: 'تم اعتماد المصروف الميداني بنجاح',
                    description: `تم خصم ${approvingExpense.amount} جنيه من الخزينة وإشعار المندوب.`,
                    variant: 'success',
                });
                setApprovingExpense(null);
                setSelectedAccountId('');
                setApprovalNotes('');
            } else {
                toast({
                    title: 'فشل اعتماد المصروف',
                    description: res.error || 'حدث خطأ أثناء الخصم من الخزينة',
                    variant: 'destructive',
                });
            }
        } catch (err) {
            toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
        } finally {
            setIsApproving(false);
        }
    };

    // Handle Reject Submit
    const handleConfirmReject = async () => {
        if (!rejectingExpense) return;
        if (!rejectionReason.trim()) {
            toast({ title: 'يرجى كتابة سبب الرفض', variant: 'destructive' });
            return;
        }

        setIsRejecting(true);
        try {
            const res = await rejectFieldExpense(rejectingExpense.id, {
                rejectionReason: rejectionReason.trim(),
                rejectedBy: user?.displayName || user?.email || 'المسؤول المالي',
            });

            if (res.success) {
                toast({
                    title: 'تم رفض طلب المصروف الميداني',
                    description: 'تم إرسال إشعار لحظي للمندوب مع سبب الرفض.',
                });
                setRejectingExpense(null);
                setRejectionReason('');
            } else {
                toast({
                    title: 'فشل الرفض',
                    description: res.error || 'حدث خطأ',
                    variant: 'destructive',
                });
            }
        } catch (err) {
            toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
        } finally {
            setIsRejecting(false);
        }
    };

    return (
        <div className="space-y-6" dir="rtl">
            {/* KPI Stats Cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {/* Pending */}
                <Card className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                                طلبات بانتظار الاعتماد
                            </p>
                            <div className="mt-1 flex items-baseline gap-2">
                                <span className="text-2xl font-black text-amber-700 dark:text-amber-400">
                                    {stats.pendingCount}
                                </span>
                                <span className="text-xs font-bold text-muted-foreground">
                                    ({stats.pendingTotal.toLocaleString()} جنيه)
                                </span>
                            </div>
                        </div>
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400">
                            <Clock className="h-5 w-5" />
                        </span>
                    </div>
                </Card>

                {/* Approved */}
                <Card className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                                مصروفات معتمدة
                            </p>
                            <div className="mt-1 flex items-baseline gap-2">
                                <span className="text-2xl font-black text-emerald-700 dark:text-emerald-400">
                                    {stats.approvedCount}
                                </span>
                                <span className="text-xs font-bold text-muted-foreground">
                                    ({stats.approvedTotal.toLocaleString()} جنيه)
                                </span>
                            </div>
                        </div>
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="h-5 w-5" />
                        </span>
                    </div>
                </Card>

                {/* Rejected */}
                <Card className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-4 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs font-semibold text-rose-700 dark:text-rose-400">
                                مصروفات مرفوضة
                            </p>
                            <p className="mt-1 text-2xl font-black text-rose-700 dark:text-rose-400">
                                {stats.rejectedCount}
                            </p>
                        </div>
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/20 text-rose-600 dark:text-rose-400">
                            <XCircle className="h-5 w-5" />
                        </span>
                    </div>
                </Card>
            </div>

            {/* Filter Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
                <div className="flex flex-wrap items-center gap-2 flex-1">
                    <div className="relative min-w-[200px] flex-1">
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="بحث باسم المندوب أو البيان..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pr-9 rounded-xl border-border text-xs"
                        />
                    </div>

                    {/* Status Filter */}
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-40 rounded-xl border-border text-xs">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent dir="rtl">
                            <SelectItem value="all">كافة الحالات</SelectItem>
                            <SelectItem value="pending">قيد المراجعة</SelectItem>
                            <SelectItem value="approved">معتمدة</SelectItem>
                            <SelectItem value="rejected">مرفوضة</SelectItem>
                        </SelectContent>
                    </Select>

                    {/* Category Filter */}
                    <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                        <SelectTrigger className="w-44 rounded-xl border-border text-xs">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent dir="rtl">
                            <SelectItem value="all">كافة التصنيفات</SelectItem>
                            {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                                <SelectItem key={k} value={k}>{v}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Expenses Table */}
            <Card className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
                <CardContent className="p-0">
                    {isLoading ? (
                        <div className="py-16 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin text-primary" />
                            جارٍ تحميل المصروفات الميدانية اللحظية...
                        </div>
                    ) : filtered.length === 0 ? (
                        <EmptyState text="لا توجد مصروفات ميدانية مطابقة للفلتر المحدد." />
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow className="border-border bg-muted/40">
                                        <TableHead className="text-right font-black">المندوب</TableHead>
                                        <TableHead className="text-right font-black">التصنيف</TableHead>
                                        <TableHead className="text-right font-black">المبلغ</TableHead>
                                        <TableHead className="text-right font-black">التاريخ والبيان</TableHead>
                                        <TableHead className="text-right font-black">الإيصال</TableHead>
                                        <TableHead className="text-right font-black">الحالة</TableHead>
                                        <TableHead className="text-center font-black">إجراءات الاعتماد</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filtered.map((e) => {
                                        const IconComp = CATEGORY_ICONS[e.category] || Receipt;
                                        const isPending = e.status === 'pending' || !e.status;
                                        const isApproved = e.status === 'approved';
                                        const isRejected = e.status === 'rejected';

                                        return (
                                            <TableRow key={e.id} className="border-border hover:bg-muted/20">
                                                {/* المندوب */}
                                                <TableCell className="font-bold text-foreground">
                                                    <div className="flex items-center gap-2">
                                                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                                            <User className="h-4 w-4" />
                                                        </span>
                                                        <span>{e.employee_name || 'مندوب ميداني'}</span>
                                                    </div>
                                                </TableCell>

                                                {/* التصنيف */}
                                                <TableCell>
                                                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/50 px-2.5 py-1 text-xs font-medium text-foreground">
                                                        <IconComp className="h-3.5 w-3.5 text-primary" />
                                                        {CATEGORY_LABELS[e.category] || e.category || 'أخرى'}
                                                    </span>
                                                </TableCell>

                                                {/* المبلغ */}
                                                <TableCell>
                                                    <span className="font-mono text-sm font-black text-foreground">
                                                        {Number(e.amount || 0).toLocaleString()} جنيه
                                                    </span>
                                                </TableCell>

                                                {/* التاريخ والبيان */}
                                                <TableCell className="max-w-xs">
                                                    <p className="text-xs text-foreground line-clamp-1">{e.notes || '—'}</p>
                                                    <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                                                        {e.date || (e.created_at?.toDate ? e.created_at.toDate().toLocaleDateString('ar-EG') : '—')}
                                                    </p>
                                                </TableCell>

                                                {/* الإيصال المرفوع */}
                                                <TableCell>
                                                    {e.receipt_url ? (
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => setPreviewImage(e.receipt_url)}
                                                            className="h-7 text-xs gap-1.5 rounded-xl border-border hover:border-primary"
                                                        >
                                                            <Eye className="h-3.5 w-3.5 text-primary" />
                                                            معاينة الإيصال
                                                        </Button>
                                                    ) : (
                                                        <span className="text-xs text-muted-foreground italic">بدون صورة</span>
                                                    )}
                                                </TableCell>

                                                {/* الحالة */}
                                                <TableCell>
                                                    {isPending && (
                                                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-bold text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                                            <Clock className="h-3 w-3" />
                                                            قيد المراجعة
                                                        </span>
                                                    )}
                                                    {isApproved && (
                                                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                                            <CheckCircle2 className="h-3 w-3" />
                                                            معتمد
                                                        </span>
                                                    )}
                                                    {isRejected && (
                                                        <div className="flex flex-col gap-0.5">
                                                            <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2.5 py-1 text-xs font-bold text-rose-600 dark:text-rose-400 border border-rose-500/20">
                                                                <XCircle className="h-3 w-3" />
                                                                مرفوض
                                                            </span>
                                                            {e.rejection_reason && (
                                                                <span className="text-[10px] text-rose-500 max-w-[150px] truncate" title={e.rejection_reason}>
                                                                    السبب: {e.rejection_reason}
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}
                                                </TableCell>

                                                {/* إجراءات سريعة */}
                                                <TableCell className="text-center">
                                                    {isPending ? (
                                                        <div className="flex items-center justify-center gap-1.5">
                                                            <Button
                                                                size="sm"
                                                                onClick={() => {
                                                                    setApprovingExpense(e);
                                                                    setSelectedAccountId(accounts[0]?.id || '');
                                                                }}
                                                                className="h-7 text-xs gap-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                                                            >
                                                                <CheckCircle2 className="h-3.5 w-3.5" />
                                                                اعتماد
                                                            </Button>

                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => setRejectingExpense(e)}
                                                                className="h-7 text-xs gap-1 rounded-xl border-rose-300 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 dark:border-rose-900"
                                                            >
                                                                <XCircle className="h-3.5 w-3.5" />
                                                                رفض
                                                            </Button>
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs text-muted-foreground font-mono">
                                                            {e.approved_by || e.rejected_by || 'تمت المعالجة'}
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

            {/* Modal: Preview Receipt Image */}
            <Dialog open={!!previewImage} onOpenChange={(v) => !v && setPreviewImage(null)}>
                <DialogContent className="max-w-xl rounded-2xl p-6" dir="rtl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center justify-between text-base font-black">
                            <span>صورة إيصال المصروف الميداني</span>
                            {previewImage && (
                                <a
                                    href={previewImage}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"
                                >
                                    فتح الصورة بحجمها الكامل
                                    <ExternalLink className="h-3.5 w-3.5" />
                                </a>
                            )}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="mt-3 overflow-hidden rounded-2xl border border-border bg-muted/20 flex items-center justify-center p-2">
                        {previewImage && (
                            <img
                                src={previewImage}
                                alt="إيصال المصروف"
                                className="max-h-[500px] w-auto rounded-xl object-contain shadow-sm"
                            />
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Modal: Confirm Approval */}
            <Dialog open={!!approvingExpense} onOpenChange={(v) => !v && setApprovingExpense(null)}>
                <DialogContent className="max-w-md rounded-2xl p-6" dir="rtl">
                    <DialogHeader className="space-y-1">
                        <DialogTitle className="flex items-center gap-2 text-lg font-black text-foreground">
                            <ShieldCheck className="h-5 w-5 text-emerald-600" />
                            اعتماد وصرف المصروف الميداني
                        </DialogTitle>
                        <DialogDescription className="text-xs text-muted-foreground">
                            سيتم خصم المبلغ من الخزينة وتحديث الرصيد وتسجيل التدفق المالي فورياً.
                        </DialogDescription>
                    </DialogHeader>

                    {approvingExpense && (
                        <div className="space-y-4 mt-2">
                            <div className="rounded-xl border border-border bg-muted/40 p-3 space-y-1.5 text-xs">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">المندوب:</span>
                                    <span className="font-bold text-foreground">{approvingExpense.employee_name}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">التصنيف:</span>
                                    <span className="font-bold text-foreground">
                                        {CATEGORY_LABELS[approvingExpense.category] || approvingExpense.category}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">المبلغ:</span>
                                    <span className="font-bold font-mono text-emerald-600 text-sm">
                                        {Number(approvingExpense.amount).toLocaleString()} جنيه
                                    </span>
                                </div>
                                {approvingExpense.notes && (
                                    <div className="pt-1 border-t border-border/50 text-muted-foreground">
                                        بيان المصروف: {approvingExpense.notes}
                                    </div>
                                )}
                            </div>

                            {/* الخزينة أو الحساب المالي المراد الخصم منه */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                                    <Wallet className="h-3.5 w-3.5 text-primary" />
                                    حساب الخزينة المخصوم منها
                                </label>
                                <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                                    <SelectTrigger className="rounded-xl border-border">
                                        <SelectValue placeholder="اختر الخزينة..." />
                                    </SelectTrigger>
                                    <SelectContent dir="rtl">
                                        {accounts.map((acc) => (
                                            <SelectItem key={acc.id} value={acc.id}>
                                                {acc.name} (الرصيد: {Number(acc.balance || 0).toLocaleString()} ج)
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* ملاحظات المحاسب */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-foreground">ملاحظات الإدارة المالية</label>
                                <Input
                                    placeholder="ملاحظات اختيارية عند الاعتماد..."
                                    value={approvalNotes}
                                    onChange={(e) => setApprovalNotes(e.target.value)}
                                    className="rounded-xl border-border text-xs"
                                />
                            </div>
                        </div>
                    )}

                    <DialogFooter className="flex items-center justify-end gap-2 pt-4 border-t border-border mt-3">
                        <Button variant="ghost" onClick={() => setApprovingExpense(null)} className="rounded-xl text-xs">
                            إلغاء
                        </Button>
                        <Button
                            disabled={isApproving}
                            onClick={handleConfirmApprove}
                            className="rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
                        >
                            {isApproving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                            تأكيد الاعتماد والخصم من الخزينة
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Modal: Reject Expense */}
            <Dialog open={!!rejectingExpense} onOpenChange={(v) => !v && setRejectingExpense(null)}>
                <DialogContent className="max-w-md rounded-2xl p-6" dir="rtl">
                    <DialogHeader className="space-y-1">
                        <DialogTitle className="flex items-center gap-2 text-lg font-black text-rose-600">
                            <XCircle className="h-5 w-5" />
                            رفض طلب المصروف الميداني
                        </DialogTitle>
                        <DialogDescription className="text-xs text-muted-foreground">
                            يرجى توضيح سبب الرفض؛ حيث سيتم إرساله كإشعار فوري للمندوب في تطبيقه.
                        </DialogDescription>
                    </DialogHeader>

                    {rejectingExpense && (
                        <div className="space-y-3 mt-2">
                            <p className="text-xs text-muted-foreground">
                                المندوب: <span className="font-bold text-foreground">{rejectingExpense.employee_name}</span> | المبلغ: <span className="font-bold text-foreground">{rejectingExpense.amount} ج</span>
                            </p>
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-foreground">سبب الرفض (إلزامي)</label>
                                <textarea
                                    placeholder="اكتب سبب عدم قبول المصروف (مثال: الإيصال غير واضح، المصروف غير مصرح به)..."
                                    value={rejectionReason}
                                    onChange={(e) => setRejectionReason(e.target.value)}
                                    rows={3}
                                    className="w-full rounded-xl border border-border bg-background p-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-rose-500"
                                    required
                                />
                            </div>
                        </div>
                    )}

                    <DialogFooter className="flex items-center justify-end gap-2 pt-3 border-t border-border mt-3">
                        <Button variant="ghost" onClick={() => setRejectingExpense(null)} className="rounded-xl text-xs">
                            إلغاء
                        </Button>
                        <Button
                            disabled={isRejecting || !rejectionReason.trim()}
                            onClick={handleConfirmReject}
                            className="rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white gap-2"
                        >
                            {isRejecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                            تأكيد الرفض وإرسال الإشعار
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
