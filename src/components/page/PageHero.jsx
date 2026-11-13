import { cn } from '@/lib/utils';
import { getTone } from './tones';

/**
 * رأس الصفحة: أيقونة ملوّنة + عنوان + وصف على اليمين، والأكشنز على الشمال.
 */
export default function PageHero({ icon: Icon, title, subtitle, actions, tone = 'primary', className }) {
    const t = getTone(tone);
    return (
        <section
            className={cn(
                'mb-5 flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-card md:flex-row md:items-center md:justify-between',
                className
            )}
        >
            <div className="flex min-w-0 items-center gap-4">
                {Icon ? (
                    <div className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-xl', t.soft)}>
                        <Icon className="h-6 w-6" aria-hidden="true" />
                    </div>
                ) : null}
                <div className="min-w-0">
                    <h1 className="truncate text-2xl font-extrabold leading-tight text-foreground">{title}</h1>
                    {subtitle ? (
                        <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">{subtitle}</p>
                    ) : null}
                </div>
            </div>
            {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </section>
    );
}

/** pill صغيرة للاستخدام داخل actions — tone اختياري لنقطة ملوّنة */
export function HeroPill({ icon: Icon, children, dot, pulse = false, className, ...props }) {
    const DOTS = {
        success: 'bg-success',
        warning: 'bg-warning',
        danger: 'bg-danger',
        primary: 'bg-primary',
    };
    return (
        <span
            className={cn(
                'inline-flex h-9 items-center gap-2 rounded-full border border-border bg-card-muted px-3.5 text-xs font-semibold text-secondary-text',
                className
            )}
            {...props}
        >
            {dot ? (
                <span className={cn('h-2 w-2 rounded-full', DOTS[dot] || dot, pulse && 'animate-pulse')} />
            ) : null}
            {Icon ? <Icon className="h-4 w-4" aria-hidden="true" /> : null}
            {children}
        </span>
    );
}
