import { db } from "../firebaseConfig";
import { doc, getDoc, updateDoc, increment, serverTimestamp } from "firebase/firestore";

// 1. دالة جلب إحصائيات اليوم (للبطاقات اللي فوق في الداشبورد)
export const getTodayStats = async () => {
    try {
        const statsRef = doc(db, "dashboard_stats", "today_summary");
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
export const updateLiveStats = async (amount, profit, isSale = true) => {
    try {
        const statsRef = doc(db, "dashboard_stats", "today_summary");
        await updateDoc(statsRef, {
            "daily_summary.total_sales": increment(isSale ? amount : 0),
            "daily_summary.net_profit": increment(profit),
            "daily_summary.invoices_count": increment(isSale ? 1 : 0),
            "last_sync": serverTimestamp()
        });
    } catch (error) {
        console.error("Live Stats Update Error: ", error);
    }
};