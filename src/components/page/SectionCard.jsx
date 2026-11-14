import { cn } from '@/lib/utils';
import { getTone } from './tones';

/**
 * كارت قسم: هيدر (أيقونة + عنوان + وصف اختياري يمين، أكشنز شمال) ثم المحتوى.
 */
export default function SectionCard({
    title,
    subtitle,
    icon: Icon,
    tone = 'primary',
    actions,
    children,
    className,
    bodyClassName,
}) {
    const t = getTone(tone);
    const hasHeader = title || Icon || actions;
    return (
        <section className={cn('rounded-2xl border border-border bg-card shadow-card', className)}>
            {hasHeader ? (
                <header className="flex flex-wrap items-center justify-between gap-3 p-5">
                    <div className="flex min-w-0 items-center gap-3">
                        {Icon ? (
                            <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', t.soft)}>
                                <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                            </div>
                        ) : null}
                        <div className="min-w-0">
                            <h2 className="text-base font-bold text-foreground">{title}</h2>
                            {subtitle ? <p className="mt-0.5 text-[11.5px] text-muted-foreground">{subtitle}</p> : null}
                        </div>
                    </div>
                    {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
                </header>
            ) : null}
            <div className={cn('px-5 pb-5', !hasHeader && 'pt-5', bodyClassName)}>{children}</div>
        </section>
    );
}

/** chip صغيرة للاستخدام في actions (مثلاً "0 طلب") */
export function CountChip({ children, className }) {
    return (
        <span
            className={cn(
                'inline-flex h-7 items-center rounded-full border border-border bg-card-muted px-3 text-[11px] font-semibold text-secondary-text',
                className
            )}
        >
            {children}
        </span>
    );
}
