import { forwardRef } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
const cn = (...i) => twMerge(clsx(i));

const Drawer = DialogPrimitive.Root;
const DrawerTrigger = DialogPrimitive.Trigger;
const DrawerClose = DialogPrimitive.Close;
const DrawerPortal = DialogPrimitive.Portal;

const DrawerOverlay = forwardRef(({ className, ...props }, ref) => (
    <DialogPrimitive.Overlay ref={ref} className={cn('fixed inset-0 z-50 bg-slate-900/35 dark:bg-black/55', className)} {...props} />
));
DrawerOverlay.displayName = 'DrawerOverlay';

const DrawerContent = forwardRef(({ className, children, ...props }, ref) => (
    <DrawerPortal>
        <DrawerOverlay />
        <DialogPrimitive.Content
            ref={ref}
            className={cn(
                'fixed inset-x-0 bottom-0 z-50 mt-24 flex h-auto flex-col rounded-t-2xl border border-border bg-card text-foreground',
                'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom',
                className
            )}
            {...props}
        >
            <div className="mx-auto mt-4 h-1.5 w-12 rounded-full bg-border " />
            {children}
        </DialogPrimitive.Content>
    </DrawerPortal>
));
DrawerContent.displayName = 'DrawerContent';

const DrawerHeader = ({ className, ...props }) => <div className={cn('grid gap-1.5 p-4 text-center sm:text-start', className)} {...props} />;
const DrawerFooter = ({ className, ...props }) => <div className={cn('mt-auto flex flex-col gap-2 p-4', className)} {...props} />;
const DrawerTitle = forwardRef(({ className, ...props }, ref) => (
    <DialogPrimitive.Title ref={ref} className={cn('text-lg font-black text-foreground ', className)} {...props} />
));
DrawerTitle.displayName = 'DrawerTitle';
const DrawerDescription = forwardRef(({ className, ...props }, ref) => (
    <DialogPrimitive.Description ref={ref} className={cn('text-sm text-muted-foreground ', className)} {...props} />
));
DrawerDescription.displayName = 'DrawerDescription';

export { Drawer, DrawerTrigger, DrawerClose, DrawerContent, DrawerHeader, DrawerFooter, DrawerTitle, DrawerDescription };