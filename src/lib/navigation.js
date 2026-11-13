/**
 * navigation.js — مصدر مركزي لبيانات التنقل ومجموعات الموديولات
 * يُستورد من Header و ModulesPortal و Sidebar (قبل حذفه).
 *
 * ❗ هذا الملف يحتوي على البيانات فقط — لا يستخدم React hooks.
 *    فحص الصلاحيات يتم في المكوّن المستهلك باستخدام useRole().can
 */
import {
    LayoutDashboard, ShoppingCart, Package, Users,
    Truck, ShoppingBag, Banknote, Calculator, Activity,
    UserCog, Sparkles,
    RotateCcw, BellRing, QrCode, Factory, PackageMinus,
    Fingerprint, CalendarDays, FileBarChart, MessageCircle,
    Building2, FileText, BarChart3, Compass, Clipboard, CheckSquare, LifeBuoy,
    // Quick action icons
    PackagePlus, AlertTriangle, Clock, Receipt, UserCog as UserCogIcon,
} from 'lucide-react';

// ─── Group accent colors (Tailwind class prefixes) ────────────────────────────
export const GROUP_ACCENTS = {
    'الرئيسية': 'amber',
    'المبيعات والعملاء': 'emerald',
    'المخزون والمشتريات': 'cyan',
    'الحسابات والمالية': 'indigo',
    'ادارة الموارد البشرية': 'rose',
    'الإدارة والنظام': 'slate',
};

// Solid hex for each group accent (used for glows / inline gradients)
export const ACCENT_HEX = {
    amber: '#F59E0B',
    emerald: '#10B981',
    cyan: '#06B6D4',
    indigo: '#6366F1',
    rose: '#F43F5E',
    slate: '#64748B',
    blue: '#2563EB',
    orange: '#EA4E1B',
    violet: '#8B5CF6',
};

// ─── Group icons ──────────────────────────────────────────────────────────────
export const GROUP_ICONS = {
    'الرئيسية': LayoutDashboard,
    'المبيعات والعملاء': ShoppingCart,
    'المخزون والمشتريات': Package,
    'الحسابات والمالية': Banknote,
    'ادارة الموارد البشرية': Users,
    'الإدارة والنظام': UserCog,
};

// ─── Module descriptions (Arabic subtitles for the portal cards) ──────────────
const DESCRIPTIONS = {
    dashboard:            'المؤشرات والعمليات اليومية',
    operations:           'المتابعة اليومية للعمليات الميدانية',
    'field-requests':     'متابعة وإدارة طلبات المناديب',
    sales:                'عروض الأسعار وإصدار الفواتير',
    customers:            'سجلات وبيانات وحسابات العملاء',
    inventory:            'الأرصدة والأسعار والتكلفة',
    returns:              'مرتجعات المبيعات والمشتريات',
    'stock-alerts':       'النواقص والحد الأدنى للرصيد',
    'barcode-generator':  'طباعة وتوليد الملصقات والرموز',
    manufacturing:        'خطوط الإنتاج وحساب التكاليف',
    purchases:            'أوامر التوريد وفواتير المشتريات',
    'stock-disbursement': 'أذونات الإخراج والتحويل الداخلي',
    suppliers:            'دليل الموردين وأرصدة الدفعات',
    reports:              'التقارير الشاملة والأرباح',
    'financial-overview': 'مؤشرات السيولة والمركز المالي',
    'profit-reports':     'صافي الأرباح وهوامش العائد',
    'cashflow-calendar':  'مواعيد الاستحقاقات والتدفقات',
    debts:                'المستحقات ومتابعة مديونيات العملاء',
    accounts:             'الحسابات البنكية وحركات النقدية',
    reconciliations:      'إغلاق اليومية ومراجعة العهد',
    employees:            'الملفات والتعاقدات الوظيفية',
    attendance:           'سجلات الدوام وساعات العمل',
    payroll:              'كشوف المستحقات والخصومات',
    activity:             'تتبع النشاطات وتدقيق النظام',
    'whatsapp-alerts':    'الفواتير التلقائية ورسائل العملاء',
    automation:           'محرك القواعد الذكية وروبوت المهام',
    users:                'إدارة الأدوار وحسابات الموظفين',
    'invoice-template':   'تنسيق الفواتير والشعار والطباعة',
    'company-settings':   'بيانات الشركة والضرائب والفروع',
    support:              'تذاكر الدعم والتواصل مع فريق المنصة',
};

