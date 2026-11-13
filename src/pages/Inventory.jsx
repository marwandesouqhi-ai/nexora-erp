import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRole } from '@/lib/RoleContext';
import { useAuth } from '@/lib/AuthContext';
import { logActivity } from '@/lib/activityLogger';
import { getSuppliers } from '@/firebase/collections/suppliers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, Search, Trash2, Pencil, AlertTriangle, Package, Wallet, CalendarX } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/components/ui/use-toast';
import ExportMenu from '@/components/shared/ExportMenu';
import { sendStockAlert } from '@/services/whatsappService';
import BarcodeScanner from '@/components/shared/BarcodeScanner';
import { createProductRecord, deleteProduct as deleteProductRecord, generateProductBarcode, getProducts, updateProduct } from '@/firebase/collections/products';

import { PageHero, StatCard } from '@/components/page';
const categoryLabels = { medication: 'دواء', supplement: 'مكمل', vaccine: 'لقاح', equipment: 'معدات', feed: 'أعلاف', other: 'أخرى' };
const categoryColors = { medication: 'bg-blue-500/15 text-blue-400', supplement: 'bg-violet-500/15 text-violet-400', vaccine: 'bg-emerald-500/15 text-emerald-400', equipment: 'bg-amber-500/15 text-amber-400', feed: 'bg-orange-500/15 text-orange-400', other: 'bg-muted text-muted-foreground' };

const emptyForm = { name: '', name_ar: '', sku: '', barcode: '', category: 'medication', unit: 'box', price: '', cost: '', stock: 0, min_stock: 10, expiry_date: '', batch_number: '', description: '', active: true, supplier_id: '', supplier_name: '', supplier_company: '' };

