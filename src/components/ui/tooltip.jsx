import { createContext, useContext, useState, useRef, forwardRef, useId } from 'react';
import { createPortal } from 'react-dom';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
const cn = (...i) => twMerge(clsx(i));

const TooltipContext = createContext(null);

// للتوافق مع استيراد shadcn القياسي (<TooltipProvider> عادةً محايد بدون Radix)
function TooltipProvider({ children }) {
    return children;
}

function Tooltip({ children }) {
    const [open, setOpen] = useState(false);
    const triggerRef = useRef(null);
    const id = useId();
    return (
        <TooltipContext.Provider value={{ open, setOpen, triggerRef, id }}>
            {children}
        </TooltipContext.Provider>
    );
}

const TooltipTrigger = forwardRef(({ children, ...props }) => {
    const ctx = useContext(TooltipContext);
    return (
        <span
            onMouseEnter={() => ctx?.setOpen(true)}
            onMouseLeave={() => ctx?.setOpen(false)}
            onFocus={() => ctx?.setOpen(true)}
            onBlur={() => ctx?.setOpen(false)}
            aria-describedby={ctx?.open ? `${ctx.id}-tip` : undefined}
            {...props}
        >
            {children}
        </span>
    );
});
TooltipTrigger.displayName = 'TooltipTrigger';

const TooltipContent = forwardRef(({ className, children, sideOffset = 6, ...props }, ref) => {
    const ctx = useContext(TooltipContext);
    if (!ctx?.open || !ctx.triggerRef.current) return null;
    const rect = ctx.triggerRef.current.getBoundingClientRect();

    return createPortal(
        <div
            ref={ref}
            id={`${ctx.id}-tip`}
            role="tooltip"
            style={{
                position: 'fixed',
                top: rect.top - sideOffset,
                left: rect.left + rect.width / 2,
                transform: 'translate(-50%, -100%)',
            }}
            className={cn(
                'z-[110] max-w-xs rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background shadow-float',
                className
            )}
            {...props}
        >
            {children}
        </div>,
        document.body
    );
});
TooltipContent.displayName = 'TooltipContent';

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };