/**
 * assistantDataService.js — طبقة بيانات مخصصة لمساعد الذكاء الاصطناعي
 *
 * تجمع كل استعلامات Firestore التي يحتاجها المساعد في مكان واحد.
 * كل دالة تعيد بيانات منظّمة جاهزة للعرض أو تمريرها للـ Gemini كـ context.
 */

import {
    where,
    orderBy,
    limit,
    getDocs,
    Timestamp,
} from 'firebase/firestore';
import { createTenantQuery } from '@/lib/tenantFirestore';

// ====================================================
// helpers
// ====================================================

/** بداية يوم معين كـ Firestore Timestamp */
function startOfDay(date = new Date()) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return Timestamp.fromDate(d);
}

/** نهاية يوم معين */
function endOfDay(date = new Date()) {
    const d = new Date(date);
    d.setHours(23, 59, 59, 999);
    return Timestamp.fromDate(d);
}

/** تحويل Firestore doc إلى object بسيط */
function docToObj(doc) {
    return { id: doc.id, ...doc.data() };
}

// ====================================================
// المخزون
// ====================================================

/**
 * يجلب الأصناف التي وصل مخزونها أقل من الحد الأدنى
 * @param {{ limit?: number }} options
 * @returns {Promise<Array<{ id, product_name, current_stock, min_stock_level, unit }>>}
 */
export async function getLowStockProducts({ maxResults = 20 } = {}) {
    try {
        const snap = await getDocs(
            createTenantQuery('products', orderBy('product_name'), limit(200))
        );
        const all = snap.docs.map(docToObj);
        const low = all.filter(
            (p) => Number(p.current_stock ?? p.stock ?? 0) <= Number(p.min_stock_level ?? 0)
        );
        return {
            success: true,
            data: low.slice(0, maxResults).map((p) => ({
                id: p.id,
                product_name: p.product_name || 'منتج بدون اسم',
                current_stock: Number(p.current_stock ?? p.stock ?? 0),
                min_stock_level: Number(p.min_stock_level ?? 0),
                unit: p.unit || 'وحدة',
            }))
        };
    } catch (err) {
        console.error('[assistantDataService] getLowStockProducts:', err);
        return { success: false, data: [], error: err.message };
    }
}

/**
 * البحث عن منتج بالاسم (بحث جزئي)
 * @param {string} nameQuery
 * @returns {Promise<Array>}
 */
export async function searchProductByName(nameQuery) {
    try {
        const snap = await getDocs(
            createTenantQuery('products', orderBy('product_name'), limit(200))
        );
        const q = (nameQuery || '').toLowerCase().trim();
        return {
            success: true,
            data: snap.docs
                .map(docToObj)
                .filter((p) => (p.product_name || '').toLowerCase().includes(q))
                .slice(0, 10)
                .map((p) => ({
                    id: p.id,
                    product_name: p.product_name,
                    current_stock: Number(p.current_stock ?? 0),
                    sell_price: Number(p.sell_price ?? p.price ?? 0),
                    unit: p.unit || 'وحدة',
                }))
        };
    } catch (err) {
        console.error('[assistantDataService] searchProductByName:', err);
        return { success: false, data: [], error: err.message };
    }
}

// ====================================================
// الديون
// ====================================================

/**
 * يجلب الديون المستحقة (remaining_amount > 0)
 * @returns {Promise<Array<{ id, party_name, remaining_amount, due_date, type }>>}
 */
export async function getPendingDebts({ maxResults = 20 } = {}) {
    try {
        let snap;
        try {
            snap = await getDocs(
                createTenantQuery(
                    'debts',
                    where('remaining_amount', '>', 0),
                    orderBy('remaining_amount', 'desc'),
                    limit(maxResults)
                )
            );
        } catch {
            // Fallback in case of index constraint or untyped debts
            snap = await getDocs(createTenantQuery('debts', limit(100)));
        }

        return {
            success: true,
            data: snap.docs
                .map(docToObj)
                .filter((d) => Number(d.remaining_amount ?? 0) > 0)
                .sort((a, b) => Number(b.remaining_amount) - Number(a.remaining_amount))
                .slice(0, maxResults)
                .map((d) => ({
                    id: d.id,
                    party_name: d.party_name || d.customer_name || 'غير محدد',
                    remaining_amount: Number(d.remaining_amount),
                    original_amount: Number(d.original_amount ?? d.amount ?? 0),
                    due_date: d.due_date || null,
                    type: d.type || 'debt',
                }))
        };
    } catch (err) {
        console.error('[assistantDataService] getPendingDebts:', err);
        return { success: false, data: [], error: err.message };
    }
}

