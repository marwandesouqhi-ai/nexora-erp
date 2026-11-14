import { createContext, useContext, forwardRef } from 'react';
import { Toggle } from './toggle';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
const cn = (...i) => twMerge(clsx(i));

const ToggleGroupContext = createContext({});

const ToggleGroup = forwardRef(({ className, type = 'single', value, onValueChange, children, ...props }, ref) => (
    <ToggleGroupContext.Provider value={{ type, value, onValueChange }}>
        <div ref={ref} role="group" className={cn('flex items-center gap-1', className)} {...props}>
            {children}
        </div>
    </ToggleGroupContext.Provider>
));
ToggleGroup.displayName = 'ToggleGroup';

const ToggleGroupItem = forwardRef(({ className, value: itemValue, children, ...props }, ref) => {
    const ctx = useContext(ToggleGroupContext);
    const isMulti = ctx.type === 'multiple';
    const pressed = isMulti ? (ctx.value || []).includes(itemValue) : ctx.value === itemValue;

    const handlePressedChange = () => {
        if (isMulti) {
            const next = pressed ? (ctx.value || []).filter((v) => v !== itemValue) : [...(ctx.value || []), itemValue];
            ctx.onValueChange?.(next);
        } else {
            ctx.onValueChange?.(pressed ? '' : itemValue);
        }
    };

    return (
        <Toggle ref={ref} pressed={pressed} onPressedChange={handlePressedChange} className={className} {...props}>
            {children}
        </Toggle>
    );
});
ToggleGroupItem.displayName = 'ToggleGroupItem';

export { ToggleGroup, ToggleGroupItem };