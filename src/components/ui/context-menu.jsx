import { createContext, useContext, useState, useRef, useEffect, forwardRef, useId } from 'react';
import { createPortal } from 'react-dom';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
const cn = (...i) => twMerge(clsx(i));

const ContextMenuContext = createContext(null);

function ContextMenu({ children }) {
    const [open, setOpen] = useState(false);
    const [point, setPoint] = useState({ x: 0, y: 0 });
    const id = useId();
    return (
        <ContextMenuContext.Provider value={{ open, setOpen, point, setPoint, id }}>
            {children}
        </ContextMenuContext.Provider>
    );
}

const ContextMenuTrigger = forwardRef(({ className, children, ...props }, ref) => {
    const ctx = useContext(ContextMenuContext);
    return (
        <div
            ref={ref}
            onContextMenu={(e) => {
                e.preventDefault();
                ctx.setPoint({ x: e.clientX, y: e.clientY });
                ctx.setOpen(true);
            }}
            className={cn(className)}
            {...props}
        >
            {children}
        </div>
    );
});
ContextMenuTrigger.displayName = 'ContextMenuTrigger';

const ContextMenuContent = forwardRef(({ className, children, ...props }, ref) => {
    const ctx = useContext(ContextMenuContext);
    const contentRef = useRef(null);

    useEffect(() => {
        if (!ctx.open) return undefined;
        const close = (e) => {
            if (!contentRef.current?.contains(e.target)) ctx.setOpen(false);
        };
        const escClose = (e) => e.key === 'Escape' && ctx.setOpen(false);
        document.addEventListener('mousedown', close);
        document.addEventListener('keydown', escClose);
        return () => {
            document.removeEventListener('mousedown', close);
            document.removeEventListener('keydown', escClose);
        };
    }, [ctx]);

    if (!ctx.open) return null;
    return createPortal(
        <div
            ref={(node) => { contentRef.current = node; if (typeof ref === 'function') ref(node); }}
            role="menu"
            style={{ position: 'fixed', top: ctx.point.y, left: ctx.point.x }}
            className={cn(
                'z-[110] min-w-[10rem] rounded-md border border-border bg-card p-1 shadow-lg ',
                className
            )}
            {...props}
        >
            {children}
        </div>,
        document.body
    );
});
ContextMenuContent.displayName = 'ContextMenuContent';

const ContextMenuItem = forwardRef(({ className, onClick, ...props }, ref) => {
    const ctx = useContext(ContextMenuContext);
    return (
        <div
            ref={ref}
            role="menuitem"
            tabIndex={0}
            onClick={(e) => { onClick?.(e); ctx.setOpen(false); }}
            className={cn(
                'cursor-pointer rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-card-muted ',
                className
            )}
            {...props}
        />
    );
});
ContextMenuItem.displayName = 'ContextMenuItem';

const ContextMenuSeparator = forwardRef(({ className, ...props }, ref) => (
    <div ref={ref} role="separator" className={cn('-mx-1 my-1 h-px bg-card-muted ', className)} {...props} />
));
ContextMenuSeparator.displayName = 'ContextMenuSeparator';

const ContextMenuLabel = forwardRef(({ className, ...props }, ref) => (
    <div ref={ref} className={cn('px-2 py-1.5 text-xs font-bold text-muted-foreground ', className)} {...props} />
));
ContextMenuLabel.displayName = 'ContextMenuLabel';

export { ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuLabel };