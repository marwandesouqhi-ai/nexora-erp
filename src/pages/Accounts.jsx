import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAccounts, addNewAccount, updateAccount, deleteAccountDoc } from '@/firebase/collections/accounts';
import { useRole } from '@/lib/RoleContext';
import { useAuth } from '@/lib/AuthContext';
import { logActivity } from '@/lib/activityLogger';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, Wallet, Landmark, ArrowUpRight, ArrowDownLeft, Pencil, Trash2, History } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const accountTypeIcons = {
    cash: <Wallet className="w-4 h-4 text-amber-500" />,
    bank: <Landmark className="w-4 h-4 text-blue-500" />,
    other: <History className="w-4 h-4 text-slate-400" />
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

    const openEdit = (acc) => { setForm(acc); setEditId(acc.id); setShowDialog(true); };

    // حساب إجمالي السيولة
    const totalLiquidity = accounts.reduce((sum, acc) => sum + (Number(acc.balance) || 0), 0);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                    <h1 className="text-2xl font-black text-slate-800 tracking-tight">الحسابات والسيولة</h1>
                    <p className="text-sm text-slate-500">إدارة الخزائن، الحسابات البنكية، والتدفقات النقدية لـ Nexora.</p>
                </div>
                {can('can_manage_accounts') && (
                    <Button onClick={() => { setForm(emptyForm); setEditId(null); setShowDialog(true); }} className="rounded-xl bg-slate-900 hover:bg-slate-800 shadow-lg gap-2">
                        <Plus className="w-4 h-4" /> إضافة حساب / خزينة
                    </Button>
                )}
            </div>

            {/* Total Liquidity Card */}
            <div className="bg-gradient-to-br from-indigo-600 to-violet-700 p-6 rounded-[2rem] text-white shadow-xl shadow-indigo-200 relative overflow-hidden">
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
                    <div className="col-span-full py-10 text-center text-slate-400 font-bold">جاري مراجعة الخزائن...</div>
                ) : accounts.map(acc => (
                    <div key={acc.id} className="group bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all">
                        <div className="flex items-start justify-between mb-4">
                            <div className="p-3 bg-slate-50 rounded-xl group-hover:bg-indigo-50 transition-colors">
                                {accountTypeIcons[acc.type] || accountTypeIcons.other}
                            </div>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400" onClick={() => openEdit(acc)}>
                                    <Pencil className="w-3 h-3" />
                                </Button>
                            </div>
                        </div>

                        <h3 className="font-black text-slate-700 text-lg">{acc.name}</h3>
                        <p className="text-xs text-slate-400 mb-4">{typeLabels[acc.type]}</p>

                        <div className="flex items-baseline justify-between pt-2 border-t border-slate-50">
                            <span className="text-xs font-bold text-slate-400 italic">الرصيد الحالي</span>
                            <span className="font-black text-xl text-slate-800">
                                {Number(acc.balance || 0).toLocaleString('ar')}
                            </span>
                        </div>
                    </div>
                ))}
            </div>

            {/* Quick Actions / Transactions Log Placeholder */}
            <div className="bg-slate-50 p-6 rounded-2xl border border-dashed border-slate-200">
                <div className="flex items-center gap-4 text-slate-500">
                    <History className="w-5 h-5" />
                    <p className="text-sm font-medium italic">سجل التحويلات والمصروفات سيظهر هنا قريباً لربطه بالخزائن.</p>
                </div>
            </div>

            {/* Account Dialog */}
            <Dialog open={showDialog} onOpenChange={setShowDialog}>
                <DialogContent className="rounded-3xl max-w-md" dir="rtl">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-black">{editId ? 'تعديل الحساب' : 'فتح حساب/خزينة جديدة'}</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-500 mr-1">اسم الحساب (مثلاً: خزينة المعرض، بنك مصر)</label>
                            <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="rounded-xl" placeholder="ادخل اسماً مميزاً" />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-500 mr-1">نوع الحساب</label>
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
                            <label className="text-xs font-bold text-slate-500 mr-1">الرصيد الافتتاحي</label>
                            <Input type="number" value={form.balance} onChange={e => setForm({ ...form, balance: Number(e.target.value) })} className="rounded-xl font-bold" />
                        </div>

                        {form.type === 'bank' && (
                            <div className="grid grid-cols-2 gap-2 animate-in fade-in slide-in-from-top-2">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-slate-500 mr-1">اسم البنك</label>
                                    <Input value={form.bank_name} onChange={e => setForm({ ...form, bank_name: e.target.value })} className="rounded-xl text-xs" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-slate-500 mr-1">رقم الحساب</label>
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
        </div>
    );
}