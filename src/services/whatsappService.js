import { httpsCallable } from 'firebase/functions';
import { functions } from '@/api/firebase';
import { getWaUrl, getCompanyAdminWhatsapp, formatWaDisplay } from '@/utils/whatsapp';

/**
 * WhatsApp Service for Nexora ERP
 * خدمة إدارة تنبيهات ومراسلات واتساب مع دعم الإرسال الآلي والمراسلة المباشرة
 */

// المستلم الافتراضي للتنبيهات = رقم واتساب إدارة الشركة الحالية (من مستند الشركة)
const adminPhone = () => getCompanyAdminWhatsapp() || import.meta.env.VITE_DEFAULT_WHATSAPP_PHONE || '';

/**
 * ✅ دالة تنسيق رقم الهاتف
 */
export const formatPhoneNumber = (phone) => {
    if (!phone) return phone;

    let cleaned = String(phone).replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit))).replace(/\D/g, '');

    if (cleaned.startsWith('0')) {
        cleaned = '20' + cleaned.substring(1);
    }

    if (cleaned.length === 10 && cleaned.startsWith('1')) {
        cleaned = '20' + cleaned;
    }

    return cleaned;
};

/**
 * ✅ دالة الـ request المحسّنة
 */
const sendWhatsappRequest = async ({ to, body, priority = '1' }) => {
    if (!to) {
        throw new Error('❌ رقم الهاتف مطلوب');
    }

    const formattedPhone = formatPhoneNumber(to);
    if (!/^20\d{10}$/.test(formattedPhone)) {
        throw new Error('رقم الهاتف غير صحيح. استخدم رقمًا مصريًا من 11 رقمًا مثل 01012345678.');
    }
    if (body.trim().length > 4096) {
        throw new Error('رسالة واتساب طويلة جدًا. الحد الأقصى 4096 حرفًا.');
    }

    try {
        const sendWhatsappCallable = httpsCallable(functions, 'sendWhatsappMessage');
        const response = await sendWhatsappCallable({ phone: formattedPhone, message: body.trim(), priority });
        const result = response?.data;

        if (!result?.success) {
            throw new Error(result?.message || '❌ فشل في إرسال الرسالة عبر الخادم');
        }

        return result.result ?? result;
    } catch (error) {
        console.warn('🔴 خطأ في sendWhatsappRequest عبر Cloud Functions:', error);
        const raw = error?.message || '';
        // فحص أخطاء الاتصال أو انتهاء الاشتراك
        if (/failed to fetch|network|CORS|5001|internal|non-payment/i.test(raw)) {
            throw new Error('⚠️ بوابة الإرسال الآلي (UltraMsg) متوقفة حالياً لانتهاء الاشتراك. يمكنك إرسال الرسالة فوراً ومجاناً عبر زر "فتح في واتساب مباشرة".', { cause: error });
        }
        throw new Error(raw || '❌ تعذر إرسال الرسالة عبر بوابة الخادم.', { cause: error });
    }
};

/**
 * ✅ إرسال رسالة عادية
 */
export const sendWhatsappMessage = async ({ phone, message, priority = '1' }) => {
    if (!phone) {
        throw new Error('❌ رقم الهاتف مطلوب');
    }

    if (!message || message.trim().length === 0) {
        throw new Error('❌ نص الرسالة مطلوب');
    }

    return await sendWhatsappRequest({
        to: phone,
        body: message,
        priority
    });
};

/**
 * ✅ فتح محادثة فورية مباشرة عبر واتساب (wa.me)
 */
export const openWhatsappDirect = (phone, message = '') => {
    const formatted = formatPhoneNumber(phone);
    const url = getWaUrl(formatted, message);
    window.open(url, '_blank', 'noopener,noreferrer');
};

/**
 * ✅ إرسال تنبيه مخزون منخفض
 */
export const sendStockAlert = async (
    productName,
    currentStock,
    recipientPhone = adminPhone()
) => {
    if (!productName) {
        throw new Error('❌ اسم المنتج مطلوب');
    }
    if (!recipientPhone) {
        console.warn('[whatsappService] لم يُضبط رقم واتساب الإدارة للشركة — تم تخطي تنبيه المخزون.');
        return { skipped: true, reason: 'no_admin_whatsapp' };
    }

    const message = `⚠️ تنبيه مخزون منخفض\n\nالمنتج: ${productName}\nالكمية الحالية: ${currentStock}`;
    return await sendWhatsappMessage({
        phone: recipientPhone,
        message,
        priority: '1'
    });
};

/**
 * ✅ إرسال تنبيه الدفع
 */
export const sendPaymentReminder = async (
    customerName,
    amount,
    recipientPhone = adminPhone()
) => {
    if (!customerName || !amount) {
        throw new Error('❌ بيانات العميل والمبلغ مطلوبة');
    }
    if (!recipientPhone) {
        console.warn('[whatsappService] لم يُضبط رقم واتساب الإدارة للشركة — تم تخطي تذكير الدفع.');
        return { skipped: true, reason: 'no_admin_whatsapp' };
    }

    const message = `📌 تذكير دفع\n\nالعميل: ${customerName}\nالمبلغ المستحق: ${amount} ج.م`;
    return await sendWhatsappMessage({
        phone: recipientPhone,
        message,
        priority: '1'
    });
};

/**
 * ✅ التحقق من حالة اتصال نظام الواتساب
 * يتيح فحص الحالة محلياً وتشخيص الربط بدقة دون حدوث أخطاء CORS أو 5001 في المتصفح
 */
export const checkWhatsappConnection = async (options = {}) => {
    const { checkRemote = false } = options;
    const instanceId = import.meta.env.VITE_ULTRAMSG_INSTANCE_ID || 'instance188017';

    // 1. في حال طلب المستخدم فحص الخادم السحابي عن بُعد
    if (checkRemote) {
        try {
            const checkConnectionCallable = httpsCallable(functions, 'checkWhatsappConnection');
            const response = await checkConnectionCallable();
            const result = response?.data;

            if (result?.success && result?.result) {
                return {
                    status: 'متصل بالكامل ✅',
                    isGatewayActive: true,
                    isDirectActive: true,
                    officialPhone: formatWaDisplay(getCompanyAdminWhatsapp()) || 'غير مضبوط',
                    notice: 'بوابة الإرسال الآلي نشطة ومتصلة بالكامل.',
                };
            }
        } catch (err) {
            console.warn('[whatsappService] فحص الخادم السحابي غير متاح:', err?.message || err);
        }
    }

    // 2. تشخيص دقيق وواقعي للنظام دون إلقاء أخطاء شبكة أو CORS
    return {
        status: 'جاهز (واتساب المباشر نشط ومتاح 100% 🟢)',
        isGatewayActive: false,
        isDirectActive: true,
        officialPhone: formatWaDisplay(getCompanyAdminWhatsapp()) || 'غير مضبوط',
        notice: `بوابة الإرسال الآلي (UltraMsg - ${instanceId}) متوقفة حالياً لانتهاء الاشتراك. يمكنك إرسال كافة الرسائل والتنبيهات فوراً ومجاناً عبر واتساب المباشر.`,
    };
};