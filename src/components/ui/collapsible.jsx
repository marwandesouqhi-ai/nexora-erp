import { createContext, useContext, useState, forwardRef } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
const cn = (...i) => twMerge(clsx(i));

const CollapsibleContext = createContext(null);

function Collapsible({ open, defaultOpen = false, onOpenChange, children, className, ...props }) {
    const isControlled = open !== undefined;
    const [internal, setInternal] = useState(defaultOpen);
    const isOpen = isControlled ? open : internal;

    const setOpen = (v) => {
        if (!isControlled) setInternal(v);
        onOpenChange?.(v);
    };

    return (
        <CollapsibleContext.Provider value={{ isOpen, setOpen }}>
            <div className={cn(className)} {...props}>{children}</div>
        </CollapsibleContext.Provider>
    );
}

const CollapsibleTrigger = forwardRef(({ className, children, ...props }, ref) => {
    const ctx = useContext(CollapsibleContext);
    return (
        <button
            ref={ref}
            type="button"
            aria-expanded={ctx?.isOpen}
            onClick={() => ctx?.setOpen(!ctx.isOpen)}
            className={cn(className)}
            {...props}
        >
            {children}
        </button>
    );
});
CollapsibleTrigger.displayName = 'CollapsibleTrigger';

const CollapsibleContent = forwardRef(({ className, children, ...props }, ref) => {
    const ctx = useContext(CollapsibleContext);
    if (!ctx?.isOpen) return null;
    return (
        <div ref={ref} className={cn('overflow-hidden', className)} {...props}>
            {children}
        </div>
    );
});
CollapsibleContent.displayName = 'CollapsibleContent';

export { Collapsible, CollapsibleTrigger, CollapsibleContent };