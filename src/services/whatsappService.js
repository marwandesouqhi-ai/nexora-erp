/**
 * WhatsApp Service for Nexora ERP
 * This service handles sending automated stock alerts to the manager's phone.
 */

// بيانات الاعتماد (يفضل وضعها في ملف .env مستقبلاً)
const INSTANCE_ID = 'instanceXXXX'; // هتحصل عليه من حسابك في UltraMsg
const TOKEN = 'your_token_here';    // التوكن الخاص بك
const MANAGER_PHONE = '201060723106'; // رقم تليفونك بالكود الدولي (20)

/**
 * إرسال تنبيه مخزون منخفض
 * @param {string} productName - اسم المنتج
 * @param {number} currentStock - الكمية الحالية
 */
export const sendStockAlert = async (productName, currentStock) => {
    const message = `
⚠️ *تنبيه مخزون منخفض - Nexora ERP* ⚠️

يا مروان، المنتج: *${productName}*
وصلت كميته لـ: *${currentStock}* قطع فقط!

يرجى مراجعة المخزن وطلب كمية جديدة في أقرب وقت.
  `.trim();

    try {
        const response = await fetch(`https://api.ultramsg.com/${INSTANCE_ID}/messages/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                token: TOKEN,
                to: MANAGER_PHONE,
                body: message,
                priority: '1' // أولوية قصوى
            }),
        });

        const result = await response.json();

        if (result.sent === "true") {
            console.log(`✅ تم إرسال تنبيه الواتساب لمنتج: ${productName}`);
        } else {
            console.error('❌ فشل إرسال الرسالة:', result);
        }
    } catch (error) {
        console.error('🚀 خطأ في خدمة الواتساب:', error);
    }
};