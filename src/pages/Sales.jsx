import { useMemo, useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useReactToPrint } from 'react-to-print';
import { getSales, deleteSale } from '@/firebase/collections/sales';
import { getProducts } from '@/firebase/collections/products';
import { useRole } from '@/lib/RoleContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Search, Trash2, Eye, Plus, ChevronRight, ChevronLeft, FileText, Printer, Truck, ShoppingCart, TrendingUp, CheckCircle2, Clock } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import ExportMenu from '@/components/shared/ExportMenu';
import CreateSaleDialog from '@/components/sales/CreateSaleDialog';
import PrintTemplate from '@/utils/printing/PrintTemplate';
import {
    PAYMENT_STATUS_LABELS, PAYMENT_STATUS_COLORS,
    getSaleTotal, getSalePaid, getSaleRemaining, getSaleDate, getSaleInvoiceLabel,
} from '@/utils/salesHelpers';

import { PageHero, StatCard, EmptyState } from '@/components/page';
const PAGE_SIZE = 15;

export default function Sales() {
    const { can } = useRole();
    const { toast } = useToast();
    const qc = useQueryClient();
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [typeFilter, setTypeFilter] = useState('all'); // 'all' | 'field' | 'central'
    const [showCreateDialog, setShowCreateDialog] = useState(false);
    const [deleteId, setDeleteId] = useState(null);
    const [viewSale, setViewSale] = useState(null);
    const [pendingPrintSale, setPendingPrintSale] = useState(null);
    const [page, setPage] = useState(1);

    const { data: sales = [], isLoading } = useQuery({
        queryKey: ['sales'],
        queryFn: getSales
    });

    const { data: products = [] } = useQuery({
        queryKey: ['products'],
        queryFn: getProducts
    });

    const deleteSaleMutation = useMutation({
        mutationFn: (id) => deleteSale(id),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['sales'] });
            qc.invalidateQueries({ queryKey: ['dashboard-sales'] });
            toast({ title: 'تم حذف الفاتورة بنجاح' });
            setDeleteId(null);
        },
    });

    const sortedSales = useMemo(
        () => [...sales].sort((a, b) => (getSaleDate(b)?.getTime() || 0) - (getSaleDate(a)?.getTime() || 0)),
        [sales]
    );

    const filtered = useMemo(() => sortedSales.filter((s) => {
        const q = search.trim().toLowerCase();
        const matchSearch = !q ||
            (s.customer_name || '').toLowerCase().includes(q) ||
            getSaleInvoiceLabel(s).toLowerCase().includes(q) ||
            (s.employee_name || s.employeeName || '').toLowerCase().includes(q);
        const matchStatus = statusFilter === 'all' || s.payment_status === statusFilter;
        
        const isField = Boolean(s.is_field_invoice || s.source === 'field' || s.employee_id || s.employeeId);
        const matchType =
            typeFilter === 'all' ||
            (typeFilter === 'field' ? isField : !isField);

        return matchSearch && matchStatus && matchType;
    }), [sortedSales, search, statusFilter, typeFilter]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const currentPage = Math.min(page, totalPages);
    const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

    const resetPage = (fn) => (...args) => { fn(...args); setPage(1); };

    const totalSales = sales.reduce((sum, s) => sum + getSaleTotal(s), 0);
    const totalPaid = sales.reduce((sum, s) => sum + getSalePaid(s), 0);
    const totalUnpaid = sales.reduce((sum, s) => sum + getSaleRemaining(s), 0);

    const exportData = filtered.map((s) => ({
        'رقم الفاتورة': getSaleInvoiceLabel(s),
        'العميل': s.customer_name || 'عميل نقدي',
        'إجمالي الفاتورة': getSaleTotal(s),
        'المدفوع': getSalePaid(s),
        'المتبقي': getSaleRemaining(s),
        'حالة الدفع': PAYMENT_STATUS_LABELS[s.payment_status] || s.payment_status || '',
        'تاريخ الفاتورة': getSaleDate(s) ? getSaleDate(s).toLocaleDateString('ar-EG') : '',
    }));

    const printRef = useRef(null);
    const handlePrint = useReactToPrint({
        contentRef: printRef,
        documentTitle: pendingPrintSale ? getSaleInvoiceLabel(pendingPrintSale) : 'invoice',
        onAfterPrint: () => setPendingPrintSale(null),
    });

    useEffect(() => {
        if (pendingPrintSale) {
            handlePrint();
        }
    }, [pendingPrintSale, handlePrint]);

    return (
        <div className="space-y-6 pb-8" dir="rtl">
            <PageHero
                className="mb-0"
                icon={ShoppingCart}
                tone="emerald"
                title="المبيعات"
                subtitle={`${sales.length} فاتورة | إجمالي المبيعات: ${totalSales.toLocaleString('en-US')} جنيه`}
                actions={
                    <>
                        <ExportMenu data={exportData} filename="sales" title="تقرير المبيعات" disabled={!filtered.length} />
                        {can('can_create_sales') && (
                            <Button onClick={() => setShowCreateDialog(true)} className="gap-2">
                                <Plus className="h-4 w-4" /> فاتورة جديدة
                            </Button>
                        )}
                    </>
                }
            />

            {/* إحصائيات */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <StatCard title="إجمالي المبيعات" value={`${totalSales.toLocaleString('en-US')} ج.م`} valueClassName="text-success" icon={TrendingUp} tone="emerald" />
                <StatCard title="المدفوع" value={`${totalPaid.toLocaleString('en-US')} ج.م`} valueClassName="text-primary" icon={CheckCircle2} tone="indigo" />
                <StatCard title="المتبقي (آجل)" value={`${totalUnpaid.toLocaleString('en-US')} ج.م`} valueClassName="text-danger" icon={Clock} tone="rose" />
            </div>

            {/* فلاتر البحث */}
            <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-border bg-card p-4 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                    <Input
                        placeholder="البحث في الفواتير..."
                        value={search}
                        onChange={(e) => resetPage(setSearch)(e.target.value)}
                        className="pr-10"
                    />
                </div>
                <Select value={statusFilter} onValueChange={resetPage(setStatusFilter)}>
                    <SelectTrigger className="w-[150px]">
                        <SelectValue placeholder="حالة الدفع" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">كل حالات الدفع</SelectItem>
                        <SelectItem value="paid">مدفوعة</SelectItem>
                        <SelectItem value="unpaid">غير مدفوعة</SelectItem>
                        <SelectItem value="partial">مدفوعة جزئياً</SelectItem>
                    </SelectContent>
                </Select>

                <Select value={typeFilter} onValueChange={resetPage(setTypeFilter)}>
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="نوع الفاتورة" />
                    </SelectTrigger>
                    <SelectContent dir="rtl">
                        <SelectItem value="all">كافة مصادر الفواتير</SelectItem>
                        <SelectItem value="field">فواتير المناديب (ميدانية)</SelectItem>
                        <SelectItem value="central">فواتير المركز والـ POS</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* الجدول */}
            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="text-right">رقم الفاتورة</TableHead>
                            <TableHead className="text-right">العميل</TableHead>
                            <TableHead className="text-right">إجمالي الفاتورة</TableHead>
                            <TableHead className="text-right">المدفوع</TableHead>
                            <TableHead className="text-right">المتبقي</TableHead>
                            <TableHead className="text-right">حالة الدفع</TableHead>
                            <TableHead className="text-right">التاريخ</TableHead>
                            <TableHead className="text-right">الإجراءات</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow><TableCell colSpan={8} className="text-center py-8">جاري التحميل...</TableCell></TableRow>
                        ) : paginated.length === 0 ? (
                            <TableRow><TableCell colSpan={8}><EmptyState text="لا توجد فواتير" /></TableCell></TableRow>
                        ) : (
                            paginated.map((sale) => {
                                const isField = Boolean(sale.is_field_invoice || sale.source === 'field' || sale.employee_id || sale.employeeId);
                                const repName = sale.employee_name || sale.employeeName;

                                return (
                                    <TableRow key={sale.id}>
                                        <TableCell className="font-medium">
                                            <div className="flex flex-col gap-1 items-start">
                                                <span className="font-mono font-bold text-foreground">{getSaleInvoiceLabel(sale)}</span>
                                                {isField ? (
                                                    <Badge className="bg-indigo-500/10 text-indigo-600 border border-indigo-500/20 text-[10px] gap-1 py-0 px-1.5 font-bold">
                                                        <Truck className="h-3 w-3" />
                                                        فاتورة ميدانية
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="outline" className="text-[10px] py-0 px-1.5 text-muted-foreground border-border">
                                                        المركز / POS
                                                    </Badge>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div>
                                                <p className="font-bold text-foreground">{sale.customer_name || 'عميل نقدي'}</p>
                                                {isField && repName && (
                                                    <p className="text-[11px] text-muted-foreground font-medium">
                                                        المندوب: {repName} (مخزن السيارة)
                                                    </p>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>{getSaleTotal(sale).toLocaleString()}</TableCell>
                                        <TableCell>{getSalePaid(sale).toLocaleString()}</TableCell>
                                        <TableCell className={getSaleRemaining(sale) > 0 ? 'text-rose-500 font-bold' : ''}>
                                            {getSaleRemaining(sale).toLocaleString()}
                                        </TableCell>
                                        <TableCell>
                                            <span className={`px-2 py-1 rounded-full text-xs ${PAYMENT_STATUS_COLORS[sale.payment_status] || 'bg-muted text-muted-foreground'}`}>
                                                {PAYMENT_STATUS_LABELS[sale.payment_status] || 'غير محدد'}
                                            </span>
                                        </TableCell>
                                        <TableCell>{getSaleDate(sale)?.toLocaleDateString('ar-EG') || '—'}</TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <Button variant="ghost" size="sm" onClick={() => setViewSale(sale)} title="عرض الفاتورة">
                                                    <Eye className="w-4 h-4" />
                                                </Button>
                                                <Button variant="ghost" size="sm" onClick={() => setPendingPrintSale(sale)} title="طباعة الفاتورة">
                                                    <Printer className="w-4 h-4" />
                                                </Button>
                                                {can('can_delete_sales') && (
                                                    <Button variant="ghost" size="sm" onClick={() => setDeleteId(sale.id)} className="text-red-600 hover:text-red-700">
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        )}
                    </TableBody>
                </Table>

                {/* Pagination */}
                {filtered.length > PAGE_SIZE && (
                    <div className="flex items-center justify-between border-t border-border px-6 py-4">
                        <p className="text-xs font-bold text-muted-foreground">
                            صفحة {currentPage} من {totalPages} — {filtered.length} فاتورة
                        </p>
                        <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => setPage((p) => p - 1)}>
                                <ChevronRight className="w-4 h-4" />
                            </Button>
                            <Button variant="outline" size="sm" disabled={currentPage >= totalPages} onClick={() => setPage((p) => p + 1)}>
                                <ChevronLeft className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            <CreateSaleDialog open={showCreateDialog} onOpenChange={setShowCreateDialog} products={products} />

            {/* Dialog - عرض تفاصيل الفاتورة */}
            <Dialog open={!!viewSale} onOpenChange={(v) => !v && setViewSale(null)}>
                <DialogContent className="max-w-lg rounded-2xl" dir="rtl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-xl font-black">
                            <FileText className="w-5 h-5 text-primary" />
                            {viewSale && getSaleInvoiceLabel(viewSale)}
                        </DialogTitle>
                    </DialogHeader>
                    {viewSale && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-3 text-sm">
                                <div className="rounded-xl bg-muted/50 p-3">
                                    <p className="text-xs text-muted-foreground font-bold">العميل</p>
                                    <p className="font-bold text-foreground">{viewSale.customer_name || 'عميل نقدي'}</p>
                                </div>
                                <div className="rounded-xl bg-muted/50 p-3">
                                    <p className="text-xs text-muted-foreground font-bold">التاريخ</p>
                                    <p className="font-bold text-foreground">{getSaleDate(viewSale)?.toLocaleString('ar-EG') || '—'}</p>
                                </div>
                            </div>
                            <div className="flex justify-end">
                                <Button
                                    variant="outline"
                                    className="gap-2"
                                    onClick={handlePrint}
                                >
                                    <Printer className="w-4 h-4" /> طباعة الفاتورة
                                </Button>
                            </div>
                            <div className="rounded-2xl border border-border overflow-hidden">
                                <table className="w-full text-sm text-right">
                                    <thead className="bg-muted/40">
                                        <tr className="text-xs font-black text-muted-foreground">
                                            <th className="px-4 py-2">الصنف</th>
                                            <th className="px-4 py-2">الكمية</th>
                                            <th className="px-4 py-2">السعر</th>
                                            <th className="px-4 py-2">الإجمالي</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                        {(viewSale.items || []).map((it, i) => (
                                            <tr key={i}>
                                                <td className="px-4 py-2 font-bold">{it.product_name}</td>
                                                <td className="px-4 py-2">{it.quantity}</td>
                                                <td className="px-4 py-2">{it.price}</td>
                                                <td className="px-4 py-2 font-bold">{it.total}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div className="space-y-1.5 rounded-2xl bg-muted/40 p-4">
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">الإجمالي</span>
                                    <span className="font-bold">{getSaleTotal(viewSale).toLocaleString()} ج.م</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">المدفوع</span>
                                    <span className="font-bold text-emerald-500">{getSalePaid(viewSale).toLocaleString()} ج.م</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">المتبقي</span>
                                    <span className="font-bold text-rose-500">{getSaleRemaining(viewSale).toLocaleString()} ج.م</span>
                                </div>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {
                (pendingPrintSale || viewSale) && (
                    <div className="absolute left-[-10000px] top-0 h-0 w-0 overflow-hidden">
                        <PrintTemplate ref={printRef} sale={pendingPrintSale || viewSale} />
                    </div>
                )
            }


            <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
                <AlertDialogContent className="rounded-2xl" dir="rtl">
                    <AlertDialogHeader>
                        <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
                        <AlertDialogDescription>هل أنت متأكد من حذف هذه الفاتورة؟</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="gap-2">
                        <AlertDialogCancel>إلغاء</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteSaleMutation.mutate(deleteId)} className="bg-red-600 hover:bg-red-700">حذف</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div >
    );
}