import { Bell, Package } from 'lucide-react';
import { useNotifications } from '@/hooks/useNotifications';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function NotificationBell() {
    const { notifications, count } = useNotifications();

    return (
        <DropdownMenu dir="rtl">
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative hover:bg-slate-100 rounded-full w-10 h-10">
                    <Bell className="w-5 h-5 text-slate-600" />
                    {count > 0 && (
                        <Badge
                            className="absolute -top-0.5 -right-0.5 h-5 w-5 flex items-center justify-center p-0 bg-red-600 border-2 border-white animate-pulse"
                        >
                            {count}
                        </Badge>
                    )}
                </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-80 mt-2 p-2 shadow-xl border-slate-200">
                <DropdownMenuLabel className="flex items-center justify-between px-2 py-1.5">
                    <span className="font-bold text-slate-800">التنبيهات</span>
                    {count > 0 && <Badge variant="outline" className="text-[10px]">{count} تنبيهات نشطة</Badge>}
                </DropdownMenuLabel>

                <DropdownMenuSeparator />

                <div className="max-h-[300px] overflow-y-auto">
                    {count === 0 ? (
                        <div className="py-8 text-center">
                            <Bell className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                            <p className="text-xs text-slate-400">لا توجد تنبيهات حالياً</p>
                        </div>
                    ) : (
                        notifications.map((item) => (
                            <DropdownMenuItem key={item.id} className="p-3 cursor-pointer hover:bg-slate-50 rounded-lg mb-1 flex flex-col items-start gap-1 border-b border-slate-50 last:border-0">
                                <div className="flex items-center gap-2 w-full">
                                    <div className="bg-amber-100 p-1.5 rounded-md">
                                        <Package className="w-3.5 h-3.5 text-amber-600" />
                                    </div>
                                    <span className="text-xs font-bold text-slate-800 flex-1">{item.name}</span>
                                    <Badge variant="secondary" className="text-[10px] bg-amber-50 text-amber-700 border-amber-100">
                                        باقي {item.quantity}
                                    </Badge>
                                </div>
                                <p className="text-[10px] text-slate-500 mr-7">
                                    هذا المنتج وصل لحد الأمان، يرجى طلب كمية جديدة.
                                </p>
                            </DropdownMenuItem>
                        ))
                    )}
                </div>

                {count > 0 && (
                    <>
                        <DropdownMenuSeparator />
                        <Button variant="ghost" className="w-full text-[11px] font-bold text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 mt-1">
                            عرض كل المخزون
                        </Button>
                    </>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}