import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useReactToPrint } from 'react-to-print';
import { addNewCustomer, getCustomers, updateCustomer, deleteCustomerDoc } from '@/firebase/collections/customers';
import { getSales } from '@/firebase/collections/sales';
import { getVisits } from '@/firebase/collections/visits';
import { useRole } from '@/lib/RoleContext';
import { useAuth } from '@/lib/AuthContext';
import { logActivity } from '@/lib/activityLogger';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, Search, Trash2, Pencil, Eye, Printer, MessageCircle, Store, ShoppingCart, Users, HandCoins, UserX, AlertTriangle, UserCheck } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import ExportMenu from '@/components/shared/ExportMenu';
import PrintTemplate from '@/utils/printing/PrintTemplate';
import { getSaleTotal, getSaleDate, getSaleInvoiceLabel, PAYMENT_STATUS_LABELS, PAYMENT_STATUS_COLORS } from '@/utils/salesHelpers';
import { getWaUrl } from '@/utils/whatsapp';
import ShelfMerchandisingView from '@/components/merchandising/ShelfMerchandisingView';

import { PageHero, StatCard, EmptyState } from '@/components/page';
const typeColors = {
    pharmacy: 'bg-cyan-500/15 text-cyan-400',
    clinic: 'bg-violet-500/15 text-violet-400',
    distributor: 'bg-amber-500/15 text-amber-400',
    other: 'bg-muted text-muted-foreground'
};

const typeLabels = {
    pharmacy: 'صيدلية',
    clinic: 'عيادة',
    distributor: 'موزع',
    other: 'أخرى'
};

const statusColors = {
    active: 'bg-emerald-500/15 text-emerald-400',
    inactive: 'bg-muted text-muted-foreground',
    blocked: 'bg-red-500/15 text-red-400'
};

const statusLabels = {
    active: 'نشط',
    inactive: 'غير نشط',
    blocked: 'محظور'
};

