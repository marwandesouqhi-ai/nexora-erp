import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

const cn = (...inputs) => twMerge(clsx(inputs));

const VARIANT_CLASSES = {
    default: 'border-transparent bg-primary text-white hover:bg-primary/90',
    secondary: 'border-transparent bg-card-muted text-foreground hover:bg-border ',
    destructive: 'border-transparent bg-danger text-white hover:bg-danger/90',
    outline: 'text-secondary-text border-border ',
};

function Badge({ className, variant = 'default', ...props }) {
    return (
        <span
            className={cn(
                'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors',
                'focus:outline-none focus:ring-2 focus:ring-primary/40',
                VARIANT_CLASSES[variant] || VARIANT_CLASSES.default,
                className
            )}
            {...props}
        />
    );
}

export { Badge };