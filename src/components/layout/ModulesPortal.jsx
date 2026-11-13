import { useState, useEffect, useRef, useMemo, useCallback, memo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutGrid, X, Search, ArrowUpLeft, Zap, ChevronLeft, SearchX } from 'lucide-react';
import { useRole } from '@/lib/RoleContext';
import {
    NAV_GROUPS, QUICK_ACTIONS, GROUP_ACCENTS, GROUP_ICONS, ACCENT_HEX, getDisplayName, isNavItemVisible,
} from '@/lib/navigation';
import { cn } from '@/lib/utils';

// ─── Accent class maps (complete strings so Tailwind picks them up) ───────────
// Tinted box: light = -100 / -600 · dark = -500/15 / -400
const TINT_BOX = {
    amber: 'bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400',
    emerald: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400',
    cyan: 'bg-cyan-100 text-cyan-600 dark:bg-cyan-500/15 dark:text-cyan-400',
    indigo: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-400',
    rose: 'bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400',
    slate: 'bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-400',
};

const TITLE_TEXT = {
    amber: 'text-amber-600 dark:text-amber-400',
    emerald: 'text-emerald-600 dark:text-emerald-400',
    cyan: 'text-cyan-600 dark:text-cyan-400',
    indigo: 'text-indigo-600 dark:text-indigo-400',
    rose: 'text-rose-600 dark:text-rose-400',
    slate: 'text-slate-600 dark:text-slate-400',
};

const QA_ARROW = 'text-[color:color-mix(in_srgb,var(--a)_70%,transparent)] dark:text-white/40';

// ─── Arabic-aware, case-insensitive search normalisation ─────────────────────
function normalize(value) {
    return String(value || '')
        .toLowerCase()
        .replace(/[ً-ْـ]/g, '') // تشكيل + تطويل
        .replace(/[أإآ]/g, 'ا')
        .replace(/ة/g, 'ه')
        .replace(/ى/g, 'ي')
        .trim();
}

function matches(query, ...fields) {
    if (!query) return true;
    return fields.some((f) => normalize(f).includes(query));
}

// ─── Small building blocks ───────────────────────────────────────────────────
function Kbd({ children }) {
    return (
        <kbd
            dir="ltr"
            className="inline-flex h-5 items-center rounded-md border border-border bg-card-muted px-1.5 font-sans text-[10px] font-semibold text-muted-foreground dark:border-white/12 dark:bg-white/5 dark:text-slate-400"
        >
            {children}
        </kbd>
    );
}

function TabPill({ active, variant = 'group', count, icon: Icon, children, onClick }) {
    const styles = {
        all: active
            ? 'border border-transparent bg-indigo-600 text-white'
            : 'border border-border bg-card text-secondary-text hover:border-border-strong dark:border-white/10 dark:bg-white/5 dark:text-slate-300',
        quick: cn(
            'border border-amber-400/60 bg-amber-50 text-amber-700 dark:border-amber-500/50 dark:bg-amber-500/12 dark:text-amber-300',
            active && 'ring-2 ring-amber-400/40'
        ),
        group: active
            ? 'border border-transparent bg-slate-900 text-white dark:border-white/25 dark:bg-white/12'
            : 'border border-border bg-card text-secondary-text hover:border-border-strong dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:border-white/20',
    };
    const onDark = (variant === 'all' || variant === 'group') && active;
    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={active}
            className={cn(
                'inline-flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-4 text-[12.5px] font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
                styles[variant]
            )}
        >
            {Icon ? <Icon className="h-4 w-4" aria-hidden="true" /> : null}
            {children}
            <span
                className={cn(
                    'inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10.5px] font-bold tabular-nums',
                    onDark ? 'bg-white/20' : 'bg-black/5 dark:bg-white/10'
                )}
            >
                {count}
            </span>
        </button>
    );
}

function QuickActionCard({ action, onOpen }) {
    const Icon = action.icon;
    return (
        <button
            type="button"
            onClick={() => onOpen(action.path)}
            style={{ '--a': action.hex }}
            className="portal-qa flex h-[76px] w-full items-center gap-3 rounded-2xl p-4 text-start"
        >
            <span
                className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl text-white shadow-sm"
                style={{ backgroundColor: action.hex }}
            >
                <Icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-extrabold text-foreground dark:text-white">{action.label}</span>
                <span className="mt-0.5 block truncate text-[11px] text-secondary-text dark:text-slate-300">
                    {action.subtitle}
                </span>
            </span>
            <ArrowUpLeft className={cn('h-4 w-4 shrink-0', QA_ARROW)} aria-hidden="true" />
        </button>
    );
}

