import { db } from "../firebaseConfig";
import { collection, doc, increment, serverTimestamp, runTransaction } from "firebase/firestore";
import { fetchTenantDocs, withTenant } from "@/lib/tenantFirestore";
import { isSupabaseBackend } from "@/api/backend";
import { callRpc } from "@/data/supabaseRpc";

// دالة تسجيل عملية هالك أو تسوية مخزنية
export const recordInventoryAdjustment = async (adjustmentData) => {
    try {
        const quantity = Number(adjustmentData.qty);
        if (!adjustmentData.productId || !Number.isFinite(quantity) || quantity <= 0) {
            throw new Error('الصنف والكمية يجب أن يكونا صحيحين.');
        }

        if (isSupabaseBackend) {
            const result = await callRpc('stock_adjustment', {
                payload: {
                    productId: adjustmentData.productId,
                    qty: quantity,
                    reason: adjustmentData.reason || 'تسوية مخزنية',
                },
            });
            return { success: true, id: result.id };
        }

        const id = await runTransaction(db, async (transaction) => {
            const productRef = doc(db, "products", adjustmentData.productId);
            const productSnap = await transaction.get(productRef);
            if (!productSnap.exists()) throw new Error('الصنف غير موجود.');

            const product = productSnap.data();
            const currentStock = Number(product.current_stock ?? product.stock ?? 0);
            if (quantity > currentStock) throw new Error(`الكمية المطلوبة أكبر من الرصيد المتاح (${currentStock}).`);

            const adjustmentRef = doc(collection(db, "inventory_adjustments"));
            const movementRef = doc(collection(db, "inventory_movements"));
            const activityRef = doc(collection(db, "activity_logs"));
            const statsRef = doc(db, "dashboard_stats", "today_summary");

            transaction.update(productRef, {
                current_stock: increment(-quantity),
                stock: increment(-quantity),
                last_update: serverTimestamp(),
            });
            transaction.set(adjustmentRef, withTenant({
                product_id: adjustmentData.productId,
                product_name: adjustmentData.productName || product.product_name || '',
                quantity_adjusted: quantity,
                reason: adjustmentData.reason || 'تسوية مخزنية',
                adjustment_type: "waste",
                recorded_at: serverTimestamp(),
                recorded_by: adjustmentData.userId || '',
            }));
            transaction.set(movementRef, withTenant({
                product_id: adjustmentData.productId,
                product_name: adjustmentData.productName || product.product_name || '',
                quantity,
                direction: 'out',
                movement_type: 'waste',
                reference_id: adjustmentRef.id,
                reference_type: 'inventory_adjustment',
                created_by: adjustmentData.userId || '',
                created_at: serverTimestamp(),
            }));
            transaction.set(activityRef, withTenant({
                action: "تسجيل هالك",
                entity_type: 'InventoryAdjustment',
                details: `تم صرف كمية ${quantity} من صنف ${adjustmentData.productName || product.product_name || ''} بسبب ${adjustmentData.reason || 'تسوية مخزنية'}`,
                user_id: adjustmentData.userId || '',
                timestamp: serverTimestamp(),
            }));
            transaction.set(statsRef, {
                daily_summary: { net_profit: increment(-(quantity * (Number(adjustmentData.costPrice) || Number(product.purchase_price) || 0))) },
            }, { merge: true });
            return adjustmentRef.id;
        });

        return { success: true, id };
    } catch (error) {
        console.error("Inventory Adjustment Error: ", error);
        return { success: false, error };
    }
};

export const getInventoryAdjustments = async (companyId = null) => {
    try {
        return await fetchTenantDocs("inventory_adjustments", {
            companyId,
            sortFn: (a, b) => {
                const timeA = a.recorded_at?.toMillis ? a.recorded_at.toMillis() : new Date(a.recorded_at || 0).getTime();
                const timeB = b.recorded_at?.toMillis ? b.recorded_at.toMillis() : new Date(b.recorded_at || 0).getTime();
                return timeB - timeA;
            },
        });
    } catch (error) {
        console.error("Error getting inventory adjustments:", error);
        return [];
    }
};