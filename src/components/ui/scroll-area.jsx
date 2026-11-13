import { forwardRef } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
const cn = (...i) => twMerge(clsx(i));

/** بدون @radix-ui/react-scroll-area (غير مثبتة) — overflow قياسي مع scrollbar مُنسّق بـ CSS */
const ScrollArea = forwardRef(({ className, children, ...props }, ref) => (
    <div
        ref={ref}
        className={cn(
            'relative overflow-auto',
            '[scrollbar-width:thin] [scrollbar-color:var(--border-strong)_transparent]',
            className
        )}
        {...props}
    >
        {children}
    </div>
));
ScrollArea.displayName = 'ScrollArea';

const ScrollBar = () => null; // موجود فقط للتوافق مع استيراد shadcn القياسي، غير مطلوب مع overflow الأصلي

export { ScrollArea, ScrollBar };