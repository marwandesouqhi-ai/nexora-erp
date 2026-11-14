import { Outlet, NavLink } from 'react-router-dom';
import { Building2, FileText, LogOut } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import clsx from 'clsx';

export function CustomerLayout() {
  const { logout, user } = useAuth();

  return (
    <div className="flex h-screen bg-card-muted/50 font-cairo" dir="rtl">
      
      {/* Customer Sidebar */}
      <div className="w-64 bg-slate-900 text-white flex flex-col transition-all duration-300 shadow-xl border-l border-slate-800">
        <div className="h-16 flex items-center justify-center border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2">
            <div className="bg-primary/20 p-2 rounded-xl">
              <Building2 className="h-6 w-6 text-primary" />
            </div>
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-l from-white to-gray-400">
              بوابة العميل
            </span>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-2">
          <NavLink
            to="/portal"
            end
            className={({ isActive }) =>
              clsx(
                isActive
                  ? 'bg-primary text-white shadow-md shadow-primary/20'
                  : 'text-muted-foreground/60 hover:bg-slate-800 hover:text-white',
                'group flex items-center gap-x-3 rounded-xl p-3 text-sm font-semibold transition-all'
              )
            }
          >
            <Building2 className="h-5 w-5 shrink-0" />
            بيانات الشركة
          </NavLink>
          
          <NavLink
            to="/portal/invoices"
            className={({ isActive }) =>
              clsx(
                isActive
                  ? 'bg-primary text-white shadow-md shadow-primary/20'
                  : 'text-muted-foreground/60 hover:bg-slate-800 hover:text-white',
                'group flex items-center gap-x-3 rounded-xl p-3 text-sm font-semibold transition-all'
              )
            }
          >
            <FileText className="h-5 w-5 shrink-0" />
            فواتيري
          </NavLink>
        </nav>

        <div className="mt-auto pt-4 border-t border-slate-800 p-3">
          <button
            onClick={logout}
            className="flex w-full items-center gap-x-3 p-3 rounded-xl hover:bg-rose-500/10 text-rose-400 hover:text-rose-300 transition-colors"
          >
            <LogOut className="h-5 w-5 shrink-0" />
            <span className="font-semibold text-sm">تسجيل الخروج</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        
        {/* Simple Header */}
        <header className="bg-card border-b border-border h-16 shrink-0 flex items-center px-6 justify-between shadow-sm">
          <h2 className="font-bold text-foreground">مرحباً بك في بوابة العملاء</h2>
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-secondary-text">{user?.email}</span>
            <div className="h-9 w-9 rounded-full bg-gradient-to-tr from-primary to-blue-400 flex items-center justify-center text-white font-bold text-sm shadow-inner">
              {user?.email?.charAt(0).toUpperCase()}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>

    </div>
  );
}
