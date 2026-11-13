import { db } from "../firebaseConfig";
import { collection, doc, increment, serverTimestamp, writeBatch, runTransaction } from "firebase/firestore";
import { fetchTenantDocs, withTenant } from "@/lib/tenantFirestore";

// ✅ دالة إنشاء معاملة شراء كاملة (Transaction Pattern)
export const createPurchaseTransaction = async (purchaseData) => {
    try {
        const batch = writeBatch(db);

        // 1. تسجيل الفاتورة في كوليكشن المشتريات
        const invoiceRef = doc(collection(db, "purchases"));
        batch.set(invoiceRef, withTenant({
            supplier_id: purchaseData.supplier_id,
            supplier_name: purchaseData.supplier_name,
            invoice_number: purchaseData.invoice_number,
            items: purchaseData.items || [],
            subtotal: Number(purchaseData.subtotal ?? purchaseData.total) || 0,
            total: Number(purchaseData.total) || 0,
            discount: Number(purchaseData.discount) || 0,
            supplier_balance_before: Number(purchaseData.supplier_balance_before) || 0,
            paid_amount: Number(purchaseData.paid_amount) || 0,
            remaining_amount: Number(purchaseData.remaining_amount ?? purchaseData.total) || 0,
            payment_status: purchaseData.payment_status || 'unpaid',
            payment_method: purchaseData.payment_method || 'cash',
            supplier_company: purchaseData.supplier_company || '',
            notes: purchaseData.notes || '',
            created_by: purchaseData.created_by,
            created_at: serverTimestamp(),
        }));

        // 2. تحديث المخزن لكل صنف (زيادة الكمية)
        if (purchaseData.items && purchaseData.items.length > 0) {
            purchaseData.items.forEach((item) => {
                const quantity = Number(item.quantity) || 0;
                if (!item.product_id || quantity <= 0) {
                    throw new Error('كل صنف في فاتورة الشراء يجب أن يحتوي على كمية صحيحة.');
                }
                const productRef = doc(db, "products", item.product_id);
                batch.update(productRef, {
                    current_stock: increment(quantity),
                    stock: increment(quantity),
                    purchase_price: Number(item.cost) || 0,
                    supplier_id: purchaseData.supplier_id || '',
                    supplier_name: purchaseData.supplier_name || '',
                    supplier_company: purchaseData.supplier_company || '',
                    last_update: serverTimestamp()
                });

                batch.set(doc(collection(db, "inventory_movements")), withTenant({
                    product_id: item.product_id,
                    product_name: item.product_name || '',
                    quantity,
                    direction: 'in',
                    movement_type: 'purchase',
                    reference_id: invoiceRef.id,
                    reference_type: 'purchase',
                    created_by: purchaseData.created_by || '',
                    created_at: serverTimestamp(),
                }));
            });
        }

        // 3. تحديث حساب المورد (زيادة المديونية)
        if (purchaseData.supplier_id) {
            const supplierRef = doc(db, "suppliers", purchaseData.supplier_id);
            batch.update(supplierRef, {
                current_balance: increment(Number(purchaseData.remaining_amount ?? purchaseData.total) || 0),
                total_purchases_value: increment(Number(purchaseData.total) || 0),
                last_transaction_date: serverTimestamp()
            });
        }

        // 4. تسجيل حركة الخزنة (خروج كاش إذا تم الدفع)
        if (Number(purchaseData.paid_amount) > 0) {
            const cashflowRef = doc(collection(db, "cashflow"));
            batch.set(cashflowRef, withTenant({
                amount: -Number(purchaseData.paid_amount),
                type: "purchase_payment",
                entry_type: "original",
                account_id: purchaseData.account_id || "",
                description: `دفع فاتورة شراء: ${purchaseData.invoice_number}`,
                related_document: invoiceRef.id,
                timestamp: serverTimestamp()
            }));
        }

        if (Number(purchaseData.remaining_amount ?? purchaseData.total) > 0) {
            batch.set(doc(collection(db, "debts")), withTenant({
                party_id: purchaseData.supplier_id || '',
                party_name: purchaseData.supplier_company
                    ? `${purchaseData.supplier_name} - ${purchaseData.supplier_company}`
                    : purchaseData.supplier_name || '',
                party_type: 'supplier',
                source_type: 'purchase',
                source_id: invoiceRef.id,
                invoice_number: purchaseData.invoice_number || '',
                amount: Number(purchaseData.total) || 0,
                paid_amount: Number(purchaseData.paid_amount) || 0,
                remaining_amount: Number(purchaseData.remaining_amount ?? purchaseData.total) || 0,
                direction: 'we_owe',
                status: Number(purchaseData.paid_amount) > 0 ? 'partial' : 'pending',
                due_date: '',
                description: `مديونية فاتورة شراء ${purchaseData.invoice_number || ''}`,
                created_by: purchaseData.created_by || '',
                created_at: serverTimestamp(),
            }));
        }

        await batch.commit();
        return { success: true, id: invoiceRef.id };
    } catch (error) {
        console.error("Purchase Transaction Error: ", error);
        throw error;
    }
};

