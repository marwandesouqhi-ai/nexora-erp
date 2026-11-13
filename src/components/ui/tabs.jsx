import { createContext, useContext, useId, forwardRef, useState } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
const cn = (...i) => twMerge(clsx(i));

const TabsContext = createContext(null);

const Tabs = forwardRef(({ className, value, defaultValue, onValueChange, children, ...props }, ref) => {
    const id = useId();
    const isControlled = value !== undefined;
    const [internal, setInternal] = useState(defaultValue);
    const current = isControlled ? value : internal;

    const setValue = (v) => {
        if (!isControlled) setInternal(v);
        onValueChange?.(v);
    };

    return (
        <TabsContext.Provider value={{ value: current, setValue, id }}>
            <div ref={ref} className={cn('w-full', className)} {...props}>
                {children}
            </div>
        </TabsContext.Provider>
    );
});
Tabs.displayName = 'Tabs';

const TabsList = forwardRef(({ className, ...props }, ref) => (
    <div
        ref={ref}
        role="tablist"
        className={cn(
            'inline-flex h-10 items-center justify-center rounded-lg bg-card-muted p-1 text-muted-foreground ',
            className
        )}
        {...props}
    />
));
TabsList.displayName = 'TabsList';

const TabsTrigger = forwardRef(({ className, value: itemValue, ...props }, ref) => {
    const ctx = useContext(TabsContext);
    const active = ctx?.value === itemValue;
    return (
        <button
            ref={ref}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => ctx?.setValue(itemValue)}
            className={cn(
                'inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-all',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:pointer-events-none disabled:opacity-50',
                active
                    ? 'bg-card text-foreground shadow-sm '
                    : 'hover:text-foreground ',
                className
            )}
            {...props}
        />
    );
});
TabsTrigger.displayName = 'TabsTrigger';

const TabsContent = forwardRef(({ className, value: itemValue, ...props }, ref) => {
    const ctx = useContext(TabsContext);
    if (ctx?.value !== itemValue) return null;
    return (
        <div
            ref={ref}
            role="tabpanel"
            className={cn('mt-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40', className)}
            {...props}
        />
    );
});
TabsContent.displayName = 'TabsContent';

export { Tabs, TabsList, TabsTrigger, TabsContent };