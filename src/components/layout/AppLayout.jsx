import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import { RoleProvider } from '@/lib/RoleContext';
import { useNotifications } from '@/hooks/useNotifications'; // الـ Hook اللي هيراقب المخزون والنشاط

export default function AppLayout() {
    const [sidebarOpen, setSidebarOpen] = useState(false);

    // تفعيل مراقبة التنبيهات (المخزون + الواتساب) بمجرد فتح التطبيق
    useNotifications();

    return (
        <RoleProvider>
            <div className="flex h-screen bg-background overflow-hidden" dir="rtl">
                {/* Sidebar - القائمة الجانبية */}
                <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

                {/* Main Content - المحتوى الرئيسي */}
                {/* ملحوظة: lg:mr-64 تضمن عدم تداخل المحتوى مع السايدبار في الشاشات الكبيرة */}
                <div className="flex-1 flex flex-col min-w-0 lg:mr-64 overflow-hidden transition-all duration-300">

                    {/* Header - أضفنا له خاصية فتح المنيو */}
                    <Header onMenuToggle={() => setSidebarOpen(true)} />

                    {/* Main Area - هنا تعرض الصفحات مثل Dashboard و Inventory */}
                    <main className="flex-1 overflow-y-auto p-4 lg:p-8 bg-slate-50/50">
                        <div className="max-w-7xl mx-auto">
                            <Outlet />
                        </div>
                    </main>

                </div>
            </div>
        </RoleProvider>
    );
}