import { db } from "../firebaseConfig";
import { collection, addDoc, serverTimestamp } from "@/data/firestoreCompat";
import { fetchTenantDocs, withTenant } from "@/lib/tenantFirestore";

// 1. دالة تسجيل حركة مالية (تُستدعى تلقائياً من العمليات الأخرى)
export const recordCashMovement = async (amount, type, description) => {
    try {
        const cashRef = await addDoc(collection(db, "cashflow"), withTenant({
            amount: Number(amount),      // القيمة (موجبة للدخل، سالبة للمصاريف/المشتريات)
            type: type,                  // (sale, purchase, expense, collection, payment)
            description: description,    // وصف العملية (مثلاً: فاتورة مبيعات رقم #101)
            timestamp: serverTimestamp(),
        }));
        return { success: true, id: cashRef.id };
    } catch (error) {
        console.error("Cashflow Error: ", error);
        return { success: false, error };
    }
};

// 2. دالة جلب تقرير الخزنة لفترة معينة
export const getCashReport = async (startDate, endDate, companyId = null) => {
    try {
        const startMillis = startDate ? new Date(startDate).getTime() : 0;
        const endMillis = endDate ? new Date(endDate).getTime() : Infinity;

        const logs = await fetchTenantDocs("cashflow", {
            companyId,
            filterFn: (item) => {
                const itemMillis = item.timestamp?.toMillis ? item.timestamp.toMillis() : new Date(item.timestamp || 0).getTime();
                return itemMillis >= startMillis && itemMillis <= endMillis;
            },
            sortFn: (a, b) => {
                const timeA = a.timestamp?.toMillis ? a.timestamp.toMillis() : new Date(a.timestamp || 0).getTime();
                const timeB = b.timestamp?.toMillis ? b.timestamp.toMillis() : new Date(b.timestamp || 0).getTime();
                return timeB - timeA;
            }
        });

        // حساب الرصيد الإجمالي في الفترة
        const totalBalance = logs.reduce((sum, log) => sum + (Number(log.amount) || 0), 0);

        return { logs, totalBalance };
    } catch (error) {
        console.error("Error fetching cash report: ", error);
        return null;
    }
};