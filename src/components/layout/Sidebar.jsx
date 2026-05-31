import { Link, useLocation } from 'react-router-dom';
import { useRole } from '@/lib/RoleContext';
import {
    LayoutDashboard, ShoppingCart, Package, Users,
    Truck, ShoppingBag, Banknote, Calculator, X, Activity,
    UserCog, ChevronRight,
} from 'lucide-react';

const navGroups = [
    {
        label: 'الرئيسية',
        items: [
            { key: 'dashboard', label: 'لوحة التحكم', path: '/', icon: LayoutDashboard, permission: 'can_view_dashboard' },
        ]
    },
    {
        label: 'المبيعات والعملاء',
        items: [
            { key: 'sales', label: 'المبيعات والفواتير', path: '/sales', icon: ShoppingCart, permission: 'can_view_sales' },
            { key: 'customers', label: 'قاعدة العملاء', path: '/customers', icon: Users, permission: 'can_view_customers' },
        ]
    },
    {
        label: 'المخزون والمشتريات',
        items: [
            { key: 'inventory', label: 'إدارة الأصناف', path: '/inventory', icon: Package, permission: 'can_view_inventory' },
            { key: 'purchases', label: 'طلبات الشراء', path: '/purchases', icon: ShoppingBag, permission: 'can_view_purchases' },
            { key: 'suppliers', label: 'الموردون', path: '/suppliers', icon: Truck, permission: 'can_view_suppliers' },
        ]
    },
    {
        label: 'الحسابات والمالية',
        items: [
            { key: 'debts', label: 'الديون والتحصيل', path: '/debts', icon: Banknote, permission: 'can_view_debts' },
            { key: 'accounts', label: 'الخزينة والرواتب', path: '/accounts', icon: Calculator, permission: 'can_view_accounts' },
        ]
    },
    {
        label: 'الإدارة والنظام',
        items: [
            { key: 'activity', label: 'سجل العمليات', path: '/activity', icon: Activity, permission: 'can_view_activity_log' },
            { key: 'users', label: 'صلاحيات المستخدمين', path: '/users', icon: UserCog, permission: 'can_manage_users' },
        ]
    },
];

export default function Sidebar({ open, onClose }) {
    const { can, role, user } = useRole();
    const location = useLocation();

    const roleLabels = { admin: 'المدير العام', accountant: 'المحاسب المالي', sales_rep: 'مسؤول مبيعات' };
    const roleColors = { admin: 'text-indigo-400', accountant: 'text-amber-400', sales_rep: 'text-emerald-400' };

    return (
        <>
            {open && (
                <div className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-sm" onClick={onClose} />
            )}

            <aside className={`
        fixed top-0 right-0 z-50 h-full w-64 flex flex-col
        bg-slate-900 border-l border-slate-800
        transform transition-transform duration-300 ease-in-out
        lg:translate-x-0
        ${open ? 'translate-x-0' : 'translate-x-full'}
      `}>
                {/* Logo Section */}
                <div className="flex items-center justify-between px-6 py-6 border-b border-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
                            <span className="text-white font-bold text-xl uppercase">N</span>
                        </div>
                        <div>
                            <h1 className="font-bold text-lg text-white tracking-wide">Nexora ERP</h1>
                            <p className="text-[10px] text-slate-400 font-medium italic">نظام الإدارة الذكي</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="lg:hidden p-1.5 rounded-lg hover:bg-slate-800 text-slate-400">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Navigation Section */}
                <nav className="flex-1 overflow-y-auto px-4 py-4 space-y-6 scrollbar-hide">
                    {navGroups.map(group => {
                        const visibleItems = group.items.filter(i => can(i.permission));
                        if (!visibleItems.length) return null;
                        return (
                            <div key={group.label}>
                                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest px-2 mb-3 leading-none">
                                    {group.label}
                                </p>
                                <div className="space-y-1">
                                    {visibleItems.map(item => {
                                        const isActive = location.pathname === item.path;
                                        const Icon = item.icon;
                                        return (
                                            <Link
                                                key={item.key}
                                                to={item.path}
                                                onClick={onClose}
                                                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group
                          ${isActive
                                                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                                                        : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                                                    }`}
                                            >
                                                <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-white' : 'text-slate-500 group-hover:text-indigo-400'}`} />
                                                <span className="flex-1">{item.label}</span>
                                                {isActive && <ChevronRight className="w-3 h-3 text-white/70" />}
                                            </Link>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </nav>

                {/* User Info Section */}
                <div className="px-4 py-5 border-t border-slate-800 bg-slate-900/50">
                    <div className="flex items-center gap-3 px-3 py-3 rounded-xl bg-slate-800/40 border border-slate-700/50">
                        <div className="w-9 h-9 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center">
                            <span className="text-indigo-400 text-sm font-bold">
                                {(user?.email || 'N').charAt(0).toUpperCase()}
                            </span>
                        </div>
                        <div className="min-w-0">
                            <p className="text-xs font-bold text-white truncate">
                                {user?.displayName || user?.email?.split('@')[0] || 'مدير النظام'}
                            </p>
                            <p className={`text-[10px] font-semibold ${roleColors[role] || 'text-slate-500'}`}>
                                {roleLabels[role] || 'مسؤول'}
                            </p>
                        </div>
                    </div>
                </div>
            </aside>
        </>
    );
}