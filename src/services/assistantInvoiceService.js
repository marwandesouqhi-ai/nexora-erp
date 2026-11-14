import {
    addDoc,
    collection,
    doc,
    getDoc,
    getDocs,
    increment,
    runTransaction,
    serverTimestamp,
    updateDoc,
    where,
} from 'firebase/firestore';
import { db } from '@/api/firebase';
import { createReturnInvoice } from '@/firebase/collections/returns';
import { createSalesInvoice } from '@/firebase/collections/sales';
import { createTenantQuery, withTenant } from '@/lib/tenantFirestore';

const normalizeInvoiceNumber = (value) => String(value || '').trim();

export async function findSaleByInvoiceNumber(invoiceNumber) {
    const normalized = normalizeInvoiceNumber(invoiceNumber);
    if (!normalized) return null;

    const byNumber = await getDocs(createTenantQuery(
        'sales',
        where('invoice_number', '==', normalized)
    ));
    if (!byNumber.empty) {
        return { id: byNumber.docs[0].id, ...byNumber.docs[0].data() };
    }

    const direct = await getDoc(doc(db, 'sales', normalized));
    return direct.exists() ? { id: direct.id, ...direct.data() } : null;
}

export async function updateSaleByInvoiceNumber(invoiceNumber, changes = {}) {
    const sale = await findSaleByInvoiceNumber(invoiceNumber);
    if (!sale) throw new Error(`لم أجد فاتورة برقم ${invoiceNumber}.`);
    if ((Number(sale.returned_amount) || 0) > 0) {
        throw new Error(`لا يمكن تعديل الفاتورة ${invoiceNumber} لأنها تحتوي على مرتجعات مسجلة مسبقاً.`);
    }
    const allowed = {};
    if (changes.customer_name) allowed.customer_name = changes.customer_name;
    if (changes.notes !== undefined) allowed.notes = changes.notes;
    if (changes.payment_status) allowed.payment_status = changes.payment_status;

    let paymentChange = null;
    if (changes.paid_amount !== undefined) {
        const total = Number(sale.total_amount ?? sale.total) || 0;
        const paid = Math.min(Math.max(Number(changes.paid_amount) || 0, 0), total);
        allowed.paid_amount = paid;
        allowed.remaining_amount = Math.max(total - paid, 0);
        allowed.payment_status = paid >= total ? 'paid' : paid > 0 ? 'partial' : 'unpaid';
        paymentChange = {
            oldPaid: Number(sale.paid_amount) || 0,
            oldRemaining: Number(sale.remaining_amount) || 0,
            newPaid: paid,
            newRemaining: allowed.remaining_amount,
        };
    }

    if (!Object.keys(allowed).length) {
        throw new Error('حدد قيمة التعديل: المدفوع أو حالة الدفع أو اسم العميل أو الملاحظات.');
    }

    allowed.updated_at = serverTimestamp();
    if (!paymentChange) {
        await updateDoc(doc(db, 'sales', sale.id), allowed);
        return { ...sale, ...allowed, id: sale.id };
    }

    const debts = await getDocs(createTenantQuery('debts', where('source_id', '==', sale.id)));
    await runTransaction(db, async (transaction) => {
        transaction.update(doc(db, 'sales', sale.id), allowed);

        if (sale.customer_id && paymentChange.newRemaining !== paymentChange.oldRemaining) {
            const balanceDelta = paymentChange.newRemaining - paymentChange.oldRemaining;
            transaction.update(doc(db, 'customers', sale.customer_id), {
                balance: increment(balanceDelta),
                current_balance: increment(balanceDelta),
                updated_at: serverTimestamp(),
                last_update: serverTimestamp(),
            });
        }

        debts.docs.forEach((debt) => transaction.update(debt.ref, {
            paid_amount: paymentChange.newPaid,
            remaining_amount: paymentChange.newRemaining,
            status: paymentChange.newRemaining > 0 ? (paymentChange.newPaid > 0 ? 'partial' : 'pending') : 'settled',
            updated_at: serverTimestamp(),
        }));

        if (sale.account_id && paymentChange.newPaid !== paymentChange.oldPaid) {
            transaction.update(doc(db, 'accounts', sale.account_id), {
                balance: increment(paymentChange.newPaid - paymentChange.oldPaid),
                updated_at: serverTimestamp(),
            });
        }

        transaction.set(doc(collection(db, 'activity_logs')), withTenant({
            action: 'update_invoice_by_assistant',
            entity_type: 'Sale',
            details: `تعديل الفاتورة ${sale.invoice_number || sale.id} بواسطة المساعد`,
            timestamp: serverTimestamp(),
        }));
    });
    return { ...sale, ...allowed, id: sale.id };
}

