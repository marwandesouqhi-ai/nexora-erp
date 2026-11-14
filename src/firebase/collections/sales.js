import { collection, getDocs, getDoc, doc, where, increment, runTransaction, serverTimestamp, updateDoc } from 'firebase/firestore';

import { db } from '../firebaseConfig';
import { deductFromVanInventory } from './van_inventory';
import { fetchTenantDocs, withTenant, createTenantQuery } from '@/lib/tenantFirestore';

const SALES_COLLECTION = 'sales';
const PRODUCTS_COLLECTION = 'products';

const parseTimestampDate = (val) => {
    if (!val) return 0;
    if (val.toMillis) return val.toMillis();
    if (val.toDate) return val.toDate().getTime();
    const d = new Date(val);
    return isNaN(d.getTime()) ? 0 : d.getTime();
};

/* =========================================================
   NORMALIZE SALE
========================================================= */

export const normalizeSale = (
    sale = {},
    id = null,
    isField = false
) => {
    const total = Number(
        sale?.total_amount ??
        sale?.total ??
        0
    );

    const paidAmount = Number(
        sale?.paid_amount ??
        sale?.paid ??
        (
            sale?.payment_status === 'paid'
                ? total
                : 0
        )
    );

    const remainingAmount = Number(
        sale?.remaining_amount ??
        Math.max(
            total - paidAmount,
            0
        )
    );

    const items = Array.isArray(
        sale?.items
    )
        ? sale.items.map((item) => {
            const quantity = Number(
                item?.quantity ??
                item?.qty ??
                0
            );

            const price = Number(
                item?.price ??
                item?.selling_price ??
                0
            );

            return {
                ...item,

                product_id:
                    item?.product_id ??
                    item?.productId ??
                    '',

                product_name:
                    item?.product_name ??
                    item?.productName ??
                    item?.name ??
                    'منتج بدون اسم',

                quantity,

                price,

                cost_price: Number(
                    item?.cost_price ??
                    item?.cost ??
                    item?.purchase_price ??
                    0
                ),

                total: Number(
                    item?.total ??
                    quantity * price
                ),
            };
        })
        : [];

    let paymentStatus =
        sale?.payment_status;

    if (!paymentStatus) {
        if (remainingAmount <= 0) {
            paymentStatus = 'paid';
        } else if (paidAmount > 0) {
            paymentStatus = 'partial';
        } else {
            paymentStatus = 'unpaid';
        }
    }

    return {
        id,

        ...sale,

        invoice_number:
            sale?.invoice_number ??
            sale?.invoiceNumber ??
            '',

        customer_id:
            sale?.customer_id ??
            sale?.customerId ??
            null,

        customer_name:
            sale?.customer_name ??
            sale?.customerName ??
            'عميل نقدي',

        items,

        total,

        total_amount: total,

        paid_amount:
            paidAmount,

        remaining_amount:
            remainingAmount,

        payment_status:
            paymentStatus,

        created_by:
            sale?.created_by ??
            sale?.createdBy ??
            null,

        created_at:
            sale?.created_at ??
            sale?.created_date ??
            null,

        created_date:
            sale?.created_date ??
            sale?.created_at ??
            null,

        is_field_invoice: Boolean(sale?.is_field_invoice || isField || sale?.employeeId || sale?.employee_id),
        source: sale?.source || ((isField || sale?.employeeId || sale?.employee_id) ? 'field' : 'pos'),
        employee_id: sale?.employee_id ?? sale?.employeeId ?? null,
        employee_name: sale?.employee_name ?? sale?.employeeName ?? '',
        payment_type: sale?.payment_type ?? sale?.paymentType ?? (remainingAmount > 0 ? 'credit' : 'cash'),
        company_id: sale?.company_id ?? '',
    };
};

/* =========================================================
   CREATE SALES INVOICE
   - Creates sale
   - Decreases product stock
   - Supports old/new stock schema
   - Uses Firestore transaction
========================================================= */

