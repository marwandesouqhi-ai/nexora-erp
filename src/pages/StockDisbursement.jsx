import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getProducts } from '@/firebase/collections/products';
import { getEmployees } from '@/firebase/collections/employees';
import { recordInventoryAdjustment } from '@/firebase/collections/inventory_adjustments';
import { getInventoryMovements } from '@/firebase/collections/inventory_movements';
import { disburseToVan, getAllVanInventories } from '@/firebase/collections/van_inventory';
import { useRole } from '@/lib/RoleContext';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, PackageMinus, Truck, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

import { PageHero, EmptyState } from '@/components/page';
const REASONS = ['انتهاء صلاحية', 'تلف', 'كسر', 'عجز جرد', 'استخدام داخلي'];

export default function StockDisbursement() {
    const { can } = useRole();
    const { user } = useAuth();
    const { toast } = useToast();
    const qc = useQueryClient();

    const [showDialog, setShowDialog] = useState(false);
    const [disbursementType, setDisbursementType] = useState('van'); // 'van' | 'waste'
    const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
    const [productId, setProductId] = useState('');
    const [qty, setQty] = useState('');
    const [reason, setReason] = useState(REASONS[0]);
    const [note, setNote] = useState('');

    const { data: products = [] } = useQuery({ queryKey: ['products-disbursement'], queryFn: getProducts });
    const { data: employees = [] } = useQuery({ queryKey: ['employees-disbursement'], queryFn: getEmployees });
    const { data: movements = [], isLoading: movementsLoading } = useQuery({ queryKey: ['inventory-movements'], queryFn: getInventoryMovements });
    const { data: vanStocks = [], isLoading: vanLoading } = useQuery({ queryKey: ['van-inventories'], queryFn: getAllVanInventories });

    const salesReps = employees.filter((e) => !e.role || e.role === 'sales_rep' || e.role === 'مندوب');

    // Mutation for Waste/Adjustment
    const wasteMutation = useMutation({
        mutationFn: (payload) => recordInventoryAdjustment(payload),
        onSuccess: () => {
            qc.invalidateQueries(['inventory-movements']);
            qc.invalidateQueries(['products-disbursement']);
            qc.invalidateQueries(['products']);
            qc.invalidateQueries(['products-stock-alerts']);
            toast({ title: 'تم تسجيل عملية الصرف/الهالك وتحديث المخزون' });
            resetForm();
        },
        onError: (err) => toast({ title: 'خطأ', description: err.message, variant: 'destructive' }),
    });

    // Mutation for Van Stock Disbursement
    const vanMutation = useMutation({
        mutationFn: (payload) => disburseToVan(payload),
        onSuccess: (res) => {
            if (res.success) {
                qc.invalidateQueries(['inventory-movements']);
                qc.invalidateQueries(['products-disbursement']);
                qc.invalidateQueries(['products']);
                qc.invalidateQueries(['van-inventories']);
                toast({ title: 'تم صرف البضاعة لسيارة المندوب بنجاح ✓', description: 'تظهر فوراً في تطبيق الهاتف الخاص بالمندوب' });
                resetForm();
            } else {
                toast({ title: 'فشل الصرف', description: res.error?.message, variant: 'destructive' });
            }
        },
        onError: (err) => toast({ title: 'خطأ', description: err.message, variant: 'destructive' }),
    });

    const resetForm = () => {
        setShowDialog(false);
        setProductId('');
        setQty('');
        setNote('');
        setSelectedEmployeeId('');
    };

    const handleSubmit = () => {
        const product = products.find((p) => p.id === productId);
        if (!product || !qty || Number(qty) <= 0) {
            toast({ title: 'تنبيه', description: 'يرجى اختيار الصنف وتحديد كمية صحيحة', variant: 'destructive' });
            return;
        }

        if (disbursementType === 'van') {
            const emp = employees.find((e) => e.id === selectedEmployeeId);
            if (!emp) {
                toast({ title: 'تنبيه', description: 'يرجى اختيار المندوب المستلم للعهدة', variant: 'destructive' });
                return;
            }
            vanMutation.mutate({
                employeeId: emp.id,
                employeeName: emp.name,
                productId: product.id,
                productName: product.product_name || product.name,
                quantity: Number(qty),
                unitPrice: Number(product.price || 0),
                notes: note,
                userId: user?.uid,
            });
        } else {
            wasteMutation.mutate({
                productId: product.id,
                productName: product.product_name || product.name,
                qty: Number(qty),
                reason: note ? `${reason} - ${note}` : reason,
                costPrice: Number(product.purchase_price || 0),
                userId: user?.uid,
            });
        }
    };

    if (!can('can_edit_inventory')) {
        return <div className="p-8 text-center text-muted-foreground" dir="rtl">غير مسموح لك بالوصول إلى هذه الصفحة.</div>;
    }

    const isSubmitting = wasteMutation.isPending || vanMutation.isPending;

    return (
        <div className="space-y-6" dir="rtl">
            <PageHero
                className="mb-0"
                icon={PackageMinus}
                tone="cyan"
                title="صرف المخزون وعهدة سيارات المندوبين"
                subtitle="صرف بضاعة لسيارات مندوبي المبيعات (Van Sales) أو تسجيل الهالك والتسويات مع المزامنة اللحظية."
                actions={
                    <Button className="gap-2" onClick={() => setShowDialog(true)}>
                        <Plus className="h-4 w-4" /> صرف جديد (سيارة / هالك)
                    </Button>
                }
            />

            {/* Van Stocks Active Overview */}
            <Card className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
                <CardHeader className="border-b border-border/50 bg-muted/20">
                    <CardTitle className="text-base font-black text-foreground flex items-center justify-between">
                        <span className="flex items-center gap-2">
                            <Truck className="h-5 w-5 text-primary" />
                            بضاعة سيارات المندوبين الحالية بالميدان (Van Stock Inventory)
                        </span>
                        <Badge variant="outline" className="text-xs font-bold font-mono">
                            {vanStocks.length} صنف موزّع
                        </Badge>
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    {vanLoading ? (
                        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
                    ) : vanStocks.length === 0 ? (
                        <EmptyState text="لا توجد بضاعة في عهدة سيارات المندوبين حالياً. يمكنك صرف بضاعة من الزر أعلاه." />
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow className="border-border">
                                    <TableHead className="text-right font-black">المندوب</TableHead>
                                    <TableHead className="text-right font-black">الصنف</TableHead>
                                    <TableHead className="text-right font-black">الكمية المتاحة بالسيارة</TableHead>
                                    <TableHead className="text-right font-black">سعر الوحدة</TableHead>
                                    <TableHead className="text-right font-black">إجمالي القيمة</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {vanStocks.map((v) => (
                                    <TableRow key={v.id} className="border-border hover:bg-muted/30">
                                        <TableCell className="font-bold text-foreground">{v.employee_name}</TableCell>
                                        <TableCell className="font-medium text-foreground">{v.product_name}</TableCell>
                                        <TableCell>
                                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-black text-emerald-600 dark:text-emerald-400 font-mono">
                                                {v.quantity} قطعة
                                            </span>
                                        </TableCell>
                                        <TableCell className="font-mono text-xs">{Number(v.unit_price || 0).toLocaleString('ar')} ج.م</TableCell>
                                        <TableCell className="font-mono text-xs font-bold text-primary">
                                            {(Number(v.quantity || 0) * Number(v.unit_price || 0)).toLocaleString('ar')} ج.م
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* Inventory Movements Log */}
            <Card className="rounded-2xl border border-border bg-card shadow-sm">
                <CardHeader><CardTitle className="text-base font-black text-foreground">سجل حركة المخزون المركزي</CardTitle></CardHeader>
                <CardContent>
                    {movementsLoading ? (
                        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
                    ) : movements.length === 0 ? (
                        <EmptyState text="لا توجد حركات مخزون مسجلة." />
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="text-right font-black">الصنف</TableHead>
                                    <TableHead className="text-right font-black">الكمية</TableHead>
                                    <TableHead className="text-right font-black">نوع الحركة</TableHead>
                                    <TableHead className="text-right font-black">المستلم / الملاحظات</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {movements.slice(0, 30).map((a) => (
                                    <TableRow key={a.id} className="border-border">
                                        <TableCell className="font-bold">{a.product_name}</TableCell>
                                        <TableCell className={a.direction === 'in' ? 'text-emerald-600 font-black font-mono' : 'text-destructive font-black font-mono'}>
                                            {a.direction === 'in' ? '+' : '-'}{a.quantity}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="text-[11px] font-bold">
                                                {a.movement_type === 'van_disbursement' ? 'عهدة سيارة مندوب 🚚' : a.movement_type === 'waste' ? 'هالك / عجز' : a.movement_type === 'purchase' ? 'شراء' : a.movement_type === 'sale' ? 'بيع' : a.movement_type}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-xs text-muted-foreground">
                                            {a.recipient_employee_name ? `المندوب: ${a.recipient_employee_name}` : a.notes || '—'}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* Disbursement Dialog */}
            <Dialog open={showDialog} onOpenChange={setShowDialog}>
                <DialogContent className="max-w-md rounded-2xl" dir="rtl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-lg font-black">
                            <PackageMinus className="h-5 w-5 text-primary" />
                            صرف من المخزن المركزي
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-2">
                        {/* Type Toggle */}
                        <div className="flex rounded-xl border border-border p-1 bg-muted/40">
                            <button
                                type="button"
                                onClick={() => setDisbursementType('van')}
                                className={`flex-1 rounded-lg py-1.5 text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                                    disbursementType === 'van'
                                        ? 'bg-card text-foreground shadow-sm'
                                        : 'text-muted-foreground hover:text-foreground'
                                }`}
                            >
                                <Truck className="h-3.5 w-3.5 text-primary" />
                                عهدة سيارة مندوب
                            </button>
                            <button
                                type="button"
                                onClick={() => setDisbursementType('waste')}
                                className={`flex-1 rounded-lg py-1.5 text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                                    disbursementType === 'waste'
                                        ? 'bg-card text-foreground shadow-sm'
                                        : 'text-muted-foreground hover:text-foreground'
                                }`}
                            >
                                <PackageMinus className="h-3.5 w-3.5 text-destructive" />
                                هالك / تالف / عجز
                            </button>
                        </div>

                        {/* If Van, select Sales Rep */}
                        {disbursementType === 'van' && (
                            <div className="space-y-1">
                                <label className="block text-xs font-bold text-foreground">مندوب المبيعات (المستلم للعهدة)</label>
                                <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
                                    <SelectTrigger className="rounded-xl border-border"><SelectValue placeholder="اختر المندوب..." /></SelectTrigger>
                                    <SelectContent dir="rtl">
                                        {(salesReps.length > 0 ? salesReps : employees).map((emp) => (
                                            <SelectItem key={emp.id} value={emp.id}>
                                                {emp.name} {emp.phone ? `(${emp.phone})` : ''}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        <div className="space-y-1">
                            <label className="block text-xs font-bold text-foreground">الصنف المراد صرفه</label>
                            <Select value={productId} onValueChange={setProductId}>
                                <SelectTrigger className="rounded-xl border-border"><SelectValue placeholder="اختر صنف..." /></SelectTrigger>
                                <SelectContent dir="rtl">
                                    {products.map((p) => (
                                        <SelectItem key={p.id} value={p.id}>
                                            {p.product_name || p.name} (رصيد المخزن: {p.current_stock ?? p.stock ?? 0})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1">
                            <label className="block text-xs font-bold text-foreground">الكمية المصروفة</label>
                            <Input
                                type="number"
                                min="1"
                                placeholder="0"
                                value={qty}
                                onChange={(e) => setQty(e.target.value)}
                                className="rounded-xl font-bold font-mono"
                            />
                        </div>

                        {disbursementType === 'waste' && (
                            <div className="space-y-1">
                                <label className="block text-xs font-bold text-foreground">سبب الهالك / العجز</label>
                                <Select value={reason} onValueChange={setReason}>
                                    <SelectTrigger className="rounded-xl border-border"><SelectValue /></SelectTrigger>
                                    <SelectContent dir="rtl">
                                        {REASONS.map((r) => (<SelectItem key={r} value={r}>{r}</SelectItem>))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        <div className="space-y-1">
                            <label className="block text-xs font-bold text-foreground">ملاحظات إضافية (اختياري)</label>
                            <Textarea
                                placeholder="رقم السيارة، بيان الاستلام، أو تفاصيل أخرى..."
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                                className="rounded-xl text-xs"
                            />
                        </div>

                        <div className="flex gap-2 pt-2 border-t border-border">
                            <Button variant="ghost" className="flex-1 rounded-xl" onClick={() => setShowDialog(false)}>
                                إلغاء
                            </Button>
                            <Button
                                className="flex-1 rounded-xl bg-primary font-bold"
                                onClick={handleSubmit}
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? 'جاري الصرف...' : 'تأكيد الصرف'}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
