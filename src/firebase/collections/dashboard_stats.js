import { db } from "../firebaseConfig";
import { doc, getDoc, setDoc, increment, serverTimestamp } from "@/data/firestoreCompat";
import { getActiveCompanyId } from "@/lib/currentTenant";
import { withTenant, fetchTenantDocs } from "@/lib/tenantFirestore";
import { isSupabaseBackend } from "@/api/backend";

const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); };
const timeOf = (v) => (v && typeof v.getTime === 'function' ? v.getTime() : new Date(v || 0).getTime());

// Supabase: no counter document; derive today's numbers from sales and expenses.
const computeTodayStats = async (companyId) => {
    const [sales, expenses] = await Promise.all([
        fetchTenantDocs('sales', { companyId }),
        fetchTenantDocs('expenses', { companyId }),
    ]);
    const from = startOfToday();
    const todaySales = sales.filter((sale) => timeOf(sale.created_at) >= from);
    const todayExpenses = expenses.filter((e) => timeOf(e.expense_date || e.created_at) >= from);
    const total_sales = todaySales.reduce((sum, sale) => sum + (Number(sale.total_amount) || 0), 0);
    const gross = todaySales.reduce((sum, sale) => sum + (Array.isArray(sale.items) ? sale.items : []).reduce((acc, item) => {
        const qty = Number(item.quantity) || 0;
        return acc + ((Number(item.price) || 0) - (Number(item.cost_price) || 0)) * qty;
    }, 0), 0);
    const expenses_today = todayExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    return { total_sales, net_profit: gross - expenses_today, expenses_today, invoices_count: todaySales.length };
};

const getStatsDocId = (companyId = null) => {
    const cId = companyId || getActiveCompanyId();
    return cId ? `today_summary_${cId}` : "today_summary";
};

// 1. دالة جلب إحصائيات اليوم (للبطاقات اللي فوق في الداشبورد)
export const getTodayStats = async (companyId = null) => {
    try {
        if (isSupabaseBackend) return await computeTodayStats(companyId);
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
        if (isSupabaseBackend) return; // stats are derived on read
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