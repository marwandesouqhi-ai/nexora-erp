import { db } from "../firebaseConfig";
import { doc, getDoc, setDoc, increment, serverTimestamp } from "firebase/firestore";
import { getActiveCompanyId } from "@/lib/currentTenant";
import { withTenant } from "@/lib/tenantFirestore";

const getStatsDocId = (companyId = null) => {
    const cId = companyId || getActiveCompanyId();
    return cId ? `today_summary_${cId}` : "today_summary";
};

// 1. دالة جلب إحصائيات اليوم (للبطاقات اللي فوق في الداشبورد)
export const getTodayStats = async (companyId = null) => {
    try {
        const statsRef = doc(db, "dashboard_stats", getStatsDocId(companyId));
        const docSnap = await getDoc(statsRef);

        if (docSnap.exists()) {
            return docSnap.data().daily_summary;
        } else {
            // لو أول مرة تفتح السيستم في اليوم، بنصفر العدادات
            return { total_sales: 0, net_profit: 0, expenses_today: 0, invoices_count: 0 };
        }
    } catch (error) {
        console.error("Error fetching dashboard stats: ", error);
        return null;
    }
};

// 2. دالة تحديث الإحصائيات عند كل عملية (تُستدعى برمجياً)
export const updateLiveStats = async (amount, profit, isSale = true, companyId = null) => {
    try {
        const statsRef = doc(db, "dashboard_stats", getStatsDocId(companyId));
        await setDoc(statsRef, withTenant({
            "daily_summary": {
                total_sales: increment(isSale ? amount : 0),
                net_profit: increment(profit),
                invoices_count: increment(isSale ? 1 : 0),
            },
            last_sync: serverTimestamp()
        }), { merge: true });
    } catch (error) {
        console.error("Live Stats Update Error: ", error);
    }
};