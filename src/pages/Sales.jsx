import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSales, deleteSale } from '@/firebase/collections/sales';
import { getProducts } from '@/firebase/collections/products';
import { useRole } from '@/lib/RoleContext';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Search, Trash2, Eye, Plus } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import ExportMenu from '@/components/shared/ExportMenu';
import CreateSaleDialog from '@/components/sales/CreateSaleDialog';

const paymentStatusColors = {
    paid: 'bg-emerald-500/15 text-emerald-400',
    unpaid: 'bg-red-500/15 text-red-400',
    partial: 'bg-amber-500/15 text-amber-400'
};

const paymentStatusLabels = {
    paid: 'مدفوع',
    unpaid: 'غير مدفوع',
    partial: 'جزئي'
};

export default function Sales() {
    const { can } = useRole();
    const { user } = useAuth();
    const { toast } = useToast();
    const qc = useQueryClient();
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [showCreateDialog, setShowCreateDialog] = useState(false);
    const [deleteId, setDeleteId] = useState(null);

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
            qc.invalidateQueries(['sales']);
            toast({ title: 'تم حذف الفاتورة بنجاح' });
            setDeleteId(null);
        },
    });

    const filtered = sales.filter(s => {
        const matchSearch = (s.customer_name || '').toLowerCase().includes(search.toLowerCase()) ||
            (s.invoice_number || '').includes(search);
        const matchStatus = statusFilter === 'all' || s.payment_status === statusFilter;
        return matchSearch && matchStatus;
    });

    const totalSales = sales.reduce((sum, s) => sum + (Number(s.total_amount) || 0), 0);
    const totalPaid = sales.reduce((sum, s) => sum + (Number(s.paid_amount) || 0), 0);
    const totalUnpaid = totalSales - totalPaid;

    const exportData = filtered.map(s => ({
        'رقم الفاتورة': s.invoice_number || '',
        'العميل': s.customer_name || '',
        'إجمالي الفاتورة': s.total_amount || 0,
        'المدفوع': s.paid_amount || 0,
        'المتبقي': (s.total_amount || 0) - (s.paid_amount || 0),
        'حالة الدفع': paymentStatusLabels[s.payment_status] || '',
        'تاريخ الفاتورة': s.created_at?.toDate?.()?.toLocaleDateString('ar-EG') || '',
    }));

    return (
        <div className="space-y-6" dir="rtl">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-2xl font-black">المبيعات</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        {sales.length} فاتورة | إجمالي المبيعات: {totalSales.toLocaleString()} جنيه
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <ExportMenu data={exportData} filename="sales" title="تقرير المبيعات" disabled={!filtered.length} />
                    {can('can_create_sales') && (
                        <Button onClick={() => setShowCreateDialog(true)} className="gap-2">
                            <Plus className="w-4 h-4" /> فاتورة جديدة
                        </Button>
                    )}
                </div>
            </div>

            {/* إحصائيات */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-card p-4 rounded-lg border">
                    <div className="text-sm text-muted-foreground">إجمالي المبيعات</div>
                    <div className="text-2xl font-bold text-emerald-600">{totalSales.toLocaleString()}</div>
                </div>
                <div className="bg-card p-4 rounded-lg border">
                    <div className="text-sm text-muted-foreground">المدفوع</div>
                    <div className="text-2xl font-bold text-blue-600">{totalPaid.toLocaleString()}</div>
                </div>
                <div className="bg-card p-4 rounded-lg border">
                    <div className="text-sm text-muted-foreground">المتبقي</div>
                    <div className="text-2xl font-bold text-red-600">{totalUnpaid.toLocaleString()}</div>
                </div>
            </div>

            {/* فلاتر البحث */}
            <div className="flex items-center gap-4 flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                    <Input
                        placeholder="البحث في الفواتير..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pr-10"
                    />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[150px]">
                        <SelectValue placeholder="حالة الدفع" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">الكل</SelectItem>
                        <SelectItem value="paid">مدفوع</SelectItem>
                        <SelectItem value="unpaid">غير مدفوع</SelectItem>
                        <SelectItem value="partial">جزئي</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* الجدول */}
            <div className="border rounded-lg">
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
                        ) : filtered.length === 0 ? (
                            <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">لا توجد فواتير</TableCell></TableRow>
                        ) : (
                            filtered.map((sale) => (
                                <TableRow key={sale.id}>
                                    <TableCell className="font-medium">{sale.invoice_number || `INV-${sale.id.slice(-6)}`}</TableCell>
                                    <TableCell>{sale.customer_name || 'عميل نقدي'}</TableCell>
                                    <TableCell>{(sale.total_amount || 0).toLocaleString()}</TableCell>
                                    <TableCell>{(sale.paid_amount || 0).toLocaleString()}</TableCell>
                                    <TableCell>{((sale.total_amount || 0) - (sale.paid_amount || 0)).toLocaleString()}</TableCell>
                                    <TableCell>
                                        <span className={`px-2 py-1 rounded-full text-xs ${paymentStatusColors[sale.payment_status] || 'bg-muted'}`}>
                                            {paymentStatusLabels[sale.payment_status] || 'غير محدد'}
                                        </span>
                                    </TableCell>
                                    <TableCell>{sale.created_at?.toDate?.()?.toLocaleDateString('ar-EG') || ''}</TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <Button variant="ghost" size="sm"><Eye className="w-4 h-4" /></Button>
                                            {can('can_delete_sales') && (
                                                <Button variant="ghost" size="sm" onClick={() => setDeleteId(sale.id)} className="text-red-600 hover:text-red-700">
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            <CreateSaleDialog open={showCreateDialog} onOpenChange={setShowCreateDialog} products={products} />

            <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
                <AlertDialogContent dir="rtl">
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
        </div>
    );
}