/** مجموع الديون المستحقة */
export async function getTotalOutstandingDebt() {
    const result = await getPendingDebts({ maxResults: 100 });
    const debts = result.success ? result.data : [];
    return debts.reduce((sum, d) => sum + (Number(d.remaining_amount) || 0), 0);
}

// ====================================================
// المبيعات
// ====================================================

/**
 * يجلب ملخص مبيعات فترة معينة
 * @param {'today'|'yesterday'|'week'|'month'} period
 */
export async function getSalesSummary(period = 'today') {
    try {
        const now = new Date();
        let from, to;

        if (period === 'today') {
            from = startOfDay(now);
            to = endOfDay(now);
        } else if (period === 'yesterday') {
            const y = new Date(now);
            y.setDate(y.getDate() - 1);
            from = startOfDay(y);
            to = endOfDay(y);
        } else if (period === 'week') {
            const w = new Date(now);
            w.setDate(w.getDate() - 7);
            from = startOfDay(w);
            to = endOfDay(now);
        } else if (period === 'month') {
            const m = new Date(now.getFullYear(), now.getMonth(), 1);
            from = startOfDay(m);
            to = endOfDay(now);
        } else {
            from = startOfDay(now);
            to = endOfDay(now);
        }

        const snap = await getDocs(
            createTenantQuery(
                'sales',
                where('created_at', '>=', from),
                where('created_at', '<=', to),
                orderBy('created_at', 'desc'),
                limit(500)
            )
        );

        const sales = snap.docs.map(docToObj);
        const count = sales.length;
        const total = sales.reduce(
            (sum, s) => sum + Number(s.total_amount ?? s.total ?? 0),
            0
        );
        const profit = sales.reduce(
            (sum, s) => sum + Number(s.profit ?? s.net_profit ?? 0),
            0
        );

        return { count, total, profit, period };
    } catch (err) {
        console.error('[assistantDataService] getSalesSummary:', err);
        return { count: 0, total: 0, profit: 0, period, hasError: true, error: err.message };
    }
}

/** جلب مبيعات اليوم فقط */
export async function getTodaySalesSummary() {
    return getSalesSummary('today');
}

// ====================================================
// المصروفات
// ====================================================

/**
 * يجلب ملخص المصروفات لفترة معينة
 */
export async function getExpensesSummary(period = 'today') {
    try {
        const now = new Date();
        let from, to;

        if (period === 'today') {
            from = startOfDay(now);
            to = endOfDay(now);
        } else if (period === 'month') {
            const m = new Date(now.getFullYear(), now.getMonth(), 1);
            from = startOfDay(m);
            to = endOfDay(now);
        } else {
            from = startOfDay(now);
            to = endOfDay(now);
        }

        const snap = await getDocs(
            createTenantQuery(
                'expenses',
                where('created_at', '>=', from),
                where('created_at', '<=', to),
                orderBy('created_at', 'desc'),
                limit(200)
            )
        );

        const expenses = snap.docs.map(docToObj);
        const total = expenses.reduce(
            (sum, e) => sum + Number(e.amount ?? 0),
            0
        );

        // تجميع حسب الفئة
        const byCategory = expenses.reduce((acc, e) => {
            const cat = e.category || 'أخرى';
            acc[cat] = (acc[cat] || 0) + Number(e.amount ?? 0);
            return acc;
        }, {});

        return { total, count: expenses.length, byCategory, period };
    } catch (err) {
        console.error('[assistantDataService] getExpensesSummary:', err);
        return { total: 0, count: 0, byCategory: {}, period, hasError: true, error: err.message };
    }
}

// ====================================================
// التحليلات التشغيلية
// ====================================================

export async function getCashflowSummary(period = 'today') {
    try {
        const now = new Date();
        const fromDate = period === 'month'
            ? new Date(now.getFullYear(), now.getMonth(), 1)
            : period === 'week'
                ? new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
                : new Date(now.setHours(0, 0, 0, 0));
        const snap = await getDocs(createTenantQuery(
            'cashflow',
            where('timestamp', '>=', Timestamp.fromDate(fromDate)),
            orderBy('timestamp', 'desc'),
            limit(500)
        ));
        const entries = snap.docs.map(docToObj);
        const inflow = entries.filter((entry) => Number(entry.amount) > 0).reduce((sum, entry) => sum + Number(entry.amount), 0);
        const outflow = entries.filter((entry) => Number(entry.amount) < 0).reduce((sum, entry) => sum + Math.abs(Number(entry.amount)), 0);
        return { count: entries.length, inflow, outflow, net: inflow - outflow, period };
    } catch (err) {
        console.error('[assistantDataService] getCashflowSummary:', err);
        return { count: 0, inflow: 0, outflow: 0, net: 0, period, hasError: true, error: err.message };
    }
}

