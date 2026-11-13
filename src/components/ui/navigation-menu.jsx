import { forwardRef } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
const cn = (...i) => twMerge(clsx(i));

const NavigationMenu = forwardRef(({ className, children, ...props }, ref) => (
    <nav ref={ref} className={cn('relative z-10 flex max-w-max flex-1 items-center justify-center', className)} {...props}>
        {children}
    </nav>
));
NavigationMenu.displayName = 'NavigationMenu';

const NavigationMenuList = forwardRef(({ className, ...props }, ref) => (
    <ul ref={ref} className={cn('group flex flex-1 list-none items-center justify-center gap-1', className)} {...props} />
));
NavigationMenuList.displayName = 'NavigationMenuList';

const NavigationMenuItem = ({ className, ...props }) => <li className={cn(className)} {...props} />;

const NavigationMenuLink = forwardRef(({ className, to, ...props }, ref) => (
    <Link
        ref={ref}
        to={to || '#'}
        className={cn(
            'inline-flex h-10 items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors hover:bg-card-muted ',
            className
        )}
        {...props}
    />
));
NavigationMenuLink.displayName = 'NavigationMenuLink';

const NavigationMenuTrigger = forwardRef(({ className, children, ...props }, ref) => (
    <button
        ref={ref}
        className={cn(
            'inline-flex h-10 items-center justify-center gap-1 rounded-md px-4 py-2 text-sm font-medium transition-colors hover:bg-card-muted ',
            className
        )}
        {...props}
    >
        {children}
        <ChevronDown className="h-3 w-3 transition-transform group-data-[state=open]:rotate-180" aria-hidden="true" />
    </button>
));
NavigationMenuTrigger.displayName = 'NavigationMenuTrigger';

const NavigationMenuContent = forwardRef(({ className, ...props }, ref) => (
    <div ref={ref} className={cn('absolute top-full mt-2 rounded-md border border-border bg-card p-4 shadow-md ', className)} {...props} />
));
NavigationMenuContent.displayName = 'NavigationMenuContent';

export {
    NavigationMenu,
    NavigationMenuList,
    NavigationMenuItem,
    NavigationMenuLink,
    NavigationMenuTrigger,
    NavigationMenuContent,
};