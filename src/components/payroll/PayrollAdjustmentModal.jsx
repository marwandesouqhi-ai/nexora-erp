import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import { Award, AlertTriangle, MinusCircle, DollarSign, Calendar, FileText, User, MessageCircle } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { addNewAdjustment, updateAdjustment } from '@/firebase/collections/payroll_adjustments';
import { notifyPayrollAdjustment } from '@/services/notificationService';

const PRESET_TITLES = {
    incentive: [
        'مكافأة تحقيق تارجت مبيعات الأسبوع',
        'حافز تميز ميداني وسرعة إنجاز',
        'مكافأة عملاء جدد',
        'حافز الالتزام والانضباط الميداني'
    ],
    penalty: [
        'جزاء تأخير صباحي متكرر',
        'جزاء عدم استكمال خط السير اليومي',
        'مخالفة إدارية في التعامل مع العملاء',
        'جزاء عدم تحديث تقرير الزيارات'
    ],
    deduction: [
        'خصم قسط سلفة نقدية',
        'خصم عجز في عهدة التحصيل',
        'خصم تلفيات أو عهدة',
        'خصم غياب غير مبرر'
    ]
};

const initialForm = {
    employee_id: '',
    employee_name: '',
    type: 'incentive',
    title: '',
    amount: '',
    reason: '',
    date: new Date().toISOString().slice(0, 10),
    status: 'approved',
};

