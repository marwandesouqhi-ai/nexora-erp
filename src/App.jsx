import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '@/lib/AuthContext';
import { TenantProvider } from '@/lib/TenantContext';
import { RoleProvider } from '@/lib/RoleContext';
import { ThemeProvider } from '@/lib/ThemeContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import PermissionGate from '@/components/auth/PermissionGate';
import AppLayout from '@/components/layout/AppLayout';
import { Toaster } from '@/components/ui/toaster';

// صفحات النظام
import Login from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import POS from '@/pages/POS';
import Inventory from '@/pages/Inventory';
import Customers from '@/pages/Customers';
import Sales from '@/pages/Sales';
import Purchases from '@/pages/Purchases';
import Suppliers from '@/pages/Suppliers';
import Debts from '@/pages/Debts';
import Accounts from '@/pages/Accounts';
import Expenses from '@/pages/Expenses';
import FinancialOverview from '@/pages/FinancialOverview';
import Employees from '@/pages/Employees';
import Payroll from '@/pages/Payroll';
import Users from '@/pages/Users';
import Reports from '@/pages/Reports';
import ActivityLog from '@/pages/ActivityLog';
import Automation from '@/pages/Automation';
import Returns from '@/pages/Returns';
import StockAlerts from '@/pages/StockAlerts';
import BarcodeGenerator from '@/pages/BarcodeGenerator';
import Manufacturing from '@/pages/Manufacturing';
import StockDisbursement from '@/pages/StockDisbursement';
import Attendance from '@/pages/Attendance';
import CashFlowCalendar from '@/pages/CashFlowCalendar';
import ProfitReports from '@/pages/ProfitReports';
import WhatsappAlerts from '@/pages/WhatsappAlerts';
import DailyMonitoring from '@/pages/DailyMonitoring';
import FieldRequests from '@/pages/FieldRequests';
import DailyReconciliations from '@/pages/DailyReconciliations';
import CompanySettings from '@/pages/CompanySettings';
import InvoiceTemplate from '@/pages/InvoiceTemplate';
import Support from '@/pages/Support';
import AcceptInvitation from '@/pages/AcceptInvitation';
import PageNotFound from '@/lib/PageNotFound';

function App() {
  return (
    <ThemeProvider>
    <AuthProvider>
      <TenantProvider>
        <RoleProvider>
          <Router>
            <Routes>
              {/* صفحة تسجيل الدخول العامة */}
              <Route path="/login" element={<Login />} />
              <Route path="/accept-invitation" element={<AcceptInvitation />} />



              {/* مسارات لوحة تحكم الشركات المشتركة في المنصة */}
              <Route
                element={
                  <ProtectedRoute>
                    <AppLayout />
                  </ProtectedRoute>
                }
              >
                <Route path="/" element={<PermissionGate permission="can_view_dashboard"><Dashboard /></PermissionGate>} />
                <Route path="/pos" element={<PermissionGate permission="can_create_sales"><POS /></PermissionGate>} />
                <Route path="/inventory" element={<PermissionGate permission="can_view_inventory"><Inventory /></PermissionGate>} />
                <Route path="/customers" element={<PermissionGate permission="can_view_customers"><Customers /></PermissionGate>} />
                <Route path="/sales" element={<PermissionGate permission="can_view_sales"><Sales /></PermissionGate>} />
                <Route path="/purchases" element={<PermissionGate permission="can_view_purchases"><Purchases /></PermissionGate>} />
                <Route path="/suppliers" element={<PermissionGate permission="can_view_suppliers"><Suppliers /></PermissionGate>} />
                <Route path="/debts" element={<PermissionGate permission="can_view_debts"><Debts /></PermissionGate>} />
                <Route path="/accounts" element={<PermissionGate permission="can_view_accounts"><Accounts /></PermissionGate>} />
                <Route path="/expenses" element={<PermissionGate permission={['can_view_financials', 'can_view_accounts']}><Expenses /></PermissionGate>} />
                <Route path="/financial-overview" element={<PermissionGate permission="can_view_financials"><FinancialOverview /></PermissionGate>} />
                <Route path="/employees" element={<PermissionGate permission="can_view_employees"><Employees /></PermissionGate>} />
                <Route path="/payroll" element={<PermissionGate permission="can_manage_payroll"><Payroll /></PermissionGate>} />
                <Route path="/users" element={<PermissionGate permission="can_manage_users"><Users /></PermissionGate>} />
                <Route path="/reports" element={<PermissionGate permission="can_view_reports"><Reports /></PermissionGate>} />
                <Route path="/activity" element={<PermissionGate permission="can_view_activity_log"><ActivityLog /></PermissionGate>} />
                <Route path="/automation" element={<PermissionGate permission="can_manage_automations"><Automation /></PermissionGate>} />
                <Route path="/returns" element={<PermissionGate permission="can_view_sales"><Returns /></PermissionGate>} />
                <Route path="/stock-alerts" element={<PermissionGate permission="can_view_inventory"><StockAlerts /></PermissionGate>} />
                <Route path="/barcode-generator" element={<PermissionGate permission="can_view_inventory"><BarcodeGenerator /></PermissionGate>} />
                <Route path="/manufacturing" element={<PermissionGate permission="can_edit_inventory"><Manufacturing /></PermissionGate>} />
                <Route path="/stock-disbursement" element={<PermissionGate permission="can_edit_inventory"><StockDisbursement /></PermissionGate>} />
                <Route path="/attendance" element={<PermissionGate permission="can_view_employees"><Attendance /></PermissionGate>} />
                <Route path="/cashflow-calendar" element={<PermissionGate permission="can_view_financials"><CashFlowCalendar /></PermissionGate>} />
                <Route path="/profit-reports" element={<PermissionGate permission="can_view_financials"><ProfitReports /></PermissionGate>} />
                <Route path="/whatsapp-alerts" element={<PermissionGate permission="can_manage_automations"><WhatsappAlerts /></PermissionGate>} />
                <Route path="/operations" element={<PermissionGate permission="can_view_operations"><DailyMonitoring /></PermissionGate>} />
                <Route path="/field-requests" element={<PermissionGate permission="can_view_operations"><FieldRequests /></PermissionGate>} />
                <Route path="/reconciliations" element={<PermissionGate permission="can_view_financials"><DailyReconciliations /></PermissionGate>} />
                <Route path="/company-settings" element={<PermissionGate permission="can_manage_users"><CompanySettings /></PermissionGate>} />
                <Route path="/support" element={<Support />} />
                <Route path="/invoice-template" element={<PermissionGate permission="can_manage_users"><InvoiceTemplate /></PermissionGate>} />
              </Route>

              <Route path="*" element={<PageNotFound />} />
            </Routes>
            <Toaster />
          </Router>
        </RoleProvider>
      </TenantProvider>
    </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
