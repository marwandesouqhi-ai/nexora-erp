import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getExpenses, updateExpense, deleteExpense, recordExpense } from '@/firebase/collections/expenses';
import { getAccounts } from '@/firebase/collections/accounts';
import { getFieldExpenses } from '@/firebase/collections/field_expenses';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, Wallet, Loader2, Trash2, Pencil, Building2, Truck, Receipt } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { format } from 'date-fns';
import { useRole } from '@/lib/RoleContext';
import FieldExpensesManager from '@/components/expenses/FieldExpensesManager';

import { PageHero } from '@/components/page';
export default function Expenses() {
    const { can } = useRole();
    const { toast } = useToast();
    const qc = useQueryClient();
    const [activeTab, setActiveTab] = useState('field'); // 'field' | 'general'
    const [amount, setAmount] = useState('');
    const [category, setCategory] = useState('general');
    const [note, setNote] = useState('');
    const [accountId, setAccountId] = useState('');
    const [editId, setEditId] = useState(null);
    const [deleteId, setDeleteId] = useState(null);

    // 1. جلب المصروفات العامة
    const { data: expenses = [], isLoading } = useQuery({
        queryKey: ['expenses'],
        queryFn: getExpenses
    });

    const { data: accounts = [] } = useQuery({
        queryKey: ['expense-accounts'],
        queryFn: getAccounts
    });

    // 2. فحص عدد مصروفات المناديب المعلقة لإظهار الشارة
    const { data: fieldExpenses = [] } = useQuery({
        queryKey: ['field-expenses-badge'],
        queryFn: getFieldExpenses,
    });

    const pendingFieldCount = fieldExpenses.filter((e) => e.status === 'pending' || !e.status).length;

    // 2. إضافة/تحديث مصروف
    const saveMutation = useMutation({
        mutationFn: async (expenseData) => {
            if (editId) {
                return updateExpense(editId, expenseData);
            } else {
                // For add, we need to use the recordExpense function which handles cashflow
                return recordExpense(expenseData);
            }
        },
        onSuccess: () => {
            qc.invalidateQueries(['expenses']);
            toast({ title: editId ? "تم تحديث المصروف بنجاح" : "تم تسجيل المصروف بنجاح" });
            setAmount('');
            setNote('');
            setAccountId('');
            setEditId(null);
        }
    });

    // 3. حذف مصروف
    const deleteMutation = useMutation({
        mutationFn: deleteExpense,
        onSuccess: () => {
            qc.invalidateQueries(['expenses']);
            toast({ title: "تم حذف المصروف بنجاح" });
            setDeleteId(null);
        }
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!amount) return;
        const expenseData = {
            amount: Number(amount),
            category,
            description: note,
            userId: 'current_user',
            account_id: accountId || ''
        };
        saveMutation.mutate(expenseData);
    };

    const openEdit = (expense) => {
        setAmount(expense.amount.toString());
        setCategory(expense.category || expense.expense_type || 'general');
        setNote(expense.description || '');
        setAccountId(expense.account_id || '');
        setEditId(expense.id);
    };

    const openNew = () => {
        setAmount('');
        setCategory('general');
        setNote('');
        setAccountId('');
        setEditId(null);
    };

    const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);

    if (!can('can_view_financials')) {
        return <div className="p-8 text-center text-muted-foreground">غير مسموح لك بالوصول إلى المصروفات.</div>;
    }

    return (
        <div className="space-y-6 pb-8" dir="rtl">
            {/* Header & Tabs */}
            <PageHero
                className="mb-0"
                icon={Receipt}
                tone="orange"
                title="إدارة وتدقيق المصروفات"
                subtitle="تدقيق واعتماد مصروفات وسلف المناديب الميدانية وإدارة المصروفات التشغيلية للمنشأة."
                actions={
                    <div className="flex items-center gap-1 rounded-full border border-border bg-card-muted p-1">
                        <Button
                            type="button"
                            size="sm"
                            variant={activeTab === 'field' ? 'default' : 'ghost'}
                            onClick={() => setActiveTab('field')}
                            className="h-8 gap-2 rounded-full text-xs font-bold"
                        >
                            <Truck className="h-4 w-4" />
                            مصروفات وسلف المناديب
                            {pendingFieldCount > 0 && (
                                <Badge className="border-0 bg-warning px-1.5 py-0 text-[10px] text-white">
                                    {pendingFieldCount} معلق
                                </Badge>
                            )}
                        </Button>

                        <Button
                            type="button"
                            size="sm"
                            variant={activeTab === 'general' ? 'default' : 'ghost'}
                            onClick={() => setActiveTab('general')}
                            className="h-8 gap-2 rounded-full text-xs font-bold"
                        >
                            <Building2 className="h-4 w-4" />
                            المصروفات العامة المركزية
                        </Button>
                    </div>
                }
            />

            {/* Tab 1: Field Expenses Manager */}
            {activeTab === 'field' && <FieldExpensesManager />}

            {/* Tab 2: General Expenses Management */}
            {activeTab === 'general' && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* فورم الإضافة */}
                <Card className="h-fit rounded-2xl border border-border bg-card shadow-card">
                    <CardHeader>
                        <CardTitle className="text-lg font-black flex items-center gap-2">
                            <Plus className="text-indigo-600" /> إضافة مصروف
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-muted-foreground mb-1 block">المبلغ</label>
                                <Input
                                    type="number"
                                    placeholder="0.00"
                                    value={amount}
                                    onChange={e => setAmount(e.target.value)}
                                    className="h-12 rounded-xl border-2 focus:border-indigo-500"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-muted-foreground mb-1 block">التصنيف</label>
                                <Select value={category} onValueChange={setCategory}>
                                    <SelectTrigger className="h-12 rounded-xl"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="general">عام</SelectItem>
                                        <SelectItem value="rent">إيجار</SelectItem>
                                        <SelectItem value="electricity">كهرباء ومرافق</SelectItem>
                                        <SelectItem value="salaries">رواتب</SelectItem>
                                        <SelectItem value="shipping">نقل وشحن</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-muted-foreground mb-1 block">الحساب/الخزينة</label>
                                <Select value={accountId} onValueChange={setAccountId}>
                                    <SelectTrigger className="h-12 rounded-xl"><SelectValue placeholder="اختر حساباً" /></SelectTrigger>
                                    <SelectContent>
                                        {accounts.map((account) => (
                                            <SelectItem key={account.id} value={account.id}>{account.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-muted-foreground mb-1 block">ملاحظة</label>
                                <Input
                                    placeholder="مثلاً: فاتورة كهرباء شهر 5"
                                    value={note}
                                    onChange={e => setNote(e.target.value)}
                                    className="h-12 rounded-xl"
                                />
                            </div>
                            <div className="flex gap-2">
                                {can('can_manage_accounts') && (
                                    <Button
                                        type="submit"
                                        className="flex-1 h-12 rounded-xl bg-indigo-600 font-bold"
                                        disabled={saveMutation.isPending}
                                    >
                                        {saveMutation.isPending ? <Loader2 className="animate-spin" /> : (editId ? "تحديث" : "حفظ المصروف")}
                                    </Button>
                                )}
                                {editId && (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="h-12 rounded-xl"
                                        onClick={openNew}
                                    >
                                        إلغاء
                                    </Button>
                                )}
                            </div>
                        </form>
                    </CardContent>
                </Card>

                {/* جدول العرض وملخص سريع */}
                <div className="lg:col-span-2 space-y-6">
                    <Card className="border-none shadow-sm bg-indigo-600 text-white rounded-3xl">
                        <CardContent className="p-6 flex justify-between items-center">
                            <div>
                                <p className="text-indigo-100 font-bold">إجمالي مصروفات الفترة</p>
                                <h2 className="text-3xl font-black">{totalExpenses.toLocaleString()} ج.م</h2>
                            </div>
                            <Wallet className="w-12 h-12 opacity-20" />
                        </CardContent>
                    </Card>

                    <Card className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
                        <Table>
                            <TableHeader className="bg-card-muted">
                                <TableRow>
                                    <TableHead className="text-right">التاريخ</TableHead>
                                    <TableHead className="text-right">التصنيف</TableHead>
                                    <TableHead className="text-right">الملاحظة</TableHead>
                                    <TableHead className="text-left">المبلغ</TableHead>
                                    <TableHead className="text-center">الإجراءات</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow><TableCell colSpan={5} className="text-center py-10"><Loader2 className="animate-spin mx-auto" /></TableCell></TableRow>
                                ) : expenses.map(exp => (
                                    <TableRow key={exp.id}>
                                        <TableCell className="text-muted-foreground text-xs">
                                            {exp.created_at ? format(exp.created_at.toDate(), 'yyyy-MM-dd') : '...'}
                                        </TableCell>
                                        <TableCell>
                                            <span className="px-2 py-1 bg-card-muted rounded-md text-xs font-bold text-secondary-text">
                                                {exp.category}
                                            </span>
                                        </TableCell>
                                        <TableCell className="font-medium">{exp.description || exp.note || ''}</TableCell>
                                        <TableCell className="text-left font-black text-red-500">{exp.amount} ج.م</TableCell>
                                        <TableCell className="text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                {can('can_manage_accounts') && (
                                                    <>
                                                        <Button variant="ghost" size="sm" onClick={() => openEdit(exp)} className="text-blue-600 hover:text-blue-700">
                                                            <Pencil className="w-4 h-4" />
                                                        </Button>
                                                        <Button variant="ghost" size="sm" onClick={() => setDeleteId(exp.id)} className="text-red-600 hover:text-red-700">
                                                            <Trash2 className="w-4 h-4" />
                                                        </Button>
                                                    </>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </Card>
                </div>
                </div>
            </div>
            )}

            {/* حوار تأكيد الحذف */}
            <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
                        <AlertDialogDescription>
                            هل أنت متأكد من حذف هذا المصروف؟ هذا الإجراء لا يمكن التراجع عنه.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>إلغاء</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => deleteMutation.mutate(deleteId)}
                            className="bg-red-600 hover:bg-red-700"
                        >
                            حذف
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}