function ModuleCard({ item, accent, active, onOpen }) {
    const Icon = item.icon;
    return (
        <button
            type="button"
            onClick={() => onOpen(item.path)}
            style={{ '--a': ACCENT_HEX[accent] }}
            aria-current={active ? 'page' : undefined}
            className={cn(
                'portal-module relative flex h-[118px] w-full flex-col justify-between rounded-2xl p-4 text-start',
                active && 'is-active'
            )}
        >
            <span className="flex items-start justify-between">
                <span className={cn('flex h-10 w-10 items-center justify-center rounded-xl', TINT_BOX[accent])}>
                    {Icon ? <Icon className="h-5 w-5" aria-hidden="true" /> : null}
                </span>
                {active ? (
                    <span className="rounded-full bg-primary-soft px-2 py-0.5 text-[10px] font-bold text-primary dark:bg-indigo-500/20 dark:text-indigo-300">
                        نشط الآن
                    </span>
                ) : (
                    <ChevronLeft className="h-4 w-4 text-muted-foreground dark:text-slate-600" aria-hidden="true" />
                )}
            </span>
            <span className="min-w-0">
                <span className="block truncate text-[15px] font-extrabold text-foreground dark:text-white">{item.label}</span>
                <span className="mt-0.5 block truncate text-[11px] text-muted-foreground dark:text-slate-400">
                    {item.description}
                </span>
            </span>
        </button>
    );
}

