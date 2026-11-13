import { LayoutDashboard, Users, CreditCard, Settings, ShieldAlert, Shield, FileText, ClipboardList, Building2, LifeBuoy } from 'lucide-react';
import type { ComponentType } from 'react';

export interface NavItem {
    name: string;
    href: string;
    icon: ComponentType<{ className?: string }>;
    roles?: string[];
    end?: boolean;
}

// نفس القائمة ونفس الأدوار اللي في Sidebar.tsx (أدوار فريق المنصة: platform_staff)
export const ADMIN_NAV: NavItem[] = [
    { name: 'الرئيسية', href: '/', icon: LayoutDashboard, roles: ['platform_admin', 'billing_admin', 'support_agent'], end: true },
    { name: 'العملاء', href: '/customers', icon: Users, roles: ['platform_admin', 'billing_admin', 'support_agent'] },
    { name: 'الاشتراكات', href: '/subscriptions', icon: CreditCard, roles: ['platform_admin', 'billing_admin', 'support_agent'] },
    { name: 'الفواتير والمالية', href: '/invoices', icon: FileText, roles: ['platform_admin', 'billing_admin'] },
    { name: 'المهام', href: '/tasks', icon: ClipboardList, roles: ['platform_admin', 'billing_admin', 'support_agent'] },
    { name: 'تذاكر الدعم', href: '/tickets', icon: LifeBuoy, roles: ['platform_admin', 'billing_admin', 'support_agent'] },
    { name: 'فريق العمل', href: '/team', icon: Shield, roles: ['platform_admin'] },
    { name: 'سجل النظام', href: '/audit-logs', icon: ShieldAlert, roles: ['platform_admin'] },
    { name: 'الإعدادات', href: '/settings', icon: Settings, roles: ['platform_admin'] },
];

export const PORTAL_NAV: NavItem[] = [
    { name: 'بيانات الشركة', href: '/portal', icon: Building2, end: true },
    { name: 'فواتيري', href: '/portal/invoices', icon: FileText },
];

/** نفس منطق Sidebar: الدور الافتراضي support_agent */
export function currentRoleOf(userRole: string | null | undefined): string {
    return userRole || 'support_agent';
}

export function filterNav(items: NavItem[], role: string): NavItem[] {
    return items.filter((item) => !item.roles || item.roles.includes(role));
}

export function roleLabel(role: string): string {
    if (role === 'super_admin') return 'مدير عام';
    if (role === 'platform_admin') return 'مدير المنصة';
    if (role === 'billing_admin') return 'مسؤول الفوترة';
    if (role === 'support_agent') return 'دعم فني';
    if (role === 'sales') return 'مبيعات';
    if (role === 'customer') return 'عميل';
    return 'دعم فني';
}

export function findActive(items: NavItem[], pathname: string): NavItem | undefined {
    return items.find((i) => (i.end ? pathname === i.href : pathname === i.href || pathname.startsWith(i.href + '/')));
}
