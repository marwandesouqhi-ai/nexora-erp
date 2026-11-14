import { forwardRef, useState } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
const cn = (...i) => twMerge(clsx(i));

const Avatar = forwardRef(({ className, ...props }, ref) => (
    <span ref={ref} className={cn('relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full', className)} {...props} />
));
Avatar.displayName = 'Avatar';

const AvatarImage = forwardRef(({ className, onError, alt = '', ...props }, ref) => {
    const [failed, setFailed] = useState(false);
    if (failed) return null;
    return (
        <img
            ref={ref}
            alt={alt}
            onError={(e) => { setFailed(true); onError?.(e); }}
            className={cn('aspect-square h-full w-full object-cover', className)}
            {...props}
        />
    );
});
AvatarImage.displayName = 'AvatarImage';

const AvatarFallback = forwardRef(({ className, ...props }, ref) => (
    <span
        ref={ref}
        className={cn('flex h-full w-full items-center justify-center rounded-full bg-card-muted text-sm font-bold text-secondary-text ', className)}
        {...props}
    />
));
AvatarFallback.displayName = 'AvatarFallback';

export { Avatar, AvatarImage, AvatarFallback };