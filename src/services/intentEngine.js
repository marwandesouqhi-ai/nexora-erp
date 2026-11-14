/**
 * intentEngine.js — محرك كشف النوايا للمساعد الذكي
 *
 * يعمل على طبقتين:
 * 1. Regex سريع للنوايا الواضحة جداً (بدون استهلاك API)
 * 2. Gemini (عبر geminiService) للنوايا المعقدة أو الغامضة
 */

// ====================================================
// تعريف النوايا المدعومة
// ====================================================

export const INTENTS = {
    QUERY_STOCK: 'query_stock',         // استعلام عن المخزون
    QUERY_DEBTS: 'query_debts',         // استعلام عن الديون
    QUERY_SALES: 'query_sales',         // استعلام عن المبيعات
    QUERY_EXPENSES: 'query_expenses',      // استعلام عن المصروفات
    QUERY_CUSTOMERS: 'query_customers',     // استعلام عن العملاء
    QUERY_SUPPLIERS: 'query_suppliers',     // استعلام عن الموردين
    QUERY_PRODUCTS: 'query_products',      // البحث عن منتج بعينه
    QUERY_PROFITABILITY: 'query_profitability', // تحليل الربحية
    QUERY_CASHFLOW: 'query_cashflow',     // التدفق النقدي
    QUERY_ACTIVITY: 'query_activity',     // سجل العمليات
    ADD_CUSTOMER: 'add_customer',        // إضافة عميل
    RECORD_EXPENSE: 'record_expense',      // تسجيل مصروف
    CREATE_INVOICE: 'create_invoice',      // إنشاء فاتورة
    UPDATE_INVOICE: 'update_invoice',      // تعديل فاتورة
    DELETE_INVOICE: 'delete_invoice',      // حذف فاتورة
    RETURN_INVOICE: 'return_invoice',      // مرتجع فاتورة
    DAILY_SUMMARY: 'daily_summary',       // التقرير اليومي الشامل
    HELP: 'help',                // طلب المساعدة
    UNKNOWN: 'unknown',             // غير مفهوم
};

// ====================================================
// قاموس Regex لكل نية
// ====================================================

const INTENT_PATTERNS = [
    {
        intent: INTENTS.DAILY_SUMMARY,
        patterns: [
            /تقرير\s*(يومي|اليوم)/i,
            /ملخص\s*(اليوم|يومي)/i,
            /ايه اللي حصل\s*(النهارده|اليوم)/i,
            /daily\s*summary/i,
        ],
    },
    {
        intent: INTENTS.QUERY_STOCK,
        patterns: [
            /منخفض|نفد|stock|مخزون|بضاعه.*قل|اصناف.*منخفض/i,
            /ما\s*(هي|هو|في)\s*(المنتجات|الاصناف|البضاعه).*منخفض/i,
            /كميه.*منخفض|low\s*stock/i,
            /ما\s*عندنا\s*(في|من)\s*(المخزون|البضاعه)/i,
        ],
    },
    {
        intent: INTENTS.QUERY_DEBTS,
        patterns: [
            /(?<![\u0600-\u06FF])(?:ال)?(?:دين|ديون|مديونيه|مديونيات)(?![\u0600-\u06FF])|غير\s*المحصل/i,
            /ما\s*(هي|في|هم)\s*(الديون|المديونيات)/i,
            /outstanding|debt/i,
            /مبالغ.*معلق|مستحقه/i,
        ],
    },
    {
        intent: INTENTS.QUERY_SALES,
        patterns: [
            /مبيعات\s*(اليوم|امبارح|الاسبوع|الشهر|النهارده)/i,
            /كام.*بعنا|بعنا.*كام/i,
            /اجمالي\s*(المبيعات|البيع)/i,
            /sales|revenue/i,
        ],
    },
    {
        intent: INTENTS.QUERY_EXPENSES,
        patterns: [
            /مصروفات?\s*(اليوم|الشهر|هذا\s*الشهر)?/i,
            /expenses?/i,
            /كام\s*صرفنا|صرفنا\s*كام/i,
        ],
    },
    {
        intent: INTENTS.QUERY_PROFITABILITY,
        patterns: [
            /ربح|ارباح|هامش|ربحيه|profit|margin/i,
            /صافي.*(اليوم|الاسبوع|الشهر)/i,
        ],
    },
    {
        intent: INTENTS.QUERY_CASHFLOW,
        patterns: [
            /تدفق|سيوله|خزينه|حركه.*(النقد|الحساب)|cash.?flow|liquidity/i,
        ],
    },
    {
        intent: INTENTS.QUERY_ACTIVITY,
        patterns: [
            /سجل.*(العمليات|النشاط)|اخر.*(العمليات|النشاط)|من.*عمل|activity.?log/i,
        ],
    },
    {
        intent: INTENTS.QUERY_CUSTOMERS,
        patterns: [
            /عملاء|عميل(?!\s*(جديد|جيد))|قائمه\s*العملاء/i,
            /customers?|clients?/i,
            /اكثر\s*(عميل|عملاء).*مبيعا|top\s*customer/i,
        ],
    },
    {
        intent: INTENTS.QUERY_SUPPLIERS,
        patterns: [
            /موردين?|قائمه\s*الموردين/i,
            /suppliers?/i,
        ],
    },
    {
        intent: INTENTS.QUERY_PRODUCTS,
        patterns: [
            /ابحث.*عن\s+(.+)|search\s+for\s+(.+)/i,
            /فين\s+(.+)|اين\s+(منتج|صنف)/i,
            /سعر\s+(.+)|price\s+of/i,
        ],
    },
    {
        intent: INTENTS.ADD_CUSTOMER,
        patterns: [
            /(اضف|ضيف|اضافه)\s+عميل/i,
            /add\s+customer/i,
            /عميل\s+جديد\s+اسم(ه|ها)?\s+/i,
        ],
    },
    {
        intent: INTENTS.RECORD_EXPENSE,
        patterns: [
            /سجل\s+مصروف|record\s+expense/i,
            /اضف\s+مصروف/i,
            /(صرفنا|دفعنا)\s+(\d+)/i,
        ],
    },
    {
        intent: INTENTS.CREATE_INVOICE,
        patterns: [/اعمل\s+فاتوره|انشئ\s+فاتوره|اضف\s+فاتوره|create\s+invoice/i],
    },
    {
        intent: INTENTS.UPDATE_INVOICE,
        patterns: [/عدل\s+فاتوره|تعديل\s+فاتوره|غير\s+الفاتوره|update\s+invoice/i],
    },
    {
        intent: INTENTS.DELETE_INVOICE,
        patterns: [/احذف\s+فاتوره|حذف\s+الفاتوره|delete\s+invoice/i],
    },
    {
        intent: INTENTS.RETURN_INVOICE,
        patterns: [/استرجع\s+فاتوره|اعمل\s+مرتجع|مرتجع\s+للفاتوره|return\s+invoice/i],
    },
    {
        intent: INTENTS.HELP,
        patterns: [
            /مساعده|help|ماذا تفعل|ايه اللي تقدر|ايه\s*اللي\s*تقدر/i,
            /what can you do/i,
        ],
    },
];

