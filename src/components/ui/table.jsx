import { forwardRef } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

const cn = (...inputs) => twMerge(clsx(inputs));

const Table = forwardRef(({ className, ...props }, ref) => (
    <div className="relative w-full overflow-x-auto">
        <table ref={ref} className={cn('w-full caption-bottom text-sm', className)} {...props} />
    </div>
));
Table.displayName = 'Table';

const TableHeader = forwardRef(({ className, ...props }, ref) => (
    <thead ref={ref} className={cn('[&_tr]:border-0 [&_tr]:bg-card-muted [&_tr:hover]:bg-card-muted', className)} {...props} />
));
TableHeader.displayName = 'TableHeader';

const TableBody = forwardRef(({ className, ...props }, ref) => (
    <tbody ref={ref} className={cn('[&_tr:last-child]:border-0', className)} {...props} />
));
TableBody.displayName = 'TableBody';

const TableFooter = forwardRef(({ className, ...props }, ref) => (
    <tfoot
        ref={ref}
        className={cn('border-t border-border bg-card-muted/50 font-medium ', className)}
        {...props}
    />
));
TableFooter.displayName = 'TableFooter';

const TableRow = forwardRef(({ className, ...props }, ref) => (
    <tr
        ref={ref}
        className={cn(
            'border-b border-border transition-colors hover:bg-card-muted ',
            className
        )}
        {...props}
    />
));
TableRow.displayName = 'TableRow';

const TableHead = forwardRef(({ className, ...props }, ref) => (
    <th
        ref={ref}
        scope="col"
        className={cn(
            'h-11 px-4 text-start align-middle text-xs font-semibold text-muted-foreground first:rounded-s-lg last:rounded-e-lg [&:has([role=checkbox])]:pe-0',
            className
        )}
        {...props}
    />
));
TableHead.displayName = 'TableHead';

const TableCell = forwardRef(({ className, ...props }, ref) => (
    <td ref={ref} className={cn('h-14 px-4 py-2 align-middle text-[13px] [&:has([role=checkbox])]:pe-0', className)} {...props} />
));
TableCell.displayName = 'TableCell';

const TableCaption = forwardRef(({ className, ...props }, ref) => (
    <caption ref={ref} className={cn('mt-4 text-sm text-muted-foreground ', className)} {...props} />
));
TableCaption.displayName = 'TableCaption';

export { Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption };