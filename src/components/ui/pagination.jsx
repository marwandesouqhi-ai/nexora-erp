import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';
import { Button } from './button';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
const cn = (...i) => twMerge(clsx(i));

const Pagination = ({ className, ...props }) => (
    <nav aria-label="ترقيم الصفحات" className={cn('mx-auto flex w-full justify-center', className)} {...props} />
);

const PaginationContent = ({ className, ...props }) => (
    <ul className={cn('flex flex-row items-center gap-1', className)} {...props} />
);

const PaginationItem = ({ className, ...props }) => <li className={cn(className)} {...props} />;

const PaginationLink = ({ className, isActive, size = 'icon', ...props }) => (
    <Button
        variant={isActive ? 'outline' : 'ghost'}
        size={size}
        aria-current={isActive ? 'page' : undefined}
        className={cn(className)}
        {...props}
    />
);

const PaginationPrevious = (props) => (
    <PaginationLink aria-label="الصفحة السابقة" size="default" className="gap-1 pe-2.5" {...props}>
        <ChevronRight className="h-4 w-4 rtl:hidden" />
        <ChevronLeft className="h-4 w-4 ltr:hidden" />
        <span>السابق</span>
    </PaginationLink>
);

const PaginationNext = (props) => (
    <PaginationLink aria-label="الصفحة التالية" size="default" className="gap-1 ps-2.5" {...props}>
        <span>التالي</span>
        <ChevronLeft className="h-4 w-4 rtl:hidden" />
        <ChevronRight className="h-4 w-4 ltr:hidden" />
    </PaginationLink>
);

const PaginationEllipsis = ({ className, ...props }) => (
    <span aria-hidden="true" className={cn('flex h-9 w-9 items-center justify-center', className)} {...props}>
        <MoreHorizontal className="h-4 w-4" />
        <span className="sr-only">صفحات إضافية</span>
    </span>
);

export { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationPrevious, PaginationNext, PaginationEllipsis };