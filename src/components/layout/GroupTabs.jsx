import { memo, useEffect, useMemo, useRef } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useRole } from '@/lib/RoleContext';
import { findNavContext, GROUP_ACCENTS, GROUP_ICONS, isNavItemVisible } from '@/lib/navigation';
import { getTone } from '@/components/page/tones';
import { cn } from '@/lib/utils';

/**
 * الشريط الثاني تحت الـ TopBar: صفحات مجموعة المسار الحالي فقط.
 * نفس فلترة الصلاحيات المستخدمة في البوابة: can(item.permission).
 */
function GroupTabs() {
    const { can, role } = useRole();
    const location = useLocation();
    const activeRef = useRef(null);

    const ctx = findNavContext(location.pathname);
    const group = ctx?.group;

    const items = useMemo(
        () => (group ? group.items.filter((i) => isNavItemVisible(i, can, role)) : []),
        [group, can, role]
    );

    useEffect(() => {
        activeRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }, [location.pathname]);

    if (!group || items.length === 0) return null;

    const GroupIcon = GROUP_ICONS[group.label];
    const tone = getTone(GROUP_ACCENTS[group.label]);

    return (
        <nav
            aria-label={group.label}
            className="flex h-12 flex-shrink-0 items-center gap-3 border-b border-border bg-card px-4 lg:px-6"
        >
            <div className="flex shrink-0 items-center gap-2">
                {GroupIcon ? (
                    <span className={cn('flex h-[26px] w-[26px] items-center justify-center rounded-lg', tone.soft)}>
                        <GroupIcon className="h-[15px] w-[15px]" aria-hidden="true" />
                    </span>
                ) : null}
                <span className="hidden text-[13px] font-bold text-foreground sm:inline">{group.label}</span>
            </div>

            <div className="no-scrollbar flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto">
                {items.map((item) => {
                    const Icon = item.icon;
                    return (
                        <NavLink
                            key={item.key}
                            to={item.path}
                            end
                            ref={(el) => {
                                if (el && location.pathname === item.path) activeRef.current = el;
                            }}
                            className={({ isActive }) =>
                                cn(
                                    'inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                                    isActive
                                        ? 'bg-primary text-white shadow-sm shadow-primary/30'
                                        : 'text-secondary-text hover:bg-card-muted hover:text-foreground'
                                )
                            }
                        >
                            {Icon ? <Icon className="h-[15px] w-[15px]" aria-hidden="true" /> : null}
                            {item.label}
                        </NavLink>
                    );
                })}
            </div>

            <span className="hidden shrink-0 text-[11px] text-muted-foreground sm:inline">{items.length} صفحات</span>
        </nav>
    );
}

export default memo(GroupTabs);
