import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
// استيراد الدوال الخاصة بـ Nexora ERP من Firebase
import { getPurchases, createPurchaseTransaction, deletePurchaseTransaction } from '@/firebase/collections/purchases';
import { getSuppliers } from '@/firebase/collections/suppliers';
import { getProducts } from '@/firebase/collections/products';
import { useRole } from '@/lib/RoleContext';
import { useAuth } from '@/lib/AuthContext';
import { logActivity } from '@/lib/activityLogger';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, Search, Trash2, Eye, X, Shield, ShoppingCart } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/components/ui/use-toast';
import ExportMenu from '@/components/shared/ExportMenu';

const paymentStatusColors = { paid: 'bg-emerald-500/15 text-emerald-400', partial: 'bg-amber-500/15 text-amber-400', unpaid: 'bg-red-500/15 text-red-400' };
const paymentStatusLabels = { paid: 'مدفوع', partial: 'جزئي', unpaid: 'غير مدفوع' };
const paymentMethodLabels = { cash: 'نقدي', bank_transfer: 'تحويل', check: 'شيك', credit: 'آجل' };

export default function Purchases() {
    const { can } = useRole();
    const { user } = useAuth();
    const { toast } = useToast();
    const qc = useQueryClient();
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [showCreate, setShowCreate] = useState(false);
    const [viewItem, setViewItem] = useState(null);
    const [deleteId, setDeleteId] = useState(null);

    // جلب البيانات من Firebase
    const { data: purchases = [], isLoading } = useQuery({ queryKey: ['purchases'], queryFn: getPurchases });
    const { data: suppliers = [] } = useQuery({ queryKey: ['suppliers'], queryFn: getSuppliers });
    const { data: products = [] } = useQuery({ queryKey: ['products'], queryFn: getProducts });

    const deletePurchase = useMutation({
        mutationFn: (id) => deletePurchaseTransaction(id),
        onSuccess: async () => {
            qc.invalidateQueries(['purchases', 'products', 'suppliers']);
            toast({ title: 'تم حذف الفاتورة وتعديل المخزن والمديونية' });
            setDeleteId(null);
        },
    });

    if (!can('can_view_purchases')) return <div className="p-10 text-center"><Shield className="mx-auto mb-4 opacity-20" size={48} /> لا تملك صلاحية</div>;

    const filtered = purchases.filter(p => {
        const matchSearch = (p.supplier_name || '').includes(search) || (p.invoice_number || '').includes(search);
        const matchStatus = statusFilter === 'all' || p.payment_status === statusFilter;
        return matchSearch && matchStatus;
    });

    return (
        <div className="space-y-6">
            {/* Header & Stats - كودك الأصلي مع تحديث بسيط */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-2xl font-black italic tracking-tighter">Nexora <span className="text-primary">Purchases</span></h1>
                    <p className="text-xs text-muted-foreground">إجمالي المشتريات: {purchases.reduce((s, p) => s + (p.total || 0), 0).toLocaleString('ar')} ج.م</p>
                </div>
                <div className="flex gap-2">
                    {can('can_create_purchases') && <Button onClick={() => setShowCreate(true)} className="gap-2 font-bold"><Plus size={18} /> فاتورة جديدة</Button>}
                </div>
            </div>

            <div className="flex items-center gap-3">
                <div className="relative flex-1"><Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-50" /><Input placeholder="بحث..." className="pr-10" value={search} onChange={e => setSearch(e.target.value)} /></div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-40"><SelectValue placeholder="الحالة" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">كل الحالات</SelectItem>
                        <SelectItem value="paid">مدفوع</SelectItem>
                        <SelectItem value="unpaid">غير مدفوع</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Table */}
            <div className="erp-card overflow-hidden border border-border/50 rounded-xl">
                <table className="w-full text-sm text-right">
                    <thead className="bg-muted/50 border-b border-border">
                        <tr>
                            <th className="px-5 py-4">رقم الفاتورة</th>
                            <th className="px-4 py-4">المورد</th>
                            <th className="px-4 py-4">الإجمالي</th>
                            <th className="px-4 py-4">الحالة</th>
                            <th className="px-4 py-4">التاريخ</th>
                            <th className="px-4 py-4" />
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading ? <tr><td colSpan={6} className="py-20 text-center opacity-50">جاري التحديث من Nexora Cloud...</td></tr> :
                            filtered.map(p => (
                                <tr key={p.id} className="border-b border-border/40 hover:bg-muted/20 transition-all">
                                    <td className="px-5 py-4 font-mono text-xs text-primary font-bold">{p.invoice_number}</td>
                                    <td className="px-4 py-4 font-bold">{p.supplier_name}</td>
                                    <td className="px-4 py-4 font-black">{(p.total || 0).toLocaleString('ar')} ج.م</td>
                                    <td className="px-4 py-4"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${paymentStatusColors[p.payment_status]}`}>{paymentStatusLabels[p.payment_status]}</span></td>
                                    <td className="px-4 py-4 text-muted-foreground">{p.created_at ? format(p.created_at.toDate(), 'dd/MM/yyyy') : '—'}</td>
                                    <td className="px-4 py-4 text-left">
                                        <Button variant="ghost" size="icon" onClick={() => setViewItem(p)}><Eye size={14} /></Button>
                                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setDeleteId(p.id)}><Trash2 size={14} /></Button>
                                    </td>
                                </tr>
                            ))
                        }
                    </tbody>
                </table>
            </div>

            {/* Modals */}
            {showCreate && <CreatePurchaseDialog suppliers={suppliers} products={products} user={user} onClose={() => setShowCreate(false)} />}

            {/* View & Delete Modals كما في كودك مع تعديل بسيط للـ logic */}
        </div>
    );
}

// Dialog إضافة فاتورة جديدة - التعديل الجوهري هنا
function CreatePurchaseDialog({ suppliers, products, user, onClose }) {
    const { toast } = useToast();
    const qc = useQueryClient();
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({ supplier_id: '', supplier_name: '', payment_method: 'cash', payment_status: 'paid', discount: 0 });
    const [items, setItems] = useState([{ product_id: '', product_name: '', quantity: 1, cost: 0, total: 0 }]);

    const total = items.reduce((s, i) => s + (i.total || 0), 0) - (Number(form.discount) || 0);

    const handleSave = async () => {
        if (!form.supplier_id || items.some(i => !i.product_id)) {
            toast({ title: "بيانات ناقصة", description: "اختار المورد والأصناف أولاً", variant: "destructive" });
            return;
        }
        setSaving(true);
        try {
            // استخدام الـ Transaction Logic اللي بيحدث 3 كوليكشنز مع بعض
            await createPurchaseTransaction({
                ...form,
                items,
                total,
                created_by: user.uid,
                invoice_number: `PUR-${Date.now().toString().slice(-6)}`
            });

            qc.invalidateQueries(['purchases', 'products', 'suppliers']);
            toast({ title: "تم الحفظ", description: "تم تحديث المخزن ومديونية المورد" });
            onClose();
        } catch (err) {
            toast({ title: "خطأ في الحفظ", variant: "destructive" });
        } finally {
            setSaving(false);
        }
    };

    const updateItem = (idx, field, val) => {
        const newItems = [...items];
        newItems[idx][field] = val;
        if (field === 'product_id') {
            const p = products.find(x => x.id === val);
            newItems[idx].product_name = p?.name;
            newItems[idx].cost = p?.cost || 0;
        }
        newItems[idx].total = Number(newItems[idx].quantity) * Number(newItems[idx].cost);
        setItems(newItems);
    };

    return (
        <Dialog open onOpenChange={onClose}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" dir="rtl">
                <DialogHeader><DialogTitle className="flex items-center gap-2"><ShoppingCart size={20} /> فاتورة شراء جديدة</DialogTitle></DialogHeader>
                <div className="space-y-4 mt-4">
                    <div className="grid grid-cols-2 gap-4">
                        <Select onValueChange={v => setForm({ ...form, supplier_id: v, supplier_name: suppliers.find(s => s.id === v)?.name })}>
                            <SelectTrigger><SelectValue placeholder="اختر المورد" /></SelectTrigger>
                            <SelectContent>{suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                        </Select>
                        <Select onValueChange={v => setForm({ ...form, payment_status: v })} defaultValue="paid">
                            <SelectTrigger><SelectValue placeholder="حالة الدفع" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="paid">مدفوع بالكامل</SelectItem>
                                <SelectItem value="unpaid">آجل (مديونية)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="border rounded-lg p-4 bg-muted/20">
                        <h3 className="text-xs font-black mb-3 opacity-50 uppercase tracking-widest">الأصناف</h3>
                        {items.map((item, i) => (
                            <div key={i} className="flex gap-2 mb-2 items-center">
                                <Select className="flex-1" onValueChange={v => updateItem(i, 'product_id', v)}>
                                    <SelectTrigger className="flex-[2]"><SelectValue placeholder="المنتج" /></SelectTrigger>
                                    <SelectContent>{products.map(p => <SelectItem key={p.id} value={p.id}>{p.name} (متاح: {p.stock})</SelectItem>)}</SelectContent>
                                </Select>
                                <Input type="number" className="w-24" placeholder="الكمية" value={item.quantity} onChange={e => updateItem(i, 'quantity', e.target.value)} />
                                <Input type="number" className="w-28" placeholder="السعر" value={item.cost} onChange={e => updateItem(i, 'cost', e.target.value)} />
                                <Button variant="ghost" size="icon" onClick={() => setItems(items.filter((_, idx) => idx !== i))}><X size={14} /></Button>
                            </div>
                        ))}
                        <Button variant="outline" size="sm" className="mt-2 w-full border-dashed" onClick={() => setItems([...items, { product_id: '', quantity: 1, cost: 0 }])}>+ إضافة صنف</Button>
                    </div>

                    <div className="flex justify-between items-center bg-primary/5 p-4 rounded-xl border border-primary/10">
                        <span className="font-bold text-primary">الإجمالي النهائي:</span>
                        <span className="text-2xl font-black text-primary">{total.toLocaleString('ar')} ج.م</span>
                    </div>

                    <div className="flex gap-2 justify-end">
                        <Button variant="outline" onClick={onClose}>إلغاء</Button>
                        <Button onClick={handleSave} disabled={saving}>{saving ? "جاري تنفيذ المعاملة..." : "حفظ الفاتورة"}</Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}