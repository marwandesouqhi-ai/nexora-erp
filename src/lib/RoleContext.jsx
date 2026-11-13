/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext } from 'react';
import { useAuth } from '@/lib/AuthContext';

// These are product labels mapped onto the existing role architecture. `custom`
// uses the same audited per-user override model rather than a second ACL store.
export const ROLE_OPTIONS = ['owner', 'admin', 'general_manager', 'manager', 'accountant', 'sales_manager', 'sales_rep', 'inventory_manager', 'purchasing_manager', 'warehouse_employee', 'viewer', 'custom'];
export const ROLE_LABELS = {
    owner: 'مالك الشركة',
    admin: 'مدير عام',
    general_manager: 'مدير عام',
    manager: 'مدير تشغيل',
    accountant: 'محاسب',
    sales_manager: 'مدير مبيعات',
    sales_rep: 'مسؤول مبيعات',
    inventory_manager: 'مدير مخزون',
    purchasing_manager: 'مدير مشتريات',
    warehouse_employee: 'موظف مخزن',
    viewer: 'مشاهد',
    custom: 'دور مخصص',
};

export const getRolePermissions = (role) => {
    const normalizedRole = ROLE_OPTIONS.includes(role) ? role : 'sales_rep';
    return PERMISSIONS[normalizedRole] || PERMISSIONS.sales_rep;
};

export const PERMISSION_GROUPS = [
    {
        title: 'لوحة التحكم',
        permissions: [
            { key: 'can_view_dashboard', label: 'عرض لوحة التحكم' },
            { key: 'can_view_operations', label: 'إدارة التشغيل' },
            { key: 'can_view_reports', label: 'عرض التقارير' },
            { key: 'can_view_activity_log', label: 'عرض سجل الأنشطة' },
            { key: 'can_view_financials', label: 'عرض البيانات المالية' },
        ],
    },
    {
        title: 'المبيعات',
        permissions: [
            { key: 'can_view_sales', label: 'عرض المبيعات' },
            { key: 'can_create_sales', label: 'إضافة مبيعات' },
            { key: 'can_edit_sales', label: 'تعديل المبيعات' },
            { key: 'can_delete_sales', label: 'حذف المبيعات' },
        ],
    },
    {
        title: 'المخزون',
        permissions: [
            { key: 'can_view_inventory', label: 'عرض المخزون' },
            { key: 'can_edit_inventory', label: 'تعديل المخزون' },
        ],
    },
    {
        title: 'المشتريات',
        permissions: [
            { key: 'can_view_purchases', label: 'عرض المشتريات' },
            { key: 'can_create_purchases', label: 'إضافة مشتريات' },
        ],
    },
    {
        title: 'العملاء',
        permissions: [
            { key: 'can_view_customers', label: 'عرض العملاء' },
            { key: 'can_edit_customers', label: 'تعديل العملاء' },
            { key: 'can_delete_customers', label: 'حذف العملاء' },
        ],
    },
    {
        title: 'الموردون',
        permissions: [
            { key: 'can_view_suppliers', label: 'عرض الموردين' },
            { key: 'can_edit_suppliers', label: 'تعديل الموردين' },
        ],
    },
    {
        title: 'الديون',
        permissions: [
            { key: 'can_view_debts', label: 'عرض الديون' },
            { key: 'can_edit_debts', label: 'تعديل الديون' },
        ],
    },
    {
        title: 'الحسابات',
        permissions: [
            { key: 'can_view_accounts', label: 'عرض الحسابات' },
            { key: 'can_manage_accounts', label: 'إدارة الحسابات' },
        ],
    },
    {
        title: 'الموظفين والرواتب',
        permissions: [
            { key: 'can_view_employees', label: 'عرض الموظفين' },
            { key: 'can_edit_employees', label: 'تعديل الموظفين' },
            { key: 'can_manage_payroll', label: 'إدارة الرواتب' },
        ],
    },
    {
        title: 'المستخدمون',
        permissions: [
            { key: 'can_manage_users', label: 'إدارة المستخدمين' },
            { key: 'can_manage_settings', label: 'إدارة إعدادات النظام' },
        ],
    },
    {
        title: 'الأسعار',
        permissions: [
            { key: 'can_edit_prices', label: 'تعديل الأسعار' },
        ],
    },
    {
        title: 'الأتمتة والمساعد',
        permissions: [
            { key: 'can_manage_automations', label: 'إدارة الأتمتة' },
            { key: 'can_use_ai_assistant', label: 'استخدام مساعد AI' },
        ],
    },
];