// ─── Panel (mounted only while open → state resets automatically) ────────────
function PortalPanel({ onClose }) {
    const { can, user, role } = useRole();
    const navigate = useNavigate();
    const location = useLocation();
    const scrollRef = useRef(null);
    const sectionRefs = useRef({});
    const [search, setSearch] = useState('');
    const [activeTab, setActiveTab] = useState('all');

    // ── Body scroll lock + Esc ───────────────────────────────────────────────
    useEffect(() => {
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        const onKey = (e) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => {
            document.body.style.overflow = prev;
            window.removeEventListener('keydown', onKey);
        };
    }, [onClose]);

    // ── Permission filtering (same check the sidebar used: can(permission)) ──
    const visibleGroups = useMemo(
        () =>
            NAV_GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => isNavItemVisible(i, can, role)) })).filter(
                (g) => g.items.length > 0
            ),
        [can, role]
    );
    const visibleQuickActions = useMemo(() => QUICK_ACTIONS.filter((a) => can(a.permission)), [can]);

    // ── Search ───────────────────────────────────────────────────────────────
    const query = normalize(search);
    const groups = useMemo(
        () =>
            visibleGroups
                .map((g) => ({
                    ...g,
                    items: g.items.filter((i) => matches(query, i.label, i.description, i.path)),
                }))
                .filter((g) => g.items.length > 0),
        [visibleGroups, query]
    );
    const quickActions = useMemo(
        () => visibleQuickActions.filter((a) => matches(query, a.label, a.subtitle, a.path)),
        [visibleQuickActions, query]
    );
    const totalModules = groups.reduce((n, g) => n + g.items.length, 0);
    const nothingFound = quickActions.length === 0 && groups.length === 0;

    const openPath = useCallback(
        (path) => {
            navigate(path);
            onClose();
        },
        [navigate, onClose]
    );

    const handleSearchKey = (e) => {
        if (e.key !== 'Enter') return;
        const first = quickActions[0]?.path || groups[0]?.items[0]?.path;
        if (first) {
            e.preventDefault();
            openPath(first);
        }
    };

    // ── Tabs → smooth scroll, scroll → active tab ───────────────────────────
    const scrollToSection = (key) => {
        setActiveTab(key);
        const container = scrollRef.current;
        if (!container) return;
        if (key === 'all') {
            container.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }
        const el = sectionRefs.current[key];
        if (el) container.scrollTo({ top: el.offsetTop - 16, behavior: 'smooth' });
    };

    const handleScroll = () => {
        const container = scrollRef.current;
        if (!container) return;
        const top = container.scrollTop;
        if (top < 8) {
            setActiveTab('all');
            return;
        }
        const order = ['quick', ...groups.map((g) => g.label)];
        let current = 'all';
        for (const key of order) {
            const el = sectionRefs.current[key];
            if (el && el.offsetTop - 40 <= top) current = key;
        }
        setActiveTab(current);
    };

    const displayName = getDisplayName(user);

    return (
        <div
            className="fixed inset-0 z-50 flex animate-fade-in items-center justify-center bg-slate-900/35 backdrop-blur-sm dark:bg-black/55"
            onMouseDown={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
            dir="rtl"
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="modules-portal-title"
                className="flex h-[82vh] w-[92vw] max-w-[1150px] animate-pop-in flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-float dark:border-white/8 dark:bg-[#0E1527]"
            >
                {/* ── Header ─────────────────────────────────────────────── */}
                <header className="flex flex-wrap items-center gap-4 border-b border-border bg-card px-5 py-4 dark:border-white/8 dark:bg-[#0E1527] lg:grid lg:grid-cols-[1fr_auto_1fr]">
                    <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm">
                            <LayoutGrid className="h-5 w-5" aria-hidden="true" />
                        </span>
                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                                <h2 id="modules-portal-title" className="text-lg font-extrabold text-foreground dark:text-white">
                                    بوابة الموديولات والأنظمة
                                </h2>
                                <span className="rounded-full border border-primary/20 bg-primary-soft px-2 py-0.5 text-[10px] font-semibold text-primary dark:border-white/12 dark:bg-white/6 dark:text-indigo-300" dir="ltr">
                                    Nexora Modules
                                </span>
                            </div>
                            <p className="mt-0.5 text-[11px] text-muted-foreground dark:text-slate-400">
                                تنقل سريع بين الموديولات والصفحات الفرعية للنظام
                            </p>
                        </div>
                    </div>

                    <div className="relative order-last w-full lg:order-none lg:w-[320px]">
                        <Search className="pointer-events-none absolute start-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground dark:text-slate-400" aria-hidden="true" />
                        <input
                            type="search"
                            autoFocus
                            value={search}
                            onChange={(e) => {
                                setSearch(e.target.value);
                                scrollRef.current?.scrollTo({ top: 0 });
                                setActiveTab('all');
                            }}
                            onKeyDown={handleSearchKey}
                            placeholder="ابحث عن موديول أو صفحة أو إجراء..."
                            aria-label="بحث في الموديولات"
                            className="h-11 w-full rounded-full border border-indigo-500/70 bg-input pe-16 ps-11 text-[13px] text-foreground outline-none placeholder:text-muted-foreground focus:ring-4 focus:ring-indigo-500/20 dark:bg-[#141C33] dark:text-white dark:placeholder:text-slate-500"
                        />
                        <kbd
                            dir="ltr"
                            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 rounded-md border border-border bg-card px-1.5 py-0.5 font-sans text-[10px] font-semibold text-muted-foreground dark:border-white/12 dark:bg-white/8 dark:text-slate-400"
                        >
                            Ctrl+K
                        </kbd>
                    </div>

                    <div className="ms-auto flex justify-end lg:ms-0">
                        <button
                            type="button"
                            onClick={onClose}
                            aria-label="إغلاق البوابة"
                            className="flex h-9 w-9 items-center justify-center rounded-full bg-card-muted text-secondary-text transition-colors hover:bg-border focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                </header>

                {/* ── Tabs row ───────────────────────────────────────────── */}
                <div className="portal-tabs-scroll flex shrink-0 items-center gap-2 overflow-x-auto border-b border-border bg-card px-5 pb-2.5 pt-3 dark:border-white/8 dark:bg-[#0E1527]">
                    <TabPill variant="all" active={activeTab === 'all'} count={totalModules} icon={LayoutGrid} onClick={() => scrollToSection('all')}>
                        كافة الموديولات
                    </TabPill>
                    {quickActions.length > 0 ? (
                        <TabPill variant="quick" active={activeTab === 'quick'} count={quickActions.length} icon={Zap} onClick={() => scrollToSection('quick')}>
                            إجراءات سريعة
                        </TabPill>
                    ) : null}
                    {groups.map((g) => (
                        <TabPill
                            key={g.label}
                            active={activeTab === g.label}
                            count={g.items.length}
                            icon={GROUP_ICONS[g.label]}
                            onClick={() => scrollToSection(g.label)}
                        >
                            {g.label}
                        </TabPill>
                    ))}
                </div>

                {/* ── Scroll area ────────────────────────────────────────── */}
                <div
                    ref={scrollRef}
                    onScroll={handleScroll}
                    className="relative flex-1 space-y-7 overflow-y-auto bg-[#F6F8FC] p-5 dark:bg-[#0B1120]"
                >
                    {nothingFound ? (
                        <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
                            <SearchX className="h-11 w-11 text-muted-foreground/60 dark:text-slate-600" strokeWidth={1.5} />
                            <p className="text-[13px] text-muted-foreground dark:text-slate-400">
                                لا توجد نتائج مطابقة لـ “{search}”
                            </p>
                        </div>
                    ) : null}

                    {quickActions.length > 0 ? (
                        <section
                            ref={(el) => { sectionRefs.current.quick = el; }}
                            className="rounded-2xl border border-border bg-card p-5 dark:border-white/8 dark:bg-white/[0.02]"
                        >
                            <div className="mb-4 flex items-center justify-between gap-3">
                                <div className="flex items-center gap-3">
                                    <span className={cn('flex h-[34px] w-[34px] items-center justify-center rounded-xl', TINT_BOX.amber)}>
                                        <Zap className="h-[18px] w-[18px]" aria-hidden="true" />
                                    </span>
                                    <div>
                                        <h3 className="text-base font-extrabold text-foreground dark:text-white">إجراءات سريعة فورية</h3>
                                        <p className="text-[11px] text-muted-foreground dark:text-slate-400">
                                            وصول مباشر لأكثر العمليات تكراراً في المنظومة
                                        </p>
                                    </div>
                                </div>
                                <span
                                    dir="ltr"
                                    className="rounded-full border border-amber-400/60 bg-amber-50 px-2.5 py-0.5 text-[10px] font-bold text-amber-700 dark:border-amber-500/50 dark:bg-transparent dark:text-amber-300"
                                >
                                    Quick Actions
                                </span>
                            </div>
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                                {quickActions.map((a) => (
                                    <QuickActionCard key={a.key} action={a} onOpen={openPath} />
                                ))}
                            </div>
                        </section>
                    ) : null}

                    {groups.map((g) => {
                        const accent = GROUP_ACCENTS[g.label] || 'indigo';
                        const GroupIcon = GROUP_ICONS[g.label];
                        return (
                            <section key={g.label} ref={(el) => { sectionRefs.current[g.label] = el; }}>
                                <div className="mb-4 flex items-center justify-between gap-3 border-b border-border pb-3 dark:border-white/6">
                                    <div className="flex items-center gap-2.5">
                                        <span className={cn('flex h-[30px] w-[30px] items-center justify-center rounded-full', TINT_BOX[accent])}>
                                            {GroupIcon ? <GroupIcon className="h-4 w-4" aria-hidden="true" /> : null}
                                        </span>
                                        <h3 className={cn('text-base font-extrabold', TITLE_TEXT[accent])}>{g.label}</h3>
                                    </div>
                                    <span className="text-[11px] text-muted-foreground dark:text-slate-500">
                                        {g.items.length} صفحات داخلية
                                    </span>
                                </div>
                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                    {g.items.map((item) => (
                                        <ModuleCard
                                            key={item.key}
                                            item={item}
                                            accent={accent}
                                            active={location.pathname === item.path}
                                            onOpen={openPath}
                                        />
                                    ))}
                                </div>
                            </section>
                        );
                    })}
                </div>

                {/* ── Footer ─────────────────────────────────────────────── */}
                <footer className="flex h-14 shrink-0 items-center justify-between gap-4 border-t border-border bg-card px-5 dark:border-white/6 dark:bg-[#0E1527]">
                    <div className="flex min-w-0 items-center gap-2.5">
                        <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-extrabold text-white">
                            {displayName.charAt(0).toUpperCase()}
                        </span>
                        <span className="truncate text-xs font-bold text-foreground dark:text-white">{displayName}</span>
                        <span className="hidden text-[11px] text-muted-foreground sm:inline dark:text-slate-500">• نظام الإدارة</span>
                    </div>
                    <div className="hidden items-center gap-4 text-[11px] text-muted-foreground sm:flex dark:text-slate-500">
                        <span className="inline-flex items-center gap-1.5">
                            <Kbd>Esc</Kbd>
                            للإغلاق
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                            <Kbd>Ctrl + K</Kbd>
                            للفتح في أي وقت
                        </span>
                    </div>
                </footer>
            </div>
        </div>
    );
}

function ModulesPortal({ open, onClose }) {
    if (!open) return null;
    return createPortal(<PortalPanel onClose={onClose} />, document.body);
}

export default memo(ModulesPortal);
