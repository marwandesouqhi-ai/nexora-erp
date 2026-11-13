import React, { useState, useEffect } from 'react';
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
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Clock, AlertCircle, Edit3, ShieldCheck, UserCheck, Loader2 } from 'lucide-react';
import { updateAttendanceRecord, approveAttendanceRecord } from '@/firebase/collections/attendance';
import { useToast } from '@/components/ui/use-toast';

export default function AttendanceEditModal({ record, open, onClose, onUpdated }) {
    const { toast } = useToast();
    const [status, setStatus] = useState('present');
    const [lateMinutes, setLateMinutes] = useState(0);
    const [checkInTime, setCheckInTime] = useState('');
    const [checkOutTime, setCheckOutTime] = useState('');
    const [note, setNote] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (!record) return;
        setStatus(record.status || 'present');
        setLateMinutes(record.late_minutes ?? (record.status === 'late' ? 15 : 0));
        setNote(record.note || record.approval_notes || '');

        if (record.check_in) {
            const d = record.check_in.toDate ? record.check_in.toDate() : new Date(record.check_in);
            if (!isNaN(d.getTime())) {
                const hours = String(d.getHours()).padStart(2, '0');
                const mins = String(d.getMinutes()).padStart(2, '0');
                setCheckInTime(`${hours}:${mins}`);
            }
        } else {
            setCheckInTime('');
        }

        if (record.check_out) {
            const d = record.check_out.toDate ? record.check_out.toDate() : new Date(record.check_out);
            if (!isNaN(d.getTime())) {
                const hours = String(d.getHours()).padStart(2, '0');
                const mins = String(d.getMinutes()).padStart(2, '0');
                setCheckOutTime(`${hours}:${mins}`);
            }
        } else {
            setCheckOutTime('');
        }
    }, [record]);

    if (!record) return null;

    const handleSave = async (isApprove = false) => {
        setIsSaving(true);
        try {
            const payload = {
                status,
                late_minutes: status === 'late' ? Number(lateMinutes) || 0 : 0,
                note: note.trim(),
            };

            if (isApprove) {
                payload.approved_by_hr = true;
                payload.hr_approval_status = 'approved';
            }

            const res = await updateAttendanceRecord(record.id, payload);
            if (res.success) {
                toast({
                    title: isApprove ? 'تم اعتماد سجل الحضور بنجاح' : 'تم حفظ تعديلات سجل الحضور',
                    variant: 'success',
                });
                onUpdated?.();
                onClose();
            } else {
                toast({
                    title: 'فشل التحديث',
                    description: res.error?.message || 'حدث خطأ',
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
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
            <DialogContent className="max-w-md rounded-2xl p-6" dir="rtl">
                <DialogHeader className="space-y-1">
                    <DialogTitle className="flex items-center gap-2 text-lg font-black text-foreground">
                        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
                            <Edit3 className="h-4 w-4" />
                        </span>
                        تعديل واعتماد سجل حضور المندوب
                    </DialogTitle>
                    <DialogDescription className="text-xs text-muted-foreground">
                        المندوب: <span className="font-bold text-foreground">{record.employee_name}</span> | التاريخ: <span className="font-mono text-foreground">{record.date}</span>
                    </DialogDescription>
                </DialogHeader>

                <div className="mt-3 space-y-4">
                    {/* حالة الحضور */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-foreground">حالة الحضور</label>
                        <Select value={status} onValueChange={setStatus}>
                            <SelectTrigger className="rounded-xl border-border">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent dir="rtl">
                                <SelectItem value="present">حاضر (في الموعد)</SelectItem>
                                <SelectItem value="late">متأخر عن بداية الدوام</SelectItem>
                                <SelectItem value="absent">غائب</SelectItem>
                                <SelectItem value="leave">إجازة رسمية / مرضية</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* دقائق التأخير إن كان متأخراً */}
                    {status === 'late' && (
                        <div className="space-y-1.5 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
                            <label className="text-xs font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                                <Clock className="h-3.5 w-3.5" />
                                دقائق التأخير المحسوبة
                            </label>
                            <Input
                                type="number"
                                min="1"
                                value={lateMinutes}
                                onChange={(e) => setLateMinutes(e.target.value)}
                                className="rounded-xl border-border text-sm"
                                placeholder="مثال: 25"
                            />
                            <p className="text-[10px] text-muted-foreground">
                                يتم حساب هذا التأخير في مسيرات الرواتب تلقائياً.
                            </p>
                        </div>
                    )}

                    {/* ملاحظات التعديل */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-foreground">ملاحظات مسؤول الموارد البشرية</label>
                        <Input
                            placeholder="مثال: تم التأكد من المندوب وعذر التأخير مقبول"
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            className="rounded-xl border-border text-xs"
                        />
                    </div>
                </div>

                <DialogFooter className="flex flex-wrap items-center justify-between gap-2 pt-4 border-t border-border mt-4">
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={onClose}
                        className="rounded-xl text-xs"
                    >
                        إلغاء
                    </Button>

                    <div className="flex items-center gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            disabled={isSaving}
                            onClick={() => handleSave(false)}
                            className="rounded-xl text-xs font-bold"
                        >
                            حفظ التعديل
                        </Button>

                        <Button
                            type="button"
                            disabled={isSaving}
                            onClick={() => handleSave(true)}
                            className="rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                        >
                            {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                            اعتماد السجل رسمياً
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
