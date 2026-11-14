import { onSnapshot } from "@/data/firestoreCompat";
import { fetchTenantDocs, createTenantQuery } from "@/lib/tenantFirestore";

const VISITS_COLLECTION = "visits";

export const VISIT_TYPE_LABELS = {
    order: "طلبية مبيعات",
    collection: "تحصيل نقدي",
    followup: "متابعة دورية",
    complaint: "شكوى / معاينة",
};

export const VISIT_TYPE_COLORS = {
    order: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400",
    collection: "bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400",
    followup: "bg-purple-500/10 text-purple-600 border-purple-500/20 dark:text-purple-400",
    complaint: "bg-rose-500/10 text-rose-600 border-rose-500/20 dark:text-rose-400",
};

const todayStr = () => new Date().toISOString().slice(0, 10);

/**
 * جلب جميع الزيارات الميدانية
 */
export const getVisits = async (companyId = null) => {
    try {
        return await fetchTenantDocs(VISITS_COLLECTION, {
            companyId,
            sortFn: (a, b) => {
                const tA = a.created_at?.toMillis ? a.created_at.toMillis() : (a.checkInTime ? new Date(a.checkInTime).getTime() : 0);
                const tB = b.created_at?.toMillis ? b.created_at.toMillis() : (b.checkInTime ? new Date(b.checkInTime).getTime() : 0);
                return tB - tA;
            },
        });
    } catch (error) {
        console.error("Error fetching visits:", error);
        return [];
    }
};

/**
 * اشتراك لحظي لكافة الزيارات الميدانية المنفذة اليوم
 */
export const subscribeTodayVisits = (onData, onError) => {
    try {
        const today = todayStr();
        const q = createTenantQuery(VISITS_COLLECTION);
        return onSnapshot(
            q,
            (snap) => {
                const list = snap.docs
                    .map((d) => ({ id: d.id, ...d.data() }))
                    .filter((v) => {
                        const dateVal = v.date || (v.created_at?.toDate ? v.created_at.toDate().toISOString().slice(0, 10) : null);
                        return !dateVal || dateVal === today;
                    });

                list.sort((a, b) => {
                    const tA = a.created_at?.toMillis?.() || (a.checkInTime ? new Date(a.checkInTime).getTime() : 0);
                    const tB = b.created_at?.toMillis?.() || (b.checkInTime ? new Date(b.checkInTime).getTime() : 0);
                    return tB - tA;
                });

                onData(list);
            },
            (err) => {
                console.error("subscribeTodayVisits error:", err);
                if (onError) onError(err);
            }
        );
    } catch (error) {
        console.error("subscribeTodayVisits setup error:", error);
        if (onError) onError(error);
        return () => {};
    }
};

/**
 * حساب مؤشرات الأداء KPIs للزيارات الميدانية
 */
export const calculateVisitsKPIs = (visits = [], activeRepsCount = 1, targetPerRep = 8) => {
    const completedVisits = visits.filter((v) => Boolean(v.checkOutTime) || Number(v.durationMinutes) > 0);
    const totalVisitsCount = visits.length;

    let totalDuration = 0;
    let countedVisitsForDuration = 0;

    visits.forEach((v) => {
        const dur = Number(v.durationMinutes);
        if (dur > 0) {
            totalDuration += dur;
            countedVisitsForDuration++;
        }
    });

    const averageDuration = countedVisitsForDuration > 0
        ? Math.round(totalDuration / countedVisitsForDuration)
        : 0;

    const totalTargetVisits = Math.max(1, (activeRepsCount || 1) * targetPerRep);
    const completionRate = Math.min(100, Math.round((totalVisitsCount / totalTargetVisits) * 100));

    return {
        totalVisits: totalVisitsCount,
        completedVisits: completedVisits.length,
        averageDuration,
        totalTargetVisits,
        completionRate,
    };
};
