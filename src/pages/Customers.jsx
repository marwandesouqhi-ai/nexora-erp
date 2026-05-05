import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
// استبدال عميل الـ base44 بملف الفايرباز الخاص بنا
import { addNewCustomer, getCustomers, updateCustomer, deleteCustomerDoc } from '@/firebase/collections/customers';
import { useRole } from '@/lib/RoleContext';
import { useAuth } from '@/lib/AuthContext';
import { logActivity } from '@/lib/activityLogger';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, Search, Trash2, Pencil } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import ExportMenu from '@/components/shared/ExportMenu';

const typeColors = { pharmacy: 'bg-cyan-500/15 text-cyan-400', clinic: 'bg-violet-500/15 text-violet-400', distributor: 'bg-amber-500/15 text-amber-400', other: 'bg-muted text-muted-foreground' };
const typeLabels = { pharmacy: 'صيدلية', clinic: 'عيادة', distributor: 'موزع', other: 'أخرى' };
const statusColors = { active: 'bg-emerald-500/15 text-emerald-400', inactive: 'bg-muted text-muted-foreground', blocked: 'bg-red-500/15 text-red-400' };
const statusLabels = { active: 'نشط', inactive: 'غير نشط', blocked: 'محظور' };

const emptyForm = { name: '', type: 'pharmacy', contact_person: '', phone: '', phone2: '', email: '', address: '', city: '', tax_number: '', credit_limit: 0, notes: '', status: 'active', balance: 0, total_spent: 0 };

