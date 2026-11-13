import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getProducts } from '@/firebase/collections/products';
import { createProductionOrder, completeProductionOrder, getProductionOrders } from '@/firebase/collections/manufacturing';
import { useRole } from '@/lib/RoleContext';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Factory, CheckCircle2, Loader2, Trash2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

import { PageHero, EmptyState } from '@/components/page';
export default function Manufacturing() {
    const { can } = useRole();
    const { user } = useAuth();
    const { toast } = useToast();
    const qc = useQueryClient();

    const [showDialog, setShowDialog] = useState(false);
    const [finishedProductId, setFinishedProductId] = useState('');
    const [qtyProduced, setQtyProduced] = useState('');
    const [materials, setMaterials] = useState([]); // [{product_id, product_name, qty_used}]
    const [materialToAdd, setMaterialToAdd] = useState('');
    const [materialQty, setMaterialQty] = useState('');

    const { data: products = [] } = useQuery({ queryKey: ['products-manufacturing'], queryFn: getProducts });
    const { data: orders = [], isLoading } = useQuery({ queryKey: ['production-orders'], queryFn: getProductionOrders });

    const createMutation = useMutation({
        mutationFn: (payload) => createProductionOrder(payload),
        onSuccess: () => {
            qc.invalidateQueries(['production-orders']);
            toast({ title: 'تم إنشاء أمر التصنيع' });
            setShowDialog(false);
            setFinishedProductId(''); setQtyProduced(''); setMaterials([]);
        },
    });

    const completeMutation = useMutation({
        mutationFn: (order) => completeProductionOrder(order),
        onSuccess: () => {
            qc.invalidateQueries(['production-orders']);
            qc.invalidateQueries(['products-manufacturing']);
            toast({ title: 'تم اعتماد أمر التصنيع وتحديث المخزون' });
        },
    });

    const handleAddMaterial = () => {
        const product = products.find((p) => p.id === materialToAdd);
        if (!product || !materialQty) return;
        setMaterials((prev) => [...prev, { product_id: product.id, product_name: product.product_name, qty_used: Number(materialQty) }]);
        setMaterialToAdd(''); setMaterialQty('');
    };

    const handleSubmit = () => {
        const finished = products.find((p) => p.id === finishedProductId);
        if (!finished || !qtyProduced || materials.length === 0) {
            toast({ title: 'أكمل بيانات الأمر: المنتج النهائي، الكمية، والخامات', variant: 'destructive' });
            return;
        }
        createMutation.mutate({
            finishedProduct: { product_id: finished.id, product_name: finished.product_name, qty_produced: qtyProduced },
            materials,
            userId: user?.uid,
        });
    };

    if (!can('can_edit_inventory')) {
        return <div className="p-8 text-center text-muted-foreground">غير مسموح لك بالوصول إلى هذه الصفحة.</div>;
    }

    return (
        <div className="space-y-6" dir="rtl">
            <PageHero
                className="mb-0"
                icon={Factory}
                tone="cyan"
                title="التصنيع والإنتاج"
                subtitle="تحويل الخامات إلى منتجات تامة الصنع مع تحديث المخزون تلقائيًا."
                actions={
                    <Button className="gap-2" onClick={() => setShowDialog(true)}>
                        <Plus className="h-4 w-4" /> أمر تصنيع جديد
                    </Button>
                }
            />

            <Card className="rounded-2xl border border-border bg-card shadow-sm">
                <CardHeader><CardTitle className="text-lg font-black text-foreground">أوامر التصنيع</CardTitle></CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
                    ) : orders.length === 0 ? (
                        <EmptyState text="لا توجد أوامر تصنيع مسجلة." />
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="text-right">رقم الأمر</TableHead>
                                    <TableHead className="text-right">المنتج النهائي</TableHead>
                                    <TableHead className="text-right">الكمية</TableHead>
                                    <TableHead className="text-right">الخامات المستخدمة</TableHead>
                                    <TableHead className="text-right">الحالة</TableHead>
                                    <TableHead className="text-right">إجراء</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {orders.map((o) => (
                                    <TableRow key={o.id}>
                                        <TableCell className="font-mono text-xs">{o.order_number}</TableCell>
                                        <TableCell className="font-bold">{o.finished_product_name}</TableCell>
                                        <TableCell>{o.qty_produced}</TableCell>
                                        <TableCell className="text-xs text-muted-foreground">{(o.materials || []).map((m) => `${m.product_name} (${m.qty_used})`).join('، ')}</TableCell>
                                        <TableCell>
                                            <Badge variant={o.status === 'completed' ? 'secondary' : 'outline'}>
                                                {o.status === 'completed' ? 'مكتمل' : 'قيد التنفيذ'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            {o.status !== 'completed' && (
                                                <Button size="sm" variant="outline" className="gap-1" onClick={() => completeMutation.mutate(o)}>
                                                    <CheckCircle2 className="h-3.5 w-3.5" /> اعتماد
                                                </Button>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            <Dialog open={showDialog} onOpenChange={setShowDialog}>
                <DialogContent className="max-w-lg" dir="rtl">
                    <DialogHeader><DialogTitle className="flex items-center gap-2"><Factory className="h-5 w-5" /> أمر تصنيع جديد</DialogTitle></DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <label className="mb-1 block text-xs font-bold text-muted-foreground">المنتج النهائي</label>
                            <Select value={finishedProductId} onValueChange={setFinishedProductId}>
                                <SelectTrigger><SelectValue placeholder="اختر المنتج التام..." /></SelectTrigger>
                                <SelectContent>{products.map((p) => (<SelectItem key={p.id} value={p.id}>{p.product_name}</SelectItem>))}</SelectContent>
                            </Select>
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-bold text-muted-foreground">الكمية المنتجة</label>
                            <Input type="number" value={qtyProduced} onChange={(e) => setQtyProduced(e.target.value)} />
                        </div>

                        <div className="space-y-2 rounded-xl border border-border p-3">
                            <p className="text-xs font-bold text-muted-foreground">الخامات المستخدمة</p>
                            <div className="flex gap-2">
                                <Select value={materialToAdd} onValueChange={setMaterialToAdd}>
                                    <SelectTrigger className="flex-1"><SelectValue placeholder="اختر خامة..." /></SelectTrigger>
                                    <SelectContent>{products.map((p) => (<SelectItem key={p.id} value={p.id}>{p.product_name}</SelectItem>))}</SelectContent>
                                </Select>
                                <Input className="w-24" type="number" placeholder="الكمية" value={materialQty} onChange={(e) => setMaterialQty(e.target.value)} />
                                <Button type="button" variant="outline" onClick={handleAddMaterial}>إضافة</Button>
                            </div>
                            {materials.map((m, idx) => (
                                <div key={`${m.product_id}-${idx}`} className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-1.5 text-sm">
                                    <span>{m.product_name} × {m.qty_used}</span>
                                    <button onClick={() => setMaterials((prev) => prev.filter((_, i) => i !== idx))}>
                                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                    </button>
                                </div>
                            ))}
                        </div>

                        <Button className="w-full" onClick={handleSubmit} disabled={createMutation.isPending}>
                            {createMutation.isPending ? 'جاري الحفظ...' : 'إنشاء أمر التصنيع'}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
