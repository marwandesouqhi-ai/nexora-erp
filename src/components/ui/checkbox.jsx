import { forwardRef } from 'react';
import { Check } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
const cn = (...i) => twMerge(clsx(i));

/** Checkbox مبني بـ <button role="checkbox"> بدون @radix-ui/react-checkbox (غير مثبتة) */
const Checkbox = forwardRef(({ className, checked = false, onCheckedChange, disabled, ...props }, ref) => (
    <button
        ref={ref}
        type="button"
        role="checkbox"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onCheckedChange?.(!checked)}
        className={cn(
            'flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border border-border-strong shadow',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-50',
            checked ? 'bg-primary border-primary text-white' : 'bg-card ',
            className
        )}
        {...props}
    >
        {checked && <Check className="h-3 w-3" />}
    </button>
));
Checkbox.displayName = 'Checkbox';

export { Checkbox };