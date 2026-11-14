/**
 * aiAssistantService.js — Pipeline رئيسي لمساعد الذكاء الاصطناعي
 *
 * يجمع بين:
 * - intentEngine: كشف نية المستخدم
 * - assistantDataService: جلب البيانات من Firestore
 * - geminiService: توليد الرد باستخدام Gemini
 * - guardrails: حماية العمليات الحساسة
 */

import { detectIntentLocal, INTENTS, buildSystemPrompt } from './intentEngine';
import {
    getLowStockProducts,
    getPendingDebts,
    getSalesSummary,
    getExpensesSummary,
    getCashflowSummary,
    getRecentActivity,
    searchProductByName,
    getTopCustomers,
    getTopSuppliers,
    getDailySummaryReport,
} from './assistantDataService';
import { streamAssistantResponse } from './geminiService';
import {
    createInvoiceFromCommand,
    deleteSaleByInvoiceNumber,
    findSaleByInvoiceNumber,
    returnSaleByInvoiceNumber,
    updateSaleByInvoiceNumber,
} from './assistantInvoiceService';

// ====================================================
// Guardrails — حراسة العمليات الحساسة
// ====================================================

/**
 * يقرر إذا كان الإجراء مسموحاً به أم يحتاج تأكيداً
 * @param {{ intent: string, confirmed?: boolean }} params
 * @returns {{ allowed: boolean, reason: string, requiresConfirmation: boolean }}
 */
export function buildGuardrailDecision({ intent, confirmed = false }) {
    const normalizedIntent = String(intent || '').toLowerCase();
    const writeIntents = ['write', 'delete', 'update', INTENTS.ADD_CUSTOMER, INTENTS.RECORD_EXPENSE];
    const needsConfirmation = writeIntents.includes(normalizedIntent);

    if (needsConfirmation && !confirmed) {
        return {
            allowed: false,
            reason: 'This action requires explicit confirmation before it can proceed.',
            requiresConfirmation: true,
        };
    }

    return {
        allowed: true,
        reason: 'Action is permitted within the current guardrails.',
        requiresConfirmation: false,
    };
}

// ====================================================
// ملخص المساعد (للـ header)
// ====================================================

/**
 * يبني ملخصاً نصياً قصيراً من مؤشرات الأداء
 */
export function buildAssistantSummary({ salesCount = 0, lowStockCount = 0, outstandingDebt = 0, pendingPayments = 0 }) {
    return `المبيعات اليوم: ${salesCount} • الأصناف المنخفضة: ${lowStockCount} • الديون المستحقة: ${Number(outstandingDebt).toString()} ج.م • المدفوعات المعلقة: ${pendingPayments}`;
}

// ====================================================
// تنفيذ الإجراءات المباشرة (Read-only)
// ====================================================

/**
 * ينفّذ الإجراء المناسب حسب النية ويعيد نصاً للـ Gemini أو للعرض المباشر
 * @param {{ intent: string, entities: object }} intentResult
 * @param {{ can: function }} permissions
 * @returns {Promise<{ contextText: string, directReply?: string }>}
 */
