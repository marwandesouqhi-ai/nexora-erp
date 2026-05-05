import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '@/api/firebase';
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { useRole } from '@/lib/RoleContext';
import { useAuth } from '@/lib/AuthContext';
import { logActivity } from '@/lib/activityLogger';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, Search, Trash2, CheckCircle, CalendarClock, Shield } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/components/ui/use-toast';
import ExportMenu from '@/components/shared/ExportMenu';

const statusColors = { pending: 'bg-red-500/15 text-red-400', partial: 'bg-amber-500/15 text-amber-400', settled: 'bg-emerald-500/15 text-emerald-400' };
const statusLabels = { pending: '????', partial: '????', settled: '????' };
const directionColors = { owed_to_us: 'bg-blue-500/15 text-blue-400', we_owe: 'bg-rose-500/15 text-rose-400' };
const directionLabels = { owed_to_us: '??? ????', we_owe: '????? ??' };

const emptyForm = {
    party_name: '',
    party_type: 'customer',
    amount: '',
    paid_amount: 0,
    direction: 'owed_to_us',
    due_date: '',
    status: 'pending',
    description: '',
    notes: '',
};

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
    const [search, setSearch] = useState('');
    const [dirFilter, setDirFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
    const [form, setForm] = useState(emptyForm);
    const [editId, setEditId] = useState(null);
    const [showDialog, setShowDialog] = useState(false);
    const [settleId, setSettleId] = useState(null);
    const [settleAmount, setSettleAmount] = useState('');
    const [deleteId, setDeleteId] = useState(null);

    const { data: debts = [], isLoading } = useQuery({
        queryKey: ['debts'],
        queryFn: async () => {
            const debtsQuery = query(collection(db, 'debts'), orderBy('created_at', 'desc'));
            const snapshot = await getDocs(debtsQuery);
            return snapshot.docs.map((docItem) => ({ id: docItem.id, ...docItem.data() }));
        },
    });

    const saveDebtMutation = useMutation({
        mutationFn: async (data) => {
            const payload = {
                party_name: data.party_name,
                party_type: data.party_type,
                amount: Number(data.amount) || 0,
                paid_amount: Number(data.paid_amount) || 0,
                direction: data.direction,
                due_date: data.due_date || '',
                status: data.status || 'pending',
                description: data.description || '',
                notes: data.notes || '',
                updated_at: serverTimestamp(),
            };

            if (editId) {
                await updateDoc(doc(db, 'debts', editId), payload);
                return { id: editId, ...payload };
            }

            const docRef = await addDoc(collection(db, 'debts'), {
                ...payload,
                created_at: serverTimestamp(),
            });
            return { id: docRef.id, ...payload };
        },
        onSuccess: async (_, input) => {
            qc.invalidateQueries(['debts']);
            await logActivity(user?.uid || user?.email || 'system', editId ? 'update_debt' : 'create_debt', `${editId ? '?????' : '?????'} ???????: ${input.party_name} — ${input.amount} ?.?`);
            toast({ title: editId ? '?? ????? ????????? ?????' : '?? ????? ????????? ?????' });
            setShowDialog(false);
            setEditId(null);
            setForm(emptyForm);
        },
    });

    const settleDebtMutation = useMutation({
        mutationFn: async ({ id, amount }) => {
            const debt = debts.find((d) => d.id === id);
            const currentPaid = Number(debt?.paid_amount) || 0;
            const newPaid = currentPaid + Number(amount);
            const status = newPaid >= Number(debt?.amount || 0) ? 'settled' : 'partial';
            await updateDoc(doc(db, 'debts', id), {
                paid_amount: newPaid,
                status,
                updated_at: serverTimestamp(),
            });
            return { id, newPaid, status };
        },
        onSuccess: async (_, variables) => {
            qc.invalidateQueries(['debts']);
            await logActivity(user?.uid || user?.email || 'system', 'settle_debt', `????? ???? ${variables.amount} ?.? ??? ??????? ${variables.id}`);
            toast({ title: '?? ????? ?????? ?????' });
            setSettleId(null);
            setSettleAmount('');
        },
    });

    const deleteDebtMutation = useMutation({
        mutationFn: async (id) => {
            await deleteDoc(doc(db, 'debts', id));
        },
        onSuccess: async (_, id) => {
            qc.invalidateQueries(['debts']);
            await logActivity(user?.uid || user?.email || 'system', 'delete_debt', `??? ???????: ${id}`);
            toast({ title: '?? ??? ????????? ?????' });
            setDeleteId(null);
        },
    });

    const openEdit = (debt) => {
        setForm({
            party_name: debt.party_name || '',
            party_type: debt.party_type || 'customer',
            amount: debt.amount?.toString() || '',
            paid_amount: debt.paid_amount?.toString() || '0',
            direction: debt.direction || 'owed_to_us',
            due_date: debt.due_date || '',
            status: debt.status || 'pending',
            description: debt.description || '',
            notes: debt.notes || '',
        });
        setEditId(debt.id);
        setShowDialog(true);
    };

    const openNew = () => {
        setForm(emptyForm);
        setEditId(null);
        setShowDialog(true);
    };

    if (!can('can_view_debts')) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center">
                    <Shield className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                    <p className="font-bold text-muted-foreground">?? ???? ?????? ?????? ???? ??????</p>
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
        '?????': d.party_name,
        '?????': d.party_type,
        '???????': directionLabels[d.direction] || d.direction,
        '??????': d.amount,
        '???????': d.paid_amount || 0,
        '???????': (Number(d.amount) || 0) - (Number(d.paid_amount) || 0),
        '??????': statusLabels[d.status] || d.status,
        '????? ?????????': d.due_date || '',
    }));

    const settleDebtData = debts.find((d) => d.id === settleId);
    const settleRemaining = settleDebtData ? Math.max(0, (Number(settleDebtData.amount) || 0) - (Number(settleDebtData.paid_amount) || 0)) : 0;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-2xl font-black">?????????</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">????? ?????? ??????????</p>
                </div>
                <div className="flex items-center gap-2">
                    <ExportMenu data={exportData} filename="debts" title="????? ?????????" disabled={!filtered.length} />
                    {can('can_edit_debts') && (
                        <Button onClick={openNew} className="gap-2 bg-indigo-600 hover:bg-indigo-700 shadow-md rounded-xl">
                            <Plus className="w-4 h-4" /> ????? ???????
                        </Button>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm border-r-4 border-r-blue-500">
                    <p className="text-xs font-bold text-slate-500 uppercase">??? ??? ?????</p>
                    <p className="text-2xl font-black mt-1 text-blue-600">{owedToUs.toLocaleString('ar')} ?.?</p>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm border-r-4 border-r-rose-500">
                    <p className="text-xs font-bold text-slate-500 uppercase">????? ?????</p>
                    <p className="text-2xl font-black mt-1 text-rose-600">{weOwe.toLocaleString('ar')} ?.?</p>
                </div>
                <div className="bg-indigo-600 p-5 rounded-2xl shadow-lg shadow-indigo-100 border-none text-white">
                    <p className="text-xs font-bold opacity-80 uppercase">???? ?????? ??????</p>
                    <p className="text-2xl font-black mt-1">{(owedToUs - weOwe).toLocaleString('ar')} ?.?</p>
                </div>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
                <div className="relative flex-1 min-w-[220px]">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input placeholder="???..." value={search} onChange={(e) => setSearch(e.target.value)} className="pr-10" />
                </div>
                <Select value={dirFilter} onValueChange={setDirFilter}>
                    <SelectTrigger className="w-44"><SelectValue placeholder="?? ?????????" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">?? ?????????</SelectItem>
                        <SelectItem value="owed_to_us">??? ????</SelectItem>
                        <SelectItem value="we_owe">????? ??</SelectItem>
                    </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-36"><SelectValue placeholder="?? ???????" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">????</SelectItem>
                        <SelectItem value="active">???</SelectItem>
                        <SelectItem value="settled">????</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className="bg-white overflow-x-auto border border-slate-100 rounded-2xl shadow-sm">
                <table className="w-full text-sm text-right">
                    <thead>
                        <tr className="border-b border-slate-50 bg-slate-50/50 text-slate-500">
                            <th className="px-5 py-4 font-bold">?????</th>
                            <th className="px-4 py-4 font-bold">???????</th>
                            <th className="px-4 py-4 font-bold">??????</th>
                            <th className="px-4 py-4 font-bold">???????</th>
                            <th className="px-4 py-4 font-bold">?????????</th>
                            <th className="px-4 py-4 font-bold">??????</th>
                            <th className="px-4 py-4 font-bold text-left">???????</th>
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading ? (
                            <tr><td colSpan={7} className="py-20 text-center text-slate-400 font-bold italic">???? ?????? ??????...</td></tr>
                        ) : filtered.length === 0 ? (
                            <tr><td colSpan={7} className="py-20 text-center text-slate-400 font-bold italic">?? ???? ????????</td></tr>
                        ) : filtered.map((d) => {
                            const remaining = Math.max(0, (Number(d.amount) || 0) - (Number(d.paid_amount) || 0));
                            const isOverdue = d.due_date && parseDate(d.due_date) < new Date() && d.status !== 'settled';
                            return (
                                <tr key={d.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors group">
                                    <td className="px-5 py-4">
                                        <div className="font-black text-slate-700">{d.party_name}</div>
                                        <div className="text-[10px] text-slate-400 font-medium">{d.description || '???? ???'}</div>
                                    </td>
                                    <td className="px-4 py-4">
                                        <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${directionColors[d.direction]}`}>
                                            {directionLabels[d.direction]}
                                        </span>
                                    </td>
                                    <td className="px-4 py-4 font-medium text-slate-500">{Number(d.amount).toLocaleString('ar')}</td>
                                    <td className="px-4 py-4">
                                        <div className={`font-black text-base ${remaining > 0 ? 'text-amber-500' : 'text-emerald-500'}`}>
                                            {remaining.toLocaleString('ar')} <span className="text-[10px]">?.?</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4">
                                        <div className={`flex items-center gap-1.5 text-[11px] font-bold ${isOverdue ? 'text-red-500 animate-pulse' : 'text-slate-400'}`}>
                                            <CalendarClock className="w-3 h-3" /> {d.due_date ? format(parseDate(d.due_date), 'dd/MM/yyyy') : '??? ????'}
                                        </div>
                                    </td>
                                    <td className="px-4 py-4"><span className={`px-2 py-1 rounded-full text-[10px] font-bold ${statusColors[d.status]}`}>{statusLabels[d.status] || d.status}</span></td>
                                    <td className="px-4 py-4 text-left">
                                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            {can('can_edit_debts') && d.status !== 'settled' && (
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-emerald-500 hover:bg-emerald-50 rounded-full" onClick={() => { setSettleId(d.id); setSettleAmount(remaining.toString()); }}>
                                                    <CheckCircle className="w-4 h-4" />
                                                </Button>
                                            )}
                                            {can('can_edit_debts') && (
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-indigo-500 hover:bg-indigo-50 rounded-full" onClick={() => openEdit(d)}>
                                                    <Plus className="w-4 h-4" />
                                                </Button>
                                            )}
                                            {can('can_edit_debts') && (
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-500 hover:bg-rose-50 rounded-full" onClick={() => setDeleteId(d.id)}>
                                                    <Trash2 className="w-4 h-4" />
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

            <Dialog open={showDialog} onOpenChange={(open) => { if (!open) { setShowDialog(false); setEditId(null); setForm(emptyForm); } }}>
                <DialogContent className="bg-white rounded-[2rem] max-w-2xl" dir="rtl">
                    <DialogHeader>
                        <DialogTitle>{editId ? '????? ?????????' : '????? ??????? ?????'}</DialogTitle>
                    </DialogHeader>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4">
                        <div className="col-span-2">
                            <label className="text-sm font-semibold text-slate-600 block mb-1">????? *</label>
                            <Input value={form.party_name} onChange={(e) => setForm((prev) => ({ ...prev, party_name: e.target.value }))} />
                        </div>
                        <div>
                            <label className="text-sm font-semibold text-slate-600 block mb-1">??? ?????</label>
                            <Select value={form.party_type} onValueChange={(value) => setForm((prev) => ({ ...prev, party_type: value }))}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="customer">????</SelectItem>
                                    <SelectItem value="supplier">????</SelectItem>
                                    <SelectItem value="other">????</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <label className="text-sm font-semibold text-slate-600 block mb-1">???????</label>
                            <Select value={form.direction} onValueChange={(value) => setForm((prev) => ({ ...prev, direction: value }))}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="owed_to_us">??? ????</SelectItem>
                                    <SelectItem value="we_owe">????? ??</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <label className="text-sm font-semibold text-slate-600 block mb-1">??????</label>
                            <Select value={form.status} onValueChange={(value) => setForm((prev) => ({ ...prev, status: value }))}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="pending">????</SelectItem>
                                    <SelectItem value="partial">????</SelectItem>
                                    <SelectItem value="settled">????</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <label className="text-sm font-semibold text-slate-600 block mb-1">?????? (?.?) *</label>
                            <Input type="number" value={form.amount} onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))} />
                        </div>
                        <div>
                            <label className="text-sm font-semibold text-slate-600 block mb-1">??????? ??? ????</label>
                            <Input type="number" value={form.paid_amount} onChange={(e) => setForm((prev) => ({ ...prev, paid_amount: e.target.value }))} />
                        </div>
                        <div>
                            <label className="text-sm font-semibold text-slate-600 block mb-1">????? ?????????</label>
                            <Input type="date" value={form.due_date} onChange={(e) => setForm((prev) => ({ ...prev, due_date: e.target.value }))} />
                        </div>
                        <div className="col-span-2">
                            <label className="text-sm font-semibold text-slate-600 block mb-1">?????</label>
                            <Input value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} />
                        </div>
                        <div className="col-span-2">
                            <label className="text-sm font-semibold text-slate-600 block mb-1">??????? ??????</label>
                            <Input value={form.notes} onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))} />
                        </div>
                    </div>
                    <div className="flex gap-2 justify-end pt-2">
                        <Button variant="ghost" onClick={() => setShowDialog(false)}>?????</Button>
                        <Button onClick={() => saveDebtMutation.mutate(form)} disabled={saveDebtMutation.isPending || !form.party_name || !form.amount}>{saveDebtMutation.isPending ? '???? ?????...' : '???'}</Button>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={!!settleId} onOpenChange={() => setSettleId(null)}>
                <DialogContent className="bg-white rounded-[2rem] max-w-sm" dir="rtl">
                    <DialogHeader>
                        <DialogTitle>????? ???? ????</DialogTitle>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-500">?????? ??????? ????</label>
                            <Input
                                type="number"
                                value={settleAmount}
                                onChange={(e) => setSettleAmount(e.target.value)}
                                className="text-2xl font-black text-center text-indigo-600 h-14 rounded-2xl border-2 border-indigo-50 focus:border-indigo-500"
                            />
                            <p className="text-[10px] text-center text-slate-400 italic">???? ???? ?????: {settleRemaining.toLocaleString('ar')} ?.?</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Button
                            className="flex-1 bg-indigo-600 hover:bg-indigo-700 h-12 rounded-xl font-bold shadow-lg"
                            onClick={() => settleDebtMutation.mutate({ id: settleId, amount: settleAmount })}
                            disabled={settleDebtMutation.isPending || !settleAmount || Number(settleAmount) <= 0}
                        >
                            {settleDebtMutation.isPending ? '???? ???????...' : '????? ??????'}
                        </Button>
                        <Button variant="ghost" onClick={() => setSettleId(null)} className="h-12 rounded-xl italic">?????</Button>
                    </div>
                </DialogContent>
            </Dialog>

            <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
                <AlertDialogContent className="bg-white rounded-[2rem] max-w-sm" dir="rtl">
                    <AlertDialogHeader>
                        <AlertDialogTitle>??? ??????????</AlertDialogTitle>
                        <AlertDialogDescription>???? ??? ????? ???????? ??? ???? ???????.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>?????</AlertDialogCancel>
                        <AlertDialogAction className="bg-rose-600 hover:bg-rose-700" onClick={() => deleteDebtMutation.mutate(deleteId)}>???</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
