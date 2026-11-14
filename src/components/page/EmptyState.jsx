import { Inbox } from 'lucide-react';
import { cn } from '@/lib/utils';

/** حالة فارغة: أيقونة 44px باهتة + نص 13px */
export default function EmptyState({ icon: Icon = Inbox, text, children, className }) {
    return (
        <div className={cn('flex flex-col items-center justify-center gap-3 py-14 text-center', className)}>
            <Icon className="h-11 w-11 text-muted-foreground/60" strokeWidth={1.5} aria-hidden="true" />
            {text ? <p className="max-w-md text-[13px] text-muted-foreground">{text}</p> : null}
            {children}
        </div>
    );
}