const RoleContext = createContext();

const PERMISSIONS = {
    owner: {
        can_view_dashboard: true,
        can_view_operations: true,
        can_view_sales: true,
        can_create_sales: true,
        can_edit_sales: true,
        can_delete_sales: true,
        can_view_inventory: true,
        can_edit_inventory: true,
        can_view_purchases: true,
        can_create_purchases: true,
        can_view_customers: true,
        can_edit_customers: true,
        can_delete_customers: true,
        can_view_suppliers: true,
        can_edit_suppliers: true,
        can_view_financials: true,
        can_view_debts: true,
        can_edit_debts: true,
        can_view_accounts: true,
        can_view_employees: true,
        can_edit_employees: true,
        can_view_activity_log: true,
        can_manage_users: true,
        can_manage_settings: true,
        can_edit_prices: true,
        can_view_reports: true,
        can_manage_automations: true,
        can_use_ai_assistant: true,
    },
    admin: {
        can_view_dashboard: true,
        can_view_operations: true,
        can_view_sales: true,
        can_create_sales: true,
        can_edit_sales: true,
        can_delete_sales: true,
        can_view_inventory: true,
        can_edit_inventory: true,
        can_view_purchases: true,
        can_create_purchases: true,
        can_view_customers: true,
        can_edit_customers: true,
        can_delete_customers: true,
        can_view_suppliers: true,
        can_edit_suppliers: true,
        can_view_financials: true,
        can_view_debts: true,
        can_view_accounts: true,
        can_view_employees: true,
        can_edit_employees: true,
        can_view_activity_log: true,
        can_manage_users: true,
        can_manage_settings: true,
        can_edit_prices: true,
        can_view_reports: true,
        can_manage_automations: true,
        can_use_ai_assistant: true,
    },
    manager: {
        can_view_dashboard: true,
        can_view_operations: true,
        can_view_sales: true,
        can_view_financials: true,
        can_view_accounts: true,
        can_view_employees: true,
        can_edit_employees: true,
        can_view_debts: true,
        can_edit_debts: true,
        can_view_reports: true,
        can_view_activity_log: true,
        can_manage_payroll: false,
        can_manage_users: false,
        can_manage_settings: false,
        can_manage_automations: false,
        can_use_ai_assistant: true,
    },
    general_manager: {
        can_view_dashboard: true, can_view_operations: true, can_view_sales: true, can_create_sales: true,
        can_edit_sales: true, can_view_inventory: true, can_edit_inventory: true, can_view_purchases: true,
        can_create_purchases: true, can_view_customers: true, can_edit_customers: true, can_view_suppliers: true,
        can_edit_suppliers: true, can_view_financials: true, can_view_debts: true, can_edit_debts: true,
        can_view_accounts: true, can_view_employees: true, can_edit_employees: true, can_view_reports: true,
        can_view_activity_log: true, can_use_ai_assistant: true,
    },
    accountant: {
        can_view_dashboard: true,
        can_view_sales: true,
        can_create_sales: false,
        can_edit_sales: false,
        can_delete_sales: false,
        can_view_inventory: true,
        can_edit_inventory: false,
        can_view_purchases: true,
        can_create_purchases: false,
        can_view_customers: true,
        can_edit_customers: false,
        can_delete_customers: false,
        can_view_suppliers: true,
        can_edit_suppliers: false,
        can_view_financials: true,
        can_view_debts: true,
        can_edit_debts: true,
        can_view_accounts: true,
        can_manage_accounts: true,
        can_view_employees: true,
        can_edit_employees: false,
        can_manage_payroll: true,
        can_view_activity_log: true,
        can_manage_users: false,
        can_edit_prices: false,
        can_view_reports: true,
        can_manage_automations: false,
        can_use_ai_assistant: true,
    },
    sales_rep: {
        can_view_dashboard: true,
        can_view_sales: true,
        can_create_sales: true,
        can_edit_sales: false,
        can_delete_sales: false,
        can_view_inventory: true,
        can_edit_inventory: false,
        can_view_purchases: false,
        can_create_purchases: false,
        can_view_customers: true,
        can_edit_customers: true,
        can_delete_customers: false,
        can_view_suppliers: false,
        can_edit_suppliers: false,
        can_view_financials: false,
        can_view_debts: false,
        can_edit_debts: false,
        can_view_accounts: false,
        can_manage_accounts: false,
        can_view_employees: false,
        can_edit_employees: false,
        can_manage_payroll: false,
        can_view_activity_log: false,
        can_manage_users: false,
        can_edit_prices: false,
        can_view_reports: false,
        can_manage_automations: false,
        can_use_ai_assistant: true,
    },
    sales_manager: {
        can_view_dashboard: true, can_view_sales: true, can_create_sales: true, can_edit_sales: true,
        can_view_inventory: true, can_view_customers: true, can_edit_customers: true, can_view_reports: true,
        can_view_operations: true, can_use_ai_assistant: true,
    },
    inventory_manager: {
        can_view_dashboard: true, can_view_inventory: true, can_edit_inventory: true, can_view_purchases: true,
        can_create_purchases: true, can_view_suppliers: true, can_edit_suppliers: true, can_view_reports: true,
    },
    purchasing_manager: {
        can_view_dashboard: true, can_view_inventory: true, can_edit_inventory: true, can_view_purchases: true,
        can_create_purchases: true, can_view_suppliers: true, can_edit_suppliers: true, can_view_reports: true,
    },
    warehouse_employee: {
        can_view_dashboard: true, can_view_inventory: true,
    },
    viewer: {
        can_view_dashboard: true,
    },
    custom: {},
};

