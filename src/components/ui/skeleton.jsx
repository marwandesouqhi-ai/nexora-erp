import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
const cn = (...i) => twMerge(clsx(i));

/** عنصر تحميل (loading placeholder) قابل لإعادة الاستخدام في أي مكان */
function Skeleton({ className, ...props }) {
    return (
        <div
            role="status"
            aria-label="جاري التحميل"
            className={cn('animate-pulse rounded-2xl bg-card-muted', className)}
            {...props}
        />
    );
}

export { Skeleton };