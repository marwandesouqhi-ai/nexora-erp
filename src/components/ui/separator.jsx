import { forwardRef } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
const cn = (...i) => twMerge(clsx(i));

const Separator = forwardRef(({ className, orientation = 'horizontal', decorative = true, ...props }, ref) => (
    <div
        ref={ref}
        role={decorative ? 'none' : 'separator'}
        aria-orientation={decorative ? undefined : orientation}
        className={cn(
            'shrink-0 bg-card-muted ',
            orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px',
            className
        )}
        {...props}
    />
));
Separator.displayName = 'Separator';

export { Separator };