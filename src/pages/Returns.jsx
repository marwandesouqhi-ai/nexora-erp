import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createReturnInvoice, getReturns } from '@/firebase/collections/returns';
import { getSales } from '@/firebase/collections/sales';
import { useRole } from '@/lib/RoleContext';
import { useAuth } from '@/lib/AuthContext';
import { logActivity } from '@/lib/activityLogger';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, RotateCcw, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

import { PageHero, EmptyState } from '@/components/page';
export default function Returns() {
    const { can } = useRole();
    const { user } = useAuth();
    const { toast } = useToast();
    const qc = useQueryClient();

    const [showDialog, setShowDialog] = useState(false);
    const [selectedSaleId, setSelectedSaleId] = useState('');
    const [selectedItems, setSelectedItems] = useState({}); // { productKey: qty }
    const [reason, setReason] = useState('');

    const { data: returns = [], isLoading } = useQuery({ queryKey: ['returns'], queryFn: getReturns });
    const { data: sales = [] } = useQuery({ queryKey: ['sales-for-returns'], queryFn: getSales });

    const selectedSale = sales.find((s) => s.id === selectedSaleId);

    const createReturnMutation = useMutation({
        mutationFn: (payload) => createReturnInvoice(payload),
        onSuccess: async (_, payload) => {
            qc.invalidateQueries(['returns']);
            qc.invalidateQueries(['products']);
            qc.invalidateQueries(['products-disbursement']);
            qc.invalidateQueries(['products-stock-alerts']);
            qc.invalidateQueries(['inventory-movements']);
            await logActivity({
                user,
                action: 'create_return',
                entity_type: 'Return',
                details: `مرتجع بقيمة ${payload.totalAmount} للعميل ${payload.customerName}`,
            });
            toast({ title: 'تم تسجيل المرتجع بنجاح' });
            setShowDialog(false);
            setSelectedSaleId('');
            setSelectedItems({});
            setReason('');
        },
        onError: () => toast({ title: 'تعذر تسجيل المرتجع', variant: 'destructive' }),
    });

    const handleToggleItem = (item) => {
        setSelectedItems((prev) => {
            const next = { ...prev };
            if (next[item.product_name]) delete next[item.product_name];
            else next[item.product_name] = { ...item, qty: item.quantity };
            return next;
        });
    };

    const handleSubmit = () => {
        const items = Object.values(selectedItems).map((i) => ({ id: i.product_id || i.id, qty: Number(i.qty), price: i.price }));
        const totalAmount = items.reduce((sum, i) => sum + i.qty * i.price, 0);
        if (!selectedSale || items.length === 0) {
            toast({ title: 'اختر فاتورة وصنف واحد على الأقل', variant: 'destructive' });
            return;
        }
        createReturnMutation.mutate({
            salesId: selectedSale.id,
            customerId: selectedSale.customer_id,
            customerName: selectedSale.customer_name || 'عميل نقدي',
            items,
            totalAmount,
            reason,
            userId: user?.uid || '',
        });
    };

    if (!can('can_view_sales')) {
        return <div className="p-8 text-center text-muted-foreground">غير مسموح لك بالوصول إلى هذه الصفحة.</div>;
    }

    return (
        <div className="space-y-6" dir="rtl">
            <PageHero
                className="mb-0"
                icon={RotateCcw}
                tone="cyan"
                title="المرتجعات"
                subtitle="تسجيل مرتجعات المبيعات وإعادة الأصناف للمخزون تلقائيًا."
                actions={can('can_create_sales') && (
                    <Button className="gap-2" onClick={() => setShowDialog(true)}>
                        <Plus className="h-4 w-4" /> تسجيل مرتجع جديد
                    </Button>
                )}
            />

            <Card className="rounded-2xl border border-border bg-card shadow-sm">
                <CardHeader>
                    <CardTitle className="text-lg font-black text-foreground">سجل المرتجعات</CardTitle>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
                    ) : returns.length === 0 ? (
                        <EmptyState text="لا توجد مرتجعات مسجلة حتى الآن." />
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="text-right">العميل</TableHead>
                                    <TableHead className="text-right">عدد الأصناف</TableHead>
                                    <TableHead className="text-right">القيمة</TableHead>
                                    <TableHead className="text-right">السبب</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {returns.map((r) => (
                                    <TableRow key={r.id}>
                                        <TableCell className="font-bold">{r.customer_name || 'عميل نقدي'}</TableCell>
                                        <TableCell>{r.items?.length || 0}</TableCell>
                                        <TableCell className="font-black text-destructive">-{Number(r.total_return_amount || 0).toLocaleString('ar')} ج.م</TableCell>
                                        <TableCell><Badge variant="outline">{r.reason || 'غير محدد'}</Badge></TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            <Dialog open={showDialog} onOpenChange={setShowDialog}>
                <DialogContent className="max-w-lg" dir="rtl">
                    <DialogHeader><DialogTitle className="flex items-center gap-2"><RotateCcw className="h-5 w-5" /> تسجيل مرتجع جديد</DialogTitle></DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <label className="mb-1 block text-xs font-bold text-muted-foreground">اختر فاتورة البيع الأصلية</label>
                            <Select value={selectedSaleId} onValueChange={(v) => { setSelectedSaleId(v); setSelectedItems({}); }}>
                                <SelectTrigger><SelectValue placeholder="اختر فاتورة..." /></SelectTrigger>
                                <SelectContent>
                                    {sales.map((s) => (
                                        <SelectItem key={s.id} value={s.id}>
                                            {(s.customer_name || 'عميل نقدي')} — {Number(s.total || 0).toLocaleString('ar')} ج.م
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {selectedSale && (
                            <div className="space-y-2">
                                <p className="text-xs font-bold text-muted-foreground">اختر الأصناف المرتجعة</p>
                                <div className="max-h-48 space-y-2 overflow-y-auto">
                                    {(selectedSale.items || []).map((item) => (
                                        <label key={item.product_name} className="flex cursor-pointer items-center justify-between rounded-xl border border-border px-3 py-2">
                                            <span className="flex items-center gap-2 text-sm">
                                                <input type="checkbox" checked={!!selectedItems[item.product_name]} onChange={() => handleToggleItem(item)} />
                                                {item.product_name}
                                            </span>
                                            <span className="text-xs text-muted-foreground">{item.quantity} × {item.price} ج.م</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div>
                            <label className="mb-1 block text-xs font-bold text-muted-foreground">سبب الإرجاع</label>
                            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="مثال: صنف تالف، خطأ في الطلب..." />
                        </div>

                        <Button className="w-full" onClick={handleSubmit} disabled={createReturnMutation.isPending}>
                            {createReturnMutation.isPending ? 'جاري الحفظ...' : 'تأكيد المرتجع'}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
