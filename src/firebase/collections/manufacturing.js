import { db } from "../firebaseConfig";
import { collection, addDoc, doc, increment, serverTimestamp, runTransaction } from "firebase/firestore";
import { fetchTenantDocs, withTenant } from "@/lib/tenantFirestore";

// إنشاء أمر تصنيع/إنتاج جديد
// materials: [{ product_id, product_name, qty_used }]
// finishedProduct: { product_id, product_name, qty_produced }
export const createProductionOrder = async (orderData) => {
    try {
        const orderRef = await addDoc(collection(db, "production_orders"), withTenant({
            order_number: orderData.orderNumber || `PRD-${Date.now()}`,
            materials: orderData.materials || [],
            finished_product_id: orderData.finishedProduct?.product_id || "",
            finished_product_name: orderData.finishedProduct?.product_name || "",
            qty_produced: Number(orderData.finishedProduct?.qty_produced) || 0,
            status: "pending", // pending, completed
            notes: orderData.notes || "",
            created_by: orderData.userId || "",
            created_at: serverTimestamp(),
        }));
        return { success: true, id: orderRef.id };
    } catch (error) {
        console.error("Production Order Error: ", error);
        return { success: false, error };
    }
};

// اعتماد أمر التصنيع: خصم الخامات من المخزن وإضافة المنتج التام
export const completeProductionOrder = async (order) => {
    try {
        await runTransaction(db, async (transaction) => {
            const orderRef = doc(db, "production_orders", order.id);
            const orderSnap = await transaction.get(orderRef);
            if (!orderSnap.exists()) throw new Error('أمر التصنيع غير موجود.');
            if (orderSnap.data().status === 'completed') throw new Error('تم اعتماد أمر التصنيع من قبل.');

            const materials = (order.materials || []).map((material) => ({
                material,
                quantity: Number(material.qty_used || 0),
                ref: doc(db, 'products', material.product_id),
            }));
            const materialSnapshots = [];
            for (const entry of materials) {
                if (!entry.material.product_id || entry.quantity <= 0) throw new Error('بيانات خامة التصنيع غير صحيحة.');
                const snapshot = await transaction.get(entry.ref);
                if (!snapshot.exists()) throw new Error(`الخامة ${entry.material.product_name || entry.material.product_id} غير موجودة.`);
                const stock = Number(snapshot.data().current_stock ?? snapshot.data().stock ?? 0);
                if (entry.quantity > stock) throw new Error(`المخزون غير كافٍ للخامة ${entry.material.product_name || entry.material.product_id}.`);
                materialSnapshots.push({ ...entry, snapshot });
            }

            const finishedQuantity = Number(order.qty_produced || 0);
            if (finishedQuantity <= 0) throw new Error('كمية المنتج النهائي غير صحيحة.');
            const finishedRef = order.finished_product_id ? doc(db, 'products', order.finished_product_id) : null;
            const finishedSnap = finishedRef ? await transaction.get(finishedRef) : null;
            if (finishedRef && !finishedSnap.exists()) throw new Error('المنتج النهائي غير موجود.');

            materialSnapshots.forEach(({ material, quantity, ref }) => {
                transaction.update(ref, {
                    current_stock: increment(-quantity),
                    stock: increment(-quantity),
                    last_update: serverTimestamp(),
                    updated_at: serverTimestamp(),
                });
                transaction.set(doc(collection(db, 'inventory_movements')), withTenant({
                    product_id: material.product_id,
                    product_name: material.product_name || '',
                    quantity,
                    direction: 'out',
                    movement_type: 'manufacturing_material',
                    reference_id: order.id,
                    reference_type: 'production_order',
                    created_by: order.created_by || '',
                    created_at: serverTimestamp(),
                }));
            });

            if (finishedRef) {
                transaction.update(finishedRef, {
                    current_stock: increment(finishedQuantity),
                    stock: increment(finishedQuantity),
                    last_update: serverTimestamp(),
                    updated_at: serverTimestamp(),
                });
                transaction.set(doc(collection(db, 'inventory_movements')), withTenant({
                    product_id: order.finished_product_id,
                    product_name: order.finished_product_name || '',
                    quantity: finishedQuantity,
                    direction: 'in',
                    movement_type: 'manufacturing_output',
                    reference_id: order.id,
                    reference_type: 'production_order',
                    created_by: order.created_by || '',
                    created_at: serverTimestamp(),
                }));
            }

            transaction.update(orderRef, { status: 'completed', completed_at: serverTimestamp() });
            transaction.set(doc(collection(db, 'activity_logs')), withTenant({
                action: 'أمر تصنيع',
                entity_type: 'ProductionOrder',
                details: `تم إنتاج ${finishedQuantity} من ${order.finished_product_name || ''}`,
                user_id: order.created_by || '',
                timestamp: serverTimestamp(),
            }));
        });

        return { success: true };
    } catch (error) {
        console.error("Complete Production Order Error: ", error);
        return { success: false, error };
    }
};

export const getProductionOrders = async (companyId = null) => {
    try {
        return await fetchTenantDocs("production_orders", {
            companyId,
            sortFn: (a, b) => {
                const timeA = a.created_at?.toMillis ? a.created_at.toMillis() : new Date(a.created_at || 0).getTime();
                const timeB = b.created_at?.toMillis ? b.created_at.toMillis() : new Date(b.created_at || 0).getTime();
                return timeB - timeA;
            },
        });
    } catch (error) {
        console.error("Error fetching production orders: ", error);
        return [];
    }
};
