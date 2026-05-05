import { db } from "../firebaseConfig";
import { collection, addDoc, query, where, orderBy, getDocs, serverTimestamp } from "firebase/firestore";

// 1. دالة تسجيل حركة مالية (تُستدعى تلقائياً من العمليات الأخرى)
export const recordCashMovement = async (amount, type, description) => {
    try {
        const cashRef = await addDoc(collection(db, "cashflow"), {
            amount: Number(amount),      // القيمة (موجبة للدخل، سالبة للمصاريف/المشتريات)
            type: type,                  // (sale, purchase, expense, collection, payment)
            description: description,    // وصف العملية (مثلاً: فاتورة مبيعات رقم #101)
            timestamp: serverTimestamp(),
        });
        return { success: true, id: cashRef.id };
    } catch (error) {
        console.error("Cashflow Error: ", error);
        return { success: false, error };
    }
};

// 2. دالة جلب تقرير الخزنة لفترة معينة
export const getCashReport = async (startDate, endDate) => {
    try {
        const q = query(
            collection(db, "cashflow"),
            where("timestamp", ">=", startDate),
            where("timestamp", "<=", endDate),
            orderBy("timestamp", "desc")
        );

        const querySnapshot = await getDocs(q);
        const logs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // حساب الرصيد الإجمالي في الفترة
        const totalBalance = logs.reduce((sum, log) => sum + log.amount, 0);

        return { logs, totalBalance };
    } catch (error) {
        console.error("Error fetching cash report: ", error);
        return null;
    }
};