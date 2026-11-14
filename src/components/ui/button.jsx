import { forwardRef } from 'react';
import { Slot } from '@radix-ui/react-slot';
import { Loader2 } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

const cn = (...inputs) => twMerge(clsx(inputs));

const VARIANT_CLASSES = {
    default: 'bg-primary text-primary-foreground shadow-sm shadow-primary/20 hover:bg-primary/90 hover:shadow-md hover:shadow-primary/25',
    destructive: 'bg-destructive text-destructive-foreground shadow-sm shadow-destructive/20 hover:bg-destructive/90 hover:shadow-md hover:shadow-destructive/25',
    outline:
        'border border-border bg-transparent shadow-sm hover:bg-accent hover:text-accent-foreground hover:border-primary/30',
    secondary:
        'bg-secondary text-secondary-foreground shadow-sm shadow-secondary/20 hover:bg-secondary/90 hover:shadow-md hover:shadow-secondary/25',
    ghost: 'hover:bg-accent hover:text-accent-foreground',
    link: 'text-primary underline-offset-4 hover:underline',
};

const SIZE_CLASSES = {
    default: 'h-10 px-4 py-2',
    sm: 'h-9 rounded-lg px-3 text-xs',
    lg: 'h-12 rounded-xl px-8 text-base',
    icon: 'h-10 w-10',
};

const Button = forwardRef(
    ({ className, variant = 'default', size = 'default', asChild = false, disabled, loading = false, children, ...props }, ref) => {
        const Comp = asChild ? Slot : 'button';
        const isDisabled = disabled || loading;

        return (
            <Comp
                ref={ref}
                disabled={isDisabled}
                aria-busy={loading || undefined}
                className={cn(
                    'group inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all duration-200 ease-out',
                    'active:scale-[0.98]',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                    'disabled:pointer-events-none disabled:opacity-50 disabled:active:scale-100',
                    variant === 'destructive' && 'motion-safe:animate-[button-shake_0.32s_ease-in-out]',
                    VARIANT_CLASSES[variant] || VARIANT_CLASSES.default,
                    SIZE_CLASSES[size] || SIZE_CLASSES.default,
                    className
                )}
                {...props}
            >
                {loading ? (
                    <>
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                        {children}
                    </>
                ) : (
                    children
                )}
            </Comp>
        );
    }
);
Button.displayName = 'Button';

export { Button };