import { forwardRef } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
const cn = (...i) => twMerge(clsx(i));

const Progress = forwardRef(({ className, value = 0, max = 100, ...props }, ref) => {
    const pct = Math.min(100, Math.max(0, (value / max) * 100));
    return (
        <div
            ref={ref}
            role="progressbar"
            aria-valuenow={value}
            aria-valuemin={0}
            aria-valuemax={max}
            className={cn('relative h-2 w-full overflow-hidden rounded-full bg-card-muted ', className)}
            {...props}
        >
            <div
                className="h-full flex-1 bg-primary transition-all"
                style={{ width: `${pct}%`, transform: 'translateX(0)' }}
            />
        </div>
    );
});
Progress.displayName = 'Progress';

export { Progress };