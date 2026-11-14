import { useState, useEffect, useCallback } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import TopBar from './TopBar';
import GroupTabs from './GroupTabs';
import ModulesPortal from './ModulesPortal';
import { useNotifications } from '@/hooks/useNotifications';

export default function AppLayout() {
    const [portalOpen, setPortalOpen] = useState(false);
    const location = useLocation();

    useNotifications();

    // ── Close portal on route change & scroll to top ─────────────────────────
    useEffect(() => {
        const timer = window.setTimeout(() => {
            setPortalOpen(false);
            window.scrollTo({ top: 0 });
        }, 0);
        return () => window.clearTimeout(timer);
    }, [location.pathname]);

    // ── Global Ctrl+K / Cmd+K shortcut ───────────────────────────────────────
    useEffect(() => {
        const handler = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                setPortalOpen((prev) => !prev);
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, []);

    const openPortal = useCallback(() => setPortalOpen(true), []);
    const closePortal = useCallback(() => setPortalOpen(false), []);

    return (
        <div className="flex h-screen flex-col overflow-hidden" dir="rtl">
            <TopBar onPortalToggle={openPortal} />
            <GroupTabs />

            <main id="main-content" className="flex-1 overflow-y-auto p-4 lg:p-6">
                <div className="mx-auto max-w-[1400px]">
                    <Outlet />
                </div>
            </main>

            <ModulesPortal open={portalOpen} onClose={closePortal} />
        </div>
    );
}
