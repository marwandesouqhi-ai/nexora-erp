import { useMemo, useState } from 'react';
import { useRole } from '@/lib/RoleContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Sparkles, Workflow } from 'lucide-react';
import { createNotification } from '@/firebase/collections/notifications';
import { logActivity } from '@/lib/activityLogger';
import { buildAutomationPlan, runAutomationPlan } from '@/services/automationService';

export default function AutomationPanel() {
    const { can, user } = useRole();
    const [title, setTitle] = useState('تنبيه تلقائي');
    const [message, setMessage] = useState('تم تشغيل قاعدة تشغيل تلقائي');
    const [status, setStatus] = useState('');
    const [loading, setLoading] = useState(false);

    const actions = useMemo(() => [
        'تنبيه مخزون منخفض',
        'تذكير بالديون',
        'ملخص يومي',
    ], []);

    const handleRun = async () => {
        if (!can('can_manage_automations')) return;
        setLoading(true);
        setStatus('');
        try {
            const plan = buildAutomationPlan({ title, message });
            const result = await runAutomationPlan(plan, {
                createNotification,
                logActivity,
                user: { uid: user?.uid || 'system', email: user?.email || 'system' },
            });
            setStatus(result.output);
        } catch (error) {
            setStatus('تعذر تشغيل الإجراء.');
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    if (!can('can_manage_automations')) {
        return null;
    }

    return (
        <Card className="border border-border bg-card shadow-sm ">
            <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg text-foreground ">
                    <Workflow className="h-5 w-5 text-indigo-600" />
                    التشغيل الآلي
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                    {actions.map((action) => (
                        <span key={action} className="rounded-full bg-card-muted px-3 py-1 text-sm text-secondary-text">{action}</span>
                    ))}
                </div>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="عنوان الإجراء" />
                <Input value={message} onChange={(e) => setMessage(e.target.value)} placeholder="نص الإجراء" />
                <Button onClick={handleRun} disabled={loading} className="gap-2">
                    <Sparkles className="h-4 w-4" />
                    {loading ? 'جارٍ التشغيل...' : 'تشغيل الإجراء'}
                </Button>
                {status && <div className="rounded-xl border border-border bg-card-muted p-3 text-sm text-secondary-text">{status}</div>}
            </CardContent>
        </Card>
    );
}