// ─── NAV_GROUPS — replicated from Sidebar.jsx with added `description` ────────
// Each item keeps the same permission / feature fields the sidebar used.
export const NAV_GROUPS = [
    {
        label: 'الرئيسية',
        items: [
            { key: 'dashboard', label: 'لوحة التحكم', path: '/', icon: LayoutDashboard, permission: 'can_view_dashboard', description: DESCRIPTIONS.dashboard },
            { key: 'operations', label: 'إدارة التشغيل', path: '/operations', icon: Compass, permission: 'can_view_operations', feature: 'field_operations', description: DESCRIPTIONS.operations },
            { key: 'field-requests', label: 'طلبات الميدان', path: '/field-requests', icon: Clipboard, permission: 'can_view_operations', feature: 'field_operations', description: DESCRIPTIONS['field-requests'] },
        ],
    },
    {
        label: 'المبيعات والعملاء',
        items: [
            { key: 'sales', label: 'المبيعات والفواتير', path: '/sales', icon: ShoppingCart, permission: 'can_view_sales', feature: 'sales', description: DESCRIPTIONS.sales },
            { key: 'customers', label: 'قاعدة العملاء', path: '/customers', icon: Users, permission: 'can_view_customers', feature: 'customers', description: DESCRIPTIONS.customers },
        ],
    },
    {
        label: 'المخزون والمشتريات',
        items: [
            { key: 'inventory', label: 'إدارة الأصناف', path: '/inventory', icon: Package, permission: 'can_view_inventory', feature: 'inventory', description: DESCRIPTIONS.inventory },
            { key: 'returns', label: 'المرتجعات', path: '/returns', icon: RotateCcw, permission: 'can_view_sales', feature: 'returns', description: DESCRIPTIONS.returns },
            { key: 'stock-alerts', label: 'تنبيهات المخزون', path: '/stock-alerts', icon: BellRing, permission: 'can_view_inventory', feature: 'inventory', description: DESCRIPTIONS['stock-alerts'] },
            { key: 'barcode-generator', label: 'مولّد الباركود/QR', path: '/barcode-generator', icon: QrCode, permission: 'can_view_inventory', feature: 'barcode', description: DESCRIPTIONS['barcode-generator'] },
            { key: 'manufacturing', label: 'التصنيع والإنتاج', path: '/manufacturing', icon: Factory, permission: 'can_edit_inventory', feature: 'manufacturing', description: DESCRIPTIONS.manufacturing },
            { key: 'purchases', label: 'طلبات الشراء', path: '/purchases', icon: ShoppingBag, permission: 'can_view_purchases', feature: 'purchases', description: DESCRIPTIONS.purchases },
            { key: 'stock-disbursement', label: 'صرف المخزون', path: '/stock-disbursement', icon: PackageMinus, permission: 'can_edit_inventory', feature: 'disbursement', description: DESCRIPTIONS['stock-disbursement'] },
            { key: 'suppliers', label: 'الموردون', path: '/suppliers', icon: Truck, permission: 'can_view_suppliers', feature: 'suppliers', description: DESCRIPTIONS.suppliers },
        ],
    },
    {
        label: 'الحسابات والمالية',
        items: [
            { key: 'reconciliations', label: 'تصفية العهد وإغلاق اليومية', path: '/reconciliations', icon: CheckSquare, permission: 'can_view_financials', feature: 'reconciliations', description: DESCRIPTIONS.reconciliations },
            { key: 'reports', label: 'التحليل المالي', path: '/reports', icon: BarChart3, permission: 'can_view_reports', feature: 'reports', description: DESCRIPTIONS.reports },
            { key: 'financial-overview', label: 'نظرة مالية', path: '/financial-overview', icon: Banknote, permission: 'can_view_financials', feature: 'financial_overview', description: DESCRIPTIONS['financial-overview'] },
            { key: 'profit-reports', label: 'تقرير الأرباح الدورية', path: '/profit-reports', icon: FileBarChart, permission: 'can_view_financials', feature: 'reports', description: DESCRIPTIONS['profit-reports'] },
            { key: 'cashflow-calendar', label: 'تقويم التدفق النقدي', path: '/cashflow-calendar', icon: CalendarDays, permission: 'can_view_financials', feature: 'financial_overview', description: DESCRIPTIONS['cashflow-calendar'] },
            { key: 'debts', label: 'الديون والتحصيل', path: '/debts', icon: Banknote, permission: 'can_view_debts', feature: 'debts', description: DESCRIPTIONS.debts },
            { key: 'accounts', label: 'الخزينة والرواتب', path: '/accounts', icon: Calculator, permission: 'can_view_accounts', feature: 'accounts', description: DESCRIPTIONS.accounts },
        ],
    },
    {
        label: 'ادارة الموارد البشرية',
        items: [
            { key: 'employees', label: 'الموظفون', path: '/employees', icon: Users, permission: 'can_view_employees', feature: 'hr_payroll', description: DESCRIPTIONS.employees },
            { key: 'attendance', label: 'الحضور والانصراف', path: '/attendance', icon: Fingerprint, permission: 'can_view_employees', feature: 'attendance', description: DESCRIPTIONS.attendance },
            { key: 'payroll', label: 'الرواتب', path: '/payroll', icon: Calculator, permission: 'can_manage_payroll', feature: 'hr_payroll', description: DESCRIPTIONS.payroll },
        ],
    },
    {
        label: 'الإدارة والنظام',
        items: [
            { key: 'activity', label: 'سجل العمليات والمراقبة', path: '/activity', icon: Activity, permission: 'can_view_activity_log', description: DESCRIPTIONS.activity },
            { key: 'whatsapp-alerts', label: 'تنبيهات واتساب', path: '/whatsapp-alerts', icon: MessageCircle, permission: 'can_manage_automations', feature: 'whatsapp_alerts', description: DESCRIPTIONS['whatsapp-alerts'] },
            { key: 'automation', label: 'الأتمتة والمساعد', path: '/automation', icon: Sparkles, permission: 'can_manage_automations', feature: 'ai_assistant', description: DESCRIPTIONS.automation },
            { key: 'users', label: 'صلاحيات المستخدمين', path: '/users', icon: UserCog, permission: 'can_manage_users', description: DESCRIPTIONS.users },
            { key: 'invoice-template', label: 'قالب الفواتير', path: '/invoice-template', icon: FileText, permission: 'can_manage_users', feature: 'sales', description: DESCRIPTIONS['invoice-template'] },
            { key: 'company-settings', label: 'إعدادات الشركة', path: '/company-settings', icon: Building2, permission: 'can_manage_users', description: DESCRIPTIONS['company-settings'] },
            // roles: تظهر لأدمن الشركة فقط (مالك الشركة / المدير العام / مدير عام)
            { key: 'support', label: 'الدعم الفني', path: '/support', icon: LifeBuoy, roles: ['owner', 'admin', 'general_manager'], description: DESCRIPTIONS.support },
        ],
    },
];

