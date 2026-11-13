import { forwardRef } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import {
    DropdownMenu as Menu,
    DropdownMenuTrigger as MenuTrigger,
    DropdownMenuContent as MenuContent,
    DropdownMenuItem as MenuItem,
    DropdownMenuSeparator as MenuSeparator,
} from './dropdown-menu';
const cn = (...i) => twMerge(clsx(i));

const Menubar = forwardRef(({ className, ...props }, ref) => (
    <div
        ref={ref}
        role="menubar"
        className={cn('flex h-10 items-center gap-1 rounded-md border border-border bg-card p-1 ', className)}
        {...props}
    />
));
Menubar.displayName = 'Menubar';

const MenubarMenu = Menu;
const MenubarTrigger = forwardRef(({ className, ...props }, ref) => (
    <MenuTrigger
        ref={ref}
        className={cn('flex cursor-pointer select-none items-center rounded-sm px-3 py-1.5 text-sm font-medium hover:bg-card-muted ', className)}
        {...props}
    />
));
MenubarTrigger.displayName = 'MenubarTrigger';
const MenubarContent = MenuContent;
const MenubarItem = MenuItem;
const MenubarSeparator = MenuSeparator;

export { Menubar, MenubarMenu, MenubarTrigger, MenubarContent, MenubarItem, MenubarSeparator };