export const createSalesInvoice = async (
    saleData = {}
) => {
    try {
        if (
            !saleData ||
            !Array.isArray(saleData.items) ||
            saleData.items.length === 0
        ) {
            throw new Error(
                'لا يمكن إنشاء فاتورة بدون منتجات.'
            );
        }

        const items = saleData.items.map((item) => {
            const quantity = Number(
                item?.quantity ??
                item?.qty ??
                0
            );

            const price = Number(
                item?.price ??
                item?.selling_price ??
                0
            );

            const costPrice = Number(
                item?.cost_price ??
                item?.cost ??
                item?.purchase_price ??
                0
            );

            return {
                ...item,

                product_id:
                    item?.product_id ??
                    item?.productId ??
                    item?.id ??
                    '',

                product_name:
                    item?.product_name ??
                    item?.productName ??
                    item?.name ??
                    'منتج بدون اسم',

                barcode:
                    item?.barcode ?? '',

                quantity,

                price,

                cost_price: costPrice,

                total: Number(
                    item?.total ??
                    quantity * price
                ),
            };
        });

        for (const item of items) {
            if (!item.product_id) {
                throw new Error(
                    `المنتج "${item.product_name}" لا يحتوي على ID صالح.`
                );
            }

            if (
                !Number.isFinite(item.quantity) ||
                item.quantity <= 0
            ) {
                throw new Error(
                    `الكمية غير صحيحة للمنتج: ${item.product_name}`
                );
            }
        }

        const total = Number(
            saleData.total_amount ??
            saleData.total ??
            saleData.totalAmount ??
            items.reduce(
                (sum, item) =>
                    sum + item.total,
                0
            )
        );

        const paidAmount = Number(
            saleData.paid_amount ??
            saleData.paid ??
            saleData.paidAmount ??
            (
                saleData.payment_status === 'paid'
                    ? total
                    : 0
            )
        );

        const remainingAmount = Math.max(
            total - paidAmount,
            0
        );

        let paymentStatus =
            saleData.payment_status;

        if (!paymentStatus) {
            if (remainingAmount <= 0) {
                paymentStatus = 'paid';
            } else if (paidAmount > 0) {
                paymentStatus = 'partial';
            } else {
                paymentStatus = 'unpaid';
            }
        }

        const invoiceNumber =
            saleData.invoice_number ||
            `INV-${Date.now()
                .toString()
                .slice(-6)}`;

        const customerName =
            String(
                saleData.customer_name ??
                saleData.customerName ??
                'عميل نقدي'
            ).trim() || 'عميل نقدي';

        const saleRef = doc(
            collection(
                db,
                SALES_COLLECTION
            )
        );
        const customerId = saleData.customer_id ?? saleData.customerId ?? null;
        const customerRef = customerId ? doc(db, 'customers', customerId) : null;
        const debtRef = remainingAmount > 0 ? doc(collection(db, 'debts')) : null;

        await runTransaction(
            db,
            async (transaction) => {
                /*
                 * ==========================================
                 * 1. READ ALL PRODUCTS FIRST
                 * ==========================================
                 */

                const productSnapshots = [];

                for (const item of items) {
                    const productRef = doc(
                        db,
                        PRODUCTS_COLLECTION,
                        item.product_id
                    );

                    const productSnap =
                        await transaction.get(
                            productRef
                        );

                    if (!productSnap.exists()) {
                        throw new Error(
                            `المنتج "${item.product_name}" غير موجود في المخزون.`
                        );
                    }

                    productSnapshots.push({
                        item,
                        ref: productRef,
                        snap: productSnap,
                    });
                }

                const customerSnap = customerRef ? await transaction.get(customerRef) : null;
                if (customerRef && !customerSnap.exists()) {
                    throw new Error('العميل المحدد غير موجود.');
                }

                /*
                 * ==========================================
                 * 2. UPDATE STOCK
                 * ==========================================
                 */

                for (const {
                    item,
                    ref,
                    snap,
                } of productSnapshots) {
                    const product =
                        snap.data();

                    /*
                     * Support both schemas:
                     *
                     * New:
                     * stock
                     *
                     * Old:
                     * current_stock
                     */

                    const hasStock =
                        Object.prototype.hasOwnProperty.call(
                            product,
                            'stock'
                        );

                    const hasCurrentStock =
                        Object.prototype.hasOwnProperty.call(
                            product,
                            'current_stock'
                        );

                    let stockField = 'stock';

                    if (
                        !hasStock &&
                        hasCurrentStock
                    ) {
                        stockField =
                            'current_stock';
                    }

                    const currentStock =
                        Number(
                            product?.[
                            stockField
                            ] ?? 0
                        );

                    if (
                        item.quantity >
                        currentStock
                    ) {
                        throw new Error(
                            `الكمية غير كافية من "${item.product_name}". المتاح: ${currentStock}`
                        );
                    }

                    const newStock =
                        currentStock -
                        item.quantity;

                    const updateData = {
                        stock: newStock,
                        current_stock: newStock,

                        last_update:
                            serverTimestamp(),

                        updated_at:
                            serverTimestamp(),
                    };

                    /*
                     * Keep both fields synchronized
                     * when the product already has both.
                     */

                    transaction.update(
                        ref,
                        updateData
                    );

                    transaction.set(doc(collection(db, 'inventory_movements')), withTenant({
                        product_id: item.product_id,
                        product_name: item.product_name,
                        quantity: item.quantity,
                        direction: 'out',
                        movement_type: 'sale',
                        reference_id: saleRef.id,
                        reference_type: 'sale',
                        created_by: saleData.created_by ?? saleData.createdBy ?? '',
                        created_at: serverTimestamp(),
                    }));

                    if (newStock <= Number(product.min_stock_level ?? product.min_stock ?? 5)) {
                        transaction.set(doc(collection(db, 'notifications')), withTenant({
                            type: 'low_stock',
                            message: `انخفض مخزون ${item.product_name} إلى ${newStock}`,
                            severity: newStock <= 0 ? 'critical' : 'warning',
                            channel: 'system',
                            recipient_type: 'system',
                            recipient_id: null,
                            metadata: { product_id: item.product_id, current_stock: newStock },
                            is_read: false,
                            created_at: serverTimestamp(),
                        }));
                    }
                }

                /*
                 * ==========================================
                 * 3. CREATE SALE DOCUMENT
                 * ==========================================
                 */

                transaction.set(
                    saleRef,
                    withTenant({
                        invoice_number:
                            invoiceNumber,

                        customer_id: customerId,

                        customer_name:
                            customerName,

                        items,

                        total,

                        total_amount:
                            total,

                        paid_amount:
                            paidAmount,

                        remaining_amount:
                            remainingAmount,

                        payment_status:
                            paymentStatus,

                        payment_method:
                            saleData.payment_method ??
                            saleData.paymentType ??
                            'cash',

                        created_by:
                            saleData.created_by ??
                            saleData.createdBy ??
                            null,

                        created_date:
                            serverTimestamp(),

                        created_at:
                            serverTimestamp(),
                    })
                );

                if (customerRef && remainingAmount > 0) {
                    transaction.update(customerRef, {
                        balance: increment(remainingAmount),
                        current_balance: increment(remainingAmount),
                        last_update: serverTimestamp(),
                    });
                    transaction.set(debtRef, withTenant({
                        party_id: customerId,
                        party_name: customerName,
                        party_type: 'customer',
                        source_type: 'sale',
                        source_id: saleRef.id,
                        invoice_number: invoiceNumber,
                        amount: total,
                        paid_amount: paidAmount,
                        remaining_amount: remainingAmount,
                        direction: 'owed_to_us',
                        status: paidAmount > 0 ? 'partial' : 'pending',
                        due_date: '',
                        description: `مديونية فاتورة بيع ${invoiceNumber}`,
                        created_by: saleData.created_by ?? saleData.createdBy ?? '',
                        created_at: serverTimestamp(),
                    }));
                }
            }
        );

        return {
            success: true,
            id: saleRef.id,

            invoice_number:
                invoiceNumber,

            total,

            paid_amount:
                paidAmount,

            remaining_amount:
                remainingAmount,

            payment_status:
                paymentStatus,
        };
    } catch (error) {
        console.error(
            'Error creating sales invoice:',
            error
        );

        return {
            success: false,
            error,
            message:
                error?.message ||
                'حدث خطأ أثناء إنشاء الفاتورة.',
        };
    }
};

