import { forwardRef } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
const cn = (...i) => twMerge(clsx(i));

const SIZE_CLASSES = { default: 'h-10 px-3', sm: 'h-9 px-2.5', lg: 'h-11 px-5' };
const VARIANT_CLASSES = {
    default: 'bg-transparent',
    outline: 'border border-border bg-transparent hover:bg-card-muted ',
};

const Toggle = forwardRef(({ className, variant = 'default', size = 'default', pressed = false, onPressedChange, ...props }, ref) => (
    <button
        ref={ref}
        type="button"
        aria-pressed={pressed}
        onClick={() => onPressedChange?.(!pressed)}
        className={cn(
            'inline-flex items-center justify-center gap-1 rounded-md text-sm font-medium transition-colors',
            'hover:bg-card-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-50 ',
            pressed && 'bg-card-muted text-foreground ',
            VARIANT_CLASSES[variant],
            SIZE_CLASSES[size],
            className
        )}
        {...props}
    />
));
Toggle.displayName = 'Toggle';

export { Toggle };