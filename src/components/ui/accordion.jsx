import { createContext, useContext, useState, forwardRef } from 'react';
import { ChevronDown } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
const cn = (...i) => twMerge(clsx(i));

const AccordionContext = createContext(null);
const AccordionItemContext = createContext(null);

function Accordion({ type = 'single', value, defaultValue, onValueChange, className, children, ...props }) {
    const isControlled = value !== undefined;
    const [internal, setInternal] = useState(defaultValue ?? (type === 'multiple' ? [] : ''));
    const current = isControlled ? value : internal;

    const setValue = (itemValue) => {
        let next;
        if (type === 'multiple') {
            next = current.includes(itemValue) ? current.filter((v) => v !== itemValue) : [...current, itemValue];
        } else {
            next = current === itemValue ? '' : itemValue;
        }
        if (!isControlled) setInternal(next);
        onValueChange?.(next);
    };

    const isOpen = (itemValue) => (type === 'multiple' ? current.includes(itemValue) : current === itemValue);

    return (
        <AccordionContext.Provider value={{ isOpen, setValue }}>
            <div className={cn(className)} {...props}>{children}</div>
        </AccordionContext.Provider>
    );
}

const AccordionItem = forwardRef(({ className, value, ...props }, ref) => (
    <AccordionItemContext.Provider value={value}>
        <div ref={ref} className={cn('border-b border-border ', className)} {...props} />
    </AccordionItemContext.Provider>
));
AccordionItem.displayName = 'AccordionItem';

const AccordionTrigger = forwardRef(({ className, children, ...props }, ref) => {
    const ctx = useContext(AccordionContext);
    const itemValue = useContext(AccordionItemContext);
    const open = ctx?.isOpen(itemValue);
    return (
        <button
            ref={ref}
            type="button"
            aria-expanded={open}
            onClick={() => ctx?.setValue(itemValue)}
            className={cn(
                'flex w-full flex-1 items-center justify-between py-4 text-sm font-bold transition-all hover:underline',
                className
            )}
            {...props}
        >
            {children}
            <ChevronDown className={cn('h-4 w-4 shrink-0 transition-transform duration-200', open && 'rotate-180')} />
        </button>
    );
});
AccordionTrigger.displayName = 'AccordionTrigger';

const AccordionContent = forwardRef(({ className, children, ...props }, ref) => {
    const ctx = useContext(AccordionContext);
    const itemValue = useContext(AccordionItemContext);
    if (!ctx?.isOpen(itemValue)) return null;
    return (
        <div ref={ref} className={cn('overflow-hidden pb-4 text-sm', className)} {...props}>
            {children}
        </div>
    );
});
AccordionContent.displayName = 'AccordionContent';

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent };