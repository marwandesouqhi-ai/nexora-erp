import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAccounts, getRecentCashflow, addNewAccount, updateAccount, deleteAccountDoc } from '@/firebase/collections/accounts';
import { useRole } from '@/lib/RoleContext';
import { useAuth } from '@/lib/AuthContext';
import { logActivity } from '@/lib/activityLogger';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, Wallet, Landmark, Pencil, Trash2, History, Calculator } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

import { PageHero } from '@/components/page';
const accountTypeIcons = {
    cash: <Wallet className="w-4 h-4 text-amber-500" />,
    bank: <Landmark className="w-4 h-4 text-blue-500" />,
    other: <History className="w-4 h-4 text-muted-foreground" />
};

const typeLabels = { cash: 'خزينة نقداً', bank: 'حساب بنكي', other: 'أخرى' };

const emptyForm = { name: '', type: 'cash', balance: 0, account_number: '', bank_name: '', notes: '' };

export default function Accounts() {
    const { can } = useRole();
    const { user } = useAuth();
    const { toast } = useToast();
    const qc = useQueryClient();

    const [showDialog, setShowDialog] = useState(false);
    const [form, setForm] = useState(emptyForm);
    const [editId, setEditId] = useState(null);
    const [deleteId, setDeleteId] = useState(null);

    // 1. جلب الحسابات المالية
    const { data: accounts = [], isLoading } = useQuery({
        queryKey: ['accounts'],
        queryFn: getAccounts
    });
    const { data: cashflow = [], isLoading: cashflowLoading } = useQuery({
        queryKey: ['cashflow-account-overview'],
        queryFn: () => getRecentCashflow(100),
        enabled: can('can_view_accounts'),
    });

    // 2. الحفظ والتعديل
    const saveMutation = useMutation({
        mutationFn: async (data) => editId ? updateAccount(editId, data) : addNewAccount(data),
        onSuccess: async (_, data) => {
            qc.invalidateQueries(['accounts']);
            await logActivity({
                user,
                action: editId ? 'update_account' : 'create_account',
                entity_type: 'Account',
                details: `${editId ? 'تعديل' : 'إضافة'} حساب مالي: ${data.name}`
            });
            toast({ title: 'تمت العملية بنجاح' });
            setShowDialog(false); setEditId(null); setForm(emptyForm);
        }
    });

    // 3. الحذف
    const deleteMutation = useMutation({
        mutationFn: (id) => {
            const account = accounts.find((item) => item.id === id);
            if (Number(account?.balance || 0) !== 0) {
                throw new Error('لا يمكن حذف حساب يحتوي على رصيد. قم بتسوية الرصيد أولاً.');
            }
            return deleteAccountDoc(id);
        },
        onSuccess: async (_, id) => {
            qc.invalidateQueries(['accounts']);
            const deletedAccount = accounts.find(acc => acc.id === id);
            await logActivity({
                user,
                action: 'delete_account',
                entity_type: 'Account',
                details: `حذف حساب مالي: ${deletedAccount?.name || id}`
            });
            toast({ title: 'تم حذف الحساب بنجاح' });
            setDeleteId(null);
        },
        onError: (error) => {
            toast({ variant: 'destructive', title: error.message || 'حدث خطأ أثناء الحذف' });
            setDeleteId(null);
        }
    });

    const openEdit = (acc) => { setForm(acc); setEditId(acc.id); setShowDialog(true); };

    // حساب إجمالي السيولة
    const totalLiquidity = accounts.reduce((sum, acc) => sum + (Number(acc.balance) || 0), 0);
    const toDate = (value) => value?.toDate?.() || (value ? new Date(value) : null);

    if (!can('can_view_accounts')) {
        return <div className="p-8 text-center text-muted-foreground">غير مسموح لك بالوصول إلى الحسابات.</div>;
    }

    return (
        <div className="space-y-6">
            <PageHero
                className="mb-0"
                icon={Calculator}
                title="الحسابات والسيولة"
                subtitle="إدارة الخزائن، الحسابات البنكية، والتدفقات النقدية لـ Nexora."
                actions={can('can_manage_accounts') && (
                    <Button onClick={() => { setForm(emptyForm); setEditId(null); setShowDialog(true); }} className="gap-2">
                        <Plus className="h-4 w-4" /> إضافة حساب / خزينة
                    </Button>
                )}
            />

            {/* Total Liquidity Card */}
            <div className="bg-gradient-to-br from-indigo-600 to-violet-700 p-6 rounded-2xl text-white shadow-xl shadow-indigo-200 relative overflow-hidden">
                <div className="relative z-10">
                    <p className="text-indigo-100 font-bold">إجمالي السيولة المتوفرة</p>
                    <h2 className="text-4xl font-black mt-2 tracking-tighter">
                        {totalLiquidity.toLocaleString('ar')} <span className="text-lg font-normal opacity-80">ج.م</span>
                    </h2>
                </div>
                <div className="absolute -bottom-6 -left-6 opacity-10">
                    <Landmark size={180} />
                </div>
            </div>

            {/* Accounts Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {isLoading ? (
                    <div className="col-span-full py-10 text-center text-muted-foreground font-bold">جاري مراجعة الخزائن...</div>
                ) : accounts.map(acc => (
                    <div key={acc.id} className="group bg-card p-5 rounded-2xl border border-border shadow-sm hover:shadow-md transition-all">
                        <div className="flex items-start justify-between mb-4">
                            <div className="p-3 bg-card-muted rounded-xl group-hover:bg-indigo-50 transition-colors">
                                {accountTypeIcons[acc.type] || accountTypeIcons.other}
                            </div>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                {can('can_manage_accounts') && (
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => openEdit(acc)}>
                                        <Pencil className="w-3 h-3" />
                                    </Button>
                                )}
                                {can('can_manage_accounts') && (
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400 hover:text-red-600" onClick={() => setDeleteId(acc.id)}>
                                        <Trash2 className="w-3 h-3" />
                                    </Button>
                                )}
                            </div>
                        </div>

                        <h3 className="font-black text-secondary-text text-lg">{acc.name}</h3>
                        <p className="text-xs text-muted-foreground mb-4">{typeLabels[acc.type]}</p>

                        <div className="flex items-baseline justify-between pt-2 border-t border-border">
                            <span className="text-xs font-bold text-muted-foreground italic">الرصيد الحالي</span>
                            <span className="font-black text-xl text-foreground">
                                {Number(acc.balance || 0).toLocaleString('ar')}
                            </span>
                        </div>
                    </div>
                ))}
            </div>

            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                <div className="mb-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3"><History className="h-5 w-5 text-indigo-600" /><div><h2 className="font-black text-foreground">آخر الحركات المالية</h2><p className="text-xs text-muted-foreground">الحركات المرتبطة بالحسابات والمصروفات والمشتريات والتحصيلات</p></div></div>
                    <span className="text-xs font-bold text-muted-foreground">{cashflow.length} حركة</span>
                </div>
                {cashflowLoading ? <p className="py-8 text-center text-sm text-muted-foreground">جاري تحميل الحركات...</p> : cashflow.length === 0 ? <p className="rounded-xl bg-muted/40 py-8 text-center text-sm text-muted-foreground">لا توجد حركات مالية بعد. ستظهر هنا تلقائيًا بعد أول فاتورة أو مصروف.</p> : (
                    <div className="overflow-x-auto"><table className="w-full text-right text-sm"><thead><tr className="border-b border-border"><th className="px-3 py-3 font-bold">التاريخ</th><th className="px-3 py-3 font-bold">الحساب</th><th className="px-3 py-3 font-bold">البيان</th><th className="px-3 py-3 font-bold">المبلغ</th></tr></thead><tbody>{cashflow.map((movement) => { const account = accounts.find((item) => item.id === movement.account_id); const amount = Number(movement.amount || 0); const date = toDate(movement.timestamp); return <tr key={movement.id} className="border-b border-border/50"><td className="px-3 py-3 text-xs text-muted-foreground">{date ? date.toLocaleDateString('ar-EG') : '—'}</td><td className="px-3 py-3 font-bold">{account?.name || (movement.account_id ? 'حساب غير موجود' : 'غير مرتبط')}</td><td className="px-3 py-3 text-muted-foreground">{movement.description || movement.type || 'حركة مالية'}</td><td className={`px-3 py-3 font-black ${amount >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{amount >= 0 ? '+' : ''}{amount.toLocaleString('ar-EG')} ج.م</td></tr>; })}</tbody></table></div>
                )}
            </div>

            {/* Account Dialog */}
            <Dialog open={showDialog} onOpenChange={setShowDialog}>
                <DialogContent className="rounded-3xl max-w-md" dir="rtl">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-black">{editId ? 'تعديل الحساب' : 'فتح حساب/خزينة جديدة'}</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-muted-foreground mr-1">اسم الحساب (مثلاً: خزينة المعرض، بنك مصر)</label>
                            <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="rounded-xl" placeholder="ادخل اسماً مميزاً" />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-muted-foreground mr-1">نوع الحساب</label>
                            <Select value={form.type} onValueChange={v => setForm({ ...form, type: v })}>
                                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="cash">خزينة نقداً (كاش)</SelectItem>
                                    <SelectItem value="bank">حساب بنكي</SelectItem>
                                    <SelectItem value="other">أخرى</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-muted-foreground mr-1">الرصيد الافتتاحي</label>
                            <Input type="number" value={form.balance} onChange={e => setForm({ ...form, balance: Number(e.target.value) })} className="rounded-xl font-bold" />
                        </div>

                        {form.type === 'bank' && (
                            <div className="grid grid-cols-2 gap-2 animate-in fade-in slide-in-from-top-2">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-muted-foreground mr-1">اسم البنك</label>
                                    <Input value={form.bank_name} onChange={e => setForm({ ...form, bank_name: e.target.value })} className="rounded-xl text-xs" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-muted-foreground mr-1">رقم الحساب</label>
                                    <Input value={form.account_number} onChange={e => setForm({ ...form, account_number: e.target.value })} className="rounded-xl text-xs" />
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex gap-2 justify-end">
                        <Button variant="ghost" onClick={() => setShowDialog(false)} className="rounded-xl italic">تراجع</Button>
                        <Button
                            className="bg-indigo-600 hover:bg-indigo-700 rounded-xl px-10 font-bold shadow-lg"
                            onClick={() => saveMutation.mutate(form)}
                            disabled={saveMutation.isPending || !form.name}
                        >
                            {saveMutation.isPending ? 'جاري الحفظ...' : 'اعتماد الحساب'}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation */}
            <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
                <AlertDialogContent dir="rtl">
                    <AlertDialogHeader>
                        <AlertDialogTitle>هل أنت متأكد من حذف هذا الحساب؟</AlertDialogTitle>
                        <AlertDialogDescription>
                            سيتم حذف الحساب نهائياً، وهذا الإجراء لا يمكن التراجع عنه. تأكد أن الرصيد المرتبط به تمت تسويته أولاً.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="rounded-xl">تراجع</AlertDialogCancel>
                        <AlertDialogAction
                            className="rounded-xl bg-red-600 hover:bg-red-700"
                            onClick={() => deleteMutation.mutate(deleteId)}
                            disabled={deleteMutation.isPending}
                        >
                            {deleteMutation.isPending ? 'جاري الحذف...' : 'حذف نهائياً'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}