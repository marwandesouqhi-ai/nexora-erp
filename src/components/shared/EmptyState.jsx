import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Card, CardContent } from '@/components/ui/card';

const cn = (...inputs) => twMerge(clsx(inputs));

export default function EmptyState({ icon: Icon, title, description, action, className }) {
    return (
        <Card className={cn('border-dashed border-border/80 bg-background/60 p-0 shadow-none', className)}>
            <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                {Icon ? (
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-sm">
                        <Icon className="h-7 w-7" aria-hidden="true" />
                    </div>
                ) : null}
                <div className="space-y-1">
                    <h3 className="text-base font-bold text-foreground">{title}</h3>
                    {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
                </div>
                {action ? <div className="pt-2">{action}</div> : null}
            </CardContent>
        </Card>
    );
}
