import { createContext, useContext, useEffect, useId, useRef, useState, forwardRef, cloneElement, isValidElement } from 'react';
import { createPortal } from 'react-dom';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

const cn = (...inputs) => twMerge(clsx(inputs));

const DropdownMenuContext = createContext(null);
function useDropdownMenu() {
    const ctx = useContext(DropdownMenuContext);
    if (!ctx) throw new Error('DropdownMenu components must be used inside <DropdownMenu>');
    return ctx;
}

/**
 * تطبيق خفيف (بدون Radix) لقائمة منسدلة، بنفس واجهة shadcn/ui القياسية:
 * <DropdownMenu><DropdownMenuTrigger/><DropdownMenuContent>...</DropdownMenuContent></DropdownMenu>
 */
function DropdownMenu({ children, dir = 'rtl' }) {
    const [open, setOpen] = useState(false);
    const triggerRef = useRef(null);
    const id = useId();

    return (
        <DropdownMenuContext.Provider value={{ open, setOpen, triggerRef, id, dir }}>
            <div className="relative inline-block" dir={dir}>
                {children}
            </div>
        </DropdownMenuContext.Provider>
    );
}

const DropdownMenuTrigger = forwardRef(({ asChild = false, children, ...props }, forwardedRef) => {
    const { open, setOpen, triggerRef, id } = useDropdownMenu();

    const mergedRef = (node) => {
        triggerRef.current = node;
        if (typeof forwardedRef === 'function') forwardedRef(node);
        else if (forwardedRef) forwardedRef.current = node;
    };

    const sharedProps = {
        ref: mergedRef,
        'aria-haspopup': 'menu',
        'aria-expanded': open,
        'aria-controls': `${id}-menu`,
        onClick: (e) => {
            children?.props?.onClick?.(e);
            props.onClick?.(e);
            setOpen((v) => !v);
        },
    };

    if (asChild && isValidElement(children)) {
        return cloneElement(children, props);
    }

    return (
        <button type="button" {...sharedProps} {...props}>
            {children}
        </button>
    );
});
DropdownMenuTrigger.displayName = 'DropdownMenuTrigger';

const DropdownMenuContent = forwardRef(({ className, align = 'start', children, ...props }, ref) => {
    const { open, setOpen, triggerRef, id } = useDropdownMenu();
    const contentRef = useRef(null);
    const [coords, setCoords] = useState(null);

    useEffect(() => {
        if (!open) return;
        const trigger = triggerRef.current;
        if (trigger) {
            const rect = trigger.getBoundingClientRect();
            setCoords({
                top: rect.bottom + window.scrollY + 8,
                left: align === 'end' ? undefined : rect.left + window.scrollX,
                right: align === 'end' ? window.innerWidth - rect.right - window.scrollX : undefined,
                minWidth: rect.width,
            });
        }
    }, [open, align, triggerRef]);

    // إغلاق عند الضغط برة القائمة أو مفتاح Escape
    useEffect(() => {
        if (!open) return undefined;
        const handleClick = (e) => {
            if (contentRef.current?.contains(e.target) || triggerRef.current?.contains(e.target)) return;
            setOpen(false);
        };
        const handleKey = (e) => e.key === 'Escape' && setOpen(false);
        document.addEventListener('mousedown', handleClick);
        document.addEventListener('keydown', handleKey);
        return () => {
            document.removeEventListener('mousedown', handleClick);
            document.removeEventListener('keydown', handleKey);
        };
    }, [open, setOpen, triggerRef]);

    if (!open || !coords) return null;

    return createPortal(
        <div
            ref={(node) => {
                contentRef.current = node;
                if (typeof ref === 'function') ref(node);
                else if (ref) ref.current = node;
            }}
            id={`${id}-menu`}
            role="menu"
            style={{ position: 'absolute', top: coords.top, left: coords.left, right: coords.right, minWidth: coords.minWidth }}
            className={cn(
                'z-50 max-h-[70vh] overflow-y-auto rounded-md border border-border bg-card p-1 shadow-lg',
                'animate-in fade-in-0 zoom-in-95',
                className
            )}
            {...props}
        >
            {children}
        </div>,
        document.body
    );
});
DropdownMenuContent.displayName = 'DropdownMenuContent';

const DropdownMenuItem = forwardRef(({ className, onClick, disabled, ...props }, ref) => {
    const { setOpen } = useDropdownMenu();
    return (
        <div
            ref={ref}
            role="menuitem"
            tabIndex={disabled ? -1 : 0}
            aria-disabled={disabled}
            onClick={(e) => {
                if (disabled) return;
                onClick?.(e);
                setOpen(false);
            }}
            onKeyDown={(e) => {
                if (disabled) return;
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onClick?.(e);
                    setOpen(false);
                }
            }}
            className={cn(
                'relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors',
                'focus:bg-card-muted hover:bg-card-muted',
                disabled && 'pointer-events-none opacity-50',
                className
            )}
            {...props}
        />
    );
});
DropdownMenuItem.displayName = 'DropdownMenuItem';

const DropdownMenuLabel = forwardRef(({ className, ...props }, ref) => (
    <div
        ref={ref}
        className={cn('px-2 py-1.5 text-xs font-bold text-muted-foreground ', className)}
        {...props}
    />
));
DropdownMenuLabel.displayName = 'DropdownMenuLabel';

const DropdownMenuSeparator = forwardRef(({ className, ...props }, ref) => (
    <div role="separator" ref={ref} className={cn('-mx-1 my-1 h-px bg-card-muted ', className)} {...props} />
));
DropdownMenuSeparator.displayName = 'DropdownMenuSeparator';

const DropdownMenuGroup = ({ children }) => <div role="group">{children}</div>;

export {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuGroup,
};