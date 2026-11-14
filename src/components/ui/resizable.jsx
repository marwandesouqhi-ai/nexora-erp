import { createContext, useContext, useRef, useCallback, forwardRef } from 'react';
import { GripVertical } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
const cn = (...i) => twMerge(clsx(i));

const ResizableContext = createContext(null);

const ResizablePanelGroup = forwardRef(({ className, direction = 'horizontal', children, ...props }, ref) => (
    <ResizableContext.Provider value={{ direction }}>
        <div
            ref={ref}
            className={cn('flex h-full w-full', direction === 'vertical' && 'flex-col', className)}
            {...props}
        >
            {children}
        </div>
    </ResizableContext.Provider>
));
ResizablePanelGroup.displayName = 'ResizablePanelGroup';

const ResizablePanel = forwardRef(({ className, defaultSize = 50, ...props }, ref) => (
    <div ref={ref} style={{ flexBasis: `${defaultSize}%` }} className={cn('overflow-auto', className)} {...props} />
));
ResizablePanel.displayName = 'ResizablePanel';

const ResizableHandle = ({ className, withHandle }) => {
    const ctx = useContext(ResizableContext);
    const dragging = useRef(false);

    const onMouseDown = useCallback((e) => {
        dragging.current = true;
        e.preventDefault();
    }, []);

    return (
        <div
            onMouseDown={onMouseDown}
            role="separator"
            aria-orientation={ctx?.direction === 'vertical' ? 'horizontal' : 'vertical'}
            className={cn(
                'relative flex items-center justify-center bg-card-muted transition-colors hover:bg-primary-soft',
                ctx?.direction === 'vertical' ? 'h-1 w-full cursor-row-resize' : 'w-1 cursor-col-resize',
                className
            )}
        >
            {withHandle && (
                <div className="z-10 flex h-4 w-3 items-center justify-center rounded-sm border border-border bg-card ">
                    <GripVertical className="h-2.5 w-2.5" />
                </div>
            )}
        </div>
    );
};

export { ResizablePanelGroup, ResizablePanel, ResizableHandle };