export async function deleteSaleByInvoiceNumber(invoiceNumber, userId = '') {
    const sale = await findSaleByInvoiceNumber(invoiceNumber);
    if (!sale) throw new Error(`لم أجد فاتورة برقم ${invoiceNumber}.`);
    if ((Number(sale.returned_amount) || 0) > 0) {
        throw new Error(`لا يمكن حذف الفاتورة ${invoiceNumber} لأنها تحتوي على مرتجعات مسجلة مسبقاً.`);
    }
    const debts = await getDocs(createTenantQuery('debts', where('source_id', '==', sale.id)));

    await runTransaction(db, async (transaction) => {
        const saleRef = doc(db, 'sales', sale.id);
        const saleSnap = await transaction.get(saleRef);
        if (!saleSnap.exists()) throw new Error('الفاتورة لم تعد موجودة.');
        const currentSale = saleSnap.data();
        if ((Number(currentSale.returned_amount) || 0) > 0) {
            throw new Error(`لا يمكن حذف الفاتورة ${invoiceNumber} لأنها تحتوي على مرتجعات.`);
        }

        for (const item of currentSale.items || []) {
            if (!item.product_id && !item.id) continue;
            const productRef = doc(db, 'products', item.product_id || item.id);
            transaction.update(productRef, {
                stock: increment(Number(item.quantity) || 0),
                current_stock: increment(Number(item.quantity) || 0),
                updated_at: serverTimestamp(),
                last_update: serverTimestamp(),
            });
        }

        const remaining = Number(currentSale.remaining_amount) || 0;
        if (currentSale.customer_id && remaining > 0) {
            transaction.update(doc(db, 'customers', currentSale.customer_id), {
                balance: increment(-remaining),
                current_balance: increment(-remaining),
                updated_at: serverTimestamp(),
                last_update: serverTimestamp(),
            });
        }

        if (currentSale.account_id && Number(currentSale.paid_amount) > 0) {
            transaction.update(doc(db, 'accounts', currentSale.account_id), {
                balance: increment(-(Number(currentSale.paid_amount) || 0)),
                updated_at: serverTimestamp(),
            });
        }

        debts.docs.forEach((debt) => transaction.delete(debt.ref));
        transaction.delete(saleRef);
        transaction.set(doc(collection(db, 'activity_logs')), withTenant({
            action: 'delete_invoice_by_assistant',
            entity_type: 'Sale',
            details: `حذف الفاتورة ${currentSale.invoice_number || sale.id} بواسطة المساعد`,
            user_id: userId,
            timestamp: serverTimestamp(),
        }));
    });

    return { success: true, invoice_number: sale.invoice_number || sale.id };
}

export async function returnSaleByInvoiceNumber(invoiceNumber, userId = '', reason = 'مرتجع كامل بواسطة المساعد') {
    const sale = await findSaleByInvoiceNumber(invoiceNumber);
    if (!sale) throw new Error(`لم أجد فاتورة برقم ${invoiceNumber}.`);
    const saleTotal = Number(sale.total_amount ?? sale.total) || 0;
    if ((Number(sale.returned_amount) || 0) >= saleTotal) {
        throw new Error('تم إرجاع هذه الفاتورة بالكامل من قبل.');
    }
    const items = (sale.items || []).map((item) => ({
        id: item.product_id || item.id,
        qty: Number(item.quantity) || 0,
        price: Number(item.price) || 0,
        product_name: item.product_name || item.name || 'منتج',
    })).filter((item) => item.id && item.qty > 0);
    if (!items.length) throw new Error('الفاتورة لا تحتوي على أصناف صالحة للمرتجع.');

    const result = await createReturnInvoice({
        salesId: sale.id,
        customerId: sale.customer_id || null,
        customerName: sale.customer_name || 'عميل نقدي',
        items,
        totalAmount: items.reduce((sum, item) => sum + item.qty * item.price, 0),
        reason,
        userId,
    });
    if (!result.success) throw result.error || new Error('تعذر تسجيل المرتجع.');
    return result;
}

export async function createInvoiceFromCommand({ customerName, product, quantity = 1, userId = '' }) {
    if (!product?.id) throw new Error('لم أجد المنتج المطلوب لإنشاء الفاتورة.');
    
    const price = Number(product.selling_price ?? product.sell_price ?? product.price) || 0;
    const total = price * Number(quantity);
    
    let resolvedCustomerId = null;
    let resolvedCustomerName = customerName || 'عميل نقدي';
    
    if (customerName) {
        const custQuery = await getDocs(createTenantQuery('customers', where('name', '==', customerName.trim())));
        if (!custQuery.empty) {
            resolvedCustomerId = custQuery.docs[0].id;
            resolvedCustomerName = custQuery.docs[0].data().name;
        }
    }
    
    let resolvedAccountId = null;
    const accQuery = await getDocs(createTenantQuery('accounts', where('type', '==', 'cash')));
    if (!accQuery.empty) {
        // نختار أول خزينة نقدية لتكون الافتراضية
        resolvedAccountId = accQuery.docs[0].id;
    }

    const result = await createSalesInvoice({
        customer_name: resolvedCustomerName,
        customer_id: resolvedCustomerId,
        account_id: resolvedAccountId,
        items: [{ product_id: product.id, product_name: product.product_name, quantity, price }],
        total_amount: total,
        paid_amount: total,
        remaining_amount: 0,
        payment_status: 'paid',
        payment_method: 'cash',
        created_by: userId,
    });
    
    if (result.success) {
        await addDoc(collection(db, 'activity_logs'), withTenant({
            action: 'create_invoice_by_assistant',
            entity_type: 'Sale',
            details: `إنشاء فاتورة ${result.invoice_number || result.id || ''} بواسطة المساعد`,
            user_id: userId,
            timestamp: serverTimestamp(),
        }));
    }
    return result;
}