async function executeIntent({ intent, entities }, permissions) {
    const can = permissions?.can || (() => true);

    switch (intent) {
        case INTENTS.QUERY_STOCK: {
            const result = await getLowStockProducts({ maxResults: 15 });
            if (!result.success) return { contextText: `عذراً، حدث خطأ أثناء جلب البيانات: ${result.error}` };
            const items = result.data;
            if (!items.length) {
                return { contextText: 'لا توجد أصناف منخفضة المخزون حالياً — المخزون في وضع جيد.' };
            }
            const list = items.map((p) => `• ${p.product_name}: ${p.current_stock} ${p.unit} (الحد الأدنى: ${p.min_stock_level})`).join('\n');
            return {
                contextText: `الأصناف منخفضة المخزون (${items.length} صنف):\n${list}`,
            };
        }

        case INTENTS.QUERY_DEBTS: {
            if (!can('can_view_debts') && !can('can_view_financials')) {
                return { directReply: '🔒 ليس لديك صلاحية عرض بيانات الديون.' };
            }
            const result = await getPendingDebts({ maxResults: 10 });
            if (!result.success) return { contextText: `عذراً، حدث خطأ أثناء جلب البيانات: ${result.error}` };
            const debts = result.data;
            if (!debts.length) {
                return { contextText: 'لا توجد ديون مستحقة حالياً — رائع!' };
            }
            const total = debts.reduce((s, d) => s + d.remaining_amount, 0);
            const list = debts.map((d) => `• ${d.party_name}: ${Number(d.remaining_amount).toLocaleString('ar-EG')} ج.م`).join('\n');
            return {
                contextText: `الديون المستحقة — الإجمالي: ${Number(total).toLocaleString('ar-EG')} ج.م (${debts.length} حالة):\n${list}`,
            };
        }

        case INTENTS.QUERY_SALES: {
            if (!can('can_view_sales') && !can('can_view_financials')) {
                return { directReply: '🔒 ليس لديك صلاحية عرض بيانات المبيعات.' };
            }
            const period = entities?.period || 'today';
            const summary = await getSalesSummary(period);
            if (summary.hasError) return { contextText: `عذراً، تعذر جلب ملخص المبيعات: ${summary.error}` };
            return {
                contextText: `ملخص المبيعات (${getPeriodLabel(period)}):\n• عدد الفواتير: ${summary.count}\n• إجمالي المبيعات: ${Number(summary.total).toLocaleString('ar-EG')} ج.م\n• صافي الأرباح: ${Number(summary.profit).toLocaleString('ar-EG')} ج.م`,
            };
        }

        case INTENTS.QUERY_EXPENSES: {
            if (!can('can_manage_accounts') && !can('can_view_financials')) {
                return { directReply: '🔒 ليس لديك صلاحية عرض المصروفات.' };
            }
            const period = entities?.period || 'today';
            const exp = await getExpensesSummary(period);
            if (exp.hasError) return { contextText: `عذراً، تعذر جلب ملخص المصروفات: ${exp.error}` };
            const cats = Object.entries(exp.byCategory)
                .map(([k, v]) => `  - ${k}: ${Number(v).toLocaleString('ar-EG')} ج.م`)
                .join('\n');
            return {
                contextText: `المصروفات (${getPeriodLabel(period)}):\n• الإجمالي: ${Number(exp.total).toLocaleString('ar-EG')} ج.م (${exp.count} عملية)\n${cats}`,
            };
        }

        case INTENTS.QUERY_PROFITABILITY: {
            if (!can('can_view_financials') && !can('can_view_sales')) {
                return { directReply: '🔒 ليس لديك صلاحية عرض تحليل الربحية.' };
            }
            const period = entities?.period || 'today';
            const summary = await getSalesSummary(period);
            if (summary.hasError) return { contextText: `عذراً، تعذر جلب البيانات: ${summary.error}` };
            const margin = summary.total > 0 ? (summary.profit / summary.total) * 100 : 0;
            return {
                contextText: `تحليل الربحية (${getPeriodLabel(period)}):\n• الإيرادات: ${Number(summary.total).toLocaleString('ar-EG')} ج.م\n• الربح: ${Number(summary.profit).toLocaleString('ar-EG')} ج.م\n• هامش الربح التقريبي: ${margin.toFixed(1)}%\n• عدد الفواتير: ${summary.count}`,
            };
        }

        case INTENTS.QUERY_CASHFLOW: {
            if (!can('can_view_financials') && !can('can_manage_accounts')) {
                return { directReply: '🔒 ليس لديك صلاحية عرض التدفق النقدي.' };
            }
            const period = entities?.period || 'today';
            const cashflow = await getCashflowSummary(period);
            if (cashflow.hasError) return { contextText: `عذراً، تعذر جلب التدفق النقدي: ${cashflow.error}` };
            return {
                contextText: `التدفق النقدي (${getPeriodLabel(period)}):\n• الداخل: ${cashflow.inflow.toLocaleString('ar-EG')} ج.م\n• الخارج: ${cashflow.outflow.toLocaleString('ar-EG')} ج.م\n• الصافي: ${cashflow.net.toLocaleString('ar-EG')} ج.م\n• عدد الحركات: ${cashflow.count}`,
            };
        }

        case INTENTS.QUERY_ACTIVITY: {
            if (!can('can_view_activity_log')) {
                return { directReply: '🔒 ليس لديك صلاحية عرض سجل العمليات.' };
            }
            const result = await getRecentActivity({ maxResults: 12 });
            if (!result.success) return { contextText: `عذراً، حدث خطأ أثناء جلب البيانات: ${result.error}` };
            const activity = result.data;
            const list = activity.map((entry) => `• ${entry.timestamp} — ${entry.user}: ${entry.details || entry.action}`).join('\n');
            return { contextText: activity.length ? `آخر العمليات:\n${list}` : 'لا توجد عمليات مسجلة حديثاً.' };
        }

        case INTENTS.CREATE_INVOICE: {
            if (!can('can_create_sales')) return { directReply: '🔒 ليس لديك صلاحية إنشاء فواتير.' };
            if (entities?.query && entities?.confirmed) {
                const results = await searchProductByName(entities.query);
                if (!results.success) return { directReply: `تعذر البحث عن المنتج: ${results.error}` };
                const product = results.data[0];
                if (!product) return { directReply: `لم أجد منتجًا باسم «${entities.query}».` };
                const quantity = Number(entities.quantity) || 1;
                const result = await createInvoiceFromCommand({
                    customerName: entities.customerName,
                    product,
                    quantity,
                    userId: permissions.user?.uid || '',
                });
                return { directReply: `✅ تم إنشاء الفاتورة ${result.invoice_number || result.id || ''} للمنتج ${product.product_name} بكمية ${quantity}.` };
            }
            return {
                directReply: '🧾 أستطيع إنشاء فاتورة، لكن أحتاج: اسم المنتج، الكمية، واسم العميل اختياريًا. مثال: «أضف فاتورة منتج باراسيتامول كمية 2 للعميل أحمد». بعد ظهور المعاينة اكتب «تأكيد».',
            };
        }

        case INTENTS.UPDATE_INVOICE: {
            if (!can('can_edit_sales') && !can('can_create_sales')) return { directReply: '🔒 ليس لديك صلاحية تعديل الفواتير.' };
            const invoiceNumber = entities?.invoiceNumber;
            if (!invoiceNumber) return { directReply: 'اذكر رقم الفاتورة المطلوب تعديلها.' };
            const sale = await findSaleByInvoiceNumber(invoiceNumber);
            if (!sale) return { directReply: `لم أجد فاتورة برقم ${invoiceNumber}.` };
            if (!entities?.confirmed) return { directReply: `📝 معاينة تعديل الفاتورة ${invoiceNumber}: إجماليها ${Number(sale.total_amount ?? sale.total ?? 0).toLocaleString('ar-EG')} ج.م. اكتب التعديل المطلوب ثم «تأكيد»، مثل: «عدل فاتورة ${invoiceNumber} المدفوع 500 تأكيد».` };
            const updated = await updateSaleByInvoiceNumber(invoiceNumber, { paid_amount: entities.paidAmount ?? entities.amount });
            return { directReply: `✅ تم تعديل الفاتورة ${invoiceNumber}. المدفوع الآن ${Number(updated.paid_amount || 0).toLocaleString('ar-EG')} ج.م والمتبقي ${Number(updated.remaining_amount || 0).toLocaleString('ar-EG')} ج.م.` };
        }

        case INTENTS.DELETE_INVOICE: {
            if (!can('can_delete_sales')) return { directReply: '🔒 ليس لديك صلاحية حذف الفواتير.' };
            const invoiceNumber = entities?.invoiceNumber;
            if (!invoiceNumber) return { directReply: 'اذكر رقم الفاتورة المطلوب حذفها.' };
            const sale = await findSaleByInvoiceNumber(invoiceNumber);
            if (!sale) return { directReply: `لم أجد فاتورة برقم ${invoiceNumber}.` };
            if (!entities?.confirmed) return { directReply: `⚠️ سيتم حذف الفاتورة ${invoiceNumber} وإعادة كمياتها للمخزون وعكس رصيد العميل. اكتب «تأكيد حذف فاتورة ${invoiceNumber}» للمتابعة.` };
            await deleteSaleByInvoiceNumber(invoiceNumber, permissions.user?.uid || '');
            return { directReply: `✅ تم حذف الفاتورة ${invoiceNumber} وعكس آثارها المالية والمخزنية.` };
        }

        case INTENTS.RETURN_INVOICE: {
            if (!can('can_create_sales')) return { directReply: '🔒 ليس لديك صلاحية إنشاء مرتجعات.' };
            const invoiceNumber = entities?.invoiceNumber;
            if (!invoiceNumber) return { directReply: 'اذكر رقم الفاتورة المطلوب استرجاعها.' };
            const sale = await findSaleByInvoiceNumber(invoiceNumber);
            if (!sale) return { directReply: `لم أجد فاتورة برقم ${invoiceNumber}.` };
            if (!entities?.confirmed) return { directReply: `↩️ سيتم عمل مرتجع كامل للفاتورة ${invoiceNumber} بقيمة ${Number(sale.total_amount ?? sale.total ?? 0).toLocaleString('ar-EG')} ج.م. اكتب «تأكيد استرجاع فاتورة ${invoiceNumber}».` };
            await returnSaleByInvoiceNumber(invoiceNumber, permissions.user?.uid || '');
            return { directReply: `✅ تم تسجيل مرتجع كامل للفاتورة ${invoiceNumber} وإعادة الأصناف للمخزون.` };
        }

        case INTENTS.QUERY_PRODUCTS: {
            const q = entities?.query || '';
            if (!q) {
                return { contextText: 'لم أفهم اسم المنتج. أعد صياغة السؤال مثلاً: "ابحث عن دواء أ"' };
            }
            const res = await searchProductByName(q);
            if (!res.success) return { contextText: `تعذر البحث: ${res.error}` };
            const results = res.data;
            if (!results.length) {
                return { contextText: `لم أجد منتجات تطابق "${q}" في قاعدة البيانات.` };
            }
            const list = results.map((p) => `• ${p.product_name} — مخزون: ${p.current_stock} ${p.unit} | سعر البيع: ${p.sell_price} ج.م`).join('\n');
            return { contextText: `نتائج البحث عن "${q}":\n${list}` };
        }

        case INTENTS.QUERY_CUSTOMERS: {
            if (!can('can_view_customers')) {
                return { directReply: '🔒 ليس لديك صلاحية عرض بيانات العملاء.' };
            }
            const result = await getTopCustomers({ maxResults: 10 });
            if (!result.success) return { contextText: `عذراً، حدث خطأ: ${result.error}` };
            const customers = result.data;
            if (!customers.length) {
                return { contextText: 'لا يوجد عملاء مسجلون حتى الآن.' };
            }
            const list = customers.map((c) => `• ${c.name}${c.total_purchases ? ` — إجمالي مشترياته: ${Number(c.total_purchases).toLocaleString('ar-EG')} ج.م` : ''}${c.debt > 0 ? ` | دين: ${Number(c.debt).toLocaleString('ar-EG')} ج.م` : ''}`).join('\n');
            return { contextText: `أبرز العملاء:\n${list}` };
        }

        case INTENTS.QUERY_SUPPLIERS:
            if (!can('can_view_suppliers')) {
                return { directReply: '🔒 ليس لديك صلاحية عرض بيانات الموردين.' };
            }
            {
                const result = await getTopSuppliers({ maxResults: 10 });
                if (!result.success) return { contextText: `عذراً، حدث خطأ: ${result.error}` };
                const suppliers = result.data;
                if (!suppliers.length) {
                    return { contextText: 'لا يوجد موردون مسجلون حتى الآن.' };
                }
                const list = suppliers
                    .map((s) => {
                        const company = s.company ? ` — ${s.company}` : '';
                        const balance = ` | الرصيد: ${Number(s.current_balance).toLocaleString('ar-EG')} ج.م`;
                        return `• ${s.name}${company}${balance}`;
                    })
                    .join('\n');
                return { contextText: `الموردون (${suppliers.length}):\n${list}` };
            }

        case INTENTS.ADD_CUSTOMER:
            return {
                directReply: 'إضافة العملاء عبر المساعد غير مفعلة حاليًا، ولم يتم إجراء أي تغيير. يُرجى استخدام صفحة العملاء مباشرة لإضافة عميل جديد وتحديد بياناته بدقة.',
            };

        case INTENTS.RECORD_EXPENSE:
            return {
                directReply: 'تسجيل المصروفات عبر المساعد غير مفعل حاليًا، ولم يتم إجراء أي تغيير. يُرجى استخدام صفحة المصروفات مباشرة لتحديد الخزينة وبند الصرف بدقة.',
            };

        case INTENTS.DAILY_SUMMARY: {
            if (!can('can_view_dashboard') && !can('can_view_financials')) {
                return { directReply: '🔒 ليس لديك صلاحية عرض التقرير اليومي.' };
            }
            const report = await getDailySummaryReport();
            return {
                contextText: buildDailySummaryText(report),
            };
        }

        case INTENTS.HELP: {
            return {
                directReply: buildHelpText(can),
            };
        }

        default:
            return { contextText: '' };
    }
}