// ─── Quick Actions (for the portal top section) ───────────────────────────────
// Each carries the `permission` of its target route so it can be filtered.
export const QUICK_ACTIONS = [
    {
        key: 'qa-new-sale',
        label: 'فاتورة بيع جديدة',
        subtitle: 'إنشاء وطباعة فاتورة نقدية أو آجل فوراً',
        path: '/pos',
        permission: 'can_create_sales',
        icon: ShoppingCart,
        accent: 'blue',
        hex: '#2563EB',
    },
    {
        key: 'qa-add-product',
        label: 'إضافة صنف للمخزون',
        subtitle: 'تسجيل منتج وتحديد حد الأمان وسعر البيع',
        path: '/inventory',
        permission: 'can_view_inventory',
        icon: PackagePlus,
        accent: 'emerald',
        hex: '#10B981',
    },
    {
        key: 'qa-expenses',
        label: 'تسجيل حركة مصروفات',
        subtitle: 'صرف نقدية وسندات قبض من الخزينة',
        path: '/expenses',
        permission: 'can_view_accounts',
        icon: Banknote,
        accent: 'rose',
        hex: '#E11D63',
    },
    {
        key: 'qa-attendance',
        label: 'تسجيل الحضور / الانصراف',
        subtitle: 'إثبات البصمة اليومية لموظفي الوردية',
        path: '/attendance',
        permission: 'can_view_employees',
        icon: Clock,
        accent: 'amber',
        hex: '#F59E0B',
    },
    {
        key: 'qa-stock-alerts',
        label: 'تنبيهات المخزون الذكية',
        subtitle: 'متابعة الأصناف الموشكة على النفاد وطلب…',
        path: '/stock-alerts',
        permission: 'can_view_inventory',
        icon: AlertTriangle,
        accent: 'orange',
        hex: '#EA4E1B',
    },
    {
        key: 'qa-settings',
        label: 'الملف الشخصي والأمان',
        subtitle: 'الصورة الشخصية وتفضيلات النظام والجلسات',
        path: '/company-settings',
        permission: 'can_manage_users',
        icon: UserCogIcon,
        accent: 'violet',
        hex: '#8B5CF6',
    },
];

