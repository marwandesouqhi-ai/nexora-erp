import { db } from "../firebaseConfig";
import { collection, addDoc, doc, updateDoc, increment, serverTimestamp } from "firebase/firestore";

// دالة تسجيل عملية هالك أو تسوية مخزنية
export const recordInventoryAdjustment = async (adjustmentData) => {
    try {
        // 1. تسجيل العملية في كوليكشن الهالك (inventory_adjustments)
        const adjustmentRef = await addDoc(collection(db, "inventory_adjustments"), {
            product_id: adjustmentData.productId,
            product_name: adjustmentData.productName,
            quantity_adjusted: Number(adjustmentData.qty), // الكمية اللي خرجت هالك
            reason: adjustmentData.reason, // (انتهاء صلاحية، تلف، كسر، عجز جرد)
            adjustment_type: "waste",      // تصنيف العملية كـ هالك
            recorded_at: serverTimestamp(),
            recorded_by: adjustmentData.userId
        });

        // 2. تحديث المخزن (خصم الكمية الهالكة بالسالب)
        const productRef = doc(db, "products", adjustmentData.productId);
        await updateDoc(productRef, {
            current_stock: increment(-adjustmentData.qty),
            last_update: serverTimestamp()
        });

        // 3. تحديث سجل النشاط (للرقابة)
        await addDoc(collection(db, "activity_logs"), {
            action: "تسجيل هالك",
            details: `تم إهلاك كمية ${adjustmentData.qty} من صنف ${adjustmentData.productName} بسبب ${adjustmentData.reason}`,
            timestamp: serverTimestamp()
        });

        // 4. (اختياري) تحديث الخسائر في الداشبورد
        const statsRef = doc(db, "dashboard_stats", "today_summary");
        await updateDoc(statsRef, {
            "daily_summary.net_profit": increment(-(adjustmentData.qty * adjustmentData.costPrice)) // خصم التكلفة من الربح
        });

        return { success: true, id: adjustmentRef.id };
    } catch (error) {
        console.error("Inventory Adjustment Error: ", error);
        return { success: false, error };
    }
};