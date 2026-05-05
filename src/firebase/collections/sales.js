import { db } from "../firebaseConfig";
import { collection, addDoc, doc, updateDoc, increment, serverTimestamp, getDocs, deleteDoc } from "firebase/firestore";

// دالة تسجيل فاتورة مبيعات جديدة
export const createSalesInvoice = async (salesData) => {
    try {
        // 1. تسجيل الفاتورة في كوليكشن المبيعات
        const invoiceRef = await addDoc(collection(db, "sales"), {
            customer_id: salesData.customerId,
            customer_name: salesData.customerName,
            items: salesData.items, // مصفوفة (product_id, name, qty, price)
            total_amount: Number(salesData.totalAmount),
            paid_amount: Number(salesData.paidAmount),
            remaining_amount: Number(salesData.totalAmount - salesData.paidAmount),
            payment_type: salesData.paymentType, // (cash, credit)
            created_at: serverTimestamp(),
        });

        // 2. تحديث المخزن (خصم الكمية المباعة)
        const updateInventoryPromises = salesData.items.map((item) => {
            const productRef = doc(db, "products", item.id);
            return updateDoc(productRef, {
                current_stock: increment(-item.qty), // خصم بالسالب
                last_update: serverTimestamp()
            });
        });

        // 3. تحديث حساب العميل (زيادة مديونيته بالباقي)
        const customerRef = doc(db, "customers", salesData.customerId);
        const updateCustomer = updateDoc(customerRef, {
            current_balance: increment(salesData.totalAmount - salesData.paidAmount),
            total_purchases: increment(salesData.totalAmount),
            last_update: serverTimestamp()
        });

        // 4. تحديث إحصائيات الداشبورد (زيادة المبيعات اليومية)
        const statsRef = doc(db, "dashboard_stats", "today_summary"); // وثيقة ثابتة لليوم
        const updateStats = updateDoc(statsRef, {
            "daily_summary.total_sales": increment(salesData.totalAmount),
            "daily_summary.net_profit": increment(salesData.totalAmount - salesData.totalCost) // صافي الربح
        });

        // تنفيذ كل العمليات في وقت واحد
        await Promise.all([...updateInventoryPromises, updateCustomer, updateStats]);

        return { success: true, id: invoiceRef.id };
    } catch (error) {
        console.error("Sales Invoice Error: ", error);
        return { success: false, error };
    }
};

// دالة جلب كل فواتير المبيعات
export const getSales = async () => {
    try {
        const querySnapshot = await getDocs(collection(db, "sales"));
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error("Error getting sales: ", error);
        return [];
    }
};

// دالة تحديث فاتورة مبيعات
export const updateSale = async (id, updatedData) => {
    try {
        const docRef = doc(db, "sales", id);
        await updateDoc(docRef, {
            ...updatedData,
            updated_at: serverTimestamp(),
        });
        return { success: true };
    } catch (error) {
        console.error("Error updating sale: ", error);
        return { success: false, error };
    }
};

// دالة حذف فاتورة مبيعات
export const deleteSale = async (id) => {
    try {
        await deleteDoc(doc(db, "sales", id));
        return { success: true };
    } catch (error) {
        console.error("Error deleting sale: ", error);
        return { success: false, error };
    }
};