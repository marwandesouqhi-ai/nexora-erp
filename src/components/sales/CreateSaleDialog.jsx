import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { db } from '@/api/firebase';
import { collection, doc, increment, runTransaction, serverTimestamp } from 'firebase/firestore';
import { withTenant } from '@/lib/tenantFirestore';

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';

import {
    Trash2,
    ScanBarcode,
    Loader2,
    ShoppingCart,
    PackageX,
    Search,
    Plus,
    Minus,
} from 'lucide-react';

import { useToast } from '@/components/ui/use-toast';
import { getCustomers } from '@/firebase/collections/customers';
import { getAccounts } from '@/firebase/collections/accounts';
import { useReactToPrint } from 'react-to-print';
import { useAuth } from '@/lib/AuthContext';

export default function CreateSaleDialog({
    open,
    onOpenChange,
    products = [],
}) {
    const { user } = useAuth();
    const { toast } = useToast();
    const qc = useQueryClient();

    const printRef = useRef(null);
    const barcodeRef = useRef(null);

    const [loading, setLoading] = useState(false);

    const [customerName, setCustomerName] = useState('عميل نقدي');
    const [selectedCustomerId, setSelectedCustomerId] = useState(null);
    const [paymentMethod, setPaymentMethod] = useState('cash');
    const [paymentStatus, setPaymentStatus] = useState('paid');
    const [partialPaidAmount, setPartialPaidAmount] = useState('');
    const [accountId, setAccountId] = useState('');
    const [discount, setDiscount] = useState(0);
    const [notes, setNotes] = useState('');

    const [items, setItems] = useState([]);
    const [barcodeInput, setBarcodeInput] = useState('');
    const [productSearch, setProductSearch] = useState('');
    const [lastSavedSale, setLastSavedSale] = useState(null);
    const { data: accounts = [] } = useQuery({ queryKey: ['sale-accounts'], queryFn: getAccounts });

    // توحيد بيانات المنتجات القادمة من Firebase
    // يدعم الـ schema القديم والجديد.
    const normalizeProduct = useCallback((product) => {
        const stock = Number(
            product.stock ??
            product.current_stock ??
            0
        );

        const price = Number(
            product.price ??
            product.selling_price ??
            0
        );

        const cost = Number(
            product.cost ??
            product.cost_price ??
            product.purchase_price ??
            0
        );

        const name =
            product.name ??
            product.product_name ??
            product.name_ar ??
            'منتج بدون اسم';

        return {
            ...product,
            id: product.id,
            normalizedName: String(name),
            normalizedStock: Number.isFinite(stock) ? stock : 0,
            normalizedPrice: Number.isFinite(price) ? price : 0,
            normalizedCost: Number.isFinite(cost) ? cost : 0,
            normalizedBarcode: String(product.barcode ?? '').trim(),
        };
    }, []);

    const normalizedProducts = useMemo(
        () => products.map(normalizeProduct),
        [products, normalizeProduct]
    );

    // المنتجات التي تظهر في البحث اليدوي
    const filteredProducts = useMemo(() => {
        const query = productSearch.trim().toLowerCase();

        if (!query) {
            return normalizedProducts.slice(0, 30);
        }

        return normalizedProducts
            .filter((product) => {
                const name = product.normalizedName.toLowerCase();
                const barcode = product.normalizedBarcode.toLowerCase();
                const sku = String(product.sku ?? '').toLowerCase();

                return (
                    name.includes(query) ||
                    barcode.includes(query) ||
                    sku.includes(query)
                );
            })
            .slice(0, 30);
    }, [normalizedProducts, productSearch]);

    // إجمالي الفاتورة
    const subTotal = useMemo(
        () => items.reduce((sum, item) => sum + Number(item.total || 0), 0),
        [items]
    );

    const totalAmount = useMemo(
        () => Math.max(Number(subTotal) - Number(discount || 0), 0),
        [subTotal, discount]
    );

    useEffect(() => {
        if (!open) {
            const timer = window.setTimeout(() => {
                setProductSearch('');
                setBarcodeInput('');
            }, 0);
            return () => window.clearTimeout(timer);
        }
        return undefined;
    }, [open]);

    // الطباعة
    const { data: customers = [] } = useQuery({
        queryKey: ['customers'],
        queryFn: getCustomers,
    });

    const selectedCustomer = customers.find((customer) => customer.id === selectedCustomerId);
    const previousBalance = Number(selectedCustomer?.balance || 0);
    const paidAmount = paymentStatus === 'paid'
        ? totalAmount
        : paymentStatus === 'partial'
            ? Math.min(Math.max(Number(partialPaidAmount) || 0, 0), totalAmount)
            : 0;
    const remainingAmount = Math.max(totalAmount - paidAmount, 0);
    const balanceAfterSale = previousBalance + remainingAmount;

    const handlePrint = useReactToPrint({
        contentRef: printRef,
        documentTitle: lastSavedSale?.invoice_number || 'invoice',

        onAfterPrint: () => {
            setLastSavedSale(null);
            onOpenChange(false);
        },
    });

    // إضافة منتج للفاتورة
    const addItem = useCallback(
        (rawProduct) => {
            const product = normalizeProduct(rawProduct);

            if (!product.id) {
                return;
            }

            if (product.normalizedStock <= 0) {
                toast({
                    title: 'المنتج غير متوفر',
                    description: `${product.normalizedName} لا يوجد منه مخزون حاليًا`,
                    variant: 'destructive',
                });

                return;
            }

            setItems((prev) => {
                const existing = prev.find(
                    (item) => item.product_id === product.id
                );

                const currentQty = existing
                    ? Number(existing.quantity)
                    : 0;

                if (currentQty + 1 > product.normalizedStock) {
                    toast({
                        title: 'تجاوزت الكمية المتاحة',
                        description: `المتاح من ${product.normalizedName}: ${product.normalizedStock}`,
                        variant: 'destructive',
                    });

                    return prev;
                }

                if (existing) {
                    return prev.map((item) =>
                        item.product_id === product.id
                            ? {
                                ...item,
                                quantity: item.quantity + 1,
                                total:
                                    (item.quantity + 1) *
                                    Number(item.price || 0),
                            }
                            : item
                    );
                }

                return [
                    ...prev,
                    {
                        product_id: product.id,
                        product_name: product.normalizedName,
                        barcode: product.normalizedBarcode,
                        price: Number(product.normalizedPrice) || 0,
                        cost_price: Number(product.normalizedCost) || 0,
                        quantity: 1,
                        total: Number(product.normalizedPrice) || 0,
                        available_stock: Number(product.normalizedStock) || 0,
                    },
                ];
            });

            setProductSearch('');
        },
        [normalizeProduct, toast]
    );

    // زيادة كمية منتج
    const increaseQuantity = useCallback(
        (productId) => {
            setItems((prev) =>
                prev.map((item) => {
                    if (item.product_id !== productId) {
                        return item;
                    }

                    if (
                        Number(item.quantity) + 1 >
                        Number(item.available_stock)
                    ) {
                        toast({
                            title: 'لا توجد كمية كافية',
                            description: `المتاح: ${item.available_stock}`,
                            variant: 'destructive',
                        });

                        return item;
                    }

                    const quantity = Number(item.quantity) + 1;

                    return {
                        ...item,
                        quantity,
                        total: quantity * Number(item.price || 0),
                    };
                })
            );
        },
        [toast]
    );

    // تقليل كمية منتج
    const decreaseQuantity = useCallback((productId) => {
        setItems((prev) =>
            prev
                .map((item) => {
                    if (item.product_id !== productId) {
                        return item;
                    }

                    const quantity = Number(item.quantity) - 1;

                    if (quantity <= 0) {
                        return null;
                    }

                    return {
                        ...item,
                        quantity,
                        total: quantity * Number(item.price || 0),
                    };
                })
                .filter(Boolean)
        );
    }, []);

    // حذف منتج
    const removeItem = useCallback((id) => {
        setItems((prev) =>
            prev.filter((item) => item.product_id !== id)
        );
    }, []);

    // Barcode اختياري
    const handleBarcodeSubmit = (e) => {
        e.preventDefault();

        const barcode = barcodeInput.trim();

        if (!barcode) {
            return;
        }

        const product = normalizedProducts.find(
            (p) => p.normalizedBarcode === barcode
        );

        if (!product) {
            toast({
                title: 'المنتج غير موجود',
                description: `لا يوجد منتج بالباركود: ${barcode}`,
                variant: 'destructive',
            });

            return;
        }

        addItem(product);
        setBarcodeInput('');
    };

    // إنشاء الفاتورة وخصم المخزون داخل transaction واحدة
    const handleSubmit = useCallback(async () => {
        if (items.length === 0 || loading) {
            return;
        }

        setLoading(true);

        try {
            const invoiceNum = `INV-${Date.now()
                .toString()
                .slice(-6)}`;

            const saleItems = items.map((item) => ({
                product_id: item.product_id,
                product_name: item.product_name || 'منتج بدون اسم',
                barcode: item.barcode || '',
                price: Number(item.price) || 0,
                cost_price: Number(item.cost_price) || 0,
                quantity: Number(item.quantity) || 0,
                total: Number(item.total) || 0,
            }));

            const normalizedTotal = Number(totalAmount) || 0;
            if (paidAmount > 0 && !accountId) {
                throw new Error('اختر الحساب أو الخزينة التي استلمت قيمة البيع.');
            }

            const saleData = {
                invoice_number: invoiceNum,
                customer_id: selectedCustomerId || null,
                customer_name:
                    customerName.trim() || 'عميل نقدي',
                items: saleItems,

                subtotal: Number(subTotal) || 0,
                total_discount: Number(discount) || 0,
                total_amount: normalizedTotal,
                paid_amount: paidAmount,
                remaining_amount: remainingAmount,

                total: normalizedTotal,
                payment_type: paymentMethod,
                payment_status: paymentStatus,
                account_id: accountId,
                notes: notes.trim(),
                created_by: user?.uid || null,
            };

            await runTransaction(db, async (transaction) => {
                const productSnapshots = [];
                const customerRef = selectedCustomerId ? doc(db, 'customers', selectedCustomerId) : null;
                const customerSnap = customerRef ? await transaction.get(customerRef) : null;
                if (customerRef && !customerSnap.exists()) {
                    throw new Error('العميل المحدد غير موجود.');
                }

                // 1. قراءة كل المنتجات والتحقق من المخزون
                for (const item of saleItems) {
                    const productRef = doc(
                        db,
                        'products',
                        item.product_id
                    );

                    const productSnap =
                        await transaction.get(productRef);

                    if (!productSnap.exists()) {
                        throw new Error(
                            `المنتج "${item.product_name}" لم يعد موجودًا في المخزون`
                        );
                    }

                    const productData = productSnap.data();

                    // دعم schema:
                    // stock / current_stock
                    const hasStockField =
                        Object.prototype.hasOwnProperty.call(
                            productData,
                            'stock'
                        );

                    const stockField = hasStockField
                        ? 'stock'
                        : 'current_stock';

                    const currentStock = Number(
                        productData[stockField] ?? 0
                    );

                    const requestedQuantity =
                        Number(item.quantity) || 0;

                    if (requestedQuantity <= 0) {
                        throw new Error(
                            `الكمية غير صحيحة للمنتج "${item.product_name}"`
                        );
                    }

                    if (requestedQuantity > currentStock) {
                        throw new Error(
                            `المخزون غير كافٍ للمنتج "${item.product_name}". المتاح: ${currentStock}`
                        );
                    }

                    productSnapshots.push({
                        ref: productRef,
                        stockField,
                        currentStock,
                        quantity: requestedQuantity,
                        item,
                    });
                }

                // 2. خصم الكمية من المخزون
                for (const product of productSnapshots) {
                    const newStock =
                        product.currentStock -
                        product.quantity;

                    transaction.update(product.ref, {
                        stock: newStock,
                        current_stock: newStock,
                        last_update: serverTimestamp(),
                        updated_at: serverTimestamp(),
                    });

                    transaction.set(doc(collection(db, 'inventory_movements')), withTenant({
                        product_id: product.item.product_id,
                        product_name: product.item.product_name,
                        quantity: product.quantity,
                        direction: 'out',
                        movement_type: 'sale',
                        reference_type: 'sale',
                        created_by: user?.uid || '',
                        created_at: serverTimestamp(),
                    }));

                    if (newStock <= Number(product.item.min_stock_level ?? 5)) {
                        transaction.set(doc(collection(db, 'notifications')), withTenant({
                            type: 'low_stock',
                            message: `انخفض مخزون ${product.item.product_name} إلى ${newStock}`,
                            severity: newStock <= 0 ? 'critical' : 'warning',
                            channel: 'system',
                            recipient_type: 'system',
                            recipient_id: null,
                            metadata: { product_id: product.item.product_id, current_stock: newStock },
                            is_read: false,
                            created_at: serverTimestamp(),
                        }));
                    }
                }

                // 3. إنشاء الفاتورة
                const salesRef = doc(
                    collection(db, 'sales')
                );

                transaction.set(salesRef, withTenant({
                    ...saleData,
                    // صفحة المبيعات الحالية تقرأ created_at،
                    // ونحتفظ بـ created_date للتوافق مع الكود القديم.
                    created_at: serverTimestamp(),
                    created_date: serverTimestamp(),
                    updated_at: serverTimestamp(),
                }));

                if (customerRef && remainingAmount > 0) {
                    transaction.update(customerRef, {
                        balance: increment(remainingAmount),
                        current_balance: increment(remainingAmount),
                        last_update: serverTimestamp(),
                    });
                    transaction.set(doc(collection(db, 'debts')), withTenant({
                        party_id: selectedCustomerId,
                        party_name: customerName,
                        party_type: 'customer',
                        source_type: 'sale',
                        source_id: salesRef.id,
                        invoice_number: invoiceNum,
                        amount: normalizedTotal,
                        paid_amount: paidAmount,
                        remaining_amount: remainingAmount,
                        direction: 'owed_to_us',
                        status: paidAmount > 0 ? 'partial' : 'pending',
                        due_date: '',
                        description: `مديونية فاتورة بيع ${invoiceNum}`,
                        created_by: user?.uid || '',
                        created_at: serverTimestamp(),
                    }));
                }

                if (paidAmount > 0) {
                    const accountRef = doc(db, 'accounts', accountId);
                    const accountSnap = await transaction.get(accountRef);
                    if (!accountSnap.exists()) throw new Error('حساب التحصيل غير موجود.');
                    transaction.update(accountRef, { balance: increment(paidAmount), updated_at: serverTimestamp() });
                    transaction.set(doc(collection(db, 'cashflow')), withTenant({
                        amount: paidAmount,
                        type: 'sale_payment',
                        account_id: accountId,
                        related_document: salesRef.id,
                        description: `تحصيل فاتورة بيع ${invoiceNum}`,
                        timestamp: serverTimestamp(),
                    }));
                }
            });

            const savedSale = {
                ...saleData,
                created_at: new Date(),
                created_date: new Date(),
            };

            setLastSavedSale(savedSale);

            setItems([]);
            setProductSearch('');
            setBarcodeInput('');
            setSelectedCustomerId(null);
            setCustomerName('عميل نقدي');
            setPaymentMethod('cash');
            setPaymentStatus('paid');
            setPartialPaidAmount('');
            setAccountId('');
            setDiscount(0);
            setNotes('');

            qc.invalidateQueries({
                queryKey: ['sales'],
            });

            qc.invalidateQueries({
                queryKey: ['products'],
            });

            toast({
                title: 'تم حفظ الفاتورة بنجاح',
                description: `رقم الفاتورة: ${invoiceNum}`,
            });
        } catch (error) {
            console.error('Create Sale Error:', error);

            toast({
                title: 'خطأ في إنشاء الفاتورة',
                description:
                    error?.message ||
                    'حدث خطأ أثناء حفظ الفاتورة',
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    }, [
        items,
        loading,
        customerName,
        totalAmount,
        paidAmount,
        remainingAmount,
        paymentStatus,
        accountId,
        user,
        qc,
        toast,
        discount,
        notes,
        paymentMethod,
        selectedCustomerId,
        subTotal,
    ]);

    // F10 لإتمام البيع
    useEffect(() => {
        if (!open) {
            return;
        }

        const handleKeyDown = (e) => {
            if (e.key === 'F10') {
                e.preventDefault();

                if (items.length > 0) {
                    handleSubmit();
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [open, items.length, handleSubmit]);

    useEffect(() => {
        if (lastSavedSale) {
            handlePrint();
        }
    }, [lastSavedSale, handlePrint]);

    return (
        <>
            <Dialog
                open={open}
                onOpenChange={(val) =>
                    !loading && onOpenChange(val)
                }
            >
                <DialogContent
                    className="max-w-6xl overflow-hidden rounded-3xl p-0"
                    dir="rtl"
                >
                    {/* Header */}
                    <DialogHeader className="border-b bg-card-muted p-6 dark:border-slate-800 ">
                        <DialogTitle className="flex items-center gap-2 text-xl font-black">
                            <ShoppingCart
                                className="text-indigo-600 dark:text-indigo-400"
                                aria-hidden="true"
                            />
                            فاتورة جديدة
                        </DialogTitle>
                    </DialogHeader>

                    <div className="grid h-[75vh] grid-cols-1 gap-0 md:grid-cols-4">
                        {/* منطقة المنتجات */}
                        <div className="flex flex-col gap-4 overflow-hidden p-6 md:col-span-3">
                            {/* البحث اليدوي */}
                            <div className="relative">
                                <Search className="absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-indigo-500" />

                                <Input
                                    autoFocus
                                    placeholder="ابحث عن المنتج بالاسم أو SKU..."
                                    value={productSearch}
                                    onChange={(e) =>
                                        setProductSearch(e.target.value)
                                    }
                                    className="h-14 rounded-2xl border-2 pe-10 text-lg focus:border-indigo-500"
                                />
                            </div>

                            {/* قائمة المنتجات */}
                            <div className="max-h-52 overflow-y-auto rounded-2xl border bg-card dark:border-slate-800 ">
                                {filteredProducts.length === 0 ? (
                                    <div className="p-6 text-center text-sm text-muted-foreground">
                                        لا توجد منتجات مطابقة
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-2 lg:grid-cols-3">
                                        {filteredProducts.map((product) => (
                                            <button
                                                key={product.id}
                                                type="button"
                                                onClick={() => addItem(product)}
                                                disabled={
                                                    product.normalizedStock <= 0
                                                }
                                                className="rounded-xl border p-3 text-right transition hover:border-indigo-400 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:hover:bg-slate-800"
                                            >
                                                <div className="flex items-start justify-between gap-2">
                                                    <div>
                                                        <p className="font-bold">
                                                            {product.normalizedName}
                                                        </p>

                                                        {product.normalizedBarcode && (
                                                            <p className="mt-1 text-[10px] text-muted-foreground">
                                                                {product.normalizedBarcode}
                                                            </p>
                                                        )}
                                                    </div>

                                                    <Plus className="h-4 w-4 text-indigo-500" />
                                                </div>

                                                <div className="mt-2 flex justify-between text-xs">
                                                    <span className="font-bold text-indigo-600">
                                                        {product.normalizedPrice.toLocaleString()}{' '}
                                                        ج.م
                                                    </span>

                                                    <span
                                                        className={
                                                            product.normalizedStock > 0
                                                                ? 'text-emerald-600'
                                                                : 'text-red-500'
                                                        }
                                                    >
                                                        المخزون:{' '}
                                                        {product.normalizedStock}
                                                    </span>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Barcode اختياري */}
                            <form
                                onSubmit={handleBarcodeSubmit}
                                className="relative"
                            >
                                <ScanBarcode className="absolute end-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />

                                <Input
                                    ref={barcodeRef}
                                    placeholder="اختياري: امسح الباركود لإضافة المنتج بسرعة"
                                    value={barcodeInput}
                                    onChange={(e) =>
                                        setBarcodeInput(e.target.value)
                                    }
                                    className="h-11 rounded-xl pe-10"
                                />
                            </form>

                            {/* السلة */}
                            <div className="flex-1 overflow-y-auto rounded-2xl border bg-card-muted/30 dark:border-slate-800 ">
                                {items.length === 0 ? (
                                    <div className="flex h-full flex-col items-center justify-center gap-2 py-16 text-center">
                                        <PackageX className="h-10 w-10 text-muted-foreground/60" />

                                        <p className="text-sm font-bold text-muted-foreground">
                                            الفاتورة فارغة
                                        </p>

                                        <p className="text-xs text-muted-foreground">
                                            ابحث عن منتج واضغط عليه لإضافته
                                        </p>
                                    </div>
                                ) : (
                                    <Table>
                                        <TableHeader className="sticky top-0 bg-card shadow-sm ">
                                            <TableRow>
                                                <TableHead>المنتج</TableHead>

                                                <TableHead className="text-center">
                                                    السعر
                                                </TableHead>

                                                <TableHead className="text-center">
                                                    الكمية
                                                </TableHead>

                                                <TableHead className="text-end">
                                                    الإجمالي
                                                </TableHead>

                                                <TableHead className="w-10" />
                                            </TableRow>
                                        </TableHeader>

                                        <TableBody>
                                            {items.map((item) => (
                                                <TableRow key={item.product_id}>
                                                    <TableCell>
                                                        <div>
                                                            <p className="font-bold">
                                                                {item.product_name}
                                                            </p>

                                                            {item.barcode && (
                                                                <p className="text-[10px] text-muted-foreground">
                                                                    {item.barcode}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </TableCell>

                                                    <TableCell className="text-center">
                                                        {Number(
                                                            item.price || 0
                                                        ).toLocaleString()}{' '}
                                                        ج.م
                                                    </TableCell>

                                                    <TableCell>
                                                        <div className="flex items-center justify-center gap-2">
                                                            <Button
                                                                type="button"
                                                                size="icon"
                                                                variant="outline"
                                                                className="h-8 w-8"
                                                                onClick={() =>
                                                                    decreaseQuantity(
                                                                        item.product_id
                                                                    )
                                                                }
                                                            >
                                                                <Minus className="h-3 w-3" />
                                                            </Button>

                                                            <span className="w-8 text-center font-black">
                                                                {item.quantity}
                                                            </span>

                                                            <Button
                                                                type="button"
                                                                size="icon"
                                                                variant="outline"
                                                                className="h-8 w-8"
                                                                onClick={() =>
                                                                    increaseQuantity(
                                                                        item.product_id
                                                                    )
                                                                }
                                                            >
                                                                <Plus className="h-3 w-3" />
                                                            </Button>
                                                        </div>

                                                        <p className="mt-1 text-center text-[10px] text-muted-foreground">
                                                            المتاح:{' '}
                                                            {item.available_stock}
                                                        </p>
                                                    </TableCell>

                                                    <TableCell className="text-end font-black text-indigo-600">
                                                        {Number(
                                                            item.total || 0
                                                        ).toLocaleString()}{' '}
                                                        ج.م
                                                    </TableCell>

                                                    <TableCell>
                                                        <Button
                                                            type="button"
                                                            size="icon"
                                                            variant="ghost"
                                                            onClick={() =>
                                                                removeItem(
                                                                    item.product_id
                                                                )
                                                            }
                                                            className="text-red-400 hover:text-red-600"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                )}
                            </div>
                        </div>

                        {/* الدفع */}
                        <div className="flex flex-col justify-between border-s bg-card-muted p-6 dark:border-slate-800 ">
                            <div className="space-y-6">
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <div className="space-y-2">
                                        <label className="text-xs font-black text-muted-foreground">
                                            العميل
                                        </label>

                                        <Select
                                            value={selectedCustomerId || ''}
                                            onValueChange={(value) => {
                                                if (!value) {
                                                    setSelectedCustomerId(null);
                                                    setCustomerName('عميل نقدي');
                                                    return;
                                                }

                                                const selected = customers.find(
                                                    (c) => c.id === value
                                                );
                                                setSelectedCustomerId(value);
                                                setCustomerName(
                                                    selected?.name || 'عميل نقدي'
                                                );
                                            }}
                                        >
                                            <SelectTrigger className="h-12 rounded-xl bg-card ">
                                                <SelectValue placeholder="اختر العميل" />
                                            </SelectTrigger>

                                            <SelectContent>
                                                <SelectItem value="">
                                                    عميل نقدي
                                                </SelectItem>
                                                {customers.map((customer) => (
                                                    <SelectItem
                                                        key={customer.id}
                                                        value={customer.id}
                                                    >
                                                        {customer.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-black text-muted-foreground">
                                            اسم العميل
                                        </label>

                                        <Input
                                            value={customerName}
                                            onChange={(e) => {
                                                setSelectedCustomerId(null);
                                                setCustomerName(e.target.value);
                                            }}
                                            className="h-12 rounded-xl bg-card "
                                            placeholder="اسم العميل"
                                        />
                                    </div>
                                </div>

                                <div className="grid gap-4 sm:grid-cols-2">
                                    <div className="space-y-2">
                                        <label className="text-xs font-black text-muted-foreground">
                                            طريقة الدفع
                                        </label>

                                        <Select
                                            value={paymentMethod}
                                            onValueChange={setPaymentMethod}
                                        >
                                            <SelectTrigger className="h-12 rounded-xl bg-card ">
                                                <SelectValue placeholder="اختر الطريقة" />
                                            </SelectTrigger>

                                            <SelectContent>
                                                <SelectItem value="cash">
                                                    نقدي
                                                </SelectItem>
                                                <SelectItem value="bank_transfer">
                                                    تحويل بنكي
                                                </SelectItem>
                                                <SelectItem value="credit">
                                                    آجل
                                                </SelectItem>
                                                <SelectItem value="instapay">
                                                    إنستاباي
                                                </SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-black text-muted-foreground">
                                            حالة الدفع
                                        </label>

                                        <Select
                                            value={paymentStatus}
                                            onValueChange={setPaymentStatus}
                                        >
                                            <SelectTrigger className="h-12 rounded-xl bg-card ">
                                                <SelectValue placeholder="اختر الحالة" />
                                            </SelectTrigger>

                                            <SelectContent>
                                                <SelectItem value="paid">
                                                    مدفوع
                                                </SelectItem>
                                                <SelectItem value="partial">
                                                    مدفوع جزئياً
                                                </SelectItem>
                                                <SelectItem value="unpaid">
                                                    غير مدفوع
                                                </SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {paymentStatus === 'partial' && <div className="space-y-2">
                                        <label className="text-xs font-black text-muted-foreground">المبلغ المدفوع</label>
                                        <Input
                                            type="number"
                                            min="0"
                                            max={totalAmount}
                                            value={partialPaidAmount}
                                            onChange={(e) => setPartialPaidAmount(e.target.value)}
                                            className="h-12 rounded-xl bg-card "
                                            placeholder="0"
                                        />
                                    </div>}

                                    {paymentStatus !== 'unpaid' && <div className="space-y-2">
                                        <label className="text-xs font-black text-muted-foreground">حساب التحصيل</label>
                                        <Select value={accountId} onValueChange={setAccountId}>
                                            <SelectTrigger className="h-12 rounded-xl bg-card "><SelectValue placeholder="اختر الخزينة أو البنك" /></SelectTrigger>
                                            <SelectContent>{accounts.map((account) => <SelectItem key={account.id} value={account.id}>{account.name}</SelectItem>)}</SelectContent>
                                        </Select>
                                    </div>}
                                </div>

                                <div className="grid gap-4 sm:grid-cols-2">
                                    <div className="space-y-2">
                                        <label className="text-xs font-black text-muted-foreground">
                                            الخصم
                                        </label>
                                        <Input
                                            type="number"
                                            value={discount}
                                            onChange={(e) =>
                                                setDiscount(Number(e.target.value))
                                            }
                                            className="h-12 rounded-xl bg-card "
                                            placeholder="0"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-black text-muted-foreground">
                                            الملاحظات
                                        </label>
                                        <textarea
                                            value={notes}
                                            onChange={(e) => setNotes(e.target.value)}
                                            className="h-12 w-full resize-none rounded-2xl border border-border bg-card px-4 py-3 text-sm text-foreground outline-none transition focus:border-indigo-500 "
                                            placeholder="ملاحظات إضافية..."
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* الإجمالي */}
                        <div className="space-y-4 border-t pt-6 dark:border-slate-800">
                            <div className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4 text-sm dark:border-indigo-900/50 dark:bg-indigo-950/20">
                                <span className="text-muted-foreground">الحساب القديم</span>
                                <span className="text-end font-bold">{previousBalance.toLocaleString()} ج.م</span>
                                <span className="text-muted-foreground">إجمالي الفاتورة</span>
                                <span className="text-end font-bold">{totalAmount.toLocaleString()} ج.م</span>
                                <span className="text-emerald-600">المدفوع</span>
                                <span className="text-end font-bold text-emerald-600">{paidAmount.toLocaleString()} ج.م</span>
                                <span className="text-rose-600">المتبقي</span>
                                <span className="text-end font-bold text-rose-600">{remainingAmount.toLocaleString()} ج.م</span>
                                <span className="border-t pt-2 font-bold text-secondary-text ">الحساب بعد الفاتورة</span>
                                <span className="border-t pt-2 text-end font-black text-indigo-600">{balanceAfterSale.toLocaleString()} ج.م</span>
                            </div>
                            <div className="flex items-end justify-between">
                                <span className="font-bold text-muted-foreground">
                                    الإجمالي
                                </span>

                                <div className="text-end">
                                    <span className="text-3xl font-black text-foreground ">
                                        {totalAmount.toLocaleString()}
                                    </span>

                                    <span className="ms-1 text-sm font-bold text-muted-foreground">
                                        ج.م
                                    </span>
                                </div>
                            </div>

                            <Button
                                type="button"
                                onClick={handleSubmit}
                                className="h-16 w-full rounded-2xl bg-indigo-600 text-xl font-black shadow-lg hover:bg-indigo-700"
                                disabled={
                                    loading || items.length === 0
                                }
                            >
                                {loading ? (
                                    <Loader2 className="animate-spin" />
                                ) : (
                                    'إتمام البيع (F10)'
                                )}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <div className="absolute left-[-10000px] top-0 h-0 w-0 overflow-hidden">
                <div
                    ref={printRef}
                    className="w-[80mm] bg-card p-6 text-black"
                    dir="rtl"
                    style={{
                        fontFamily: 'Arial, sans-serif',
                    }}
                >
                    <div className="mb-4 border-b-2 border-black pb-4 text-center">
                        <h1 className="text-2xl font-black">
                            NEXORA ERP
                        </h1>

                        <p className="text-xs">
                            نظام إدارة متكامل
                        </p>
                    </div>

                    <div className="mb-4 space-y-1 text-[12px]">
                        <div className="flex justify-between">
                            <span>الفاتورة:</span>

                            <b>
                                {lastSavedSale?.invoice_number}
                            </b>
                        </div>

                        <div className="flex justify-between">
                            <span>التاريخ:</span>

                            <span>
                                {new Date().toLocaleString('ar-EG')}
                            </span>
                        </div>

                        <div className="flex justify-between">
                            <span>العميل:</span>

                            <b>
                                {lastSavedSale?.customer_name}
                            </b>
                        </div>
                    </div>

                    <table className="mb-4 w-full text-[11px]">
                        <thead>
                            <tr className="border-b border-black">
                                <th className="py-2 text-right">
                                    الصنف
                                </th>

                                <th className="text-center">
                                    كمية
                                </th>

                                <th className="text-left">
                                    إجمالي
                                </th>
                            </tr>
                        </thead>

                        <tbody>
                            {lastSavedSale?.items?.map(
                                (item, i) => (
                                    <tr
                                        key={i}
                                        className="border-b border-dotted border-border-strong"
                                    >
                                        <td className="py-2">
                                            {item.product_name}
                                        </td>

                                        <td className="text-center">
                                            {item.quantity}
                                        </td>

                                        <td className="text-left font-bold">
                                            {Number(
                                                item.total || 0
                                            ).toLocaleString()}
                                        </td>
                                    </tr>
                                )
                            )}
                        </tbody>
                    </table>

                    <div className="border-t border-black pt-2 text-right">
                        <div className="flex justify-between text-lg font-black">
                            <span>الإجمالي:</span>

                            <span>
                                {Number(
                                    lastSavedSale?.total || 0
                                ).toLocaleString()}{' '}
                                ج.م
                            </span>
                        </div>
                    </div>

                    <div className="mt-8 border-t border-dashed pt-4 text-center">
                        <p className="text-[10px]">
                            شكرًا لتعاملكم معنا!
                        </p>

                        <p className="mt-1 text-[9px] italic">
                            Powered by Nexora ERP
                        </p>
                    </div>
                </div>
            </div>
        </>
    );
}
