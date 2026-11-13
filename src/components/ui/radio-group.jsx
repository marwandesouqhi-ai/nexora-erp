import { createContext, useContext, forwardRef } from 'react';
import { Circle } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
const cn = (...i) => twMerge(clsx(i));

const RadioGroupContext = createContext(null);

const RadioGroup = forwardRef(({ className, value, onValueChange, ...props }, ref) => (
    <RadioGroupContext.Provider value={{ value, onValueChange }}>
        <div ref={ref} role="radiogroup" className={cn('grid gap-2', className)} {...props} />
    </RadioGroupContext.Provider>
));
RadioGroup.displayName = 'RadioGroup';

const RadioGroupItem = forwardRef(({ className, value: itemValue, disabled, ...props }, ref) => {
    const ctx = useContext(RadioGroupContext);
    const checked = ctx?.value === itemValue;
    return (
        <button
            ref={ref}
            type="button"
            role="radio"
            aria-checked={checked}
            disabled={disabled}
            onClick={() => ctx?.onValueChange?.(itemValue)}
            className={cn(
                'flex h-4 w-4 items-center justify-center rounded-full border border-border-strong text-primary',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-50',
                className
            )}
            {...props}
        >
            {checked && <Circle className="h-2 w-2 fill-current text-current" />}
        </button>
    );
});
RadioGroupItem.displayName = 'RadioGroupItem';

export { RadioGroup, RadioGroupItem };