// ====================================================
// استخراج الكيانات (Entities)
// ====================================================

/**
 * يستخرج الكيانات من النص (اسم، رقم، فترة زمنية)
 * @param {string} rawText النص الأصلي
 * @param {string} normalizedText النص بعد التطبيع
 * @returns {{ name?: string, amount?: number, period?: string, query?: string }}
 */
export function extractEntities(rawText, normalizedText) {
    const entities = {};
    const textToUse = normalizedText || rawText;

    // استخراج الاسم
    const nameMatch = textToUse.match(
        /(?:اسم(?:ه|ها)?|باسم|named?)\s+([\u0600-\u06FF\w\s-]{2,30})/i
    );
    if (nameMatch) {
        entities.name = nameMatch[1].trim();
    }

    // استخراج الرقم / المبلغ
    const amountMatch = rawText.match(/(\d[\d,.]*)(?:\s*(?:جنيه|ج\.م|ل\.ع|EGP|USD))?/);
    if (amountMatch) {
        entities.amount = parseFloat(amountMatch[1].replace(/,/g, ''));
    }

    const paidAmountMatch = textToUse.match(/(?:المدفوع|دفعنا|مدفوع)\s*(?:مبلغ)?\s*(\d[\d,.]*)/i);
    if (paidAmountMatch) entities.paidAmount = parseFloat(paidAmountMatch[1].replace(/,/g, ''));

    const invoiceMatch = textToUse.match(/(?:فاتوره|الفاتوره|فاتورة|الفاتورة)\s*(?:رقم|رقمها|#)?\s*([A-Za-z0-9_-]{3,})/i);
    if (invoiceMatch) entities.invoiceNumber = invoiceMatch[1];

    const quantityMatch = textToUse.match(/(?:كميه|عدد|كمية)\s*(\d+)/i);
    if (quantityMatch) entities.quantity = Number(quantityMatch[1]);

    const commandProductMatch = textToUse.match(/منتج\s+(.+?)(?=\s+(?:كميه|عدد|كمية|للعميل|لعميل)|$)/i);
    if (commandProductMatch) entities.query = commandProductMatch[1].trim();

    const customerMatch = textToUse.match(/للعميل\s+([\u0600-\u06FF\w\s-]{2,40})/i);
    if (customerMatch) entities.customerName = customerMatch[1].trim();

    // استخراج الفترة الزمنية
    if (/اليوم|النهارده|today/i.test(textToUse)) entities.period = 'today';
    else if (/امبارح|امس|yesterday/i.test(textToUse)) entities.period = 'yesterday';
    else if (/الاسبوع|this\s*week/i.test(textToUse)) entities.period = 'week';
    else if (/الشهر|this\s*month/i.test(textToUse)) entities.period = 'month';

    // استخراج اسم المنتج (للبحث)
    const productMatch = textToUse.match(
        /(?:ابحث\s*عن|فين|سعر|منتج)\s+([\u0600-\u06FF\w\s]{2,30})/i
    );
    if (productMatch && !entities.query) {
        entities.query = productMatch[1].trim();
    }

    // استخراج وصف المصروف
    const expenseDescMatch = textToUse.match(
        /مصروف\s+([\u0600-\u06FF\w\s]{2,30})/i
    );
    if (expenseDescMatch) {
        entities.description = expenseDescMatch[1].trim();
    }

    return entities;
}

/**
 * تطبيع النص العربي لتسهيل مطابقة النوايا مع اختلاف كتابة الهمزات والياءات والتشكيل
 */
export function normalizeArabicText(text = '') {
    return String(text || '')
        .trim()
        .replace(/[\u064B-\u065F\u0670]/g, '')
        .replace(/[إأآا]/g, 'ا')
        .replace(/ة/g, 'ه')
        .replace(/ى/g, 'ي');
}

// ====================================================
// دالة كشف النية الرئيسية (Regex Layer)
// ====================================================

/**
 * يكشف النية من النص بدون استدعاء AI
 * @param {string} text
 * @returns {{ intent: string, confidence: 'high'|'low', entities: object }}
 */
export function detectIntentLocal(text) {
    const raw = String(text || '').trim();
    const normalized = normalizeArabicText(raw);

    for (const { intent, patterns } of INTENT_PATTERNS) {
        if (patterns.some((p) => p.test(normalized))) {
            return {
                intent,
                confidence: 'high',
                entities: extractEntities(raw, normalized),
            };
        }
    }

    return {
        intent: INTENTS.UNKNOWN,
        confidence: 'low',
        entities: extractEntities(raw, normalized),
    };
}

// ====================================================
// بناء System Prompt للمساعد
// ====================================================

/**
 * يبني System Prompt كاملاً يتضمن بيانات الشركة وصلاحيات المستخدم
 * @param {{ permissions: string[], role: string, contextData: object }} config
 * @returns {string}
 */
export function buildSystemPrompt({ permissions = [], role = 'sales_rep', contextData = {} }) {
    const permissionsList = permissions.filter(Boolean).join(', ') || 'قراءة فقط';

    const dataContext = [
        contextData.salesCount != null
            ? `مبيعات اليوم: ${contextData.salesCount} فاتورة`
            : null,
        contextData.lowStockCount != null
            ? `أصناف منخفضة المخزون: ${contextData.lowStockCount} صنف`
            : null,
        contextData.outstandingDebt != null
            ? `ديون مستحقة: ${contextData.outstandingDebt} ج.م`
            : null,
        contextData.totalRevenue != null
            ? `إجمالي إيرادات اليوم: ${contextData.totalRevenue} ج.م`
            : null,
        contextData.expensesToday != null
            ? `مصروفات اليوم: ${contextData.expensesToday} ج.م`
            : null,
    ]
        .filter(Boolean)
        .join('\n');

    return `أنت "مساعد Nexora ERP الذكي" — مساعد ذكاء اصطناعي متخصص في إدارة الأعمال والمحاسبة.

## هويتك
- اسمك: مساعد Nexora الذكي
- لغتك الأساسية: العربية (المصرية أو الفصحى حسب المستخدم)
- أسلوبك: ودود، مهني، موجز، دقيق

## بيانات الشركة الحالية (لحظة آنية)
${dataContext || 'لا تتوفر بيانات فورية الآن.'}

## صلاحيات المستخدم الحالي
- الدور: ${role}
- الصلاحيات المتاحة: ${permissionsList}

## قواعد مهمة
1. **لا تنفّذ أي إجراء يكتب/يعدّل/يحذف** بيانات دون أن تؤكد نية المستخدم صراحةً أولاً.
2. إذا طُلب منك شيء خارج صلاحيات المستخدم، اعتذر بأدب واشرح السبب.
3. **ردودك مختصرة** — لا تتجاوز 5 أسطر إلا إذا طُلبت قائمة أو تقرير مفصّل.
4. إذا كان السؤال عن بيانات لا تملكها الآن، اذكر ذلك وقدّم ما تعلمه.
5. استخدم أرقاماً وقوائم عند الحاجة لتحسين الوضوح.
6. إذا لم تفهم الطلب تماماً، اطلب توضيحاً قصيراً.

## ما يمكنك فعله
- الإجابة على استفسارات عن المخزون والمبيعات والديون والمصروفات والعملاء
- تقديم توصيات وتحليلات بناءً على بيانات الشركة
- مساعدة المستخدم في فهم النظام والوظائف المتاحة
`;
}
