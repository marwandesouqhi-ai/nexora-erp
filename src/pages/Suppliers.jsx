import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
// استيراد الدوال من ملف كوليكشن الموردين الخاص بنا
import { addNewSupplier, getSuppliers, updateSupplier, deleteSupplierDoc } from '@/firebase/collections/suppliers';
import { useRole } from '@/lib/RoleContext';
import { useAuth } from '@/lib/AuthContext';
import { logActivity } from '@/lib/activityLogger';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, Search, Trash2, Pencil, Truck, Wallet } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import ExportMenu from '@/components/shared/ExportMenu';

// إضافة current_balance للفورم الافتراضي
const emptyForm = { name: '', company: '', phone: '', whatsapp: '', email: '', address: '', notes: '', current_balance: 0 };

export default function Suppliers() {
    const { can } = useRole();
    const { user } = useAuth();
    const { toast } = useToast();
    const qc = useQueryClient();
    const [search, setSearch] = useState('');
    const [form, setForm] = useState(emptyForm);
    const [editId, setEditId] = useState(null);
    const [showDialog, setShowDialog] = useState(false);
    const [deleteId, setDeleteId] = useState(null);

    // 1. جلب الموردين من Firebase
    const { data: suppliers = [], isLoading } = useQuery({
        queryKey: ['suppliers'],
        queryFn: getSuppliers
    });

    // 2. حفظ/تعديل مورد في Firebase
    const saveSupplierMutation = useMutation({
        mutationFn: (data) => editId ? updateSupplier(editId, data) : addNewSupplier(data),
        onSuccess: async (_, data) => {
            qc.invalidateQueries(['suppliers']);
            await logActivity({
                user,
                action: editId ? 'update_supplier' : 'create_supplier',
                entity_type: 'Supplier',
                details: `${editId ? 'تعديل' : 'إضافة'} مورد: ${data.name}`
            });
            toast({ title: editId ? 'تم تحديث بيانات المورد' : 'تم إضافة المورد بنجاح' });
            setShowDialog(false); setEditId(null); setForm(emptyForm);
        },
    });

    // 3. حذف مورد من Firebase
    const deleteSupplierMutation = useMutation({
        mutationFn: (id) => deleteSupplierDoc(id),
        onSuccess: async () => {
            qc.invalidateQueries(['suppliers']);
            toast({ title: 'تم حذف المورد نهائياً' });
            setDeleteId(null);
        },
    });

    const openEdit = (s) => { setForm(s); setEditId(s.id); setShowDialog(true); };
    const openNew = () => { setForm(emptyForm); setEditId(null); setShowDialog(true); };

    const filtered = suppliers.filter(s =>
        (s.name || '').toLowerCase().includes(search.toLowerCase()) ||
        (s.company || '').toLowerCase().includes(search.toLowerCase())
    );

    const exportData = filtered.map(s => ({
        'الاسم': s.name, 'الشركة': s.company || '', 'الهاتف': s.phone || '',
        'المديونية': s.current_balance || 0, 'العنوان': s.address || ''
    }));

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-2xl font-black">الموردون</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">{suppliers.length} مورد مسجل</p>
                </div>
                <div className="flex items-center gap-2">
                    <ExportMenu data={exportData} filename="suppliers" title="قائمة الموردين" disabled={!filtered.length} />
                    {can('can_edit_suppliers') && <Button onClick={openNew} className="gap-2"><Plus className="w-4 h-4" /> مورد جديد</Button>}
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="erp-card p-4 border border-border bg-card/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-500/10 rounded-lg text-amber-500"><Wallet className="w-5 h-5" /></div>
                        <div>
                            <p className="text-xs text-muted-foreground font-bold">إجمالي مديونية الموردين</p>
                            <p className="text-xl font-black text-amber-500">
                                {suppliers.reduce((s, c) => s + (Number(c.current_balance) || 0), 0).toLocaleString('ar')} ج.م
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="بحث بالاسم أو الشركة..." value={search} onChange={e => setSearch(e.target.value)} className="pr-10 max-w-md" />
            </div>

            {/* Table */}
            <div className="erp-card overflow-x-auto border border-border rounded-xl bg-card">
                <table className="w-full text-sm text-right">
                    <thead>
                        <tr className="border-b border-border bg-muted/30 text-muted-foreground">
                            <th className="px-5 py-3">المورد / الشركة</th>
                            <th className="px-4 py-3">الهاتف</th>
                            <th className="px-4 py-3">المديونية الحالية</th>
                            <th className="px-4 py-3">العنوان</th>
                            <th className="px-4 py-3 text-left" />
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading ? <tr><td colSpan={5} className="py-10 text-center">جاري جلب البيانات من Nexora Cloud...</td></tr>
                            : filtered.length === 0 ? <tr><td colSpan={5} className="py-10 text-center">لا يوجد موردون مسجلون</td></tr>
                                : filtered.map(s => (
                                    <tr key={s.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                                        <td className="px-5 py-3">
                                            <div className="font-bold">{s.name}</div>
                                            <div className="text-xs text-muted-foreground">{s.company || 'بدون شركة'}</div>
                                        </td>
                                        <td className="px-4 py-3 text-muted-foreground font-mono">{s.phone || '—'}</td>
                                        <td className={`px-4 py-3 font-black ${(s.current_balance || 0) > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                                            {(s.current_balance || 0).toLocaleString('ar')} ج.م
                                        </td>
                                        <td className="px-4 py-3 text-muted-foreground max-w-[200px] truncate">{s.address || '—'}</td>
                                        <td className="px-4 py-3 text-left">
                                            <div className="flex justify-end gap-1">
                                                {can('can_edit_suppliers') && <Button variant="ghost" size="icon" onClick={() => openEdit(s)}><Pencil className="w-3.5 h-3.5" /></Button>}
                                                {can('can_edit_suppliers') && <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setDeleteId(s.id)}><Trash2 className="w-3.5 h-3.5" /></Button>}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                    </tbody>
                </table>
            </div>

            {/* Dialog */}
            <Dialog open={showDialog} onOpenChange={v => { if (!v) { setShowDialog(false); setEditId(null); setForm(emptyForm); } }}>
                <DialogContent className="max-w-lg" dir="rtl">
                    <DialogHeader><DialogTitle>{editId ? 'تعديل بيانات المورد' : 'إضافة مورد جديد'}</DialogTitle></DialogHeader>
                    <div className="grid grid-cols-2 gap-4 mt-4">
                        <div className="col-span-2">
                            <label className="text-xs font-bold mb-1 block text-muted-foreground">اسم المورد الكامل *</label>
                            <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                        </div>
                        <div>
                            <label className="text-xs font-bold mb-1 block text-muted-foreground">اسم الشركة</label>
                            <Input value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} />
                        </div>
                        <div>
                            <label className="text-xs font-bold mb-1 block text-muted-foreground">رقم الهاتف</label>
                            <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
                        </div>
                        <div>
                            <label className="text-xs font-bold mb-1 block text-muted-foreground">المديونية الافتتاحية (ج.م)</label>
                            <Input type="number" value={form.current_balance} onChange={e => setForm({ ...form, current_balance: Number(e.target.value) })} />
                        </div>
                        <div>
                            <label className="text-xs font-bold mb-1 block text-muted-foreground">واتساب</label>
                            <Input value={form.whatsapp} onChange={e => setForm({ ...form, whatsapp: e.target.value })} />
                        </div>
                        <div className="col-span-2">
                            <label className="text-xs font-bold mb-1 block text-muted-foreground">العنوان بالتفصيل</label>
                            <Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
                        </div>
                    </div>
                    <div className="flex gap-2 justify-end mt-4">
                        <Button variant="outline" onClick={() => setShowDialog(false)}>إلغاء</Button>
                        <Button onClick={() => saveSupplierMutation.mutate(form)} disabled={saveSupplierMutation.isPending}>
                            {saveSupplierMutation.isPending ? 'جاري الحفظ...' : 'حفظ المورد'}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation */}
            <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
                <AlertDialogContent dir="rtl">
                    <AlertDialogHeader>
                        <AlertDialogTitle>حذف المورد؟</AlertDialogTitle>
                        <AlertDialogDescription>تنبيه: سيتم مسح بيانات المورد، تأكد أنه لا توجد فواتير معلقة مرتبطة به.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>تراجع</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteSupplierMutation.mutate(deleteId)} className="bg-destructive">تأكيد الحذف</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}