// ====================================================
// Pipeline رئيسي — runAssistantMessage
// ====================================================

/**
 * الدالة الرئيسية التي تُستدعى من واجهة المستخدم
 *
 * @param {object} params
 * @param {string} params.userMessage — نص رسالة المستخدم
 * @param {Array}  params.history — تاريخ المحادثة [{role, content}]
 * @param {object} params.contextData — بيانات الشركة الحالية (من getDailySummaryReport)
 * @param {object} params.permissions — { can: fn, role: string, permissionsList: string[] }
 * @param {function(string):void} params.onChunk — streaming callback
 * @returns {Promise<string>} الرد الكامل
 */
export async function runAssistantMessage({
    userMessage,
    history = [],
    contextData = {},
    permissions = {},
    onChunk,
}) {
    if (!userMessage?.trim()) return '';

    // 1. كشف النية محلياً
    const intentResult = detectIntentLocal(userMessage);
    // تحسين التقاط نية التأكيد الصريحة
    const confirmed = /\b(تأكيد|أكد|موافق|confirm|نعم|نفذ|اعتمد)\b/i.test(userMessage.trim());
    intentResult.entities = { ...intentResult.entities, confirmed };

    // الحفاظ على النية السابقة إذا كانت الرسالة مجرد تأكيد (Stateful Confirmation)
    if (confirmed && intentResult.intent === INTENTS.UNKNOWN && history.length > 0) {
        const lastUserMsg = history.slice().reverse().find((m) => m.role === 'user');
        if (lastUserMsg) {
            const prevResult = detectIntentLocal(lastUserMsg.content);
            const requiresConfirmation = [
                INTENTS.CREATE_INVOICE,
                INTENTS.UPDATE_INVOICE,
                INTENTS.DELETE_INVOICE,
                INTENTS.RETURN_INVOICE
            ];
            if (requiresConfirmation.includes(prevResult.intent)) {
                intentResult.intent = prevResult.intent;
                intentResult.entities = { ...prevResult.entities, confirmed: true };
            }
        }
    }

    // 2. التحقق من الـ Guardrails قبل التنفيذ المباشر للأفعال التي تغير البيانات
    const guardrail = buildGuardrailDecision({ intent: intentResult.intent, confirmed });
    if (!guardrail.allowed) {
        // إذا كان الإجراء يحتاج تأكيد ولكن المستخدم لم يؤكد، نطلب منه التأكيد.
        // تم معالجة هذا داخل كل case في executeIntent بإرجاع المعاينة.
    }

    // 3. تنفيذ الإجراء المناسب وجلب البيانات
    const { contextText = '', directReply } = await executeIntent(intentResult, permissions);

    // 4. إذا كان الرد مباشراً (رسالة صلاحيات أو مساعدة) — أعده فوراً
    if (directReply) {
        if (onChunk) onChunk(directReply);
        return directReply;
    }

    // 5. بناء System Prompt مع البيانات المُجمَّعة
    const systemPrompt = buildSystemPrompt({
        permissions: Object.entries(permissions.permissionsList || {})
            .filter(([, v]) => v)
            .map(([k]) => k),
        role: permissions.role || 'sales_rep',
        contextData,
    });

    // 6. بناء الرسالة للـ Gemini (تضمين البيانات المُجلَبة)
    const enrichedMessage = contextText
        ? `[بيانات من النظام]\n${contextText}\n\n[سؤال المستخدم]\n${userMessage}`
        : userMessage;

    // 7. إرسال إلى Gemini مع streaming
    const fullReply = await streamAssistantResponse({
        userMessage: enrichedMessage,
        systemPrompt,
        history,
        onChunk,
    });

    return fullReply;
}