export default function PayrollAdjustmentModal({
    open,
    onClose,
    employees = [],
    editAdjustment = null,
    onSuccess,
}) {
    const { user } = useAuth();
    const { toast } = useToast();
    const [form, setForm] = useState(initialForm);
    const [sendWhatsapp, setSendWhatsapp] = useState(true);
    const [loading, setLoading] = useState(false);

    const selectedEmployee = employees.find((e) => e.id === form.employee_id);

    useEffect(() => {
        if (editAdjustment) {
            setForm({
                employee_id: editAdjustment.employee_id || '',
                employee_name: editAdjustment.employee_name || '',
                type: editAdjustment.type || 'incentive',
                title: editAdjustment.title || '',
                amount: editAdjustment.amount || '',
                reason: editAdjustment.reason || '',
                date: editAdjustment.date || new Date().toISOString().slice(0, 10),
                status: editAdjustment.status || 'approved',
            });
        } else {
            setForm({
                ...initialForm,
                date: new Date().toISOString().slice(0, 10),
            });
        }
    }, [editAdjustment, open]);

    const handleEmployeeChange = (empId) => {
        const selected = employees.find((e) => e.id === empId);
        if (selected) {
            setForm((prev) => ({
                ...prev,
                employee_id: selected.id,
                employee_name: selected.name,
            }));
        }
    };

    const handleTypeChange = (type) => {
        setForm((prev) => ({
            ...prev,
            type,
            title: PRESET_TITLES[type]?.[0] || prev.title,
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.employee_id) {
            toast({ title: 'تنبيه', description: 'يرجى اختيار المندوب أولاً', variant: 'destructive' });
            return;
        }
        if (!form.amount || Number(form.amount) <= 0) {
            toast({ title: 'تنبيه', description: 'يرجى إدخال مبلغ صحيح أكبر من الصفر', variant: 'destructive' });
            return;
        }
        if (!form.title.trim()) {
            toast({ title: 'تنبيه', description: 'يرجى كتابة عنوان البند', variant: 'destructive' });
            return;
        }

        setLoading(true);
        try {
            const payload = {
                ...form,
                amount: Math.abs(Number(form.amount)),
                created_by: user?.displayName || user?.email || 'الإدارة',
            };

            let res;
            if (editAdjustment?.id) {
                res = await updateAdjustment(editAdjustment.id, payload);
            } else {
                res = await addNewAdjustment(payload);
            }

            if (res.success) {
                // إرسال الإشعار الفوري (داخل النظام + واتساب)
                await notifyPayrollAdjustment({
                    employee: selectedEmployee,
                    adjustment: { ...payload, id: res.id || editAdjustment?.id },
                    sendWhatsapp,
                });

                toast({
                    title: editAdjustment ? 'تم تحديث البند بنجاح' : 'تم إضافة البند وإرسال الإشعار',
                    description: sendWhatsapp && selectedEmployee?.phone
                        ? 'تم إرسال إشعار فوري عبر WhatsApp وعبر النظام للمندوب.'
                        : 'سيظهر البند فوراً في كشف حساب المندوب في تطبيق Nexora Field.',
                    variant: 'success',
                });
                if (onSuccess) onSuccess();
                onClose();
            } else {
                toast({
                    title: 'خطأ',
                    description: res.error?.message || 'فشلت العملية، يرجى المحاولة ثانية',
                    variant: 'destructive',
                });
            }
        } catch (err) {
            console.error('Error submitting adjustment:', err);
            toast({ title: 'خطأ غير متوقع', description: err.message, variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
            <DialogContent className="max-w-lg rounded-2xl p-6" dir="rtl">
                <DialogHeader className="space-y-1">
                    <DialogTitle className="flex items-center gap-2 text-xl font-black text-foreground">
                        <Award className="h-5 w-5 text-primary" />
                        {editAdjustment ? 'تعديل تسوية مالية' : 'إضافة تسوية مالية (حافز / جزاء / خصم)'}
                    </DialogTitle>
                    <DialogDescription className="text-xs text-muted-foreground">
                        تُسجَّل هذه التسوية لحظياً وتظهر فوراً في كشف حساب المندوب في تطبيق Nexora Field.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="mt-4 space-y-4">
                    {/* نوع العملية */}
                    <div className="space-y-1.5">
                        <Label className="text-xs font-bold text-foreground">نوع التسوية المالية</Label>
                        <div className="grid grid-cols-3 gap-2">
                            <button
                                type="button"
                                onClick={() => handleTypeChange('incentive')}
                                className={`flex flex-col items-center justify-center rounded-2xl border p-3 text-xs font-bold transition-all ${
                                    form.type === 'incentive'
                                        ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shadow-sm'
                                        : 'border-border bg-card text-muted-foreground hover:bg-muted'
                                }`}
                            >
                                <Award className="mb-1 h-5 w-5" />
                                حافز / مكافأة 🟢
                            </button>

                            <button
                                type="button"
                                onClick={() => handleTypeChange('penalty')}
                                className={`flex flex-col items-center justify-center rounded-2xl border p-3 text-xs font-bold transition-all ${
                                    form.type === 'penalty'
                                        ? 'border-rose-500 bg-rose-500/10 text-rose-600 dark:text-rose-400 shadow-sm'
                                        : 'border-border bg-card text-muted-foreground hover:bg-muted'
                                }`}
                            >
                                <AlertTriangle className="mb-1 h-5 w-5" />
                                جزاء إداري 🔴
                            </button>

                            <button
                                type="button"
                                onClick={() => handleTypeChange('deduction')}
                                className={`flex flex-col items-center justify-center rounded-2xl border p-3 text-xs font-bold transition-all ${
                                    form.type === 'deduction'
                                        ? 'border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400 shadow-sm'
                                        : 'border-border bg-card text-muted-foreground hover:bg-muted'
                                }`}
                            >
                                <MinusCircle className="mb-1 h-5 w-5" />
                                خصم سلفة 🟡
                            </button>
                        </div>
                    </div>

                    {/* المندوب */}
                    <div className="space-y-1.5">
                        <Label className="text-xs font-bold text-foreground flex items-center gap-1">
                            <User className="h-3.5 w-3.5 text-muted-foreground" />
                            المندوب / الموظف
                        </Label>
                        <Select value={form.employee_id} onValueChange={handleEmployeeChange}>
                            <SelectTrigger className="rounded-xl border-border">
                                <SelectValue placeholder="اختر المندوب..." />
                            </SelectTrigger>
                            <SelectContent dir="rtl">
                                {employees.map((emp) => (
                                    <SelectItem key={emp.id} value={emp.id}>
                                        {emp.name} {emp.role === 'sales_rep' ? '(مندوب مبيعات)' : ''}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        {/* المبلغ */}
                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold text-foreground flex items-center gap-1">
                                <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                                المبلغ (بالجنيه EGP)
                            </Label>
                            <Input
                                type="number"
                                min="0"
                                step="any"
                                required
                                placeholder="0.00"
                                value={form.amount}
                                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                                className="rounded-xl font-bold font-mono"
                            />
                        </div>

                        {/* التاريخ */}
                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold text-foreground flex items-center gap-1">
                                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                                تاريخ الاستحقاق
                            </Label>
                            <Input
                                type="date"
                                required
                                value={form.date}
                                onChange={(e) => setForm({ ...form, date: e.target.value })}
                                className="rounded-xl"
                            />
                        </div>
                    </div>

                    {/* عنوان البند */}
                    <div className="space-y-1.5">
                        <Label className="text-xs font-bold text-foreground flex items-center justify-between">
                            <span className="flex items-center gap-1">
                                <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                                عنوان البند
                            </span>
                            <span className="text-[10px] text-muted-foreground">أو اختر من المقترحات أدناه</span>
                        </Label>
                        <Input
                            required
                            placeholder="مثال: مكافأة تحقيق تارجت الأسبوع"
                            value={form.title}
                            onChange={(e) => setForm({ ...form, title: e.target.value })}
                            className="rounded-xl"
                        />

                        {/* اقتراحات سريعة */}
                        <div className="flex flex-wrap gap-1.5 pt-1">
                            {PRESET_TITLES[form.type]?.slice(0, 3).map((preset) => (
                                <button
                                    key={preset}
                                    type="button"
                                    onClick={() => setForm((p) => ({ ...p, title: preset }))}
                                    className="rounded-lg bg-muted px-2 py-0.5 text-[10px] text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
                                >
                                    {preset}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* السبب والشرح */}
                    <div className="space-y-1.5">
                        <Label className="text-xs font-bold text-foreground">الشرح والسبب الإداري (اختياري)</Label>
                        <textarea
                            rows={2}
                            placeholder="تفاصيل إضافية أو مبررات القرار..."
                            value={form.reason}
                            onChange={(e) => setForm({ ...form, reason: e.target.value })}
                            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                    </div>

                    {/* الحالة */}
                    <div className="space-y-1.5">
                        <Label className="text-xs font-bold text-foreground">حالة الاعتماد</Label>
                        <Select
                            value={form.status}
                            onValueChange={(val) => setForm({ ...form, status: val })}
                        >
                            <SelectTrigger className="rounded-xl border-border">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent dir="rtl">
                                <SelectItem value="approved">معتمد فوراً (Approved) ✅</SelectItem>
                                <SelectItem value="pending">قيد المراجعة (Pending) ⏳</SelectItem>
                                <SelectItem value="applied">تم ترحيله للراتب (Applied) 💼</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* خيار إرسال إشعار WhatsApp */}
                    <div className="flex items-center justify-between rounded-2xl border border-border bg-emerald-500/5 p-3">
                        <div className="flex items-center gap-2.5">
                            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                                <MessageCircle className="h-4 w-4" />
                            </span>
                            <div>
                                <p className="text-xs font-bold text-foreground">إشعار فوري عبر WhatsApp للمندوب</p>
                                <p className="text-[11px] text-muted-foreground">
                                    {selectedEmployee?.phone
                                        ? `إرسال رسالة تفصيلية للرقم (${selectedEmployee.phone})`
                                        : 'لم يتم تسجيل رقم هاتف للموظف (سيتم إرسال إشعار داخل التطبيق فقط)'}
                                </p>
                            </div>
                        </div>
                        <label className="relative inline-flex cursor-pointer items-center">
                            <input
                                type="checkbox"
                                checked={sendWhatsapp}
                                onChange={(e) => setSendWhatsapp(e.target.checked)}
                                disabled={!selectedEmployee?.phone}
                                className="peer sr-only"
                            />
                            <div className="peer h-5 w-9 rounded-full bg-muted peer-checked:bg-emerald-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:absolute after:top-[2px] after:right-[2px] after:h-4 after:w-4 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all peer-focus:outline-none dark:border-gray-600"></div>
                        </label>
                    </div>

                    <div className="mt-6 flex items-center justify-end gap-2 pt-2 border-t border-border">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={onClose}
                            disabled={loading}
                            className="rounded-xl"
                        >
                            إلغاء
                        </Button>
                        <Button
                            type="submit"
                            disabled={loading}
                            className="rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground min-w-28 font-bold"
                        >
                            {loading ? 'جاري الحفظ...' : editAdjustment ? 'تحديث البند' : 'حفظ ونشر للمندوب'}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