export async function getRecentActivity({ maxResults = 10 } = {}) {
    try {
        const snap = await getDocs(createTenantQuery('activity_logs', orderBy('timestamp', 'desc'), limit(maxResults)));
        return {
            success: true,
            data: snap.docs.map((entry) => {
                const data = entry.data();
                return {
                    id: entry.id,
                    action: data.action || 'نشاط',
                    details: data.details || '',
                    user: data.user_name || data.user_email || 'النظام',
                    timestamp: data.timestamp?.toDate?.()?.toLocaleString('ar-EG') || 'غير محدد',
                };
            })
        };
    } catch (err) {
        console.error('[assistantDataService] getRecentActivity:', err);
        return { success: false, data: [], error: err.message };
    }
}

// ====================================================
// العملاء
// ====================================================

/**
 * يجلب قائمة العملاء مع إجمالي مشترياتهم (مرتبة تنازلياً)
 */
export async function getTopCustomers({ maxResults = 10 } = {}) {
    try {
        const snap = await getDocs(
            createTenantQuery('customers', orderBy('total_purchases', 'desc'), limit(maxResults))
        );
        return {
            success: true,
            data: snap.docs.map((d) => {
                const data = d.data();
                return {
                    id: d.id,
                    name: data.name || data.customer_name || 'غير محدد',
                    phone: data.phone || '',
                    total_purchases: Number(data.total_purchases ?? 0),
                    debt: Number(data.debt ?? data.outstanding_balance ?? 0),
                };
            })
        };
    } catch (err) {
        console.error('[assistantDataService] getTopCustomers:', err);
        return { success: false, data: [], error: err.message };
    }
}

// ====================================================
// الموردون
// ====================================================

/**
 * يجلب الموردين النشطين لعرض ملخص سريع داخل المساعد
 */
export async function getTopSuppliers({ maxResults = 10 } = {}) {
    try {
        const snap = await getDocs(
            createTenantQuery('suppliers', orderBy('name'), limit(maxResults))
        );
        return {
            success: true,
            data: snap.docs.map((doc) => {
                const data = doc.data();
                return {
                    id: doc.id,
                    name: data.name || 'غير محدد',
                    company: data.company || '',
                    current_balance: Number(data.current_balance ?? 0),
                    total_purchases_value: Number(data.total_purchases_value ?? 0),
                    is_active: data.is_active !== false,
                };
            })
        };
    } catch (err) {
        console.error('[assistantDataService] getTopSuppliers:', err);
        return { success: false, data: [], error: err.message };
    }
}

// ====================================================
// التقرير اليومي الشامل
// ====================================================

/**
 * يجلب كل مؤشرات الأداء الرئيسية للمساعد دفعة واحدة
 * @returns {Promise<object>} context data جاهز للـ Gemini
 */
export async function getDailySummaryReport() {
    const [sales, lowStock, debts, expenses] = await Promise.allSettled([
        getTodaySalesSummary(),
        getLowStockProducts({ maxResults: 5 }),
        getPendingDebts({ maxResults: 5 }),
        getExpensesSummary('today'),
    ]);

    const safeVal = (r, fallback) => (r.status === 'fulfilled' ? r.value : fallback);
    const salesVal = safeVal(sales, {});
    
    // Unpack data from { success, data, error } functions
    const lowStockResult = safeVal(lowStock, { data: [] });
    const lowStockVal = lowStockResult.data || [];
    
    const debtsResult = safeVal(debts, { data: [] });
    const debtsVal = debtsResult.data || [];
    
    const expensesVal = safeVal(expenses, {});

    const hasErrors =
        sales.status === 'rejected' ||
        Boolean(salesVal.hasError) ||
        lowStock.status === 'rejected' ||
        !lowStockResult.success ||
        debts.status === 'rejected' ||
        !debtsResult.success ||
        expenses.status === 'rejected' ||
        Boolean(expensesVal.hasError);

    return {
        hasErrors,
        salesCount: salesVal.count ?? 0,
        totalRevenue: salesVal.total ?? 0,
        salesProfit: salesVal.profit ?? 0,
        lowStockCount: lowStockVal.length,
        lowStockItems: lowStockVal,
        outstandingDebt: debtsVal.reduce(
            (s, d) => s + (Number(d.remaining_amount) || 0),
            0
        ),
        topDebts: debtsVal,
        expensesToday: expensesVal.total ?? 0,
        expensesCount: expensesVal.count ?? 0,
    };
}
