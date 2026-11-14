// معاملات تطبيق Nexora ERP

export const APP_NAME = 'Nexora ERP';
export const APP_VERSION = '1.0.0';

// صلاحيات افتراضية
export const DEFAULT_ROLES = {
    admin: {
        name: 'مسؤول النظام',
        permissions: [
            'can_view_dashboard',
            'can_view_customers',
            'can_edit_customers',
            'can_delete_customers',
            'can_view_suppliers',
            'can_edit_suppliers',
            'can_delete_suppliers',
            'can_view_purchases',
            'can_create_purchases',
            'can_delete_purchases',
            'can_view_sales',
            'can_create_sales',
            'can_delete_sales',
            'can_view_inventory',
            'can_edit_inventory',
            'can_view_debts',
            'can_view_expenses',
            'can_create_expenses',
            'can_view_reports',
            'can_manage_users',
            'can_manage_settings',
        ]
    },
    sales: {
        name: 'موظف مبيعات',
        permissions: [
            'can_view_dashboard',
            'can_view_customers',
            'can_edit_customers',
            'can_view_sales',
            'can_create_sales',
            'can_view_inventory',
            'can_view_debts',
        ]
    },
    inventory: {
        name: 'أمين مخزن',
        permissions: [
            'can_view_dashboard',
            'can_view_inventory',
            'can_edit_inventory',
            'can_view_purchases',
            'can_view_products',
        ]
    },
    viewer: {
        name: 'عارض',
        permissions: [
            'can_view_dashboard',
            'can_view_customers',
            'can_view_suppliers',
            'can_view_sales',
            'can_view_purchases',
            'can_view_inventory',
            'can_view_reports',
        ]
    }
};

// ألوان الحالات
export const STATUS_COLORS = {
    active: 'emerald',
    inactive: 'slate',
    blocked: 'red',
    paid: 'emerald',
    unpaid: 'red',
    partial: 'amber',
};

// تنسيقات التاريخ
export const DATE_FORMAT = 'dd/MM/yyyy';
export const TIME_FORMAT = 'HH:mm:ss';
export const DATETIME_FORMAT = 'dd/MM/yyyy HH:mm';

// حد أقصى للملفات المرفوعة
export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

// العملات المدعومة
export const CURRENCIES = {
    EGP: 'ج.م',
    USD: '$',
    EUR: '€',
};

export const DEFAULT_CURRENCY = 'EGP';