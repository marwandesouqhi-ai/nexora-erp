/**
 * إعدادات ودوال الواتساب الموحدة لنظام Nexora ERP
 *
 * رقم واتساب الإدارة خاص بكل شركة (ليس ثابتاً في النظام):
 * يُحفظ في مستند الشركة companies/{companyId}.admin_whatsapp
 * ويُضاف عند إنشاء الشركة من لوحة إدارة المنصة، ويمكن تعديله من "إعدادات الشركة".
 */

/**
 * توحيد رقم الهاتف لصيغة دولية أرقام فقط (مصر افتراضياً):
 * 01012345678 → 201012345678 · +20 101 234 5678 → 201012345678 · أرقام عربية مدعومة
 */
export const normalizeWaNumber = (phone) => {
    if (!phone) return '';
    let digits = String(phone)
        .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
        .replace(/\D/g, '');
    if (digits.startsWith('00')) digits = digits.slice(2);
    if (digits.startsWith('0')) digits = `20${digits.slice(1)}`;
    if (digits.length === 10 && digits.startsWith('1')) digits = `20${digits}`;
    return digits;
};

/** هل الرقم صالح (رقم دولي من 10 إلى 15 خانة) */
export const isValidWaNumber = (phone) => /^\d{10,15}$/.test(normalizeWaNumber(phone));

/** عرض الرقم للمستخدم: 201011488621 → +20 1011488621 */
export const formatWaDisplay = (phone) => {
    const digits = normalizeWaNumber(phone);
    if (!digits) return '';
    if (digits.startsWith('20') && digits.length === 12) return `+20 ${digits.slice(2)}`;
    return `+${digits}`;
};

/**
 * توليد رابط محادثة واتساب مباشر مع تنظيف رقم الهاتف وإرفاق الرسالة المشفرة
 * @param {string} phone - رقم الهاتف (محلي أو دولي)
 * @param {string} msg - نص الرسالة المسبقة (اختياري)
 * @returns {string} رابط wa.me
 */
export const getWaUrl = (phone, msg) => {
    const cleanPhone = String(phone || '').replace(/[^0-9]/g, '');
    const base = 'https://wa.me/' + cleanPhone;
    return msg ? `${base}?text=${encodeURIComponent(msg)}` : base;
};

// ─── رقم واتساب إدارة الشركة الحالية ──────────────────────────────────────────
// يُحدَّث تلقائياً من TenantContext عند تحميل/تغيير مستند الشركة،
// حتى تستخدمه الخدمات (مثل تنبيهات المخزون) دون تمريره يدوياً.
let companyAdminWhatsapp = '';

export const setCompanyAdminWhatsapp = (phone) => {
    companyAdminWhatsapp = normalizeWaNumber(phone);
};

export const getCompanyAdminWhatsapp = () => companyAdminWhatsapp;

/**
 * فتح محادثة فورية مع رقم إدارة الشركة
 * @param {string} phone - رقم إدارة الشركة
 * @param {string} [initialMessage] - رسالة اختيارية
 */
export const openCompanyWa = (phone, initialMessage = '') => {
    const number = normalizeWaNumber(phone);
    if (!number) return false;
    window.open(getWaUrl(number, initialMessage), '_blank', 'noopener,noreferrer');
    return true;
};
