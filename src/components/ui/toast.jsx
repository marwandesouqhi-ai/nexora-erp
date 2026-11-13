import { forwardRef } from 'react';
import * as ToastPrimitives from '@radix-ui/react-toast';
import { X } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

const cn = (...inputs) => twMerge(clsx(inputs));

const ToastProvider = ToastPrimitives.Provider;

// التوستات تظهر أسفل يسار الشاشة (ثابت فيزيائياً بغض النظر عن اتجاه الصفحة)
const ToastViewport = forwardRef(({ className, ...props }, ref) => (
    <ToastPrimitives.Viewport
        ref={ref}
        className={cn(
            'fixed bottom-0 left-0 z-[100] flex max-h-screen w-full flex-col gap-2 p-4 outline-none sm:max-w-[400px]',
            className
        )}
        {...props}
    />
));
ToastViewport.displayName = 'ToastViewport';

const VARIANT_CLASSES = {
    default: 'border border-border bg-card text-foreground shadow-float',
    success: 'bg-success text-white shadow-float',
    danger: 'bg-danger text-white shadow-float',
    destructive: 'bg-danger text-white shadow-float',
};

const Toast = forwardRef(({ className, variant = 'default', ...props }, ref) => (
    <ToastPrimitives.Root
        ref={ref}
        className={cn(
            'group pointer-events-auto relative flex w-full items-center justify-between gap-3 overflow-hidden rounded-xl p-4 pe-9 transition-all',
            'data-[state=open]:animate-toast-in data-[state=closed]:opacity-0',
            'data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)]',
            VARIANT_CLASSES[variant] || VARIANT_CLASSES.default,
            className
        )}
        {...props}
    />
));
Toast.displayName = 'Toast';

const ToastAction = forwardRef(({ className, ...props }, ref) => (
    <ToastPrimitives.Action
        ref={ref}
        className={cn(
            'inline-flex h-8 shrink-0 items-center justify-center rounded-lg border border-current/25 bg-transparent px-3 text-xs font-semibold transition-colors',
            'hover:bg-black/5 focus:outline-none focus:ring-2 focus:ring-primary dark:hover:bg-white/10',
            className
        )}
        {...props}
    />
));
ToastAction.displayName = 'ToastAction';

const ToastClose = forwardRef(({ className, ...props }, ref) => (
    <ToastPrimitives.Close
        ref={ref}
        className={cn(
            'absolute end-2 top-2 rounded-md p-1 opacity-60 transition-opacity',
            'hover:opacity-100 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-current/40',
            className
        )}
        toast-close=""
        {...props}
    >
        <X className="h-4 w-4" />
    </ToastPrimitives.Close>
));
ToastClose.displayName = 'ToastClose';

const ToastTitle = forwardRef(({ className, ...props }, ref) => (
    <ToastPrimitives.Title ref={ref} className={cn('text-[13px] font-bold', className)} {...props} />
));
ToastTitle.displayName = 'ToastTitle';

const ToastDescription = forwardRef(({ className, ...props }, ref) => (
    <ToastPrimitives.Description ref={ref} className={cn('text-xs opacity-90', className)} {...props} />
));
ToastDescription.displayName = 'ToastDescription';

export {
    ToastProvider,
    ToastViewport,
    Toast,
    ToastTitle,
    ToastDescription,
    ToastClose,
    ToastAction,
};
