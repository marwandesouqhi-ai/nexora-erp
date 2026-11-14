import { memo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getTone } from './tones';

/**
 * كارت مؤشر: مربع صلب 44px بأيقونة بيضاء أعلى اليمين، عنوان، قيمة 26px، وصف.
 * delta (اختياري) يظهر كـ "0% ↗" أعلى الشمال.
 */
function StatCard({
    icon: Icon,
    title,
    value,
    caption,
    tone = 'indigo',
    delta,
    deltaDown = false,
    valueClassName,
    captionClassName,
    loading = false,
    linkTo,
    className,
}) {
    const t = getTone(tone);
    const body = (
        <div
            className={cn(
                'relative h-full rounded-2xl border border-border bg-card p-5 shadow-card transition-colors',
                linkTo && 'hover:border-border-strong',
                className
            )}
        >
            {delta !== undefined && delta !== null ? (
                <span
                    dir="ltr"
                    className={cn(
                        'absolute end-5 top-5 inline-flex items-center gap-0.5 text-[11px] font-bold',
                        deltaDown ? 'text-danger' : 'text-success'
                    )}
                >
                    {delta}
                    {deltaDown ? (
                        <ArrowDownRight className="h-3 w-3" aria-hidden="true" />
                    ) : (
                        <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
                    )}
                </span>
            ) : null}
            {Icon ? (
                <div className={cn('flex h-11 w-11 items-center justify-center rounded-xl text-white', t.solid)}>
                    <Icon className="h-5 w-5" aria-hidden="true" />
                </div>
            ) : null}
            <p className="mt-4 text-[13px] font-medium text-secondary-text">{title}</p>
            {loading ? (
                <div className="mt-2 h-7 w-24 animate-pulse rounded-md bg-card-muted" />
            ) : (
                <p className={cn('mt-1 text-[26px] font-extrabold leading-tight text-foreground', valueClassName)}>
                    {value}
                </p>
            )}
            {caption ? (
                <p className={cn('mt-1 text-[11px] text-muted-foreground', captionClassName)}>{caption}</p>
            ) : null}
        </div>
    );

    if (!linkTo) return body;
    return (
        <Link
            to={linkTo}
            aria-label={typeof title === 'string' ? title : undefined}
            className="block rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
            {body}
        </Link>
    );
}

export default memo(StatCard);
