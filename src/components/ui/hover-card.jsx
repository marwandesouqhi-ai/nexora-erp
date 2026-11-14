// نفس منطق popover لكن بالتفعيل عبر hover بدل click
import { createContext, useContext, useState, useRef, forwardRef, useId } from 'react';
import { createPortal } from 'react-dom';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
const cn = (...i) => twMerge(clsx(i));

const HoverCardContext = createContext(null);

function HoverCard({ children, openDelay = 150, closeDelay = 150 }) {
    const [open, setOpenState] = useState(false);
    const triggerRef = useRef(null);
    const timerRef = useRef(null);
    const id = useId();

    const setOpen = (v, delay) => {
        clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => setOpenState(v), v ? openDelay : closeDelay ?? delay);
    };

    return (
        <HoverCardContext.Provider value={{ open, setOpen, triggerRef, id }}>
            {children}
        </HoverCardContext.Provider>
    );
}

const HoverCardTrigger = forwardRef(({ children, ...props }) => {
    const ctx = useContext(HoverCardContext);
    return (
        <span onMouseEnter={() => ctx?.setOpen(true)} onMouseLeave={() => ctx?.setOpen(false)} {...props}>
            {children}
        </span>
    );
});
HoverCardTrigger.displayName = 'HoverCardTrigger';

const HoverCardContent = forwardRef(({ className, children, ...props }, ref) => {
    const ctx = useContext(HoverCardContext);
    if (!ctx?.open || !ctx.triggerRef.current) return null;
    const rect = ctx.triggerRef.current.getBoundingClientRect();
    return createPortal(
        <div
            ref={ref}
            onMouseEnter={() => ctx.setOpen(true)}
            onMouseLeave={() => ctx.setOpen(false)}
            style={{ position: 'absolute', top: rect.bottom + window.scrollY + 8, left: rect.left + window.scrollX, width: 260 }}
            className={cn(
                'z-50 rounded-md border border-border bg-card p-4 shadow-md ',
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
HoverCardContent.displayName = 'HoverCardContent';

export { HoverCard, HoverCardTrigger, HoverCardContent };