const emptyForm = {
    name: '',
    type: 'pharmacy',
    contact_person: '',
    phone: '',
    phone2: '',
    email: '',
    address: '',
    city: '',
    tax_number: '',
    credit_limit: 0,
    notes: '',
    status: 'active',
    balance: 0,
    total_spent: 0
};

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
    const [historyCustomer, setHistoryCustomer] = useState(null);

    // جلب البيانات
    const { data: customers = [], isLoading } = useQuery({
        queryKey: ['customers'],
        queryFn: getCustomers
    });

    const [customerDetailTab, setCustomerDetailTab] = useState('sales');

    // سجل مبيعات العميل (بيتحمل بس لما نفتح النافذة)
    const { data: allSales = [], isLoading: isLoadingSales } = useQuery({
        queryKey: ['sales'],
        queryFn: getSales,
        enabled: !!historyCustomer
    });

    // سجل زيارات وتدقيق رفوف العميل
    const { data: allVisits = [], isLoading: isLoadingVisits } = useQuery({
        queryKey: ['visits-customer-history'],
        queryFn: getVisits,
        enabled: !!historyCustomer
    });

    const customerSales = historyCustomer
        ? allSales
            .filter(s => s.customer_name === historyCustomer.name)
            .sort((a, b) => (getSaleDate(b)?.getTime() || 0) - (getSaleDate(a)?.getTime() || 0))
        : [];

    const customerVisits = historyCustomer
        ? allVisits.filter(v => v.customer_id === historyCustomer.id || v.customer_name === historyCustomer.name)
        : [];

    const [pendingPrintSale, setPendingPrintSale] = useState(null);
    const printRef = useRef(null);
    const handlePrint = useReactToPrint({
        contentRef: printRef,
        documentTitle: pendingPrintSale ? getSaleInvoiceLabel(pendingPrintSale) : 'invoice',
        onAfterPrint: () => setPendingPrintSale(null),
    });

    const handlePrintSale = (sale) => {
        setPendingPrintSale(sale);
    };

    useEffect(() => {
        if (pendingPrintSale) {
            handlePrint();
        }
    }, [pendingPrintSale, handlePrint]);

    // حفظ وتعديل
    const saveCustomerMutation = useMutation({
        mutationFn: async (data) => {
            let res;
            if (editId) {
                res = await updateCustomer(editId, data);
            } else {
                res = await addNewCustomer(data);
            }
            if (!res.success) {
                throw res.error || new Error('حدث خطأ غير متوقع');
            }
            return res;
        },
        onSuccess: async (_, data) => {
            qc.invalidateQueries({ queryKey: ['customers'] });
            await logActivity({
                user,
                action: editId ? 'update_customer' : 'create_customer',
                entity_type: 'Customer',
                details: `${editId ? 'تعديل' : 'إضافة'} عميل: ${data.name}`
            });
            toast({
                title: editId ? 'تم تحديث العميل بنجاح' : 'تم إضافة العميل بنجاح',
                variant: 'success'
            });
            setShowDialog(false);
            setEditId(null);
            setForm(emptyForm);
        },
        onError: (error) => {
            toast({
                title: 'حدث خطأ',
                description: error.message,
                variant: 'destructive'
            });
        }
    });

    // حذف
    const deleteCustomerMutation = useMutation({
        mutationFn: async (id) => {
            const res = await deleteCustomerDoc(id);
            if (!res.success) throw res.error || new Error('حدث خطأ في الحذف');
            return res;
        },
        onSuccess: async () => {
            qc.invalidateQueries({ queryKey: ['customers'] });
            toast({
                title: 'تم حذف العميل بنجاح',
                variant: 'success'
            });
            setDeleteId(null);
        },
        onError: (error) => {
            toast({
                title: 'خطأ في الحذف',
                description: error.message,
                variant: 'destructive'
            });
        }
    });

    const openEdit = (customer) => {
        setForm(customer);
        setEditId(customer.id);
        setShowDialog(true);
    };

    const openNew = () => {
        setForm(emptyForm);
        setEditId(null);
        setShowDialog(true);
    };

    const closeDialog = () => {
        setShowDialog(false);
        setEditId(null);
        setForm(emptyForm);
    };

    const filtered = customers.filter(c => {
        const matchSearch =
            (c.name || '').toLowerCase().includes(search.toLowerCase()) ||
            (c.phone || '').includes(search) ||
            (c.city || '').toLowerCase().includes(search.toLowerCase());
        const matchType = typeFilter === 'all' || c.type === typeFilter;
        return matchSearch && matchType;
    });

    const exportData = filtered.map(c => ({
        'الاسم': c.name,
        'النوع': typeLabels[c.type],
        'المسؤول': c.contact_person || '',
        'الهاتف': c.phone,
        'المدينة': c.city || '',
        'الرصيد': c.balance || 0,
        'إجمالي المشتريات': c.total_spent || 0,
        'حد الائتمان': c.credit_limit || 0,
        'الحالة': statusLabels[c.status]
    }));

    const stats = [
        {
            label: 'إجمالي المديونيات',
            value: `${customers
                .reduce((sum, c) => sum + (Number(c.balance) || 0), 0)
                .toLocaleString('ar')} ج.م`,
            color: 'text-rose-500'
        },
        {
            label: 'عملاء عليهم ديون',
            value: customers.filter(c => (c.balance || 0) > 0).length,
            color: 'text-amber-500'
        },
        {
            label: 'تخطوا حد الائتمان',
            value: customers.filter(
                c =>
                    c.credit_limit > 0 &&
                    (c.balance || 0) > c.credit_limit
            ).length,
            color: 'text-red-600'
        },
        {
            label: 'نشط الآن',
            value: customers.filter(c => c.status === 'active').length,
            color: 'text-emerald-500'
        }
    ];

    return (
        <div className="space-y-6 pb-8">
            {/* Header */}
            <PageHero
                className="mb-0"
                icon={Users}
                tone="emerald"
                title="العملاء"
                subtitle={`لديك ${customers.length} عميل، منهم ${customers.filter(c => (c.balance || 0) > 0).length} عليهم مديونيات`}
                actions={
                    <>
                        <ExportMenu
                            data={exportData}
                            filename="customers"
                            title="قائمة العملاء"
                            disabled={!filtered.length}
                        />
                        {can('can_edit_customers') && (
                            <Button onClick={openNew} className="gap-2">
                                <Plus className="h-4 w-4" /> عميل جديد
                            </Button>
                        )}
                    </>
                }
            />

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
                <div className="relative flex-1 min-w-48">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                        placeholder="بحث بالاسم أو الهاتف أو المدينة..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="pr-10"
                    />
                </div>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger className="w-40">
                        <SelectValue placeholder="كل الأنواع" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">كل الأنواع</SelectItem>
                        <SelectItem value="pharmacy">صيدلية</SelectItem>
                        <SelectItem value="clinic">عيادة</SelectItem>
                        <SelectItem value="distributor">موزع</SelectItem>
                        <SelectItem value="other">أخرى</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {stats.map((stat, i) => {
                    const look = [
                        { icon: HandCoins, tone: 'rose', valueClassName: 'text-danger' },
                        { icon: UserX, tone: 'amber', valueClassName: 'text-warning' },
                        { icon: AlertTriangle, tone: 'danger', valueClassName: 'text-danger' },
                        { icon: UserCheck, tone: 'emerald', valueClassName: 'text-success' },
                    ][i] || { icon: Users, tone: 'indigo' };
                    return <StatCard key={stat.label} title={stat.label} value={stat.value} {...look} />;
                })}
            </div>

            {/* Table */}
            <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-card">
                <table className="w-full text-sm text-right">
                    <thead>
                        <tr className="border-b border-border bg-muted/50">
                            <th className="px-5 py-3 font-bold">العميل</th>
                            <th className="px-4 py-3 font-bold">النوع</th>
                            <th className="px-4 py-3 font-bold">الرصيد</th>
                            <th className="px-4 py-3 font-bold">الحالة</th>
                            <th className="px-4 py-3" />
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading ? (
                            <tr>
                                <td colSpan={5} className="py-10 text-center">
                                    جاري التحميل...
                                </td>
                            </tr>
                        ) : filtered.length === 0 ? (
                            <tr>
                                <td colSpan={5}><EmptyState text="لا توجد عملاء" /></td>
                            </tr>
                        ) : (
                            filtered.map(c => (
                                <tr key={c.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                                    <td className="px-5 py-3 font-bold">{c.name}</td>
                                    <td className="px-4 py-3">
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${typeColors[c.type]}`}>
                                            {typeLabels[c.type]}
                                        </span>
                                    </td>
                                    <td className={`px-4 py-3 font-bold ${(c.balance || 0) > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                                        {(c.balance || 0).toLocaleString('ar')} ج.م
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${statusColors[c.status]}`}>
                                            {statusLabels[c.status]}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-left">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => setHistoryCustomer(c)}
                                            title="سجل المبيعات"
                                        >
                                            <Eye className="w-3.5 h-3.5" />
                                        </Button>
                                        {can('can_edit_customers') && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => openEdit(c)}
                                            >
                                                <Pencil className="w-3.5 h-3.5" />
                                            </Button>
                                        )}
                                        {can('can_delete_customers') && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="text-destructive"
                                                onClick={() => setDeleteId(c.id)}
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </Button>
                                        )}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Dialog - إضافة وتعديل العميل */}
            <Dialog open={showDialog} onOpenChange={open => {
                if (!open) closeDialog();
            }}>
                <DialogContent
                    className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl"
                    dir="rtl"
                >
                    <DialogHeader>
                        <DialogTitle className="text-xl font-black">
                            {editId ? 'تحديث بيانات العميل' : 'إضافة عميل جديد'}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="grid grid-cols-2 gap-4 py-4">
                        {/* الاسم */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-muted-foreground">
                                اسم العميل (المنشأة) *
                            </label>
                            <Input
                                value={form.name}
                                onChange={e =>
                                    setForm({ ...form, name: e.target.value })
                                }
                                placeholder="مثلاً: صيدلية الرفاعي"
                            />
                        </div>

                        {/* الهاتف */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-muted-foreground">
                                رقم الهاتف الأساسي
                            </label>
                            <Input
                                value={form.phone}
                                onChange={e =>
                                    setForm({ ...form, phone: e.target.value })
                                }
                                placeholder="01012345678"
                                className="text-left"
                            />
                        </div>

                        {/* الهاتف الثاني */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-muted-foreground">
                                رقم الهاتف الثاني
                            </label>
                            <Input
                                value={form.phone2}
                                onChange={e =>
                                    setForm({ ...form, phone2: e.target.value })
                                }
                                placeholder="01098765432"
                                className="text-left"
                            />
                        </div>

                        {/* البريد الإلكتروني */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-muted-foreground">
                                البريد الإلكتروني
                            </label>
                            <Input
                                type="email"
                                value={form.email}
                                onChange={e =>
                                    setForm({ ...form, email: e.target.value })
                                }
                                placeholder="info@example.com"
                                className="text-left"
                            />
                        </div>

                        {/* نوع العميل */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-muted-foreground">
                                نوع العميل
                            </label>
                            <Select
                                value={form.type}
                                onValueChange={v =>
                                    setForm({ ...form, type: v })
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {Object.entries(typeLabels).map(([val, lbl]) => (
                                        <SelectItem key={val} value={val}>
                                            {lbl}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* حد الائتمان */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-muted-foreground">
                                حد الائتمان
                            </label>
                            <Input
                                type="number"
                                value={form.credit_limit}
                                onChange={e =>
                                    setForm({
                                        ...form,
                                        credit_limit: Number(e.target.value) || 0
                                    })
                                }
                                placeholder="مثلاً: 5000"
                            />
                        </div>

                        {/* المدينة */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-muted-foreground">
                                المدينة
                            </label>
                            <Input
                                value={form.city}
                                onChange={e =>
                                    setForm({ ...form, city: e.target.value })
                                }
                                placeholder="مثلاً: القاهرة"
                            />
                        </div>

                        {/* العنوان */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-muted-foreground">
                                العنوان
                            </label>
                            <Input
                                value={form.address}
                                onChange={e =>
                                    setForm({ ...form, address: e.target.value })
                                }
                                placeholder="الشارع والمنطقة"
                            />
                        </div>

                        {/* اسم المسؤول */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-muted-foreground">
                                اسم المسؤول
                            </label>
                            <Input
                                value={form.contact_person}
                                onChange={e =>
                                    setForm({
                                        ...form,
                                        contact_person: e.target.value
                                    })
                                }
                                placeholder="مثلاً: أحمد علي"
                            />
                        </div>

                        {/* الرقم الضريبي */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-muted-foreground">
                                الرقم الضريبي
                            </label>
                            <Input
                                value={form.tax_number}
                                onChange={e =>
                                    setForm({ ...form, tax_number: e.target.value })
                                }
                                placeholder="الرقم الضريبي"
                                className="text-left"
                            />
                        </div>

                        {/* الحالة */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-muted-foreground">
                                الحالة
                            </label>
                            <Select
                                value={form.status}
                                onValueChange={v =>
                                    setForm({ ...form, status: v })
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {Object.entries(statusLabels).map(([val, lbl]) => (
                                        <SelectItem key={val} value={val}>
                                            {lbl}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* الملاحظات */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-muted-foreground">
                            الملاحظات
                        </label>
                        <textarea
                            value={form.notes}
                            onChange={e =>
                                setForm({ ...form, notes: e.target.value })
                            }
                            placeholder="ملاحظات إضافية عن العميل..."
                            rows="3"
                            className="w-full rounded-md border border-input px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                    </div>

                    {/* Buttons */}
                    <div className="flex gap-2 justify-end pt-4 border-t">
                        <Button
                            variant="ghost"
                            onClick={closeDialog}
                        >
                            إلغاء
                        </Button>
                        <Button
                            onClick={() => saveCustomerMutation.mutate(form)}
                            disabled={saveCustomerMutation.isPending || !form.name}
                        >
                            {saveCustomerMutation.isPending
                                ? 'جاري الحفظ...'
                                : editId
                                    ? 'تحديث البيانات'
                                    : 'حفظ البيانات'}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* نافذة تفاصيل وسجل العميل (المبيعات وتدقيق الرفوف) */}
            <Dialog open={!!historyCustomer} onOpenChange={(open) => !open && setHistoryCustomer(null)}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl" dir="rtl">
                    <DialogHeader className="border-b border-border/60 pb-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                                <DialogTitle className="text-xl font-black text-foreground">
                                    ملف العميل: {historyCustomer?.name}
                                </DialogTitle>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    {historyCustomer?.city} — {historyCustomer?.address || 'العنوان غير مسجل'}
                                </p>
                            </div>

                            {/* WhatsApp Button */}
                            {historyCustomer?.phone && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        const url = getWaUrl(historyCustomer.phone, `مرحباً ${historyCustomer.name}، بخصوص حسابكم لدى شركة Nexora.`);
                                        window.open(url, '_blank', 'noopener,noreferrer');
                                    }}
                                    className="gap-1.5 text-xs font-bold text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/10 rounded-xl"
                                >
                                    <MessageCircle className="h-4 w-4" />
                                    محادثة واتساب
                                </Button>
                            )}
                        </div>

                        {/* Tab Switcher */}
                        <div className="flex gap-2 mt-4 border-b border-border/40 pb-1">
                            <button
                                onClick={() => setCustomerDetailTab('sales')}
                                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
                                    customerDetailTab === 'sales'
                                        ? 'bg-primary text-primary-foreground shadow-sm'
                                        : 'text-muted-foreground hover:text-foreground'
                                }`}
                            >
                                <ShoppingCart className="h-3.5 w-3.5" />
                                سجل الفواتير والمبيعات ({customerSales.length})
                            </button>

                            <button
                                onClick={() => setCustomerDetailTab('merchandising')}
                                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
                                    customerDetailTab === 'merchandising'
                                        ? 'bg-primary text-primary-foreground shadow-sm'
                                        : 'text-muted-foreground hover:text-foreground'
                                }`}
                            >
                                <Store className="h-3.5 w-3.5" />
                                تدقيق الرفوف والمنافسين
                            </button>
                        </div>
                    </DialogHeader>

                    {customerDetailTab === 'sales' ? (
                        <div className="max-h-[60vh] overflow-y-auto">
                            {isLoadingSales ? (
                                <div className="py-10 text-center text-muted-foreground">جاري تحميل السجل...</div>
                            ) : customerSales.length === 0 ? (
                                <EmptyState text="لا توجد فواتير مسجلة لهذا العميل" />
                            ) : (
                                <table className="w-full text-sm text-right">
                                    <thead>
                                        <tr className="border-b border-border bg-muted/50">
                                            <th className="px-3 py-2 font-bold">رقم الفاتورة</th>
                                            <th className="px-3 py-2 font-bold">التاريخ</th>
                                            <th className="px-3 py-2 font-bold">الإجمالي</th>
                                            <th className="px-3 py-2 font-bold">حالة السداد</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {customerSales.map(sale => {
                                            const date = getSaleDate(sale);
                                            return (
                                                <tr key={sale.id} className="border-b border-border/50">
                                                    <td className="px-3 py-2 font-bold flex items-center gap-2">
                                                        {getSaleInvoiceLabel(sale)}
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => handlePrintSale(sale)}
                                                            title="طباعة الفاتورة"
                                                        >
                                                            <Printer className="w-3 h-3" />
                                                        </Button>
                                                    </td>
                                                    <td className="px-3 py-2 text-muted-foreground">
                                                        {date ? date.toLocaleDateString('ar-EG') : '—'}
                                                    </td>
                                                    <td className="px-3 py-2 font-bold">
                                                        {getSaleTotal(sale).toLocaleString('ar')} ج.م
                                                    </td>
                                                    <td className="px-3 py-2">
                                                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${PAYMENT_STATUS_COLORS[sale.payment_status] || 'bg-muted text-muted-foreground'}`}>
                                                            {PAYMENT_STATUS_LABELS[sale.payment_status] || sale.payment_status || '—'}
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    ) : (
                        <div className="max-h-[65vh] overflow-y-auto p-1">
                            {isLoadingVisits ? (
                                <div className="py-10 text-center text-muted-foreground">جاري تحميل بيانات الرفوف والزيارات...</div>
                            ) : (
                                <ShelfMerchandisingView
                                    visits={customerVisits}
                                    customerName={historyCustomer?.name}
                                />
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {pendingPrintSale && (
                <div className="absolute left-[-10000px] top-0 h-0 w-0 overflow-hidden">
                    <PrintTemplate ref={printRef} sale={pendingPrintSale} />
                </div>
            )}

            {/* Alert Dialog - تأكيد الحذف */}
            <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
                <AlertDialogContent className="rounded-2xl" dir="rtl">
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            هل أنت متأكد من حذف هذا العميل؟
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            سيتم حذف بيانات العميل نهائياً من قاعدة البيانات.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>تراجع</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => deleteCustomerMutation.mutate(deleteId)}
                            disabled={deleteCustomerMutation.isPending}
                            className="bg-red-600 hover:bg-red-700"
                        >
                            {deleteCustomerMutation.isPending
                                ? 'جاري الحذف...'
                                : 'تأكيد الحذف'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}