// ✅ دالة حذف معاملة شراء كاملة (مع تعديل المخزن والمورد)
export const deletePurchaseTransaction = async (purchaseId) => {
    try {
        await runTransaction(db, async (transaction) => {
            const purchaseRef = doc(db, "purchases", purchaseId);
            const purchaseSnap = await transaction.get(purchaseRef);
            if (!purchaseSnap.exists()) throw new Error("Purchase not found");

            const purchase = purchaseSnap.data();
            const productSnapshots = [];
            for (const item of purchase.items || []) {
                const quantity = Number(item.quantity) || 0;
                const productRef = doc(db, "products", item.product_id);
                const productSnap = await transaction.get(productRef);
                if (!productSnap.exists()) throw new Error(`الصنف ${item.product_name || item.product_id} غير موجود.`);
                const product = productSnap.data();
                const currentStock = Number(product.current_stock ?? product.stock ?? 0);
                if (quantity > currentStock) throw new Error(`لا يمكن إلغاء الفاتورة لأن رصيد ${item.product_name || item.product_id} غير كافٍ.`);
                productSnapshots.push({ item, quantity, ref: productRef });
            }

            transaction.delete(purchaseRef);
            productSnapshots.forEach(({ item, quantity, ref }) => {
                transaction.update(ref, { current_stock: increment(-quantity), stock: increment(-quantity), last_update: serverTimestamp() });
                transaction.set(doc(collection(db, "inventory_movements")), withTenant({
                    product_id: item.product_id,
                    product_name: item.product_name || '',
                    quantity,
                    direction: 'out',
                    movement_type: 'purchase_reversal',
                    reference_id: purchaseId,
                    reference_type: 'purchase',
                    created_by: purchase.created_by || '',
                    created_at: serverTimestamp(),
                }));
            });

            if (purchase.supplier_id) {
                transaction.update(doc(db, "suppliers", purchase.supplier_id), {
                    current_balance: increment(-Number(purchase.remaining_amount ?? purchase.total) || 0),
                    total_purchases_value: increment(-Number(purchase.total) || 0),
                    last_transaction_date: serverTimestamp(),
                });
            }

            if (Number(purchase.paid_amount ?? (purchase.payment_status === 'paid' ? purchase.total : 0)) > 0) {
                transaction.set(doc(collection(db, "cashflow")), withTenant({
                    amount: Number(purchase.paid_amount ?? purchase.total),
                    type: "purchase_payment_reversal",
                    entry_type: "reversal",
                    account_id: purchase.account_id || "",
                    description: `عكس دفع فاتورة شراء: ${purchase.invoice_number}`,
                    related_document: purchaseId,
                    timestamp: serverTimestamp(),
                }));
            }
        });
        return { success: true };
    } catch (error) {
        console.error("Error deleting purchase: ", error);
        throw error;
    }
};

// دالة جلب كل فواتير المشتريات
export const getPurchases = async (companyId = null) => {
    try {
        return await fetchTenantDocs("purchases", {
            companyId,
            sortFn: (a, b) => {
                const timeA = a.created_at?.toMillis ? a.created_at.toMillis() : new Date(a.created_at || 0).getTime();
                const timeB = b.created_at?.toMillis ? b.created_at.toMillis() : new Date(b.created_at || 0).getTime();
                return timeB - timeA;
            },
        });
    } catch (error) {
        console.error("Error getting purchases: ", error);
        return [];
    }
};

// دالة تحديث فاتورة مشتريات
export const updatePurchase = async (id, updatedData) => {
    console.warn("Purchase updates are disabled because a posted purchase affects stock, supplier balance, and cashflow.", { id, updatedData });
    throw new Error("لا يمكن تعديل فاتورة شراء مرحّلة. استخدم الإلغاء ثم أنشئ فاتورة صحيحة.");
};

// التوافق مع الاسم القديم مع الحفاظ على عكس المخزون والأرصدة.
export const deletePurchase = deletePurchaseTransaction;