/* =========================================================
   GET SALES
========================================================= */

export const getSales = async (companyId = null) => {
    try {
        const [salesDocs, invoicesDocs] = await Promise.all([
            fetchTenantDocs(SALES_COLLECTION, { companyId }),
            fetchTenantDocs('invoices', { companyId }),
        ]);

        const combinedSales = [];

        salesDocs.forEach((docData) => {
            combinedSales.push(normalizeSale(docData, docData.id, false));
        });

        invoicesDocs.forEach((docData) => {
            combinedSales.push(normalizeSale(docData, docData.id, true));
        });

        return combinedSales.sort((a, b) => {
            const timeA = parseTimestampDate(a.created_at ?? a.created_date ?? a.date);
            const timeB = parseTimestampDate(b.created_at ?? b.created_date ?? b.date);
            return timeB - timeA;
        });
    } catch (error) {
        console.error('Error getting combined sales & invoices:', error);
        return [];
    }
};

/**
 * معالجة فاتورة مبيعات ميدانية: خصم الكميات من مخزن سيارة المندوب (van_inventory)
 * وزيادة مديونية العميل بالمبلغ المتبقي الآجل في جدول customers
 */
export const processFieldInvoiceDeduction = async (invoiceData = {}) => {
    try {
        const repId = invoiceData.employeeId || invoiceData.employee_id;
        const customerId = invoiceData.customerId || invoiceData.customer_id;
        const remaining = Number(invoiceData.remainingAmount ?? invoiceData.remaining_amount ?? 0);
        const items = invoiceData.items || [];

        // 1. الخصم من مخزن سيارة المندوب (وليس المخزن المركزي)
        if (repId && Array.isArray(items) && items.length > 0) {
            for (const item of items) {
                const prodId = item.productId || item.product_id;
                const qty = Number(item.quantity || item.qty || 0);
                if (prodId && qty > 0) {
                    await deductFromVanInventory(repId, prodId, qty);
                }
            }
        }

        // 2. تحديث مديونية العميل بالمبلغ الآجل المتبقي
        if (customerId && remaining > 0) {
            const custRef = doc(db, 'customers', customerId);
            await updateDoc(custRef, {
                balance: increment(remaining),
                current_balance: increment(remaining),
                updated_at: serverTimestamp(),
            });
        }

        return { success: true };
    } catch (error) {
        console.error('Error processing field invoice deduction:', error);
        return { success: false, error };
    }
};


