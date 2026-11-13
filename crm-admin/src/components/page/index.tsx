/**
 * Page primitives — نفس مكونات nexora-erp (PageHero / StatCard / SectionCard / EmptyState / Toolbar)
 */
import type { ComponentType, ReactNode } from 'react';
import { ArrowDownRight, ArrowUpRight, ChevronDown, Inbox, Search } from 'lucide-react';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';

export const cn = (...inputs: Parameters<typeof clsx>) => twMerge(clsx(...inputs));

type Icon = ComponentType<{ className?: string; strokeWidth?: number; 'aria-hidden'?: boolean | 'true' }>;

export const TONES = {
    indigo: { solid: 'bg-[#4F6FE5]', soft: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-400' },
    primary: { solid: 'bg-primary', soft: 'bg-primary-soft text-primary' },
    violet: { solid: 'bg-[#7C5CE6]', soft: 'bg-violet-soft text-violet' },
    emerald: { solid: 'bg-[#10B981]', soft: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400' },
    success: { solid: 'bg-success', soft: 'bg-success-soft text-success' },
    blue: { solid: 'bg-[#2563EB]', soft: 'bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400' },
    cyan: { solid: 'bg-[#06B6D4]', soft: 'bg-cyan-100 text-cyan-600 dark:bg-cyan-500/15 dark:text-cyan-400' },
    amber: { solid: 'bg-[#F59E0B]', soft: 'bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400' },
    warning: { solid: 'bg-warning', soft: 'bg-warning-soft text-warning' },
    orange: { solid: 'bg-[#F97316]', soft: 'bg-orange-100 text-orange-600 dark:bg-orange-500/15 dark:text-orange-400' },
    rose: { solid: 'bg-[#F43F5E]', soft: 'bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400' },
    danger: { solid: 'bg-danger', soft: 'bg-danger-soft text-danger' },
    magenta: { solid: 'bg-magenta', soft: 'bg-magenta-soft text-magenta' },
    slate: { solid: 'bg-[#64748B]', soft: 'bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-400' },
} as const;
export type Tone = keyof typeof TONES;

/* ── PageHero ─────────────────────────────────────────────────────────── */
export function PageHero({
    icon: IconCmp,
    title,
    subtitle,
    actions,
    tone = 'primary',
    className,
}: {
    icon?: Icon;
    title: ReactNode;
    subtitle?: ReactNode;
    actions?: ReactNode;
    tone?: Tone;
    className?: string;
}) {
    return (
        <section
            className={cn(
                'mb-5 flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-card md:flex-row md:items-center md:justify-between',
                className
            )}
        >
            <div className="flex min-w-0 items-center gap-4">
                {IconCmp ? (
                    <div className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-xl', TONES[tone].soft)}>
                        <IconCmp className="h-6 w-6" aria-hidden="true" />
                    </div>
                ) : null}
                <div className="min-w-0">
                    <h1 className="truncate text-2xl font-extrabold leading-tight text-foreground">{title}</h1>
                    {subtitle ? <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">{subtitle}</p> : null}
                </div>
            </div>
            {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </section>
    );
}

export function HeroPill({
    icon: IconCmp,
    children,
    dot,
    className,
}: {
    icon?: Icon;
    children: ReactNode;
    dot?: 'success' | 'warning' | 'danger' | 'primary';
    className?: string;
}) {
    const DOTS = { success: 'bg-success', warning: 'bg-warning', danger: 'bg-danger', primary: 'bg-primary' };
    return (
        <span
            className={cn(
                'inline-flex h-9 items-center gap-2 rounded-full border border-border bg-card-muted px-3.5 text-xs font-semibold text-secondary-text',
                className
            )}
        >
            {dot ? <span className={cn('h-2 w-2 rounded-full', DOTS[dot])} /> : null}
            {IconCmp ? <IconCmp className="h-4 w-4" aria-hidden="true" /> : null}
            {children}
        </span>
    );
}

/* ── StatCard ─────────────────────────────────────────────────────────── */
export function StatCard({
    icon: IconCmp,
    title,
    value,
    caption,
    tone = 'indigo',
    delta,
    deltaDown = false,
    valueClassName,
    loading = false,
    className,
}: {
    icon?: Icon;
    title: ReactNode;
    value: ReactNode;
    caption?: ReactNode;
    tone?: Tone;
    delta?: string;
    deltaDown?: boolean;
    valueClassName?: string;
    loading?: boolean;
    className?: string;
}) {
    return (
        <div className={cn('relative h-full rounded-2xl border border-border bg-card p-5 shadow-card', className)}>
            {delta ? (
                <span
                    dir="ltr"
                    className={cn('absolute end-5 top-5 inline-flex items-center gap-0.5 text-[11px] font-bold', deltaDown ? 'text-danger' : 'text-success')}
                >
                    {delta}
                    {deltaDown ? <ArrowDownRight className="h-3 w-3" /> : <ArrowUpRight className="h-3 w-3" />}
                </span>
            ) : null}
            {IconCmp ? (
                <div className={cn('flex h-11 w-11 items-center justify-center rounded-xl text-white', TONES[tone].solid)}>
                    <IconCmp className="h-5 w-5" aria-hidden="true" />
                </div>
            ) : null}
            <p className="mt-4 text-[13px] font-medium text-secondary-text">{title}</p>
            {loading ? (
                <div className="mt-2 h-7 w-24 animate-pulse rounded-md bg-card-muted" />
            ) : (
                <p className={cn('mt-1 text-[26px] font-extrabold leading-tight text-foreground', valueClassName)}>{value}</p>
            )}
            {caption ? <p className="mt-1 text-[11px] text-muted-foreground">{caption}</p> : null}
        </div>
    );
}

/* ── SectionCard ──────────────────────────────────────────────────────── */
export function SectionCard({
    title,
    subtitle,
    icon: IconCmp,
    tone = 'primary',
    actions,
    children,
    className,
    bodyClassName,
}: {
    title?: ReactNode;
    subtitle?: ReactNode;
    icon?: Icon;
    tone?: Tone;
    actions?: ReactNode;
    children?: ReactNode;
    className?: string;
    bodyClassName?: string;
}) {
    const hasHeader = Boolean(title || IconCmp || actions);
    return (
        <section className={cn('rounded-2xl border border-border bg-card shadow-card', className)}>
            {hasHeader ? (
                <header className="flex flex-wrap items-center justify-between gap-3 p-5">
                    <div className="flex min-w-0 items-center gap-3">
                        {IconCmp ? (
                            <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', TONES[tone].soft)}>
                                <IconCmp className="h-[18px] w-[18px]" aria-hidden="true" />
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

export function CountChip({ children, className }: { children: ReactNode; className?: string }) {
    return (
        <span className={cn('inline-flex h-7 items-center rounded-full border border-border bg-card-muted px-3 text-[11px] font-semibold text-secondary-text', className)}>
            {children}
        </span>
    );
}

/* ── EmptyState ───────────────────────────────────────────────────────── */
export function EmptyState({ icon: IconCmp = Inbox, text, children, className }: { icon?: Icon; text?: ReactNode; children?: ReactNode; className?: string }) {
    return (
        <div className={cn('flex flex-col items-center justify-center gap-3 py-14 text-center', className)}>
            <IconCmp className="h-11 w-11 text-muted-foreground/60" strokeWidth={1.5} aria-hidden="true" />
            {text ? <p className="max-w-md text-[13px] text-muted-foreground">{text}</p> : null}
            {children}
        </div>
    );
}

/* ── Toolbar ──────────────────────────────────────────────────────────── */
export function Toolbar({
    search,
    onSearchChange,
    placeholder = 'بحث...',
    children,
    className,
}: {
    search?: string;
    onSearchChange?: (v: string) => void;
    placeholder?: string;
    children?: ReactNode;
    className?: string;
}) {
    return (
        <div className={cn('mb-5 flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-card lg:flex-row lg:items-center', className)}>
            {onSearchChange ? (
                <div className="relative flex-1">
                    <input
                        type="search"
                        value={search ?? ''}
                        onChange={(e) => onSearchChange(e.target.value)}
                        placeholder={placeholder}
                        className="h-11 w-full rounded-xl border-0 bg-input pe-11 ps-4 text-[13px] text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/40"
                    />
                    <Search className="pointer-events-none absolute end-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                </div>
            ) : null}
            {children}
        </div>
    );
}

export function ToolbarSelect({
    value,
    onChange,
    options,
    ariaLabel,
    className,
}: {
    value: string;
    onChange: (v: string) => void;
    options: { value: string; label: string }[];
    ariaLabel?: string;
    className?: string;
}) {
    return (
        <div className={cn('relative lg:w-48', className)}>
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                aria-label={ariaLabel}
                className="h-11 w-full appearance-none rounded-xl border border-border bg-card pe-4 ps-9 text-[13px] font-semibold text-foreground outline-none focus:ring-2 focus:ring-primary/40"
            >
                {options.map((o) => (
                    <option key={o.value} value={o.value}>
                        {o.label}
                    </option>
                ))}
            </select>
            <ChevronDown className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        </div>
    );
}
