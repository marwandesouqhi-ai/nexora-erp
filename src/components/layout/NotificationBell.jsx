import { memo } from 'react';
import { Bell, Package, Award, AlertTriangle, MinusCircle, Fingerprint, CheckCheck } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useNotifications } from '@/hooks/useNotifications';

function NotificationBell() {
    const { notifications = [], count = 0, markAsRead, markAllAsRead } = useNotifications() || {};

    const renderItemIcon = (item) => {
        if (item.type === 'payroll_adjustment') {
            if (item.metadata?.type === 'incentive') {
                return (
                    <div className="rounded-md bg-emerald-100 p-1.5 dark:bg-emerald-500/10 text-emerald-600">
                        <Award className="h-4 w-4" />
                    </div>
                );
            }
            if (item.metadata?.type === 'penalty') {
                return (
                    <div className="rounded-md bg-rose-100 p-1.5 dark:bg-rose-500/10 text-rose-600">
                        <AlertTriangle className="h-4 w-4" />
                    </div>
                );
            }
            return (
                <div className="rounded-md bg-amber-100 p-1.5 dark:bg-amber-500/10 text-amber-600">
                    <MinusCircle className="h-4 w-4" />
                </div>
            );
        }

        if (item.type === 'attendance_checkin') {
            return (
                <div className="rounded-md bg-primary/10 p-1.5 text-primary">
                    <Fingerprint className="h-4 w-4" />
                </div>
            );
        }

        return (
            <div className="rounded-md bg-amber-100 p-1.5 dark:bg-amber-500/10 text-amber-600">
                <Package className="h-4 w-4" />
            </div>
        );
    };

    return (
        <DropdownMenu dir="rtl">
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="relative h-9 w-9 rounded-full text-secondary-text hover:bg-card-muted hover:text-foreground"
                    aria-label={count > 0 ? `${count} تنبيهات جديدة` : 'التنبيهات'}
                >
                    <Bell className="h-[18px] w-[18px]" />
                    {count > 0 && (
                        <Badge className="absolute -top-0.5 -right-0.5 flex h-5 w-5 animate-pulse items-center justify-center border-2 border-card p-0 bg-danger text-white">
                            {count > 9 ? '9+' : count}
                        </Badge>
                    )}
                </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="mt-2 w-88 border-border p-2 shadow-xl ">
                <DropdownMenuLabel className="flex items-center justify-between px-2 py-1.5">
                    <span className="font-bold text-foreground ">التنبيهات والإشعارات</span>
                    <div className="flex items-center gap-2">
                        {count > 0 && (
                            <Badge variant="outline" className="text-[10px]">
                                {count} تنبيهات
                            </Badge>
                        )}
                        {count > 0 && (
                            <button
                                onClick={markAllAsRead}
                                className="text-[11px] text-primary hover:underline flex items-center gap-1 font-semibold"
                            >
                                <CheckCheck className="h-3 w-3" />
                                قراءة الكل
                            </button>
                        )}
                    </div>
                </DropdownMenuLabel>

                <DropdownMenuSeparator />

                <div className="max-h-[350px] overflow-y-auto">
                    {count === 0 ? (
                        <div className="py-8 text-center">
                            <Bell className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40 " aria-hidden="true" />
                            <p className="text-xs text-muted-foreground">لا توجد تنبيهات جديدة حالياً</p>
                        </div>
                    ) : (
                        notifications.map((item) => (
                            <DropdownMenuItem
                                key={item.id}
                                onClick={() => markAsRead(item.id)}
                                className="mb-1 flex cursor-pointer flex-col items-start gap-1 rounded-xl border-b border-border/40 p-2.5 last:border-0 hover:bg-muted/50 transition-colors"
                            >
                                <div className="flex w-full items-start gap-2">
                                    {renderItemIcon(item)}
                                    <div className="flex-1">
                                        <p className="text-xs font-bold text-foreground leading-tight">
                                            {item.title || item.name}
                                        </p>
                                        <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                                            {item.message || (item.quantity ? `هذا المنتج قارب على النفاد (باقي ${item.quantity})` : '')}
                                        </p>
                                    </div>
                                    {item.quantity && (
                                        <Badge variant="secondary" className="text-[10px]">
                                            باقي {item.quantity}
                                        </Badge>
                                    )}
                                </div>
                            </DropdownMenuItem>
                        ))
                    )}
                </div>

                <DropdownMenuSeparator />
                <div className="flex gap-1 pt-1">
                    <Button
                        asChild
                        variant="ghost"
                        className="flex-1 text-[11px] font-bold text-primary hover:bg-primary/5"
                    >
                        <a href="/attendance">حضور المندوبين</a>
                    </Button>
                    <Button
                        asChild
                        variant="ghost"
                        className="flex-1 text-[11px] font-bold text-primary hover:bg-primary/5"
                    >
                        <a href="/payroll">كشف الرواتب والتسويات</a>
                    </Button>
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

export default memo(NotificationBell);