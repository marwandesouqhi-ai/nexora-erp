export function buildAutomationPlan({ title = 'تنبيه تلقائي', message = '' }) {
    const normalizedTitle = String(title || '').trim();
    const normalizedMessage = String(message || '').trim();

    const kind = normalizedTitle.includes('مخزون') || normalizedMessage.includes('مخزون')
        ? 'inventory_low_stock'
        : normalizedTitle.includes('دين') || normalizedMessage.includes('دين')
            ? 'debt_reminder'
            : 'daily_summary';

    return {
        kind,
        title: normalizedTitle || 'تنبيه تلقائي',
        summary: normalizedMessage || 'تم تشغيل الإجراء التلقائي بنجاح.',
        payload: {
            title: normalizedTitle || 'تنبيه تلقائي',
            message: normalizedMessage || 'تم تشغيل الإجراء التلقائي بنجاح.',
        },
    };
}

export async function runAutomationPlan(plan, context = {}) {
    const { createNotification = async () => { }, logActivity = async () => { }, user = null } = context;

    const notificationText = `${plan.title}: ${plan.summary}`;

    await createNotification('automation', notificationText);
    await logActivity({
        user: user?.uid || user?.email || 'system',
        action: 'run_automation',
        entity_type: 'Automation',
        details: notificationText,
    });

    return {
        ok: true,
        plan,
        output: notificationText,
    };
}
