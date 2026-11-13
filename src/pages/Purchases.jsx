import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getPurchases, createPurchaseTransaction, deletePurchaseTransaction } from '@/firebase/collections/purchases';
import { getSuppliers } from '@/firebase/collections/suppliers';
import { getProducts } from '@/firebase/collections/products';
import { getAccounts } from '@/firebase/collections/accounts';
import { useRole } from '@/lib/RoleContext';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, Search, Trash2, Eye, X, Shield, ShoppingCart, ShoppingBag, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/components/ui/use-toast';
import ExportMenu from '@/components/shared/ExportMenu';

import { PageHero, StatCard } from '@/components/page';
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
    const { data: accounts = [] } = useQuery({ queryKey: ['purchase-accounts'], queryFn: getAccounts });

    const deletePurchase = useMutation({
        mutationFn: (id) => deletePurchaseTransaction(id),
        onSuccess: async () => {
            qc.invalidateQueries({ queryKey: ['purchases'] });
            qc.invalidateQueries({ queryKey: ['products'] });
            qc.invalidateQueries({ queryKey: ['suppliers'] });
            toast({ title: 'تم حذف الفاتورة بنجاح', description: 'تم تعديل المخزن والمديونية' });
            setDeleteId(null);
        },
        onError: (error) => {
            toast({ title: 'خطأ في الحذف', description: error.message, variant: 'destructive' });
        }
    });

    if (!can('can_view_purchases')) return <div className="p-10 text-center"><Shield className="mx-auto mb-4 opacity-20" size={48} /> لا تملك صلاحية</div>;

    const filtered = purchases.filter(p => {
        const matchSearch = (p.supplier_name || '').includes(search) || (p.invoice_number || '').includes(search);
        const matchStatus = statusFilter === 'all' || p.payment_status === statusFilter;
        return matchSearch && matchStatus;
    });

    const exportData = filtered.map(p => ({
        'رقم الفاتورة': p.invoice_number,
        'المورد': p.supplier_name,
        'الإجمالي': p.total || 0,
        'حالة الدفع': paymentStatusLabels[p.payment_status],
        'طريقة الدفع': paymentMethodLabels[p.payment_method],
        'التاريخ': p.created_at ? format(p.created_at.toDate?.() || new Date(p.created_at), 'dd/MM/yyyy') : '—',
    }));

    return (
        <div className="space-y-6">
            {/* Header */}
            <PageHero
                className="mb-0"
                icon={ShoppingBag}
                tone="cyan"
                title="المشتريات"
                subtitle={`إجمالي: ${purchases.reduce((s, p) => s + (p.total || 0), 0).toLocaleString('en-US')} ج.م`}
                actions={
                    <>
                        <ExportMenu data={exportData} filename="purchases" title="قائمة المشتريات" disabled={!filtered.length} />
                        {can('can_create_purchases') && (
                            <Button onClick={() => setShowCreate(true)} className="gap-2">
                                <Plus className="h-4 w-4" /> فاتورة جديدة
                            </Button>
                        )}
                    </>
                }
            />

            {/* Filters */}
            <div className="flex items-center gap-3 flex-wrap">
                <div className="relative flex-1 min-w-48">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-50" />
                    <Input
                        placeholder="بحث برقم فاتورة أو المورد..."
                        className="pr-10"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-40">
                        <SelectValue placeholder="الحالة" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">كل الحالات</SelectItem>
                        <SelectItem value="paid">مدفوع</SelectItem>
                        <SelectItem value="unpaid">غير مدفوع</SelectItem>
                        <SelectItem value="partial">جزئي</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard title="إجمالي المشتريات" value={`${purchases.reduce((s, p) => s + (p.total || 0), 0).toLocaleString('en-US')} ج.م`} icon={ShoppingBag} tone="blue" />
                <StatCard title="مدفوعة" value={purchases.filter(p => p.payment_status === 'paid').length} valueClassName="text-success" icon={CheckCircle2} tone="success" />
                <StatCard title="غير مدفوعة" value={purchases.filter(p => p.payment_status === 'unpaid').length} valueClassName="text-danger" icon={XCircle} tone="danger" />
                <StatCard title="جزئية" value={purchases.filter(p => p.payment_status === 'partial').length} valueClassName="text-warning" icon={Clock} tone="amber" />
            </div>

            {/* Table */}
            <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-card">
                <table className="w-full text-sm text-right">
                    <thead className="bg-muted/50 border-b border-border">
                        <tr>
                            <th className="px-5 py-4 font-bold">رقم الفاتورة</th>
                            <th className="px-4 py-4 font-bold">المورد</th>
                            <th className="px-4 py-4 font-bold">الإجمالي</th>
                            <th className="px-4 py-4 font-bold">الحالة</th>
                            <th className="px-4 py-4 font-bold">التاريخ</th>
                            <th className="px-4 py-4" />
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading ? (
                            <tr>
                                <td colSpan={6} className="py-20 text-center opacity-50">
                                    جاري التحميل...
                                </td>
                            </tr>
                        ) : filtered.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="py-20 text-center opacity-50">
                                    لا توجد فواتير
                                </td>
                            </tr>
                        ) : (
                            filtered.map(p => (
                                <tr key={p.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                                    <td className="px-5 py-4 font-mono text-xs font-bold text-primary">{p.invoice_number}</td>
                                    <td className="px-4 py-4 font-bold">{p.supplier_name}</td>
                                    <td className="px-4 py-4 font-black">{(p.total || 0).toLocaleString('ar')} ج.م</td>
                                    <td className="px-4 py-4">
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${paymentStatusColors[p.payment_status]}`}>
                                            {paymentStatusLabels[p.payment_status]}
                                        </span>
                                    </td>
                                    <td className="px-4 py-4 text-muted-foreground">
                                        {p.created_at ? format(p.created_at.toDate?.() || new Date(p.created_at), 'dd/MM/yyyy') : '—'}
                                    </td>
                                    <td className="px-4 py-4 text-left">
                                        <Button variant="ghost" size="icon" onClick={() => setViewItem(p)}>
                                            <Eye size={14} />
                                        </Button>
                                        {can('can_manage_accounts') && (
                                            <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setDeleteId(p.id)}>
                                                <Trash2 size={14} />
                                            </Button>
                                        )}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Create Dialog */}
            {showCreate && (
                <CreatePurchaseDialog
                    suppliers={suppliers}
                    products={products}
                    accounts={accounts}
                    user={user}
                    onClose={() => setShowCreate(false)}
                />
            )}

            {/* View Dialog */}
            {viewItem && (
                <Dialog open onOpenChange={() => setViewItem(null)}>
                    <DialogContent dir="rtl" className="max-w-2xl">
                        <DialogHeader>
                            <DialogTitle>تفاصيل الفاتورة {viewItem.invoice_number}</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-xs text-muted-foreground font-bold">المورد</p>
                                    <p className="text-lg font-bold">{viewItem.supplier_name}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground font-bold">رقم الفاتورة</p>
                                    <p className="text-lg font-bold font-mono">{viewItem.invoice_number}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground font-bold">الإجمالي</p>
                                    <p className="text-lg font-bold">{(viewItem.total || 0).toLocaleString('ar')} ج.م</p>
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground font-bold">الإجمالي قبل الخصم</p>
                                    <p className="text-lg font-bold">{(viewItem.subtotal ?? viewItem.total ?? 0).toLocaleString('ar')} ج.م</p>
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground font-bold">الخصم</p>
                                    <p className="text-lg font-bold">{(viewItem.discount || 0).toLocaleString('ar')} ج.م</p>
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground font-bold">الرصيد السابق للمورد</p>
                                    <p className="text-lg font-bold">{(viewItem.supplier_balance_before || 0).toLocaleString('ar')} ج.م</p>
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground font-bold">المدفوع</p>
                                    <p className="text-lg font-bold text-emerald-600">{(viewItem.paid_amount || 0).toLocaleString('ar')} ج.م</p>
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground font-bold">المتبقي</p>
                                    <p className="text-lg font-bold text-amber-600">{(viewItem.remaining_amount || 0).toLocaleString('ar')} ج.م</p>
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground font-bold">الحالة</p>
                                    <p className={`text-lg font-bold ${paymentStatusColors[viewItem.payment_status]}`}>
                                        {paymentStatusLabels[viewItem.payment_status]}
                                    </p>
                                </div>
                            </div>
                            {viewItem.items && viewItem.items.length > 0 && (
                                <div className="border-t pt-4">
                                    <p className="font-bold mb-2">الأصناف</p>
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b">
                                                <th className="text-right py-2">الصنف</th>
                                                <th className="text-right">الكمية</th>
                                                <th className="text-right">السعر</th>
                                                <th className="text-right">الإجمالي</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {viewItem.items.map((item, i) => (
                                                <tr key={i} className="border-b">
                                                    <td className="py-2">{item.product_name}</td>
                                                    <td>{item.quantity}</td>
                                                    <td>{(item.cost || 0).toLocaleString('ar')} ج.م</td>
                                                    <td>{(Number(item.quantity) * Number(item.cost) || 0).toLocaleString('ar')} ج.م</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </DialogContent>
                </Dialog>
            )}

            {/* Delete Dialog */}
            <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
                <AlertDialogContent dir="rtl">
                    <AlertDialogHeader>
                        <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
                        <AlertDialogDescription>
                            هل أنت متأكد من حذف هذه الفاتورة؟ سيتم تعديل المخزن والمديونية تلقائياً
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>تراجع</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => deletePurchase.mutate(deleteId)}
                            disabled={deletePurchase.isPending}
                            className="bg-red-600 hover:bg-red-700"
                        >
                            {deletePurchase.isPending ? 'جاري الحذف...' : 'حذف الفاتورة'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

// Dialog إضافة فاتورة جديدة
function CreatePurchaseDialog({ suppliers, products, accounts, user, onClose }) {
    const { toast } = useToast();
    const qc = useQueryClient();
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({ supplier_id: '', supplier_name: '', supplier_company: '', supplier_balance_before: 0, account_id: '', payment_method: 'cash', payment_status: 'paid', paid_amount: 0, discount: 0 });
    const [items, setItems] = useState([{ product_id: '', product_name: '', quantity: 1, cost: 0, total: 0 }]);

    const subtotal = items.reduce((sum, item) => sum + (Number(item.total) || 0), 0);
    const discount = Math.min(Math.max(Number(form.discount) || 0, 0), subtotal);
    const total = Math.max(subtotal - discount, 0);
    const paidAmount = form.payment_status === 'paid'
        ? total
        : form.payment_status === 'partial'
            ? Math.min(Math.max(Number(form.paid_amount) || 0, 0), total)
            : 0;
    const remainingAmount = Math.max(total - paidAmount, 0);
    const calculatedPaymentStatus = paidAmount >= total && total > 0 ? 'paid' : paidAmount > 0 ? 'partial' : 'unpaid';

    const handleSave = async () => {
        if (!form.supplier_id || items.some(i => !i.product_id) || (paidAmount > 0 && !form.account_id)) {
            toast({ title: "بيانات ناقصة", description: paidAmount > 0 && !form.account_id ? "اختر الحساب الذي تم الدفع منه" : "اختار المورد والأصناف أولاً", variant: "destructive" });
            return;
        }
        setSaving(true);
        try {
            await createPurchaseTransaction({
                ...form,
                items: items.filter(i => i.product_id),
                subtotal,
                discount,
                total,
                paid_amount: paidAmount,
                remaining_amount: remainingAmount,
                payment_status: calculatedPaymentStatus,
                created_by: user.uid,
                invoice_number: `PUR-${Date.now().toString().slice(-6)}`
            });

            qc.invalidateQueries({ queryKey: ['purchases'] });
            qc.invalidateQueries({ queryKey: ['products'] });
            qc.invalidateQueries({ queryKey: ['suppliers'] });
            toast({ title: "تم الحفظ", description: "تم تحديث المخزن ومديونية المورد", variant: "success" });
            onClose();
        } catch (err) {
            toast({ title: "خطأ في الحفظ", description: err.message, variant: "destructive" });
        } finally {
            setSaving(false);
        }
    };

    const updateItem = (idx, field, val) => {
        const newItems = [...items];
        newItems[idx][field] = val;
        if (field === 'product_id') {
            const p = products.find(x => x.id === val);
            newItems[idx].product_name = p?.product_name;
            newItems[idx].cost = p?.purchase_price || 0;
        }
        newItems[idx].total = Number(newItems[idx].quantity) * Number(newItems[idx].cost);
        setItems(newItems);
    };

    return (
        <Dialog open onOpenChange={onClose}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" dir="rtl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <ShoppingCart size={20} /> فاتورة شراء جديدة
                    </DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                    <div className="grid grid-cols-2 gap-4">
                        <Select onValueChange={v => { const supplier = suppliers.find((item) => item.id === v); setForm({ ...form, supplier_id: v, supplier_name: supplier?.name || '', supplier_company: supplier?.company || '', supplier_balance_before: Number(supplier?.current_balance) || 0 }); }}>
                            <SelectTrigger>
                                <SelectValue placeholder="اختر المورد" />
                            </SelectTrigger>
                            <SelectContent>
                                {suppliers.map(s => (
                                    <SelectItem key={s.id} value={s.id}>
                                        {s.company ? `${s.name} - ${s.company}` : s.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select onValueChange={v => setForm({ ...form, payment_status: v })} defaultValue="paid">
                            <SelectTrigger>
                                <SelectValue placeholder="حالة الدفع" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="paid">مدفوع بالكامل</SelectItem>
                                <SelectItem value="unpaid">آجل (مديونية)</SelectItem>
                                <SelectItem value="partial">جزئي</SelectItem>
                            </SelectContent>
                        </Select>
                        {form.payment_status !== 'unpaid' && <Select value={form.account_id} onValueChange={(value) => setForm({ ...form, account_id: value })}><SelectTrigger><SelectValue placeholder="حساب الدفع" /></SelectTrigger><SelectContent>{accounts.map((account) => <SelectItem key={account.id} value={account.id}>{account.name}</SelectItem>)}</SelectContent></Select>}
                    </div>

                    {form.payment_status === 'partial' && (
                        <div>
                            <label className="mb-1 block text-xs font-bold text-muted-foreground">المدفوع الآن</label>
                            <Input type="number" min="0" max={total} value={form.paid_amount} onChange={(event) => setForm({ ...form, paid_amount: event.target.value })} />
                        </div>
                    )}

                    <div>
                        <label className="mb-1 block text-xs font-bold text-muted-foreground">الخصم</label>
                        <Input type="number" min="0" max={subtotal} value={form.discount} onChange={(event) => setForm({ ...form, discount: event.target.value })} />
                    </div>

                    <div className="border rounded-lg p-4 bg-muted/20">
                        <h3 className="text-xs font-black mb-3 opacity-50 uppercase tracking-widest">الأصناف</h3>
                        {items.map((item, i) => (
                            <div key={i} className="flex gap-2 mb-2 items-center">
                                <Select className="flex-1" onValueChange={v => updateItem(i, 'product_id', v)}>
                                    <SelectTrigger className="flex-[2]">
                                        <SelectValue placeholder="المنتج" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {products.map(p => (
                                            <SelectItem key={p.id} value={p.id}>
                                                {p.product_name} (متاح: {p.current_stock})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Input
                                    type="number"
                                    className="w-24"
                                    placeholder="الكمية"
                                    value={item.quantity}
                                    onChange={e => updateItem(i, 'quantity', e.target.value)}
                                />
                                <Input
                                    type="number"
                                    className="w-28"
                                    placeholder="السعر"
                                    value={item.cost}
                                    onChange={e => updateItem(i, 'cost', e.target.value)}
                                />
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setItems(items.filter((_, idx) => idx !== i))}
                                >
                                    <X size={14} />
                                </Button>
                            </div>
                        ))}
                        <Button
                            variant="outline"
                            size="sm"
                            className="mt-2 w-full border-dashed"
                            onClick={() => setItems([...items, { product_id: '', quantity: 1, cost: 0 }])}
                        >
                            + إضافة صنف
                        </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-3 rounded-xl border border-primary/10 bg-primary/5 p-4 text-sm">
                        <div><span className="text-muted-foreground">الإجمالي قبل الخصم</span><strong className="block text-lg">{subtotal.toLocaleString('ar')} ج.م</strong></div>
                        <div><span className="text-muted-foreground">الخصم</span><strong className="block text-lg">{discount.toLocaleString('ar')} ج.م</strong></div>
                        <div><span className="text-muted-foreground">صافي الفاتورة</span><strong className="block text-lg text-primary">{total.toLocaleString('ar')} ج.م</strong></div>
                        <div><span className="text-muted-foreground">الرصيد السابق للمورد</span><strong className="block text-lg">{Number(form.supplier_balance_before || 0).toLocaleString('ar')} ج.م</strong></div>
                        <div><span className="text-muted-foreground">المدفوع</span><strong className="block text-lg text-emerald-600">{paidAmount.toLocaleString('ar')} ج.م</strong></div>
                        <div><span className="text-muted-foreground">المتبقي بعد الفاتورة</span><strong className="block text-lg text-amber-600">{remainingAmount.toLocaleString('ar')} ج.م</strong></div>
                    </div>

                    <div className="flex gap-2 justify-end">
                        <Button variant="outline" onClick={onClose}>
                            إلغاء
                        </Button>
                        <Button onClick={handleSave} disabled={saving}>
                            {saving ? "جاري تنفيذ المعاملة..." : "حفظ الفاتورة"}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}