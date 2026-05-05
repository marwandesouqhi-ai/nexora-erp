import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getProducts } from '@/firebase/collections/products';
import { createSalesInvoice } from '@/firebase/collections/sales';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { ShoppingCart, Search, Trash2, Plus, Minus, CheckCircle2, User, Printer } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/AuthContext';
import { logActivity } from '@/lib/activityLogger';

export default function POS() {
    const { user } = useAuth();
    const { toast } = useToast();
    const qc = useQueryClient();
    const [cart, setCart] = useState([]);
    const [search, setSearch] = useState('');
    const [customerName, setCustomerName] = useState('عميل نقدي');

    // 1. جلب المنتجات المتاحة فقط (التي بها مخزون)
    const { data: products = [] } = useQuery({
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
                customerId: null, // عميل نقدي
                customerName: customerName,
                items: cart.map(item => ({
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
            await logActivity({
                user,
                action: 'create_invoice',
                details: `فاتورة مبيعات لـ ${customerName} بقيمة ${total} ج.م`
            });
            toast({ title: 'تمت عملية البيع بنجاح' });
            setCart([]);
            setCustomerName('عميل نقدي');
        }
    });

    const addToCart = (product) => {
        const existing = cart.find(item => item.id === product.id);
        if (existing) {
            if (existing.quantity >= product.stock) return toast({ title: 'عفواً، نفدت الكمية', variant: 'destructive' });
            setCart(cart.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item));
        } else {
            setCart([...cart, { ...product, quantity: 1 }]);
        }
    };

    const total = useMemo(() => cart.reduce((acc, item) => acc + (item.price * item.quantity), 0), [cart]);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-120px)]">

            {/* قسم البحث والمنتجات (8 أعمدة) */}
            <div className="lg:col-span-8 flex flex-col gap-4">
                <div className="relative">
                    <Search className="absolute right-4 top-4 text-slate-400 w-5 h-5" />
                    <Input
                        placeholder="ابحث عن صنف بالاسم أو الباركود..."
                        className="h-14 pr-12 rounded-2xl border-none shadow-sm text-lg"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 overflow-y-auto pr-1">
                    {mappedProducts.filter(p => p.name.includes(search)).map(product => (
                        <Card
                            key={product.id}
                            className={`p-4 rounded-[2rem] cursor-pointer hover:border-indigo-500 transition-all border-2 border-transparent shadow-sm ${product.stock <= 0 ? 'opacity-50 grayscale cursor-not-allowed' : ''}`}
                            onClick={() => product.stock > 0 && addToCart(product)}
                        >
                            <p className="text-[10px] font-black text-indigo-500 uppercase mb-1">{product.category}</p>
                            <h3 className="font-bold text-slate-800 text-sm line-clamp-2 h-10">{product.name}</h3>
                            <div className="mt-3 flex justify-between items-center">
                                <span className="font-black text-slate-900">{product.price} ج.م</span>
                                <span className={`text-[10px] px-2 py-0.5 rounded-full ${product.stock < 5 ? 'bg-rose-50 text-rose-500' : 'bg-slate-50 text-slate-500'}`}>
                                    متاح: {product.stock}
                                </span>
                            </div>
                        </Card>
                    ))}
                </div>
            </div>

            {/* فاتورة البيع (4 أعمدة) */}
            <div className="lg:col-span-4 flex flex-col bg-white rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden">
                <div className="p-6 bg-slate-900 text-white">
                    <div className="flex items-center gap-3 mb-4">
                        <ShoppingCart className="text-indigo-400" />
                        <h2 className="text-xl font-black italic">سلة المبيعات</h2>
                    </div>
                    <div className="relative">
                        <User className="absolute right-3 top-2.5 w-4 h-4 text-slate-400" />
                        <Input
                            value={customerName}
                            onChange={e => setCustomerName(e.target.value)}
                            className="bg-white/10 border-none text-white placeholder:text-slate-500 h-10 pr-10 rounded-xl"
                            placeholder="اسم العميل..."
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {cart.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-300 opacity-50">
                            <ShoppingCart size={48} />
                            <p className="font-bold mt-2">السلة فارغة</p>
                        </div>
                    ) : cart.map(item => (
                        <div key={item.id} className="flex items-center justify-between bg-slate-50 p-3 rounded-2xl group">
                            <div className="flex-1">
                                <p className="font-bold text-slate-800 text-sm">{item.name}</p>
                                <p className="text-xs text-indigo-600 font-black">{item.price * item.quantity} ج.م</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button size="icon" variant="ghost" className="h-7 w-7 rounded-full bg-white shadow-sm" onClick={() => setCart(cart.map(i => i.id === item.id ? { ...i, quantity: Math.max(1, i.quantity - 1) } : i))}>
                                    <Minus size={12} />
                                </Button>
                                <span className="font-bold text-sm w-4 text-center">{item.quantity}</span>
                                <Button size="icon" variant="ghost" className="h-7 w-7 rounded-full bg-white shadow-sm" onClick={() => addToCart(item)}>
                                    <Plus size={12} />
                                </Button>
                                <Button size="icon" variant="ghost" className="h-7 w-7 text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => setCart(cart.filter(i => i.id !== item.id))}>
                                    <Trash2 size={12} />
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="p-6 bg-slate-50 border-t border-slate-100 space-y-4">
                    <div className="flex justify-between items-center text-xl font-black">
                        <span className="text-slate-500">الإجمالي:</span>
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