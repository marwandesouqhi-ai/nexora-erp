import { createContext, useContext, useState, useRef, useEffect, forwardRef, isValidElement, cloneElement, useId } from 'react';
import { createPortal } from 'react-dom';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
const cn = (...i) => twMerge(clsx(i));

const PopoverContext = createContext(null);

function Popover({ open, defaultOpen = false, onOpenChange, children }) {
    const isControlled = open !== undefined;
    const [internal, setInternal] = useState(defaultOpen);
    const isOpen = isControlled ? open : internal;
    const triggerRef = useRef(null);
    const id = useId();

    const setOpen = (v) => {
        if (!isControlled) setInternal(v);
        onOpenChange?.(v);
    };

    return (
        <PopoverContext.Provider value={{ isOpen, setOpen, triggerRef, id }}>
            {children}
        </PopoverContext.Provider>
    );
}

const PopoverTrigger = forwardRef(({ asChild, children, ...props }) => {
    const ctx = useContext(PopoverContext);
    const sharedProps = {
        onClick: () => ctx?.setOpen(!ctx.isOpen),
        'aria-expanded': ctx?.isOpen,
        'aria-controls': `${ctx?.id}-popover`,
    };
    if (asChild && isValidElement(children)) return cloneElement(children, sharedProps);
    return <button type="button" {...sharedProps} {...props}>{children}</button>;
});
PopoverTrigger.displayName = 'PopoverTrigger';

const PopoverContent = forwardRef(({ className, align = 'center', children, ...props }, ref) => {
    const ctx = useContext(PopoverContext);
    const contentRef = useRef(null);

    useEffect(() => {
        if (!ctx?.isOpen) return undefined;
        const handleClick = (e) => {
            if (contentRef.current?.contains(e.target) || ctx.triggerRef.current?.contains(e.target)) return;
            ctx.setOpen(false);
        };
        const handleKey = (e) => e.key === 'Escape' && ctx.setOpen(false);
        document.addEventListener('mousedown', handleClick);
        document.addEventListener('keydown', handleKey);
        return () => {
            document.removeEventListener('mousedown', handleClick);
            document.removeEventListener('keydown', handleKey);
        };
    }, [ctx]);

    if (!ctx?.isOpen || !ctx.triggerRef.current) return null;
    const rect = ctx.triggerRef.current.getBoundingClientRect();
    const left = align === 'end' ? rect.right - 288 + window.scrollX : align === 'start' ? rect.left + window.scrollX : rect.left + rect.width / 2 - 144 + window.scrollX;

    return createPortal(
        <div
            ref={(node) => { contentRef.current = node; if (typeof ref === 'function') ref(node); }}
            id={`${ctx.id}-popover`}
            role="dialog"
            style={{ position: 'absolute', top: rect.bottom + window.scrollY + 8, left, width: 288 }}
            className={cn(
                'z-50 rounded-md border border-border bg-card p-4 shadow-md outline-none ',
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
PopoverContent.displayName = 'PopoverContent';

export { Popover, PopoverTrigger, PopoverContent };