// ====================================================
// Legacy compat — runAssistantAction
// ====================================================

export async function runAssistantAction({ intent, prompt, confirmed = false }) {
    const decision = buildGuardrailDecision({ intent, confirmed });
    if (!decision.allowed) {
        return { ok: false, decision, output: 'Action blocked by guardrails.' };
    }
    return {
        ok: true,
        decision,
        output: `Prepared ${intent} request: ${prompt || 'No prompt provided.'}`,
    };
}

// ====================================================
// Helpers
// ====================================================

function getPeriodLabel(period) {
    const map = { today: 'اليوم', yesterday: 'أمس', week: 'هذا الأسبوع', month: 'هذا الشهر' };
    return map[period] || 'اليوم';
}

function buildDailySummaryText(report) {
    const lines = [
        `📊 **التقرير اليومي — ${new Date().toLocaleDateString('ar-EG')}**`,
    ];

    if (report.hasErrors) {
        lines.push('⚠️ *تنبيه: تعذر تحديث بعض المؤشرات اللحظية لوجود مشكلة في الاتصال أو الصلاحيات.*');
    }

    lines.push(
        '',
        `🛒 المبيعات: ${report.salesCount} فاتورة | إجمالي: ${Number(report.totalRevenue).toLocaleString('ar-EG')} ج.م | ربح: ${Number(report.salesProfit).toLocaleString('ar-EG')} ج.م`,
        `💸 المصروفات: ${Number(report.expensesToday).toLocaleString('ar-EG')} ج.م (${report.expensesCount} عملية)`,
        `📦 أصناف منخفضة المخزون: ${report.lowStockCount} صنف`,
        `💰 إجمالي الديون المستحقة: ${Number(report.outstandingDebt).toLocaleString('ar-EG')} ج.م`,
    );

    if (report.lowStockItems?.length) {
        lines.push('', '⚠️ أبرز الأصناف المنخفضة:');
        report.lowStockItems.slice(0, 3).forEach((p) => {
            lines.push(`  • ${p.product_name}: ${p.current_stock} ${p.unit}`);
        });
    }

    if (report.topDebts?.length) {
        lines.push('', '💳 أكبر الديون:');
        report.topDebts.slice(0, 3).forEach((d) => {
            lines.push(`  • ${d.party_name}: ${Number(d.remaining_amount).toLocaleString('ar-EG')} ج.م`);
        });
    }

    return lines.join('\n');
}

