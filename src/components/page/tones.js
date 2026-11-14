/**
 * ألوان الـ tones المشتركة بين كل primitives الصفحات.
 * - solid: مربع لون صلب + أيقونة بيضاء (نفس الشكل في الوضعين)
 * - soft:  مربع ملوّن خفيف (light = -100/-600 · dark = -500/15 / -400)
 * - text:  لون النص المطابق (للقيم والعناوين الملوّنة)
 * كل الكلاسات مكتوبة كاملة عشان Tailwind يلقطها.
 */
export const TONES = {
    indigo: {
        solid: 'bg-[#4F6FE5]',
        soft: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-400',
        text: 'text-primary',
    },
    primary: {
        solid: 'bg-primary',
        soft: 'bg-primary-soft text-primary',
        text: 'text-primary',
    },
    violet: {
        solid: 'bg-[#7C5CE6]',
        soft: 'bg-violet-soft text-violet',
        text: 'text-violet',
    },
    emerald: {
        solid: 'bg-[#10B981]',
        soft: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400',
        text: 'text-emerald-600 dark:text-emerald-400',
    },
    success: {
        solid: 'bg-success',
        soft: 'bg-success-soft text-success',
        text: 'text-success',
    },
    blue: {
        solid: 'bg-[#2563EB]',
        soft: 'bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400',
        text: 'text-blue-600 dark:text-blue-400',
    },
    cyan: {
        solid: 'bg-[#06B6D4]',
        soft: 'bg-cyan-100 text-cyan-600 dark:bg-cyan-500/15 dark:text-cyan-400',
        text: 'text-cyan-600 dark:text-cyan-400',
    },
    info: {
        solid: 'bg-info',
        soft: 'bg-info-soft text-info',
        text: 'text-info',
    },
    amber: {
        solid: 'bg-[#F59E0B]',
        soft: 'bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400',
        text: 'text-amber-600 dark:text-amber-400',
    },
    warning: {
        solid: 'bg-warning',
        soft: 'bg-warning-soft text-warning',
        text: 'text-warning',
    },
    orange: {
        solid: 'bg-[#F97316]',
        soft: 'bg-orange-100 text-orange-600 dark:bg-orange-500/15 dark:text-orange-400',
        text: 'text-orange-600 dark:text-orange-400',
    },
    rose: {
        solid: 'bg-[#F43F5E]',
        soft: 'bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400',
        text: 'text-rose-600 dark:text-rose-400',
    },
    danger: {
        solid: 'bg-danger',
        soft: 'bg-danger-soft text-danger',
        text: 'text-danger',
    },
    magenta: {
        solid: 'bg-magenta',
        soft: 'bg-magenta-soft text-magenta',
        text: 'text-magenta',
    },
    slate: {
        solid: 'bg-[#64748B]',
        soft: 'bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-400',
        text: 'text-secondary-text',
    },
};

export function getTone(tone) {
    return TONES[tone] || TONES.primary;
}
