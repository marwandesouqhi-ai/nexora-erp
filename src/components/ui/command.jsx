/* eslint-disable react-refresh/only-export-components */
import { useMemo, forwardRef } from 'react';
import { Search } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
const cn = (...i) => twMerge(clsx(i));

const Command = forwardRef(({ className, children, ...props }, ref) => (
    <div
        ref={ref}
        className={cn('flex h-full w-full flex-col overflow-hidden rounded-md bg-card text-foreground ', className)}
        {...props}
    >
        {children}
    </div>
));
Command.displayName = 'Command';

function CommandInput({ className, value, onValueChange, placeholder = 'ابحث...', ...props }) {
    return (
        <div className="flex items-center gap-2 border-b border-border px-3 ">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <input
                value={value}
                onChange={(e) => onValueChange?.(e.target.value)}
                placeholder={placeholder}
                className={cn('flex h-11 w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground', className)}
                {...props}
            />
        </div>
    );
}

const CommandList = forwardRef(({ className, ...props }, ref) => (
    <div ref={ref} className={cn('max-h-72 overflow-y-auto overflow-x-hidden p-1', className)} {...props} />
));
CommandList.displayName = 'CommandList';

function CommandEmpty({ children = 'لا توجد نتائج' }) {
    return <div className="py-6 text-center text-sm text-muted-foreground">{children}</div>;
}

const CommandGroup = forwardRef(({ className, heading, children, ...props }, ref) => (
    <div ref={ref} className={cn('overflow-hidden p-1 text-foreground ', className)} {...props}>
        {heading && <p className="px-2 py-1.5 text-xs font-bold text-muted-foreground ">{heading}</p>}
        {children}
    </div>
));
CommandGroup.displayName = 'CommandGroup';

const CommandItem = forwardRef(({ className, onSelect, ...props }, ref) => (
    <div
        ref={ref}
        role="option"
        tabIndex={0}
        onClick={() => onSelect?.()}
        onKeyDown={(e) => (e.key === 'Enter') && onSelect?.()}
        className={cn(
            'relative flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none',
            'hover:bg-card-muted ',
            className
        )}
        {...props}
    />
));
CommandItem.displayName = 'CommandItem';

/** Hook مساعد لفلترة عناصر بسيطة نصيًا — استخدم مع CommandInput */
function useCommandFilter(items, query, getLabel = (i) => String(i)) {
    return useMemo(() => {
        if (!query) return items;
        const q = query.toLowerCase();
        return items.filter((item) => getLabel(item).toLowerCase().includes(q));
    }, [items, query, getLabel]);
}

export { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem, useCommandFilter };