import { useState, useRef, useEffect } from 'react';
import { db } from '@/api/firebase';
import { collection, doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Trash2, ScanBarcode, Loader2, ShoppingCart } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { useReactToPrint } from 'react-to-print';
import { useAuth } from '@/lib/AuthContext';

export default function CreateSaleDialog({ open, onOpenChange, products }) {
    const { user } = useAuth();
    const { toast } = useToast();
    const qc = useQueryClient();
    const printRef = useRef();
    const barcodeRef = useRef(null);

    const [loading, setLoading] = useState(false);
    const [customerName, setCustomerName] = useState('عميل نقدي');
    const [paymentStatus, setPaymentStatus] = useState('paid');
    const [items, setItems] = useState([]);
    const [barcodeInput, setBarcodeInput] = useState('');
    const [lastSavedSale, setLastSavedSale] = useState(null);

    const totalAmount = items.reduce((sum, item) => sum + item.total, 0);

    const handlePrint = useReactToPrint({
        content: () => printRef.current,
        onAfterPrint: () => {
            setLastSavedSale(null);
            onOpenChange(false);
        }
    });

    const handleSubmit = async () => {
        if (items.length === 0 || loading) return;
        setLoading(true);

        try {
            const invoiceNum = `INV-${Date.now().toString().slice(-6)}`;
            const saleData = {
                invoice_number: invoiceNum,
                customer_name: customerName,
                items: items,
                total: totalAmount,
                payment_status: paymentStatus,
                created_date: new Date(),
                created_by: user?.uid
            };

            await runTransaction(db, async (transaction) => {
                for (const item of items) {
                    const pRef = doc(db, 'products', item.product_id);
                    const pSnap = await transaction.get(pRef);
                    const newStock = pSnap.data().stock - item.quantity;
                    if (newStock < 0) throw `عفواً، الكمية نفذت من ${item.product_name}`;
                    transaction.update(pRef, { stock: newStock });
                }
                const salesRef = doc(collection(db, 'sales'));
                transaction.set(salesRef, { ...saleData, created_date: serverTimestamp() });
            });

            setLastSavedSale(saleData);
            toast({ title: "تم الحفظ بنجاح.. جاري الطباعة" });

            setTimeout(() => {
                handlePrint();
                setItems([]); // تصفير السلة بعد النجاح
                setCustomerName('عميل نقدي');
            }, 500);

            qc.invalidateQueries(['sales', 'products']);
        } catch (error) {
            toast({ title: "خطأ", description: error.toString(), variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    // --- 1. اختصارات الكيبورد ---
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (open) {
                if (e.key === 'F10') {
                    e.preventDefault();
                    handleSubmit();
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [open, handleSubmit]);

    const handleBarcodeSubmit = (e) => {
        e.preventDefault();
        const product = products.find(p => p.barcode === barcodeInput);
        if (product) {
            addItem(product);
        } else {
            toast({ title: "المنتج غير موجود", variant: "destructive" });
        }
        setBarcodeInput('');
    };

    const addItem = (product) => {
        setItems(prev => {
            const existing = prev.find(item => item.product_id === product.id);
            const currentQtyInCart = existing ? existing.quantity : 0;

            // التأكد من عدم تجاوز المخزون المتاح
            if (currentQtyInCart + 1 > product.stock) {
                toast({ title: "تجاوزت الكمية المتاحة", variant: "destructive" });
                return prev;
            }

            if (existing) {
                return prev.map(item =>
                    item.product_id === product.id
                        ? { ...item, quantity: item.quantity + 1, total: (item.quantity + 1) * item.price }
                        : item
                );
            }
            return [...prev, {
                product_id: product.id,
                product_name: product.name,
                price: Number(product.price),
                cost_price: Number(product.cost_price || 0),
                quantity: 1,
                total: Number(product.price)
            }];
        });
    };

    const removeItem = (id) => {
        setItems(prev => prev.filter(item => item.product_id !== id));
    };

    return (
        <Dialog open={open} onOpenChange={(val) => {
            if (!loading) onOpenChange(val); // منع الإغلاق أثناء الحفظ
        }}>
            <DialogContent className="max-w-5xl bg-white rounded-3xl p-0 overflow-hidden" dir="rtl">
                <DialogHeader className="p-6 border-b bg-slate-50 flex flex-row items-center justify-between">
                    <DialogTitle className="text-xl font-black flex items-center gap-2">
                        <ShoppingCart className="text-indigo-600" /> فاتورة جديدة - {customerName}
                    </DialogTitle>
                </DialogHeader>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-0 h-[70vh]">
                    {/* منطقة البيع */}
                    <div className="md:col-span-3 p-6 flex flex-col gap-4 overflow-hidden">
                        <form onSubmit={handleBarcodeSubmit} className="relative">
                            <ScanBarcode className="absolute right-3 top-1/2 -translate-y-1/2 text-indigo-500 w-5 h-5" />
                            <Input
                                ref={barcodeRef}
                                placeholder="امسح الباركود (أو اضغط F10 للحفظ)..."
                                value={barcodeInput}
                                onChange={e => setBarcodeInput(e.target.value)}
                                className="pr-10 h-14 rounded-2xl border-2 focus:border-indigo-500 text-lg"
                                autoFocus
                            />
                        </form>

                        <div className="border rounded-2xl flex-1 overflow-y-auto bg-slate-50/30">
                            <Table>
                                <TableHeader className="bg-white sticky top-0 shadow-sm">
                                    <TableRow>
                                        <TableHead className="text-right">المنتج</TableHead>
                                        <TableHead className="text-center">السعر</TableHead>
                                        <TableHead className="text-center">الكمية</TableHead>
                                        <TableHead className="text-left">المجموع</TableHead>
                                        <TableHead className="w-10"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {items.map(item => (
                                        <TableRow key={item.product_id} className="hover:bg-white transition-colors">
                                            <TableCell className="font-bold text-slate-700">{item.product_name}</TableCell>
                                            <TableCell className="text-center">{item.price} ج.م</TableCell>
                                            <TableCell className="text-center font-mono font-bold">{item.quantity}</TableCell>
                                            <TableCell className="text-left font-mono font-bold text-indigo-600">{item.total} ج.م</TableCell>
                                            <TableCell>
                                                <Button size="icon" variant="ghost" onClick={() => removeItem(item.product_id)} className="text-red-400 hover:text-red-600">
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </div>

                    {/* جانب الدفع */}
                    <div className="bg-slate-50 p-6 border-r flex flex-col justify-between">
                        <div className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-xs font-black text-slate-400 uppercase tracking-wider">تفاصيل العميل</label>
                                <Input value={customerName} onChange={e => setCustomerName(e.target.value)} className="bg-white h-12 rounded-xl" />
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-black text-slate-400 uppercase tracking-wider">نوع الدفع</label>
                                <Select value={paymentStatus} onValueChange={setPaymentStatus}>
                                    <SelectTrigger className="bg-white h-12 rounded-xl"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="paid">نقدي (كاش)</SelectItem>
                                        <SelectItem value="unpaid">آجل (شكك)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="pt-6 border-t space-y-4">
                            <div className="flex justify-between items-end">
                                <span className="text-slate-500 font-bold">الإجمالي</span>
                                <div className="text-left">
                                    <span className="text-3xl font-black text-slate-900">{totalAmount}</span>
                                    <span className="text-sm font-bold text-slate-500 mr-1">ج.م</span>
                                </div>
                            </div>
                            <Button
                                onClick={handleSubmit}
                                className="w-full h-16 rounded-2xl bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200 text-xl font-black transition-all active:scale-95"
                                disabled={loading || items.length === 0}
                            >
                                {loading ? <Loader2 className="animate-spin" /> : "إتمام البيع (F10)"}
                            </Button>
                        </div>
                    </div>
                </div>

                {/* مكون الطباعة الحرارية المخفي */}
                <div className="hidden">
                    <div ref={printRef} className="p-6 w-[80mm] text-black bg-white" dir="rtl" style={{ fontFamily: 'Arial, sans-serif' }}>
                        <div className="text-center border-b-2 border-black pb-4 mb-4">
                            <h1 className="text-2xl font-black italic">NEXORA ERP</h1>
                            <p className="text-xs">حلول برمجية متكاملة لـ مروان دسوقي</p>
                        </div>
                        <div className="text-[12px] mb-4 space-y-1">
                            <div className="flex justify-between"><span>الفاتورة:</span> <b>{lastSavedSale?.invoice_number}</b></div>
                            <div className="flex justify-between"><span>التاريخ:</span> <span>{new Date().toLocaleString('ar-EG')}</span></div>
                            <div className="flex justify-between"><span>العميل:</span> <b>{lastSavedSale?.customer_name}</b></div>
                        </div>
                        <table className="w-full text-[11px] mb-4">
                            <thead>
                                <tr className="border-b border-black">
                                    <th className="text-right py-2">الصنف</th>
                                    <th className="text-center">كمية</th>
                                    <th className="text-left">سعر</th>
                                </tr>
                            </thead>
                            <tbody>
                                {lastSavedSale?.items.map((item, i) => (
                                    <tr key={i} className="border-b border-dotted border-slate-300">
                                        <td className="py-2">{item.product_name}</td>
                                        <td className="text-center">{item.quantity}</td>
                                        <td className="text-left font-bold">{item.total}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <div className="text-right border-t border-black pt-2">
                            <div className="flex justify-between text-lg font-black">
                                <span>الإجمالي:</span>
                                <span>{lastSavedSale?.total} ج.م</span>
                            </div>
                        </div>
                        <div className="text-center mt-8 pt-4 border-t border-dashed">
                            <p className="text-[10px]">شكراً لتعاملكم معنا!</p>
                            <p className="text-[9px] mt-1 italic">Powered by Nexora ERP</p>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}