import { memo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';

function resolveIcon(icon) {
    if (!icon) return null;
    // دعم تمرير عنصر جاهز <Icon /> أو تمرير الكومبوننت نفسه Icon
    if (typeof icon === 'function' || typeof icon === 'object') {
        if (icon.$$typeof || typeof icon === 'function') {
            // لو عنصر React جاهز اتبعت زي ما هو
            if (icon.props !== undefined || icon.type !== undefined) return icon;
        }
    }
    const IconComp = icon;
    return <IconComp className="h-5 w-5" aria-hidden="true" />;
}

/**
 * كارت إحصائية عام قابل لإعادة الاستخدام.
 * يدعم شكلين من الاستخدام:
 *  - <StatCard label="..." value="..." icon={<Icon />} color="text-amber-500" />
 *  - <StatCard title="..." value="..." icon={Icon} color="bg-indigo-600" sub="..." linkTo="/x" />
 */
function StatCard({
    title,
    label,
    value,
    sub,
    icon,
    color,
    linkTo,
    loading = false,
    className = '',
}) {
    const heading = title ?? label ?? '';
    const isBgColor = typeof color === 'string' && color.startsWith('bg-');
    const iconNode = resolveIcon(icon);

    const content = (
        <div
            className={`group flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-sm transition-all hover:shadow-md ${linkTo ? 'cursor-pointer' : ''} ${className}`}
        >
            <div className="flex items-start justify-between">
                {iconNode && (
                    <div
                        className={`flex h-10 w-10 items-center justify-center rounded-xl ${isBgColor ? `${color} text-white` : `bg-card-muted ${color || 'text-muted-foreground '}`
                            }`}
                    >
                        {iconNode}
                    </div>
                )}
                {linkTo && (
                    <ArrowUpRight
                        className="h-4 w-4 text-muted-foreground/60 opacity-0 transition-opacity group-hover:opacity-100 "
                        aria-hidden="true"
                    />
                )}
            </div>

            <div>
                <p className="text-xs font-bold text-muted-foreground ">{heading}</p>
                {loading ? (
                    <div className="mt-2 h-6 w-20 animate-pulse rounded bg-border " />
                ) : (
                    <p className="mt-1 text-2xl font-black text-foreground ">{value}</p>
                )}
                {sub && <p className="mt-0.5 text-[10px] font-medium text-muted-foreground ">{sub}</p>}
            </div>
        </div>
    );

    return linkTo ? (
        <Link to={linkTo} aria-label={heading} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-2xl">
            {content}
        </Link>
    ) : (
        content
    );
}

export default memo(StatCard);