import React, { useState, useEffect } from 'react';
import { Menu, LogOut, Clock, Calendar as CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/AuthContext';
import { useRole } from '@/lib/RoleContext';
import NotificationBell from './NotificationBell';

export default function Header({ onMenuToggle }) {
    const { logout } = useAuth();
    const { role, user } = useRole();
    const [currentTime, setCurrentTime] = useState(new Date());

    // تحديث الوقت كل دقيقة
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    const roleLabels = {
        admin: 'المدير العام',
        accountant: 'المحاسب المالي',
        sales_rep: 'مسؤول مبيعات'
    };

    const formatDate = (date) => {
        return new Intl.DateTimeFormat('ar-EG', {
            weekday: 'long',
            day: 'numeric',
            month: 'long'
        }).format(date);
    };

    return (
        <header className="h-16 bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-6 flex-shrink-0 sticky top-0 z-30">

            {/* الجزء الأيمن: المنيو والتعريف */}
            <div className="flex items-center gap-4">
                <Button
                    variant="ghost"
                    size="icon"
                    className="lg:hidden hover:bg-slate-100 rounded-xl"
                    onClick={onMenuToggle}
                >
                    <Menu className="w-5 h-5 text-slate-600" />
                </Button>

                <div className="hidden md:flex flex-col">
                    <h2 className="text-sm font-bold text-slate-800 leading-none">لوحة التحكم</h2>
                    <p className="text-[10px] text-slate-500 font-medium mt-1 uppercase tracking-wider">
                        Nexora ERP — الجيل القادم لإدارة المؤسسات
                    </p>
                </div>
            </div>

            {/* الجزء الأوسط: الوقت والتاريخ (إضافة جديدة) */}
            <div className="hidden lg:flex items-center gap-6 text-slate-500">
                <div className="flex items-center gap-2">
                    <CalendarIcon className="w-3.5 h-3.5 text-indigo-500" />
                    <span className="text-xs font-semibold">{formatDate(currentTime)}</span>
                </div>
                <div className="flex items-center gap-2 border-r border-slate-200 pr-6">
                    <Clock className="w-3.5 h-3.5 text-indigo-500" />
                    <span className="text-xs font-bold tabular-nums">
                        {currentTime.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                </div>
            </div>

            {/* الجزء الأيسر: التنبيهات والبروفايل */}
            <div className="flex items-center gap-3">

                <NotificationBell />

                <div className="h-8 w-[1px] bg-slate-200 mx-1 hidden sm:block"></div>

                <div className="flex items-center gap-3 pl-2 py-1 rounded-full bg-slate-50 border border-slate-100 pr-1 ml-2">
                    <div className="text-right hidden sm:block pl-2">
                        <p className="text-[11px] font-bold text-slate-800 leading-tight">
                            {user?.full_name || user?.email?.split('@')[0] || 'مستخدم'}
                        </p>
                        <p className="text-[9px] text-indigo-600 font-bold uppercase tracking-tighter">
                            {roleLabels[role] || role}
                        </p>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-indigo-600 shadow-sm flex items-center justify-center border-2 border-white">
                        <span className="text-white text-xs font-black">
                            {(user?.full_name || user?.email || 'N').charAt(0).toUpperCase()}
                        </span>
                    </div>
                </div>

                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => logout()}
                    className="w-9 h-9 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                    title="تسجيل الخروج"
                >
                    <LogOut className="w-4 h-4" />
                </Button>
            </div>
        </header>
    );
}