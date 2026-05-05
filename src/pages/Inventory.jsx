import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '@/api/firebase';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import { useRole } from '@/lib/RoleContext';
import { useAuth } from '@/lib/AuthContext';
import { logActivity } from '@/lib/activityLogger';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, Search, Trash2, Pencil, AlertTriangle, Package, FileSpreadsheet, QrCode } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/components/ui/use-toast';
import ExportMenu from '@/components/shared/ExportMenu';
import { sendStockAlert } from '@/services/whatsappService';
import BarcodeScanner from '@/components/shared/BarcodeScanner';

const categoryLabels = { medication: 'دواء', supplement: 'مكمل', vaccine: 'لقاح', equipment: 'معدات', feed: 'أعلاف', other: 'أخرى' };
const categoryColors = { medication: 'bg-blue-500/15 text-blue-400', supplement: 'bg-violet-500/15 text-violet-400', vaccine: 'bg-emerald-500/15 text-emerald-400', equipment: 'bg-amber-500/15 text-amber-400', feed: 'bg-orange-500/15 text-orange-400', other: 'bg-muted text-muted-foreground' };

const emptyForm = { name: '', name_ar: '', sku: '', barcode: '', category: 'medication', unit: 'box', price: '', cost: '', stock: 0, min_stock: 10, expiry_date: '', batch_number: '', description: '', active: true };

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

    // 1. جلب البيانات من Firebase
    const { data: products = [], isLoading } = useQuery({
        queryKey: ['products'],
        queryFn: async () => {
            const q = query(collection(db, 'products'), orderBy('name'));
            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        }
    });

    // 2. إضافة وتعديل منتج
    const saveProduct = useMutation({
        mutationFn: async (data) => {
            const productData = {
                ...data,
                stock: Number(data.stock),
                min_stock: Number(data.min_stock),
                price: Number(data.price),
                cost: Number(data.cost),
                updated_at: new Date().toISOString()
            };

            if (editId) {
                const docRef = doc(db, 'products', editId);
                return await updateDoc(docRef, productData);
            } else {
                return await addDoc(collection(db, 'products'), { ...productData, created_at: new Date().toISOString() });
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
            setShowDialog(false); setEditId(null); setForm(emptyForm);
        },
    });

    // 3. حذف منتج
    const deleteProduct = useMutation({
        mutationFn: async (id) => await deleteDoc(doc(db, 'products', id)),
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
        'الاسم': p.name, 'الباركود': p.barcode, 'الفئة': categoryLabels[p.category], 'المخزن': p.stock, 'سعر البيع': p.price
    }));

    return (
        <div className="space-y-6 pb-10">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                <div>
                    <h1 className="text-2xl font-black text-slate-800 tracking-tight">المخزون الاستراتيجي</h1>
                    <p className="text-sm text-slate-500 mt-1 flex items-center gap-2">
                        <Package className="w-3 h-3" /> {products.length} صنف مسجل في Nexora
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <ExportMenu data={exportData} filename="inventory_report" />
                    {can('admin') && (
                        <Button onClick={() => { setForm(emptyForm); setEditId(null); setShowDialog(true); }} className="bg-indigo-600 hover:bg-indigo-700 shadow-md gap-2">
                            <Plus className="w-4 h-4" /> إضافة صنف جديد
                        </Button>
                    )}
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <StatCard label="قيمة المخزون (بيع)" value={`${products.reduce((acc, p) => acc + (p.stock * p.price), 0).toLocaleString()} ج.م`} icon={<FileSpreadsheet className="text-emerald-500" />} />
                <StatCard label="نواقص المخزن" value={products.filter(p => p.stock <= p.min_stock).length} color="text-amber-500" icon={<AlertTriangle />} />
                <StatCard label="منتهى الصلاحية" value={products.filter(p => p.expiry_date && new Date(p.expiry_date) < today).length} color="text-red-500" />
            </div>

            {/* Controls Area */}
            <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                    {/* البحث اليدوي */}
                    <div className="relative flex-1 min-w-[280px]">
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input
                            placeholder="بحث بالاسم، الباركود، أو الـ SKU..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="pr-10 h-11 border-slate-200 focus:ring-indigo-500"
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
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <table className="w-full text-right">
                    <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 text-xs uppercase font-bold">
                        <tr>
                            <th className="px-6 py-4">المنتج</th>
                            <th className="px-6 py-4">الفئة</th>
                            <th className="px-6 py-4">المخزن</th>
                            <th className="px-6 py-4">سعر البيع</th>
                            <th className="px-6 py-4">تاريخ الانتهاء</th>
                            <th className="px-6 py-4 text-left">إجراءات</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {isLoading ? (
                            <tr><td colSpan="6" className="py-20 text-center text-slate-400">جاري تحميل البيانات...</td></tr>
                        ) : filtered.map(p => (
                            <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                                <td className="px-6 py-4">
                                    <p className="font-bold text-slate-800">{p.name}</p>
                                    <p className="text-[10px] text-slate-400 font-mono tracking-tighter">{p.barcode || 'بدون باركود'}</p>
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold ${categoryColors[p.category]}`}>
                                        {categoryLabels[p.category]}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-2">
                                        <span className={`font-black ${p.stock <= p.min_stock ? 'text-amber-500' : 'text-slate-700'}`}>{p.stock}</span>
                                        <span className="text-[10px] text-slate-400">/ {p.unit}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4 font-bold text-indigo-600">{p.price.toLocaleString()} ج.م</td>
                                <td className="px-6 py-4 text-xs text-slate-500">
                                    {p.expiry_date ? format(new Date(p.expiry_date), 'yyyy-MM-dd') : '—'}
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center justify-end gap-1">
                                        <Button variant="ghost" size="icon" onClick={() => { setForm(p); setEditId(p.id); setShowDialog(true); }} className="h-8 w-8 text-slate-400 hover:text-indigo-600"><Pencil className="w-4 h-4" /></Button>
                                        <Button variant="ghost" size="icon" onClick={() => setDeleteId(p.id)} className="h-8 w-8 text-slate-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></Button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Dialog Form */}
            <Dialog open={showDialog} onOpenChange={setShowDialog}>
                <DialogContent className="max-w-2xl bg-white" dir="rtl">
                    <DialogHeader><DialogTitle className="text-xl font-black">{editId ? 'تعديل الصنف' : 'إضافة صنف جديد للمخزن'}</DialogTitle></DialogHeader>
                    <div className="grid grid-cols-2 gap-4 py-4">
                        <div className="col-span-2">
                            <label className="text-xs font-bold mb-1 block text-slate-500">اسم المنتج (إلزامي)</label>
                            <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                        </div>
                        <div>
                            <label className="text-xs font-bold mb-1 block text-slate-500">الباركود</label>
                            <Input value={form.barcode} onChange={e => setForm({ ...form, barcode: e.target.value })} />
                        </div>
                        <div>
                            <label className="text-xs font-bold mb-1 block text-slate-500">الفئة</label>
                            <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>{Object.entries(categoryLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div>
                            <label className="text-xs font-bold mb-1 block text-slate-500">سعر البيع</label>
                            <Input type="number" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} />
                        </div>
                        <div>
                            <label className="text-xs font-bold mb-1 block text-slate-500">سعر الشراء (التكلفة)</label>
                            <Input type="number" value={form.cost} onChange={e => setForm({ ...form, cost: e.target.value })} />
                        </div>
                        <div>
                            <label className="text-xs font-bold mb-1 block text-slate-500">الكمية الحالية</label>
                            <Input type="number" value={form.stock} onChange={e => setForm({ ...form, stock: e.target.value })} />
                        </div>
                        <div>
                            <label className="text-xs font-bold mb-1 block text-slate-500">حد الأمان (تنبيه النقص)</label>
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
                <AlertDialogContent className="bg-white" dir="rtl">
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