// ─── Role labels (shared between Header, Sidebar, Portal footer) ──────────────
export const ROLE_LABELS = {
    super_admin: 'مالك المنصة (Super Admin)',
    owner: 'مالك الشركة',
    admin: 'المدير العام',
    accountant: 'المحاسب المالي',
    sales_rep: 'مسؤول مبيعات',
    manager: 'مدير تشغيل',
    // أدوار أُضيفت في RoleContext
    general_manager: 'مدير عام',
    sales_manager: 'مدير مبيعات',
    inventory_manager: 'مدير مخزون',
    purchasing_manager: 'مدير مشتريات',
    warehouse_employee: 'موظف مخزن',
    viewer: 'مشاهد',
    custom: 'دور مخصص',
};

export const ROLE_COLORS = {
    super_admin: 'text-rose-400 font-black',
    owner: 'text-indigo-400',
    admin: 'text-indigo-400',
    accountant: 'text-amber-400',
    sales_rep: 'text-emerald-400',
    manager: 'text-cyan-400',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Build a flat path→label map for resolving the current page title from the route */
export function buildPathTitleMap() {
    const map = {};
    for (const group of NAV_GROUPS) {
        for (const item of group.items) {
            map[item.path] = item.label;
        }
    }
    // Fallbacks for routes not in NAV_GROUPS
    map['/pos'] = 'نقطة البيع';
    map['/expenses'] = 'المصروفات';
    map['/login'] = 'تسجيل الدخول';
    return map;
}

/** هل العنصر مسموح للمستخدم؟ (نفس فحص can + قيد الأدوار إن وُجد) */
export function isNavItemVisible(item, can, role) {
    return (!item.permission || can(item.permission)) && (!item.roles || item.roles.includes(role));
}

/** Flat list of all nav items (useful for search) */
export function getAllNavItems() {
    return NAV_GROUPS.flatMap((g) => g.items);
}


// صفحات خارج NAV_GROUPS لكن لها عنوان/أيقونة في الـ TopBar
const EXTRA_PAGES = {
    '/pos': { key: 'pos', label: 'نقطة البيع', path: '/pos', icon: ShoppingCart, permission: 'can_create_sales', group: 'المبيعات والعملاء' },
    '/expenses': { key: 'expenses', label: 'المصروفات', path: '/expenses', icon: Receipt, permission: 'can_view_accounts', group: 'الحسابات والمالية' },
};

/** يرجّع { group, item } للمسار الحالي (أو null) */
export function findNavContext(pathname) {
    for (const group of NAV_GROUPS) {
        const item = group.items.find((i) => i.path === pathname);
        if (item) return { group, item };
    }
    const extra = EXTRA_PAGES[pathname];
    if (extra) {
        return { group: NAV_GROUPS.find((g) => g.label === extra.group) || null, item: extra };
    }
    return null;
}

/** الاسم المعروض للمستخدم (TopBar + Portal footer) */
export function getDisplayName(user) {
    return user?.displayName || user?.full_name || user?.email?.split('@')[0] || 'مستخدم';
}