/* =========================================================
   GET ONE SALE
========================================================= */

export const getSaleById = async (
    id
) => {
    try {
        if (!id) {
            return null;
        }

        const saleRef =
            doc(
                db,
                SALES_COLLECTION,
                id
            );

        const snapshot =
            await getDoc(saleRef);

        if (!snapshot.exists()) {
            return null;
        }

        return normalizeSale(
            snapshot.data(),
            snapshot.id
        );
    } catch (error) {
        console.error(
            'Error getting sale:',
            error
        );

        return null;
    }
};

/* =========================================================
   DELETE SALE
========================================================= */

export const deleteSale = async (
    id
) => {
    try {
        if (!id) {
            throw new Error(
                'Sale ID is required.'
            );
        }

        const saleRef = doc(db, SALES_COLLECTION, id);
        const debtsSnapshot = await getDocs(createTenantQuery('debts', where('source_id', '==', id)));

        await runTransaction(db, async (transaction) => {
            const saleSnapshot = await transaction.get(saleRef);
            if (!saleSnapshot.exists()) throw new Error('الفاتورة غير موجودة.');

            const sale = saleSnapshot.data();
            const productRefs = (sale.items || [])
                .map((item) => ({ item, ref: doc(db, PRODUCTS_COLLECTION, item.product_id || item.id) }))
                .filter(({ item }) => item.product_id || item.id);
            const productSnapshots = await Promise.all(productRefs.map(({ ref }) => transaction.get(ref)));

            productSnapshots.forEach((snapshot, index) => {
                if (!snapshot.exists()) {
                    throw new Error(`الصنف ${productRefs[index].item.product_name || ''} غير موجود.`);
                }
            });

            productRefs.forEach(({ item, ref }) => {
                const quantity = Number(item.quantity) || 0;
                transaction.update(ref, {
                    stock: increment(quantity),
                    current_stock: increment(quantity),
                    updated_at: serverTimestamp(),
                    last_update: serverTimestamp(),
                });
                transaction.set(doc(collection(db, 'inventory_movements')), withTenant({
                    product_id: item.product_id || item.id,
                    product_name: item.product_name || item.name || '',
                    quantity,
                    direction: 'in',
                    movement_type: 'sale_reversal',
                    reference_id: id,
                    reference_type: 'sale',
                    created_by: sale.created_by || '',
                    created_at: serverTimestamp(),
                }));
            });

            const remaining = Number(sale.remaining_amount) || 0;
            if (sale.customer_id && remaining > 0) {
                transaction.update(doc(db, 'customers', sale.customer_id), {
                    balance: increment(-remaining),
                    current_balance: increment(-remaining),
                    updated_at: serverTimestamp(),
                    last_update: serverTimestamp(),
                });
            }

            const paid = Number(sale.paid_amount) || 0;
            if (sale.account_id && paid > 0) {
                transaction.update(doc(db, 'accounts', sale.account_id), {
                    balance: increment(-paid),
                    updated_at: serverTimestamp(),
                });
                transaction.set(doc(collection(db, 'cashflow')), withTenant({
                    amount: -paid,
                    type: 'sale_payment_reversal',
                    entry_type: 'reversal',
                    account_id: sale.account_id,
                    related_document: id,
                    description: `عكس تحصيل فاتورة بيع ${sale.invoice_number || id}`,
                    timestamp: serverTimestamp(),
                }));
            }

            debtsSnapshot.docs.forEach((debt) => transaction.delete(debt.ref));
            transaction.delete(saleRef);
            transaction.set(doc(collection(db, 'activity_logs')), withTenant({
                action: 'delete_invoice',
                entity_type: 'Sale',
                details: `حذف فاتورة بيع ${sale.invoice_number || id} مع عكس آثارها`,
                user_id: sale.created_by || '',
                timestamp: serverTimestamp(),
            }));
        });

        return {
            success: true,
        };
    } catch (error) {
        console.error(
            'Error deleting sale:',
            error
        );

        throw error;
    }
};

/* =========================================================
   DATE HELPER
========================================================= */

const getTimestampDate = (
    value
) => {
    if (!value) {
        return 0;
    }

    if (
        typeof value?.toDate ===
        'function'
    ) {
        const date =
            value.toDate();

        return Number.isNaN(
            date.getTime()
        )
            ? 0
            : date.getTime();
    }

    if (value instanceof Date) {
        return Number.isNaN(
            value.getTime()
        )
            ? 0
            : value.getTime();
    }

    const date =
        new Date(value);

    return Number.isNaN(
        date.getTime()
    )
        ? 0
        : date.getTime();
};