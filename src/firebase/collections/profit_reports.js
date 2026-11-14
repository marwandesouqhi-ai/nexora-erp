import { db } from "../firebaseConfig";
import { collection, addDoc, serverTimestamp } from "@/data/firestoreCompat";
import { fetchTenantDocs, withTenant } from "@/lib/tenantFirestore";

// حفظ لقطة (snapshot) لتقرير أرباح فترة معينة، عشان يبقى عندك أرشيف دوري
export const saveProfitReport = async (reportData) => {
    try {
        const ref = await addDoc(collection(db, "profit_reports"), withTenant({
            period_label: reportData.periodLabel || "",   // مثلاً: "أغسطس 2026" أو "الأسبوع 32"
            period_type: reportData.periodType || "monthly", // daily, weekly, monthly
            start_date: reportData.startDate || "",
            end_date: reportData.endDate || "",
            total_sales: Number(reportData.totalSales) || 0,
            total_cost: Number(reportData.totalCost) || 0,
            total_expenses: Number(reportData.totalExpenses) || 0,
            net_profit: Number(reportData.netProfit) || 0,
            generated_by: reportData.userId || "",
            created_at: serverTimestamp(),
        }));
        return { success: true, id: ref.id };
    } catch (error) {
        console.error("Save Profit Report Error: ", error);
        return { success: false, error };
    }
};

export const getProfitReports = async (companyId = null) => {
    try {
        return await fetchTenantDocs("profit_reports", {
            companyId,
            sortFn: (a, b) => {
                const timeA = a.created_at?.toMillis ? a.created_at.toMillis() : new Date(a.created_at || 0).getTime();
                const timeB = b.created_at?.toMillis ? b.created_at.toMillis() : new Date(b.created_at || 0).getTime();
                return timeB - timeA;
            },
        });
    } catch (error) {
        console.error("Error fetching profit reports: ", error);
        return [];
    }
};
