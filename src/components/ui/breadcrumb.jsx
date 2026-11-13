import { forwardRef } from 'react';
import { ChevronLeft, MoreHorizontal } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
const cn = (...i) => twMerge(clsx(i));

const Breadcrumb = forwardRef(({ ...props }, ref) => <nav ref={ref} aria-label="مسار التنقل" {...props} />);
Breadcrumb.displayName = 'Breadcrumb';

const BreadcrumbList = forwardRef(({ className, ...props }, ref) => (
    <ol
        ref={ref}
        className={cn('flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground ', className)}
        {...props}
    />
));
BreadcrumbList.displayName = 'BreadcrumbList';

const BreadcrumbItem = forwardRef(({ className, ...props }, ref) => (
    <li ref={ref} className={cn('inline-flex items-center gap-1.5', className)} {...props} />
));
BreadcrumbItem.displayName = 'BreadcrumbItem';

const BreadcrumbLink = forwardRef(({ className, ...props }, ref) => (
    <a ref={ref} className={cn('transition-colors hover:text-foreground ', className)} {...props} />
));
BreadcrumbLink.displayName = 'BreadcrumbLink';

const BreadcrumbPage = forwardRef(({ className, ...props }, ref) => (
    <span ref={ref} role="link" aria-disabled="true" aria-current="page" className={cn('font-bold text-foreground ', className)} {...props} />
));
BreadcrumbPage.displayName = 'BreadcrumbPage';

const BreadcrumbSeparator = ({ className, children, ...props }) => (
    <li role="presentation" aria-hidden="true" className={cn('[&>svg]:h-3.5 [&>svg]:w-3.5', className)} {...props}>
        {children ?? <ChevronLeft className="rtl:rotate-180" />}
    </li>
);

const BreadcrumbEllipsis = ({ className, ...props }) => (
    <span role="presentation" aria-hidden="true" className={cn('flex h-9 w-9 items-center justify-center', className)} {...props}>
        <MoreHorizontal className="h-4 w-4" />
        <span className="sr-only">المزيد</span>
    </span>
);

export { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbPage, BreadcrumbSeparator, BreadcrumbEllipsis };