export default function Inventory() {
    const { can } = useRole();
    const { user } = useAuth();
    const { toast } = useToast();
    const qc = useQueryClient();
    const [search, setSearch] = useState('');
    const [catFilter, setCatFilter] = useState('all');
    const [stockFilter, setStockFilter] = useState('all');
    const [form, setForm] = useState(emptyForm);
    const [editId, setEditId] = useState(null);
    const [showDialog, setShowDialog] = useState(false);
    const [deleteId, setDeleteId] = useState(null);
    const [barcodeChangeRequested, setBarcodeChangeRequested] = useState(false);

    // 1. جلب البيانات من Firebase
    const { data: products = [], isLoading } = useQuery({
        queryKey: ['products'],
        queryFn: async () => {
            const records = await getProducts();
            return records.map((data) => {
                return {
                    id: data.id,
                    name: data.product_name ?? data.name ?? '',
                    barcode: data.barcode ?? '',
                    category: data.category ?? 'other',
                    unit: data.unit ?? 'box',
                    price: Number(data.selling_price ?? data.price ?? 0),
                    cost: Number(data.purchase_price ?? data.cost ?? 0),
                    stock: Number(data.current_stock ?? data.stock ?? 0),
                    min_stock: Number(data.min_stock_level ?? data.min_stock ?? 10),
                    expiry_date: data.expiry_date ?? '',
                    batch_number: data.batch_number ?? '',
                    description: data.description ?? '',
                    active: data.active ?? true,
                    supplier_id: data.supplier_id ?? '',
                    supplier_name: data.supplier_name ?? '',
                    supplier_company: data.supplier_company ?? '',
                };
            });
        }
    });

    const { data: suppliers = [] } = useQuery({
        queryKey: ['suppliers'],
        queryFn: getSuppliers,
    });

    // 2. إضافة وتعديل منتج
    const saveProduct = useMutation({
        mutationFn: async (data) => {
            const productData = {
                product_name: data.name,
                barcode: editId && !barcodeChangeRequested
                    ? (products.find((product) => product.id === editId)?.barcode || generateProductBarcode(editId))
                    : (data.barcode?.trim() || generateProductBarcode()),
                category: data.category,
                unit: data.unit,
                selling_price: Number(data.price),
                purchase_price: Number(data.cost),
                current_stock: Number(data.stock),
                stock: Number(data.stock),
                min_stock_level: Number(data.min_stock),
                min_stock: Number(data.min_stock),
                expiry_date: data.expiry_date || null,
                batch_number: data.batch_number,
                description: data.description,
                supplier_id: data.supplier_id || '',
                supplier_name: data.supplier_name || '',
                supplier_company: data.supplier_company || '',
                updated_at: new Date().toISOString(),
            };

            if (editId) {
                return updateProduct(editId, productData);
            } else {
                return createProductRecord(productData);
            }
        },
        onSuccess: async (_, data) => {
            qc.invalidateQueries(['products']);

            // تنبيه الواتساب عند النقص
            if (data.stock <= data.min_stock) {
                sendStockAlert(data.name, data.stock);
            }

            await logActivity(user?.uid, editId ? 'تعديل منتج' : 'إضافة منتج', `المنتج: ${data.name}`);
            toast({ title: "تمت العملية بنجاح", description: editId ? "تم تحديث البيانات" : "تمت إضافة الصنف للمخزن" });
            setShowDialog(false); setEditId(null); setBarcodeChangeRequested(false); setForm(emptyForm);
        },
    });

    // 3. حذف منتج
    const deleteProduct = useMutation({
        mutationFn: deleteProductRecord,
        onSuccess: async () => {
            qc.invalidateQueries(['products']);
            toast({ title: 'تم الحذف', description: 'تم حذف المنتج من السجلات نهائياً' });
            setDeleteId(null);
        },
    });

    // 4. منطق البحث والفلترة
    const today = new Date();
    const filtered = products.filter(p => {
        const matchSearch = (p.name || '').toLowerCase().includes(search.toLowerCase()) ||
            (p.barcode || '').includes(search) ||
            (p.sku || '').toLowerCase().includes(search.toLowerCase());
        const matchCat = catFilter === 'all' || p.category === catFilter;
        const isLow = (p.stock || 0) <= (p.min_stock || 10);
        const isExpired = p.expiry_date && new Date(p.expiry_date) < today;
        const matchStock = stockFilter === 'all' || (stockFilter === 'low' && isLow) || (stockFilter === 'expired' && isExpired);
        return matchSearch && matchCat && matchStock;
    });

    // تحضير البيانات للإكسيل
    const exportData = filtered.map(p => ({
        'الاسم': p.name,
        'الباركود': p.barcode,
        'الفئة': categoryLabels[p.category],
        'المورد': p.supplier_name || '—',
        'المخزن': p.stock,
        'سعر البيع': p.price,
    }));

    return (
        <div className="space-y-6 pb-10">
            {/* Header */}
            <PageHero
                className="mb-0"
                icon={Package}
                tone="cyan"
                title="المخزون الاستراتيجي"
                subtitle={`${products.length} صنف مسجل في Nexora`}
                actions={
                    <>
                        <ExportMenu data={exportData} filename="inventory_report" />
                        {can('can_edit_inventory') && (
                            <Button onClick={() => { setForm(emptyForm); setEditId(null); setBarcodeChangeRequested(false); setShowDialog(true); }} className="gap-2">
                                <Plus className="h-4 w-4" /> إضافة صنف جديد
                            </Button>
                        )}
                    </>
                }
            />

            {/* Stats Cards */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <StatCard title="قيمة المخزون (بيع)" value={`${products.reduce((acc, p) => acc + (p.stock * p.price), 0).toLocaleString('en-US')} ج.م`} caption="إجمالي الكميات × سعر البيع" icon={Wallet} tone="emerald" />
                <StatCard title="نواقص المخزن" value={products.filter(p => p.stock <= p.min_stock).length} valueClassName="text-warning" caption="أصناف عند أو تحت حد الأمان" icon={AlertTriangle} tone="amber" />
                <StatCard title="منتهى الصلاحية" value={products.filter(p => p.expiry_date && new Date(p.expiry_date) < today).length} valueClassName="text-danger" caption="أصناف تجاوزت تاريخ الصلاحية" icon={CalendarX} tone="rose" />
            </div>

            {/* Controls Area */}
            <div className="space-y-4 rounded-2xl border border-border bg-card p-4 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
                <div className="flex flex-wrap items-center gap-3">
                    {/* البحث اليدوي */}
                    <div className="relative flex-1 min-w-[280px]">
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                            placeholder="بحث بالاسم، الباركود، أو الـ SKU..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="pr-10 h-11 border-border bg-card focus:ring-indigo-500"
                        />
                    </div>

                    {/* فلاتر الفئة والحالة */}
                    <Select value={catFilter} onValueChange={setCatFilter}>
                        <SelectTrigger className="w-40 h-11"><SelectValue placeholder="كل الفئات" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">كل الفئات</SelectItem>
                            {Object.entries(categoryLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                        </SelectContent>
                    </Select>

                    <Select value={stockFilter} onValueChange={setStockFilter}>
                        <SelectTrigger className="w-40 h-11"><SelectValue placeholder="حالة المخزن" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">الكل</SelectItem>
                            <SelectItem value="low">النواقص</SelectItem>
                            <SelectItem value="expired">منتهى الصلاحية</SelectItem>
                        </SelectContent>
                    </Select>

                    {/* زرار السكانر بالكاميرا */}
                    <BarcodeScanner onScanSuccess={(code) => {
                        setSearch(code);
                        toast({ title: "تم المسح", description: `باركود: ${code}` });
                    }} />
                </div>
            </div>

            {/* Table */}
            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
                <table className="w-full text-right">
                    <thead className="border-b border-border bg-muted/40 text-xs uppercase font-bold text-muted-foreground">
                        <tr>
                            <th className="px-6 py-4">المنتج</th>
                            <th className="px-6 py-4">الفئة</th>
                            <th className="px-6 py-4">المورد</th>
                            <th className="px-6 py-4">المخزن</th>
                            <th className="px-6 py-4">سعر البيع</th>
                            <th className="px-6 py-4">تاريخ الانتهاء</th>
                            <th className="px-6 py-4 text-left">إجراءات</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                        {isLoading ? (
                            <tr><td colSpan="6" className="py-20 text-center"><div className="flex flex-col items-center justify-center gap-2 text-muted-foreground"><Package className="h-6 w-6" /><span className="text-sm font-semibold">جاري تحميل البيانات...</span></div></td></tr>
                        ) : filtered.length > 0 ? filtered.map(p => (
                            <tr key={p.id} className="transition-colors hover:bg-muted/30">
                                <td className="px-6 py-4">
                                    <p className="font-bold text-foreground">{p.name}</p>
                                    <p className="text-[10px] text-muted-foreground font-mono tracking-tighter">{p.barcode || 'بدون باركود'}</p>
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold ${categoryColors[p.category]}`}>
                                        {categoryLabels[p.category]}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-secondary-text">
                                    {p.supplier_company || p.supplier_name || '—'}
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-2">
                                        <span className={`font-black ${p.stock <= p.min_stock ? 'text-amber-500' : 'text-slate-700'}`}>{p.stock}</span>
                                        <span className="text-[10px] text-muted-foreground">/ {p.unit}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4 font-bold text-indigo-600">{Number(p.price ?? 0).toLocaleString()} ج.م</td>
                                <td className="px-6 py-4 text-xs text-muted-foreground">
                                    {p.expiry_date ? format(new Date(p.expiry_date), 'yyyy-MM-dd') : '—'}
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center justify-end gap-1">
                                        <Button variant="ghost" size="icon" onClick={() => { setForm(p); setEditId(p.id); setBarcodeChangeRequested(false); setShowDialog(true); }} className="h-8 w-8 text-muted-foreground hover:text-indigo-600"><Pencil className="w-4 h-4" /></Button>
                                        <Button variant="ghost" size="icon" onClick={() => setDeleteId(p.id)} className="h-8 w-8 text-muted-foreground hover:text-red-600"><Trash2 className="w-4 h-4" /></Button>
                                    </div>
                                </td>
                            </tr>
                        )) : (
                            <tr><td colSpan="6" className="py-20 text-center"><div className="flex flex-col items-center justify-center gap-2 text-muted-foreground"><Package className="h-6 w-6" /><span className="text-sm font-semibold">لا توجد نتائج مطابقة للبحث</span></div></td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Dialog Form */}
            <Dialog open={showDialog} onOpenChange={setShowDialog}>
                <DialogContent className="max-w-2xl rounded-2xl bg-background" dir="rtl">
                    <DialogHeader><DialogTitle className="text-xl font-black">{editId ? 'تعديل الصنف' : 'إضافة صنف جديد للمخزن'}</DialogTitle></DialogHeader>
                    <div className="grid grid-cols-2 gap-4 py-4">
                        <div className="col-span-2">
                            <label className="text-xs font-bold mb-1 block text-muted-foreground">اسم المنتج (إلزامي)</label>
                            <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                        </div>
                        <div>
                            <label className="text-xs font-bold mb-1 block text-muted-foreground">الباركود</label>
                            <div className="flex gap-2">
                                <Input value={form.barcode} readOnly={!!editId && !barcodeChangeRequested} placeholder="سيتم إنشاؤه تلقائياً عند الحفظ" onChange={e => setForm({ ...form, barcode: e.target.value })} />
                                {editId && <Button type="button" variant="outline" onClick={() => setBarcodeChangeRequested((value) => !value)}>{barcodeChangeRequested ? 'تثبيت' : 'تغيير'}</Button>}
                            </div>
                            <p className="mt-1 text-[11px] text-muted-foreground">{editId && !barcodeChangeRequested ? 'الباركود ثابت. فعّل التغيير لتعديله.' : 'سيتم حفظ هذا الباركود مع المنتج.'}</p>
                        </div>
                        <div>
                            <label className="text-xs font-bold mb-1 block text-muted-foreground">الفئة</label>
                            <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>{Object.entries(categoryLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div>
                            <label className="text-xs font-bold mb-1 block text-muted-foreground">المورد</label>
                            <Select value={form.supplier_id} onValueChange={v => { const supplier = suppliers.find((item) => item.id === v); setForm({ ...form, supplier_id: v, supplier_name: supplier?.name || '', supplier_company: supplier?.company || '' }); }}>
                                <SelectTrigger><SelectValue placeholder="Choose supplier" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="">No supplier</SelectItem>
                                    {suppliers.map((supplier) => (
                                        <SelectItem key={supplier.id} value={supplier.id}>{supplier.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <label className="text-xs font-bold mb-1 block text-muted-foreground">سعر البيع</label>
                            <Input type="number" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} />
                        </div>
                        <div>
                            <label className="text-xs font-bold mb-1 block text-muted-foreground">سعر الشراء (التكلفة)</label>
                            <Input type="number" value={form.cost} onChange={e => setForm({ ...form, cost: e.target.value })} />
                        </div>
                        <div>
                            <label className="text-xs font-bold mb-1 block text-muted-foreground">الكمية الحالية</label>
                            <Input type="number" value={form.stock} onChange={e => setForm({ ...form, stock: e.target.value })} />
                        </div>
                        <div>
                            <label className="text-xs font-bold mb-1 block text-muted-foreground">حد الأمان (تنبيه النقص)</label>
                            <Input type="number" value={form.min_stock} onChange={e => setForm({ ...form, min_stock: e.target.value })} />
                        </div>
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setShowDialog(false)}>إلغاء</Button>
                        <Button onClick={() => saveProduct.mutate(form)} className="bg-indigo-600 px-8">حفظ البيانات</Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Delete Alert */}
            <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
                <AlertDialogContent className="rounded-2xl bg-background" dir="rtl">
                    <AlertDialogHeader>
                        <AlertDialogTitle>هل أنت متأكد من الحذف؟</AlertDialogTitle>
                        <AlertDialogDescription>سيتم إزالة هذا المنتج تماماً من قاعدة البيانات وسجل المخازن.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="gap-2">
                        <AlertDialogCancel>تراجع</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteProduct.mutate(deleteId)} className="bg-red-600 hover:bg-red-700 text-white">تأكيد الحذف</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
