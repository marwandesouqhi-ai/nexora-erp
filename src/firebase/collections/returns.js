import { db } from "../firebaseConfig";
import { collection, addDoc, doc, updateDoc, increment, serverTimestamp } from "firebase/firestore";

// دالة تسجيل عملية مرتجع (مبيعات)
export const createReturnInvoice = async (returnData) => {
    try {
        // 1. تسجيل المرتجع في كوليكشن المرتجعات
        const returnRef = await addDoc(collection(db, "returns"), {
            original_sales_id: returnData.salesId, // ربط المرتجع بفاتورة البيع الأصلية
            customer_id: returnData.customerId,
            customer_name: returnData.customerName,
            items: returnData.items, // الأصناف اللي رجعت (id, qty, price)
            total_return_amount: Number(returnData.totalAmount),
            return_date: serverTimestamp(),
            reason: returnData.reason || "غير محدد"
        });

        // 2. تحديث المخزن (إعادة الكمية المرتجعة للمخزن)
        const updateInventoryPromises = returnData.items.map((item) => {
            const productRef = doc(db, "products", item.id);
            return updateDoc(productRef, {
                current_stock: increment(item.qty), // زيادة المخزن تاني
                last_update: serverTimestamp()
            });
        });

        // 3. تحديث حساب العميل (خصم قيمة المرتجع من مديونيته)
        const customerRef = doc(db, "customers", returnData.customerId);
        const updateCustomer = updateDoc(customerRef, {
            current_balance: increment(-returnData.totalAmount), // خصم بالسالب من دينه
            last_update: serverTimestamp()
        });

        // 4. تحديث سجل النشاط (عشان الأدمن يعرف إن حصل مرتجع)
        await addDoc(collection(db, "activity_logs"), {
            action: "مرتجع مبيعات",
            details: `تم إرجاع بضاعة بقيمة ${returnData.totalAmount} للعميل ${returnData.customerName}`,
            timestamp: serverTimestamp(),
            user_role: "staff" // أو حسب الموظف
        });

        await Promise.all([...updateInventoryPromises, updateCustomer]);

        return { success: true, id: returnRef.id };
    } catch (error) {
        console.error("Return Process Error: ", error);
        return { success: false, error };
    }
};