export default function Customers() {
    const { can } = useRole();
    const { user } = useAuth();
    const { toast } = useToast();
    const qc = useQueryClient();
    const [search, setSearch] = useState('');
    const [typeFilter, setTypeFilter] = useState('all');
    const [form, setForm] = useState(emptyForm);
    const [editId, setEditId] = useState(null);
    const [showDialog, setShowDialog] = useState(false);
    const [deleteId, setDeleteId] = useState(null);

    // 1. جلب البيانات من Firebase
    const { data: customers = [], isLoading } = useQuery({
        queryKey: ['customers'],
        queryFn: getCustomers // الدالة اللي عملناها في كوليكشن العملاء
    });

    // 2. الحفظ والتعديل في Firebase
    const saveCustomerMutation = useMutation({
        mutationFn: async (data) => {
            if (editId) {
                return updateCustomer(editId, data);
            } else {
                return addNewCustomer(data);
            }
        },
        onSuccess: async (_, data) => {
            qc.invalidateQueries(['customers']);
            await logActivity({
                user,
                action: editId ? 'update_customer' : 'create_customer',
                entity_type: 'Customer',
                details: `${editId ? 'تعديل' : 'إضافة'} عميل: ${data.name}`
            });
            toast({ title: editId ? 'تم تحديث العميل بنجاح' : 'تم إضافة العميل بنجاح' });
            setShowDialog(false); setEditId(null); setForm(emptyForm);
        },
    });

    // 3. الحذف من Firebase
    const deleteCustomerMutation = useMutation({
        mutationFn: (id) => deleteCustomerDoc(id),
        onSuccess: async () => {
            qc.invalidateQueries(['customers']);
            toast({ title: 'تم حذف العميل بنجاح' });
            setDeleteId(null);
        },
    });

    const openEdit = (c) => { setForm(c); setEditId(c.id); setShowDialog(true); };
    const openNew = () => { setForm(emptyForm); setEditId(null); setShowDialog(true); };

    const filtered = customers.filter(c => {
        const matchSearch = (c.name || '').toLowerCase().includes(search.toLowerCase()) ||
            (c.phone || '').includes(search) ||
            (c.city || '').toLowerCase().includes(search.toLowerCase());
        const matchType = typeFilter === 'all' || c.type === typeFilter;
        return matchSearch && matchType;
    });

    const exportData = filtered.map(c => ({
        'الاسم': c.name, 'النوع': typeLabels[c.type], 'المسؤول': c.contact_person || '',
        'الهاتف': c.phone, 'المدينة': c.city || '', 'الرصيد': c.balance || 0,
        'إجمالي المشتريات': c.total_spent || 0, 'الحالة': statusLabels[c.status],
    }));

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-2xl font-black">العملاء</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">{customers.length} عميل مسجل</p>
                </div>
                <div className="flex items-center gap-2">
                    <ExportMenu data={exportData} filename="customers" title="قائمة العملاء" disabled={!filtered.length} />
                    {can('can_edit_customers') && <Button onClick={openNew} className="gap-2"><Plus className="w-4 h-4" /> عميل جديد</Button>}
                </div>
            </div>

            {/* Filters & Stats - كما هي في كودك الجميل */}
            <div className="flex items-center gap-3 flex-wrap">
                <div className="relative flex-1 min-w-48">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input placeholder="بحث بالاسم أو الهاتف..." value={search} onChange={e => setSearch(e.target.value)} className="pr-10" />
                </div>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger className="w-40"><SelectValue placeholder="كل الأنواع" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">كل الأنواع</SelectItem>
                        <SelectItem value="pharmacy">صيدلية</SelectItem>
                        <SelectItem value="clinic">عيادة</SelectItem>
                        <SelectItem value="distributor">موزع</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'إجمالي المديونيات', value: `${customers.reduce((s, c) => s + (Number(c.balance) || 0), 0).toLocaleString('ar')} ج.م`, color: 'text-rose-400' },
                    { label: 'نشط الآن', value: customers.filter(c => c.status === 'active').length, color: 'text-emerald-400' },
                    { label: 'صيدليات', value: customers.filter(c => c.type === 'pharmacy').length, color: 'text-cyan-400' },
                    { label: 'عيادات', value: customers.filter(c => c.type === 'clinic').length, color: 'text-violet-400' },
                ].map((s, i) => (
                    <div key={i} className="erp-card p-4 border border-border bg-card/50">
                        <p className="text-xs font-semibold text-muted-foreground">{s.label}</p>
                        <p className={`text-xl font-black mt-1 ${s.color}`}>{s.value}</p>
                    </div>
                ))}
            </div>

            {/* Table */}
            <div className="erp-card overflow-x-auto border border-border rounded-xl">
                <table className="w-full text-sm text-right">
                    <thead>
                        <tr className="border-b border-border bg-muted/30 text-muted-foreground">
                            <th className="px-5 py-3">العميل</th>
                            <th className="px-4 py-3">النوع</th>
                            <th className="px-4 py-3">الرصيد</th>
                            <th className="px-4 py-3">الحالة</th>
                            <th className="px-4 py-3" />
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading ? <tr><td colSpan={5} className="py-10 text-center">جاري التحميل من فايرباز...</td></tr>
                            : filtered.map(c => (
                                <tr key={c.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                                    <td className="px-5 py-3 font-bold">{c.name}</td>
                                    <td className="px-4 py-3"><span className={`erp-badge px-2 py-0.5 rounded-full text-xs ${typeColors[c.type]}`}>{typeLabels[c.type]}</span></td>
                                    <td className={`px-4 py-3 font-bold ${(c.balance || 0) > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                                        {(c.balance || 0).toLocaleString('ar')} ج.م
                                    </td>
                                    <td className="px-4 py-3"><span className={`erp-badge px-2 py-0.5 rounded-full text-xs ${statusColors[c.status]}`}>{statusLabels[c.status]}</span></td>
                                    <td className="px-4 py-3 text-left">
                                        <Button variant="ghost" size="icon" onClick={() => openEdit(c)}><Pencil className="w-3.5 h-3.5" /></Button>
                                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setDeleteId(c.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                                    </td>
                                </tr>
                            ))}
                    </tbody>
                </table>
            </div>

            {/* Dialog & AlertDialog - كما هي مع تحديث الـ Mutations */}
            <Dialog open={showDialog} onOpenChange={v => { if (!v) { setShowDialog(false); setEditId(null); setForm(emptyForm); } }}>
                <DialogContent className="max-w-2xl" dir="rtl">
                    <DialogHeader><DialogTitle>{editId ? 'تعديل بيانات العميل' : 'إضافة عميل جديد لـ Nexora'}</DialogTitle></DialogHeader>
                    {/* ... الحقول الخاصة بك كما هي ... */}
                    <div className="flex gap-2 justify-end pt-4">
                        <Button variant="outline" onClick={() => setShowDialog(false)}>إلغاء</Button>
                        <Button
                            onClick={() => saveCustomerMutation.mutate(form)}
                            disabled={saveCustomerMutation.isPending}
                        >
                            {saveCustomerMutation.isPending ? 'جاري الحفظ...' : 'حفظ البيانات'}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
                <AlertDialogContent dir="rtl">
                    <AlertDialogHeader><AlertDialogTitle>هل أنت متأكد؟</AlertDialogTitle><AlertDialogDescription>سيتم حذف بيانات العميل نهائياً من قاعدة بيانات الفايرباز.</AlertDialogDescription></AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>تراجع</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteCustomerMutation.mutate(deleteId)} className="bg-destructive hover:bg-destructive/90">تأكيد الحذف</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
// ... (نفس الـ imports اللي عندك)

export default function Customers() {
    // ... (نفس الـ hooks والـ Mutations)

    // تعديل بسيط في الفورم لضمان وجود الـ Credit Limit
    const [form, setForm] = useState(emptyForm);

    return (
        <div className="space-y-6">
            {/* Header Section */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-2xl font-black text-slate-800">إدارة العملاء</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        لديك {customers.length} عميل، منهم {customers.filter(c => (c.balance || 0) > 0).length} عليهم مديونيات.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <ExportMenu data={exportData} filename="customers" title="قائمة العملاء" disabled={!filtered.length} />
                    {can('can_edit_customers') && (
                        <Button onClick={openNew} className="gap-2 bg-indigo-600 hover:bg-indigo-700 shadow-md rounded-xl">
                            <Plus className="w-4 h-4" /> عميل جديد
                        </Button>
                    )}
                </div>
            </div>

            {/* Stats Cards - تم إضافة "العملاء المتعثرين" */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'إجمالي المديونيات', value: `${customers.reduce((s, c) => s + (Number(c.balance) || 0), 0).toLocaleString('ar')} ج.م`, color: 'text-rose-500' },
                    { label: 'عملاء عليهم ديون', value: customers.filter(c => (c.balance || 0) > 0).length, color: 'text-amber-500' },
                    { label: 'تخطوا حد الائتمان', value: customers.filter(c => (c.balance || 0) > (c.credit_limit || 0) && (c.credit_limit > 0)).length, color: 'text-red-600' },
                    { label: 'نشط الآن', value: customers.filter(c => c.status === 'active').length, color: 'text-emerald-500' },
                ].map((s, i) => (
                    <div key={i} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                        <p className="text-xs font-bold text-slate-500">{s.label}</p>
                        <p className={`text-xl font-black mt-1 ${s.color}`}>{s.value}</p>
                    </div>
                ))}
            </div>

            {/* Table Area */}
            <div className="bg-white overflow-x-auto border border-slate-100 rounded-2xl shadow-sm">
                <table className="w-full text-sm text-right">
                    <thead>
                        <tr className="border-b border-slate-50 bg-slate-50/50 text-slate-500">
                            <th className="px-5 py-4 font-bold">العميل</th>
                            <th className="px-4 py-4 font-bold">النوع / المدينة</th>
                            <th className="px-4 py-4 font-bold">المديونية</th>
                            <th className="px-4 py-4 font-bold">الحالة</th>
                            <th className="px-4 py-4 text-left font-bold">إجراءات</th>
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading ? (
                            <tr><td colSpan={5} className="py-20 text-center text-slate-400">جاري مزامنة البيانات مع Nexora Cloud...</td></tr>
                        ) : filtered.map(c => {
                            const isOverLimit = c.credit_limit > 0 && (c.balance || 0) > c.credit_limit;
                            return (
                                <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                                    <td className="px-5 py-4">
                                        <div className="font-black text-slate-700">{c.name}</div>
                                        <div className="text-xs text-slate-400">{c.phone}</div>
                                    </td>
                                    <td className="px-4 py-4">
                                        <div className={`inline-flex px-2 py-0.5 rounded-lg text-[10px] font-bold mb-1 ${typeColors[c.type]}`}>
                                            {typeLabels[c.type]}
                                        </div>
                                        <div className="text-xs text-slate-500 italic">{c.city || 'بدون مدينة'}</div>
                                    </td>
                                    <td className="px-4 py-4">
                                        <div className={`font-black text-base ${(c.balance || 0) > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                                            {(c.balance || 0).toLocaleString('ar')} <span className="text-[10px]">ج.م</span>
                                        </div>
                                        {isOverLimit && (
                                            <div className="text-[10px] font-bold text-red-600 bg-red-50 px-1 rounded animate-pulse w-fit">
                                                تخطى حد الائتمان ({c.credit_limit})
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-4 py-4">
                                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${statusColors[c.status]}`}>
                                            {statusLabels[c.status]}
                                        </span>
                                    </td>
                                    <td className="px-4 py-4 text-left">
                                        <div className="flex items-center justify-end gap-1">
                                            {/* زر سريع لمشاهدة فواتير العميل (مفيد جداً) */}
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-indigo-600" title="فواتير العميل">
                                                <Search className="w-3.5 h-3.5" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400" onClick={() => openEdit(c)}>
                                                <Pencil className="w-3.5 h-3.5" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-400 hover:text-rose-600" onClick={() => setDeleteId(c.id)}>
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Dialog Form Modification */}
            <Dialog open={showDialog} onOpenChange={setShowDialog}>
                <DialogContent className="max-w-2xl rounded-3xl" dir="rtl">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-black">
                            {editId ? 'تحديث بيانات العميل' : 'إضافة عميل جديد لـ Nexora'}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="grid grid-cols-2 gap-4 py-4">
                        <div className="space-y-2">
                            <label className="text-xs font-bold mr-1">اسم العميل (المنشأة)</label>
                            <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="rounded-xl" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold mr-1">رقم الهاتف</label>
                            <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="rounded-xl text-left" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold mr-1">حد الائتمان (الشكك المسموح به)</label>
                            <Input type="number" value={form.credit_limit} onChange={e => setForm({ ...form, credit_limit: Number(e.target.value) })} className="rounded-xl" placeholder="مثلاً: 5000" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold mr-1">نوع العميل</label>
                            <Select value={form.type} onValueChange={v => setForm({ ...form, type: v })}>
                                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {Object.entries(typeLabels).map(([val, lbl]) => <SelectItem key={val} value={val}>{lbl}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="flex gap-2 justify-end">
                        <Button variant="ghost" onClick={() => setShowDialog(false)} className="rounded-xl italic">إلغاء</Button>
                        <Button
                            className="bg-indigo-600 hover:bg-indigo-700 rounded-xl px-8 font-bold shadow-lg"
                            onClick={() => saveCustomerMutation.mutate(form)}
                            disabled={saveCustomerMutation.isPending || !form.name}
                        >
                            {saveCustomerMutation.isPending ? 'جاري الحفظ...' : 'حفظ البيانات'}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
            {/* ... AlertDialog كما هو ... */}
        </div>
    );
}