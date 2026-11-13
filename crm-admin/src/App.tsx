import type { ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { DashboardLayout } from './layouts/DashboardLayout';
import { Login } from './pages/Login';
import { DashboardHome } from './pages/DashboardHome';
import { Customers } from './pages/Customers';
import { Subscriptions } from './pages/Subscriptions';
import { Settings } from './pages/Settings';
import { AuditLogs } from './pages/AuditLogs';
import { Team } from './pages/Team';
import { Invoices } from './pages/Invoices';
import { Tasks } from './pages/Tasks';
import { Tickets } from './pages/Tickets';

function ProtectedRoute({ children, requireAdmin = false }: { children: ReactNode, requireAdmin?: boolean }) {
  const { user, loading, isPlatformAdmin, isPlatformStaff, logout } = useAuth();
  
  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">جاري التحميل...</div>;
  }
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!isPlatformStaff) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4" dir="rtl">
        <div className="flex w-full max-w-[420px] flex-col items-center gap-4 rounded-3xl border border-border bg-card p-8 text-center shadow-float">
          <p className="text-[15px] font-bold text-foreground">هذا الحساب ليس من فريق دعم منصة Nexora.</p>
          <button onClick={logout} className="inline-flex h-11 items-center justify-center rounded-xl bg-primary px-6 text-sm font-bold text-white transition-colors hover:bg-primary-hover">تسجيل الخروج</button>
        </div>
      </div>
    );
  }

  if (requireAdmin && !isPlatformAdmin) {
    return <Navigate to="/" replace />;
  }
  
  return <>{children}</>;
}

function AppRoutes() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route 
        path="/login" 
        element={user ? <Navigate to="/" replace /> : <Login />} 
      />
      
      {/* Admin & Employees Routes */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardHome />} />
        <Route path="customers" element={<Customers />} />
        <Route path="subscriptions" element={<Subscriptions />} />
        <Route path="audit-logs" element={<ProtectedRoute requireAdmin><AuditLogs /></ProtectedRoute>} />
        <Route path="team" element={<ProtectedRoute requireAdmin><Team /></ProtectedRoute>} />
        <Route path="invoices" element={<Invoices />} />
        <Route path="tasks" element={<Tasks />} />
        <Route path="tickets" element={<Tickets />} />
        <Route path="settings" element={<ProtectedRoute requireAdmin><Settings /></ProtectedRoute>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
