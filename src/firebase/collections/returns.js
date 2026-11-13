import { db } from "../firebaseConfig";
import { collection, doc, increment, serverTimestamp, runTransaction } from "firebase/firestore";
import { fetchTenantDocs, withTenant } from "@/lib/tenantFirestore";

// دالة تسجيل عملية مرتجع (مبيعات)
export const createReturnInvoice = async (returnData) => {
    try {
        if (!returnData.salesId || !Array.isArray(returnData.items) || returnData.items.length === 0) {
            throw new Error('يجب اختيار فاتورة وصنف مرتجع واحد على الأقل.');
        }

        const id = await runTransaction(db, async (transaction) => {
            const saleRef = doc(db, "sales", returnData.salesId);
            const saleSnap = await transaction.get(saleRef);
            if (!saleSnap.exists()) throw new Error('فاتورة البيع الأصلية غير موجودة.');

            const sale = saleSnap.data();
            const saleItems = sale.items || [];
            const saleTotal = Number(sale.total_amount ?? sale.total) || 0;
            const returnedBefore = Number(sale.returned_amount) || 0;
            const returnedItemsBefore = sale.returned_items || {};
            const productRefs = returnData.items.map((item) => ({ item, ref: doc(db, "products", item.id) }));
            const productSnapshots = [];
            for (const product of productRefs) {
                const quantity = Number(product.item.qty);
                if (!product.item.id || !Number.isFinite(quantity) || quantity <= 0) throw new Error('كمية المرتجع غير صحيحة.');
                const snapshot = await transaction.get(product.ref);
                if (!snapshot.exists()) throw new Error('أحد أصناف المرتجع غير موجود في المخزون.');
                productSnapshots.push({ ...product, quantity, snapshot });
            }

            const returnRef = doc(collection(db, "returns"));
            const activityRef = doc(collection(db, "activity_logs"));
            const saleItemLimit = new Map(saleItems.map((item) => [item.product_id || item.id, Number(item.quantity) || 0]));
            const returnedItemsAfter = { ...returnedItemsBefore };
            let calculatedReturnTotal = 0;

            for (const { item, ref, quantity, snapshot } of productSnapshots) {
                const soldQuantity = saleItemLimit.get(item.id) || 0;
                const returnedQuantity = Number(returnedItemsBefore[item.id]) || 0;
                if (!soldQuantity || returnedQuantity + quantity > soldQuantity) {
                    throw new Error(`كمية مرتجع ${item.product_name || ''} أكبر من الكمية المتاحة للإرجاع.`);
                }
                returnedItemsAfter[item.id] = returnedQuantity + quantity;
                calculatedReturnTotal += quantity * (Number(item.price) || 0);
                transaction.update(ref, {
                    current_stock: increment(quantity),
                    stock: increment(quantity),
                    last_update: serverTimestamp(),
                });
                transaction.set(doc(collection(db, "inventory_movements")), withTenant({
                    product_id: item.id,
                    product_name: item.product_name || snapshot.data().product_name || '',
                    quantity,
                    direction: 'in',
                    movement_type: 'sales_return',
                    reference_id: returnRef.id,
                    reference_type: 'return',
                    created_by: returnData.userId || '',
                    created_at: serverTimestamp(),
                }));
            }

            const returnTotal = calculatedReturnTotal;
            if (sale.customer_id) {
                transaction.update(doc(db, "customers", sale.customer_id), {
                    balance: increment(-returnTotal),
                    current_balance: increment(-returnTotal),
                    updated_at: serverTimestamp(),
                });
            }

            const returnedAfter = returnedBefore + returnTotal;
            transaction.update(saleRef, {
                returned_amount: returnedAfter,
                returned_items: returnedItemsAfter,
                return_status: returnedAfter >= saleTotal ? 'fully_returned' : 'partially_returned',
                updated_at: serverTimestamp(),
            });

            transaction.set(returnRef, withTenant({
                original_sales_id: returnData.salesId,
                customer_id: returnData.customerId || null,
                customer_name: returnData.customerName || 'عميل نقدي',
                items: returnData.items,
                total_return_amount: returnTotal,
                return_date: serverTimestamp(),
                reason: returnData.reason || "غير محدد",
                created_by: returnData.userId || '',
            }));
            transaction.set(activityRef, withTenant({
                action: "مرتجع مبيعات",
                entity_type: 'Return',
                details: `تم إرجاع بضاعة بقيمة ${returnTotal} للعميل ${sale.customer_name || 'عميل نقدي'}`,
                user_id: returnData.userId || '',
                timestamp: serverTimestamp(),
            }));
            return returnRef.id;
        });

        return { success: true, id };
    } catch (error) {
        console.error("Return Process Error: ", error);
        return { success: false, error };
    }
};

export const getReturns = async (companyId = null) => {
    try {
        return await fetchTenantDocs("returns", {
            companyId,
            sortFn: (a, b) => {
                const timeA = a.return_date?.toMillis ? a.return_date.toMillis() : new Date(a.return_date || 0).getTime();
                const timeB = b.return_date?.toMillis ? b.return_date.toMillis() : new Date(b.return_date || 0).getTime();
                return timeB - timeA;
            },
        });
    } catch (error) {
        console.error("Error getting returns:", error);
        return [];
    }
};