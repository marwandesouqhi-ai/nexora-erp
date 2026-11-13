import AutomationPanel from '@/components/shared/AutomationPanel';
import AiAssistantPanel from '@/components/shared/AiAssistantPanel';

export default function Automation() {
    return (
        <div className="space-y-6" dir="rtl">
            <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
                <h1 className="text-2xl font-black text-foreground">الأتمتة والمساعد الذكي</h1>
                <p className="mt-2 text-sm text-muted-foreground">إدارة الإجراءات التلقائية والردود الآمنة مع صلاحيات واضحة.</p>
            </div>
            <AutomationPanel />
            <AiAssistantPanel />
        </div>
    );
}
