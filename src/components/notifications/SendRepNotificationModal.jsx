import React, { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Send, Bell, User, Sparkles, Loader2, CheckCircle2 } from 'lucide-react';
import { sendRepNotification } from '@/firebase/collections/notifications';
import { useToast } from '@/components/ui/use-toast';

const NOTIFICATION_TYPES = [
    { value: 'general', label: 'تنبيه إداري عام' },
    { value: 'target_update', label: 'تحديث الهدف البيعي (Target)' },
    { value: 'customer_assignment', label: 'إسناد عميل جديد للمندوب' },
    { value: 'expense_alert', label: 'إشعار بخصوص مصروف ميداني' },
    { value: 'urgent_instruction', label: 'توجيه ميداني عاجل' },
];

export default function SendRepNotificationModal({ open, onClose, employees = [], defaultRepId = '' }) {
    const { toast } = useToast();
    const [targetRep, setTargetRep] = useState(defaultRepId || 'all');
    const [notifType, setNotifType] = useState('general');
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Keep targetRep updated if defaultRepId changes
    React.useEffect(() => {
        if (defaultRepId) setTargetRep(defaultRepId);
    }, [defaultRepId]);

    const handleSend = async (e) => {
        e.preventDefault();
        if (!title.trim()) {
            toast({ title: 'يرجى كتابة عنوان التنبيه', variant: 'destructive' });
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await sendRepNotification({
                targetEmployeeId: targetRep,
                title: title.trim(),
                body: body.trim(),
                type: notifType,
            });

            if (res.success) {
                toast({
                    title: 'تم إرسال الإشعار اللحظي بنجاح',
                    description: targetRep === 'all'
                        ? 'تم تعميم الإشعار لجميع المناديب في الميدان.'
                        : 'تم إرسال الإشعار فورياً لتطبيق المندوب المحدد.',
                });
                setTitle('');
                setBody('');
                onClose();
            } else {
                toast({
                    title: 'فشل إرسال الإشعار',
                    description: res.error?.message || 'حدث خطأ غير متوقع',
                    variant: 'destructive',
                });
            }
        } catch (err) {
            toast({
                title: 'خطأ',
                description: err.message,
                variant: 'destructive',
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const reps = employees.filter((e) => e.role === 'sales_rep' || !e.role || e.department === 'sales');

    return (
        <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
            <DialogContent className="max-w-md rounded-2xl p-6" dir="rtl">
                <DialogHeader className="space-y-1">
                    <DialogTitle className="flex items-center gap-2 text-lg font-black text-foreground">
                        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
                            <Send className="h-4 w-4" />
                        </span>
                        إرسال تنبيه موجه لتطبيق المندوب
                    </DialogTitle>
                    <DialogDescription className="text-xs text-muted-foreground">
                        يصل هذا الإشعار لحظياً إلى شاشة تطبيق المناديب (`Nexora Field`) عبر Firebase.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSend} className="space-y-4 mt-2">
                    {/* اختيار المندوب المستهدف */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                            <User className="h-3.5 w-3.5 text-muted-foreground" />
                            المندوب المستهدف
                        </label>
                        <Select value={targetRep} onValueChange={setTargetRep}>
                            <SelectTrigger className="rounded-xl border-border">
                                <SelectValue placeholder="اختر المندوب..." />
                            </SelectTrigger>
                            <SelectContent dir="rtl">
                                <SelectItem value="all" className="font-bold text-primary">
                                    جميع المناديب (تعميم شامل)
                                </SelectItem>
                                {reps.map((r) => (
                                    <SelectItem key={r.id} value={r.id}>
                                        {r.name} {r.phone ? `(${r.phone})` : ''}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* نوع التنبيه */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                            <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
                            نوع التنبيه
                        </label>
                        <Select value={notifType} onValueChange={setNotifType}>
                            <SelectTrigger className="rounded-xl border-border">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent dir="rtl">
                                {NOTIFICATION_TYPES.map((t) => (
                                    <SelectItem key={t.value} value={t.value}>
                                        {t.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* عنوان التنبيه */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-foreground">عنوان الإشعار</label>
                        <Input
                            placeholder="مثال: هدف بيعي جديد لشهر سبتمبر"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="rounded-xl border-border text-sm"
                            required
                        />
                    </div>

                    {/* نص التنبيه */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-foreground">تفاصيل وبيان التنبيه</label>
                        <textarea
                            placeholder="اكتب التوجيهات أو التعليمات الموجهة للمندوب هنا..."
                            value={body}
                            onChange={(e) => setBody(e.target.value)}
                            rows={3}
                            className="w-full rounded-xl border border-border bg-background p-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                    </div>

                    <DialogFooter className="flex items-center justify-end gap-2 pt-2">
                        <Button type="button" variant="ghost" onClick={onClose} className="rounded-xl">
                            إلغاء
                        </Button>
                        <Button
                            type="submit"
                            disabled={isSubmitting}
                            className="rounded-xl gap-2 font-bold"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    جارٍ الإرسال...
                                </>
                            ) : (
                                <>
                                    <Send className="h-4 w-4" />
                                    إرسال التنبيه الآن
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
