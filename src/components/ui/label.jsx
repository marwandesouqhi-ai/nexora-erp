import { forwardRef } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

const cn = (...inputs) => twMerge(clsx(inputs));

/**
 * لا نعتمد على @radix-ui/react-label لأنها غير مثبتة في المشروع؛
 * <label> عادي كافٍ لأننا لا نحتاج ميزات متقدمة (Peer selectors كافية).
 */
const Label = forwardRef(({ className, ...props }, ref) => (
    <label
        ref={ref}
        className={cn(
            'text-sm font-medium leading-none text-secondary-text peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ',
            className
        )}
        {...props}
    />
));
Label.displayName = 'Label';

export { Label };