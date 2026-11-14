import { Search, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * شريط فلترة: بحث (flex-1) + selects.
 * selects: [{ value, onChange, options: [{ value, label }], ariaLabel }]
 */
export default function Toolbar({
    search,
    onSearchChange,
    placeholder = 'بحث...',
    selects = [],
    children,
    className,
}) {
    return (
        <div
            className={cn(
                'mb-5 flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-card lg:flex-row lg:items-center',
                className
            )}
        >
            {onSearchChange ? (
                <div className="relative flex-1">
                    <input
                        type="search"
                        value={search ?? ''}
                        onChange={(e) => onSearchChange(e.target.value)}
                        placeholder={placeholder}
                        className="h-11 w-full rounded-xl border-0 bg-input pe-11 ps-4 text-[13px] text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/40"
                    />
                    <Search
                        className="pointer-events-none absolute end-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                        aria-hidden="true"
                    />
                </div>
            ) : null}
            {selects.map((s, i) => (
                <ToolbarSelect key={s.ariaLabel || i} {...s} />
            ))}
            {children}
        </div>
    );
}

export function ToolbarSelect({ value, onChange, options = [], ariaLabel, className }) {
    return (
        <div className={cn('relative lg:w-48', className)}>
            <select
                value={value}
                onChange={(e) => onChange?.(e.target.value)}
                aria-label={ariaLabel}
                className="h-11 w-full appearance-none rounded-xl border border-border bg-card pe-4 ps-9 text-[13px] font-semibold text-foreground outline-none focus:ring-2 focus:ring-primary/40"
            >
                {options.map((o) => (
                    <option key={o.value} value={o.value}>
                        {o.label}
                    </option>
                ))}
            </select>
            <ChevronDown
                className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
            />
        </div>
    );
}
