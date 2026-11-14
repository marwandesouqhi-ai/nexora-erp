import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getProducts } from '@/firebase/collections/products';
import { getCustomers } from '@/firebase/collections/customers';
import { createSalesInvoice } from '@/firebase/collections/sales';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ShoppingCart, Search, Trash2, Plus, Minus, CheckCircle2, User, Printer, Sparkles } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/AuthContext';
import { logActivity } from '@/lib/activityLogger';

export default function POS() {
    const { user } = useAuth();
    const { toast } = useToast();
    const qc = useQueryClient();
    const [cart, setCart] = useState([]);
    const [search, setSearch] = useState('');
    const [customerId, setCustomerId] = useState(null);
    const [customerName, setCustomerName] = useState('عميل نقدي');

    const { data: customers = [] } = useQuery({
        queryKey: ['customers'],
        queryFn: getCustomers,
    });

    // 1. جلب المنتجات المتاحة فقط (التي بها مخزون)
    const { data: products = [], isLoading } = useQuery({
        queryKey: ['products'],
        queryFn: getProducts
    });

    // 2. رسم المنتجات لتتناسب مع الكود
    const mappedProducts = useMemo(() =>
        products.map(p => ({
            id: p.id,
            name: p.product_name,
            price: p.selling_price,
            stock: p.current_stock,
            category: p.category || 'غير مصنف',
            barcode: p.barcode
        })), [products]
    );

    // 2. معالجة الفاتورة (تنقيص المخزن + تسجيل العملية)
    const checkoutMutation = useMutation({
        mutationFn: async () => {
            const invoiceData = {
                customer_id: customerId || null,
                customerName: customerName,
                items: cart.map(item => ({
                    product_id: item.id,
                    id: item.id,
                    name: item.name,
                    qty: item.quantity,
                    price: item.price
                })),
                totalAmount: total,
                paidAmount: total, // مدفوع كامل في POS
                paymentType: 'cash'
            };
            return createSalesInvoice(invoiceData);
        },
        onSuccess: async () => {
            qc.invalidateQueries(['products']);
            qc.invalidateQueries(['products-stock-alerts']);
            qc.invalidateQueries(['inventory-movements']);
            await logActivity({
                user,
                action: 'create_invoice',
                details: `فاتورة مبيعات لـ ${customerName} بقيمة ${total} ج.م`
            });
            toast({ title: 'تمت عملية البيع بنجاح' });
            setCart([]);
            setCustomerId(null);
            setCustomerName('عميل نقدي');
        }
    });

    const addToCart = useCallback((product) => {
        setCart((currentCart) => {
            const existing = currentCart.find((item) => item.id === product.id);
            if (existing) {
                if (existing.quantity >= product.stock) {
                    toast({ title: 'عفواً، نفدت الكمية', variant: 'destructive' });
                    return currentCart;
                }
                return currentCart.map((item) => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
            }
            return [...currentCart, { ...product, quantity: 1 }];
        });
        toast({ title: 'تمت إضافة العنصر إلى السلة', description: product.name });
    }, [toast]);

    const total = cart.reduce((acc, item) => acc + (Number(item.price) * Number(item.quantity)), 0);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-120px)]">

            {/* قسم البحث والمنتجات (8 أعمدة) */}
            <div className="lg:col-span-8 flex flex-col gap-4">
                <div className="relative">
                    <Search className="absolute right-4 top-4 h-5 w-5 text-muted-foreground" aria-hidden="true" />
                    <Input
                        placeholder="ابحث عن صنف بالاسم أو الباركود..."
                        className="h-14 rounded-2xl border border-border bg-background/80 pr-12 text-lg shadow-sm transition-all focus:ring-2 focus:ring-primary/25"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>

                {isLoading ? (
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
                        {Array.from({ length: 8 }).map((_, index) => (
                            <Skeleton key={index} className="h-36 rounded-2xl" />
                        ))}
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-3 overflow-y-auto pr-1 md:grid-cols-3 xl:grid-cols-4">
                        {mappedProducts.filter((p) => p.name.includes(search)).map((product) => (
                            <Card
                                key={product.id}
                                className={`group cursor-pointer border-2 p-4 transition-all duration-300 ${product.stock <= 0 ? 'cursor-not-allowed opacity-50 grayscale' : 'hover:-translate-y-1'}`}
                                onClick={() => product.stock > 0 && addToCart(product)}
                            >
                                <div className="mb-3 flex items-center justify-between">
                                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.2em] text-primary">
                                        {product.category}
                                    </span>
                                    {product.stock > 0 ? (
                                        <Sparkles className="h-4 w-4 text-amber-500 transition-transform duration-300 group-hover:rotate-12" aria-hidden="true" />
                                    ) : null}
                                </div>
                                <h3 className="h-10 text-sm font-bold text-foreground line-clamp-2 ">{product.name}</h3>
                                <div className="mt-3 flex items-center justify-between">
                                    <span className="font-black text-foreground ">{product.price} ج.م</span>
                                    <span className={`rounded-full px-2 py-0.5 text-[10px] ${product.stock < 5 ? 'bg-danger-soft text-danger' : 'bg-card-muted text-secondary-text'}`}>
                                        متاح: {product.stock}
                                    </span>
                                </div>
                            </Card>
                        ))}
                    </div>
                )}
            </div>

            {/* فاتورة البيع (4 أعمدة) */}
            <div className="lg:col-span-4 flex flex-col overflow-hidden rounded-[2.5rem] border border-border bg-card shadow-[0_20px_50px_rgba(15,23,42,0.08)]">
                <div className="bg-gradient-to-br from-indigo-600 to-violet-600 p-6 text-white">
                    <div className="flex items-center gap-3 mb-4">
                        <ShoppingCart className="text-indigo-400" />
                        <h2 className="text-xl font-black italic">سلة المبيعات</h2>
                    </div>
                    <div className="space-y-3">
                        <div>
                            <label className="text-xs font-black text-muted-foreground/60">اختر عميلًا مسجلًا</label>
                            <Select value={customerId || ''} onValueChange={(value) => {
                                if (!value) {
                                    setCustomerId(null);
                                    setCustomerName('عميل نقدي');
                                    return;
                                }
                                const selected = customers.find((c) => c.id === value);
                                setCustomerId(value);
                                setCustomerName(selected?.name || 'عميل نقدي');
                            }}>
                                <SelectTrigger className="h-12 rounded-xl bg-white/10 text-white"><SelectValue placeholder="عميل نقدي" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="">عميل نقدي</SelectItem>
                                    {customers.map((customer) => (
                                        <SelectItem key={customer.id} value={customer.id}>{customer.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="relative">
                            <User className="absolute right-3 top-3 w-4 h-4 text-muted-foreground" />
                            <Input
                                value={customerName}
                                onChange={e => {
                                    setCustomerId(null);
                                    setCustomerName(e.target.value);
                                }}
                                className="h-10 rounded-xl border-none bg-white/15 pr-10 text-white placeholder:text-white/60"
                                placeholder="اسم العميل..."
                            />
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {cart.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-muted-foreground/60 opacity-50">
                            <ShoppingCart size={48} />
                            <p className="font-bold mt-2">السلة فارغة</p>
                        </div>
                    ) : cart.map(item => (
                        <div key={item.id} className="group flex items-center justify-between rounded-[1.25rem] border border-border/60 bg-card/90 p-3 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
                            <div className="flex-1">
                                <p className="font-bold text-foreground text-sm">{item.name}</p>
                                <p className="text-xs text-indigo-600 font-black">{item.price * item.quantity} ج.م</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button size="icon" variant="ghost" className="h-7 w-7 rounded-full bg-background shadow-sm" onClick={() => setCart(cart.map(i => i.id === item.id ? { ...i, quantity: Math.max(1, i.quantity - 1) } : i))}>
                                    <Minus size={12} />
                                </Button>
                                <span className="font-bold text-sm w-4 text-center">{item.quantity}</span>
                                <Button size="icon" variant="ghost" className="h-7 w-7 rounded-full bg-background shadow-sm" onClick={() => addToCart(item)}>
                                    <Plus size={12} />
                                </Button>
                                <Button size="icon" variant="ghost" className="h-7 w-7 text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => setCart(cart.filter(i => i.id !== item.id))}>
                                    <Trash2 size={12} />
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="space-y-4 border-t border-border bg-card/90 p-6">
                    <div className="flex justify-between items-center text-xl font-black">
                        <span className="text-muted-foreground">الإجمالي:</span>
                        <span className="text-indigo-600">{total.toLocaleString('ar')} ج.م</span>
                    </div>
                    <div className="flex gap-2">
                        <Button
                            className="flex-1 h-14 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-lg font-black shadow-lg shadow-indigo-100 gap-2"
                            onClick={() => checkoutMutation.mutate()}
                            disabled={cart.length === 0 || checkoutMutation.isPending}
                        >
                            <CheckCircle2 size={20} /> إنهاء وبيع
                        </Button>
                        <Button variant="outline" className="h-14 w-14 rounded-2xl border-2">
                            <Printer size={20} />
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}