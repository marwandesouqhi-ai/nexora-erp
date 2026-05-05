import React, { createContext, useContext } from 'react';
import { useAuth } from '@/lib/AuthContext';

const RoleContext = createContext();

// 1. مصفوفة الصلاحيات (نفس اللي بعتها مع التأكد من شموليتها)
const PERMISSIONS = {
    admin: {
        can_view_dashboard: true,
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
        can_edit_prices: true,
        can_view_reports: true,
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
        can_view_employees: true,
        can_edit_employees: false,
        can_view_activity_log: true,
        can_manage_users: false,
        can_edit_prices: false,
        can_view_reports: true,
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
        can_view_employees: false,
        can_edit_employees: false,
        can_view_activity_log: false,
        can_manage_users: false,
        can_edit_prices: false,
        can_view_reports: false,
    },
};

export function RoleProvider({ children }) {
    const { user } = useAuth();

    // التأكد من جلب الدور (Role) من بيانات المستخدم في Firebase
    const role = user?.role || 'sales_rep';
    const permissions = PERMISSIONS[role] || PERMISSIONS.sales_rep;

    // دالة فحص الصلاحية
    const can = (permission) => {
        // المدير (Admin) له صلاحية مطلقة دائماً
        if (role === 'admin') return true;
        return permissions[permission] === true;
    };

    const isAdmin = role === 'admin';
    const isAccountant = role === 'accountant';
    const isSalesRep = role === 'sales_rep';

    return (
        <RoleContext.Provider value={{ role, permissions, can, isAdmin, isAccountant, isSalesRep, user }}>
            {children}
        </RoleContext.Provider>
    );
}

export function useRole() {
    const context = useContext(RoleContext);
    if (context === undefined) {
        throw new Error('useRole must be used within a RoleProvider');
    }
    return context;
}