export function RoleProvider({ children }) {
    const { user } = useAuth();

    const normalizedRole = typeof user?.role === 'string' ? user.role : 'sales_rep';
    const role = ROLE_OPTIONS.includes(normalizedRole) ? normalizedRole : 'sales_rep';
    const basePermissions = PERMISSIONS[role] || PERMISSIONS.sales_rep;
    const permissionOverrides = typeof user?.permission_overrides === 'object' && user?.permission_overrides !== null ? user.permission_overrides : {};

    const resolvePermission = (permission) => {
        if (Object.prototype.hasOwnProperty.call(permissionOverrides, permission)) {
            return permissionOverrides[permission];
        }
        return basePermissions[permission] === true;
    };

    const can = (permission) => {
        if (permissionOverrides?.[permission] === false) {
            return false;
        }

        if (user?.is_super_admin === true) {
            return true;
        }

        if (role === 'admin' || role === 'owner') {
            return permissionOverrides?.[permission] !== false;
        }

        return resolvePermission(permission);
    };

    const customOverrides = Object.keys(permissionOverrides).length > 0;
    const overriddenPermissions = Object.entries(permissionOverrides).reduce((acc, [key, value]) => {
        acc[key] = value;
        return acc;
    }, {});

    const isSuperAdmin = user?.is_super_admin === true;
    const isOwner = role === 'owner';
    const isAdmin = role === 'admin';
    const isAccountant = role === 'accountant';
    const isSalesRep = role === 'sales_rep';

    return (
        <RoleContext.Provider value={{ role, permissions: basePermissions, permissionOverrides, can, customOverrides, overriddenPermissions, isSuperAdmin, isOwner, isAdmin, isAccountant, isSalesRep, user }}>
            {children}
        </RoleContext.Provider>
    );
}

export function useRole() {
    return useContext(RoleContext);
}
