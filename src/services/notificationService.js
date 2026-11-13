import { db } from '@/api/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { sendWhatsappMessage } from './whatsappService';
import { withTenant } from '@/lib/tenantFirestore';

/**
 * خدمة إرسال الإشعارات والتنبيهات الفورية (In-App + WhatsApp)
 */

export const notifyPayrollAdjustment = async ({
    employee,
    adjustment,
    sendWhatsapp = false,
}) => {
    try {
        const empName = employee?.name || adjustment.employee_name;
        const empPhone = employee?.phone || '';
        const isBonus = adjustment.type === 'incentive';
        const isPenalty = adjustment.type === 'penalty';

        // 1. إنشاء إشعار داخل النظام (In-App Notification)
        let notifTitle = '';
        let severity = 'info';

        if (isBonus) {
            notifTitle = `🎉 حافز جديد: تم اعتماد مكافأة بقيمة ${adjustment.amount} ج.م للمندوب ${empName}`;
            severity = 'success';
        } else if (isPenalty) {
            notifTitle = `⚠️ جزاء إداري: تم تسجيل جزاء بقيمة ${adjustment.amount} ج.م على المندوب ${empName}`;
            severity = 'destructive';
        } else {
            notifTitle = `📌 خصم سلفة: تم تسجيل خصم بقيمة ${adjustment.amount} ج.م للمندوب ${empName}`;
            severity = 'warning';
        }

        await addDoc(collection(db, 'notifications'), withTenant({
            type: 'payroll_adjustment',
            title: notifTitle,
            message: `${adjustment.title}${adjustment.reason ? ` - ${adjustment.reason}` : ''}`,
            severity,
            recipient_id: adjustment.employee_id,
            recipient_type: 'sales_rep',
            metadata: {
                adjustment_id: adjustment.id || null,
                employee_id: adjustment.employee_id,
                employee_name: empName,
                amount: adjustment.amount,
                type: adjustment.type,
            },
            is_read: false,
            created_at: serverTimestamp(),
        }));

        // 2. إرسال تنبيه فوري عبر WhatsApp إذا تم طلب ذلك ومتاح رقم هاتف
        let whatsappSent = false;
        if (sendWhatsapp && empPhone) {
            let whatsappBody = '';
            if (isBonus) {
                whatsappBody = `🌟 *إشعار مالي - مكافأة جديدة* 🌟\n\nعناية الزميل/ *${empName}*،\nتهانينا! تم اعتماد حافز مالي لحسابك بقيمة: *${adjustment.amount} ج.م*\n\n📌 *البند:* ${adjustment.title}\n📅 *التاريخ:* ${adjustment.date}\n${adjustment.reason ? `📝 *ملاحظات:* ${adjustment.reason}\n` : ''}\nنشكرك على جهودك وتفانيك المستمر! ✨\n— إدارة Nexora ERP`;
            } else if (isPenalty) {
                whatsappBody = `⚠️ *إشعار إداري - جزاء* ⚠️\n\nعناية السيد/ *${empName}*،\nنحيطكم علماً بأنه تم تسجيل جزاء إداري بقيمة: *${adjustment.amount} ج.م*\n\n📌 *السبب:* ${adjustment.title}\n📅 *التاريخ:* ${adjustment.date}\n${adjustment.reason ? `📝 *التفاصيل:* ${adjustment.reason}\n` : ''}\nيرجى مراجعة إدارة العمليات الميدانية عند اللزوم.\n— إدارة Nexora ERP`;
            } else {
                whatsappBody = `📌 *إشعار تسوية مالية - سلفة* 📌\n\nعناية السيد/ *${empName}*،\nتم قيد خصم سلفة مالية من مستحقاتك بقيمة: *${adjustment.amount} ج.م*\n\n📌 *البيان:* ${adjustment.title}\n📅 *التاريخ:* ${adjustment.date}\n— إدارة Nexora ERP`;
            }

            try {
                await sendWhatsappMessage({
                    phone: empPhone,
                    message: whatsappBody,
                });
                whatsappSent = true;
            } catch (wErr) {
                console.warn('Could not dispatch whatsapp notification:', wErr);
            }
        }

        return { success: true, whatsappSent };
    } catch (error) {
        console.error('Error dispatching notification:', error);
        return { success: false, error };
    }
};

/**
 * إشعار بتسجيل حضور بيومتري جديد
 */
export const notifyBiometricCheckIn = async ({ employeeName, method = 'biometric', isLate = false }) => {
    try {
        const title = isLate
            ? `⏱️ تأخر في الحضور: المندوب ${employeeName} سجل حضوراً متأخراً`
            : `🟢 تسجيل حضور: قام المندوب ${employeeName} بالتبصيم البيومتري`;

        await addDoc(collection(db, 'notifications'), withTenant({
            type: 'attendance_checkin',
            title,
            message: `طريقة التبصيم: ${method === 'biometric' ? 'بصمة بيومترية (Nexora Field)' : 'يدوي'}`,
            severity: isLate ? 'warning' : 'info',
            recipient_type: 'admin',
            is_read: false,
            created_at: serverTimestamp(),
        }));
    } catch (err) {
        console.error('notifyBiometricCheckIn error:', err);
    }
};