function buildHelpText(can) {
    const actions = [];
    if (can('can_view_inventory') || can('can_edit_inventory')) actions.push('📦 الاستعلام عن المخزون والأصناف المنخفضة');
    if (can('can_view_debts') || can('can_view_financials')) actions.push('💰 عرض وتحليل الديون المستحقة');
    if (can('can_view_sales')) actions.push('📊 ملخص المبيعات والربحية (اليوم / الأسبوع / الشهر)');
    if (can('can_manage_accounts') || can('can_view_financials')) actions.push('💸 ملخص المصروفات والتدفق النقدي');
    if (can('can_view_customers')) actions.push('👥 قائمة أبرز العملاء');
    if (can('can_view_suppliers')) actions.push('🚚 قائمة الموردين وأرصدتهم');
    if (can('can_create_sales')) actions.push('🧾 إدارة الفواتير (إنشاء / تعديل / مرتجع بأمر صريح وتأكيد)');
    if (can('can_view_dashboard')) actions.push('📋 التقرير اليومي الشامل للشركة');
    actions.push('🔍 البحث عن منتج أو سعر بالاسم');

    return `مرحباً! أنا **مساعد Nexora الذكي**، مدعوم بـ Gemini AI.\n\nيمكنني مساعدتك في:\n${actions.map((a) => `• ${a}`).join('\n')}\n\nفقط اكتب سؤالك بشكل طبيعي وسأفهمه! 🤖`;
}
