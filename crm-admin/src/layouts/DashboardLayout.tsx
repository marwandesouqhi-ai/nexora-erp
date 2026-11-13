import { Outlet } from 'react-router-dom';
import { TopBar } from '../components/TopBar';
import { useAuth } from '../contexts/AuthContext';
import { ADMIN_NAV, currentRoleOf, filterNav } from '../lib/navigation';

export function DashboardLayout() {
    const { userRole } = useAuth();
    const role = currentRoleOf(userRole);
    const items = filterNav(ADMIN_NAV, role);

    return (
        <div className="flex h-screen flex-col overflow-hidden" dir="rtl">
            <TopBar items={items} role={role} subtitle="لوحة إدارة المنصة" groupLabel="لوحة الإدارة" />
            <main className="flex-1 overflow-y-auto p-4 lg:p-6">
                <div className="mx-auto max-w-[1400px]">
                    <Outlet />
                </div>
            </main>
        </div>
    );
}
