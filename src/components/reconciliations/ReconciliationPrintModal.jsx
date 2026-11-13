import { forwardRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer, X, CheckCircle2, AlertTriangle } from 'lucide-react';
import { getDifferenceStatus } from '@/firebase/collections/daily_reconciliations';

export const ReconciliationPrintSheet = forwardRef(({ record }, ref) => {
    if (!record) return null;
    const diffStatus = getDifferenceStatus(record.cash_difference);

    return (
        <div ref={ref} className="p-8 bg-white text-slate-900 min-h-[500px]" dir="rtl">
            {/* Header */}
            <div className="border-b-2 border-slate-900 pb-4 mb-6 flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black tracking-wide">Nexora ERP — إيصال تصفية اليومية والعهدة</h1>
                    <p className="text-xs text-slate-600 mt-1">سند استلام عهدة نقدية وجرد بضاعة السيارة (Van Stock)</p>
                </div>
                <div className="text-left">
                    <p className="text-xs font-mono font-bold">رقم المحضر: #{record.id?.slice(0, 8) || 'REC'}</p>
                    <p className="text-xs text-slate-600 font-mono">{record.date || new Date().toISOString().slice(0, 10)}</p>
                </div>
            </div>

            {/* Rep & Audit Info */}
            <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 mb-6 text-sm">
                <div>
                    <span className="text-slate-500 font-bold block text-xs">اسم المندوب:</span>
                    <span className="font-black text-base">{record.employee_name || record.employee_id || 'مندوب ميداني'}</span>
                </div>
                <div>
                    <span className="text-slate-500 font-bold block text-xs">تاريخ التصفية:</span>
                    <span className="font-bold">{record.date}</span>
                </div>
                <div>
                    <span className="text-slate-500 font-bold block text-xs">حالة الاعتماد:</span>
                    <span className="font-bold">{record.status === 'approved' ? 'معتمد محاسبياً ✅' : 'قيد المراجعة'}</span>
                </div>
                <div>
                    <span className="text-slate-500 font-bold block text-xs">المحاسب المعتمد:</span>
                    <span className="font-bold">{record.audited_by || '—'}</span>
                </div>
            </div>

            {/* Financial Summary Table */}
            <table className="w-full border-collapse border border-slate-300 text-sm mb-6">
                <thead>
                    <tr className="bg-slate-100 text-slate-800">
                        <th className="border border-slate-300 p-3 text-right">البيان المالي والتشغيلي</th>
                        <th className="border border-slate-300 p-3 text-center">القيمة المسجلة بالنظام</th>
                        <th className="border border-slate-300 p-3 text-center">القيمة الفعلية المستلمة</th>
                        <th className="border border-slate-300 p-3 text-center">الفارق المالي</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td className="border border-slate-300 p-3 font-bold">النقدية المحصلة من الفواتير والعملاء</td>
                        <td className="border border-slate-300 p-3 text-center font-mono font-bold">
                            {(record.system_cash || 0).toLocaleString('ar')} ج.م
                        </td>
                        <td className="border border-slate-300 p-3 text-center font-mono font-black text-slate-900">
                            {(record.actual_cash || 0).toLocaleString('ar')} ج.م
                        </td>
                        <td className={`border border-slate-300 p-3 text-center font-mono font-black ${
                            record.cash_difference < 0 ? 'text-red-600 bg-red-50' : record.cash_difference > 0 ? 'text-amber-600 bg-amber-50' : 'text-emerald-700 bg-emerald-50'
                        }`}>
                            {(record.cash_difference || 0).toLocaleString('ar')} ج.م
                        </td>
                    </tr>
                    <tr>
                        <td className="border border-slate-300 p-3 font-bold">إنجاز الزيارات الميدانية</td>
                        <td className="border border-slate-300 p-3 text-center font-mono" colSpan="3">
                            تم إنجاز {record.done_visits || 0} زيارة من إجمالي {record.total_visits || 0} زيارة مجدولة
                        </td>
                    </tr>
                    <tr>
                        <td className="border border-slate-300 p-3 font-bold">أصناف بضاعة السيارة (Van Stock)</td>
                        <td className="border border-slate-300 p-3 text-center font-mono" colSpan="3">
                            تم مطابقة جرد {record.stock_items_count || 0} صنف في عهدة السيارة
                        </td>
                    </tr>
                </tbody>
            </table>

            {/* Difference indicator banner */}
            <div className={`p-4 rounded-xl border mb-6 flex items-center gap-3 ${
                record.cash_difference < 0 ? 'bg-red-50 border-red-200 text-red-700' :
                record.cash_difference > 0 ? 'bg-amber-50 border-amber-200 text-amber-800' :
                'bg-emerald-50 border-emerald-200 text-emerald-800'
            }`}>
                {record.cash_difference < 0 ? <AlertTriangle className="h-6 w-6" /> : <CheckCircle2 className="h-6 w-6" />}
                <div>
                    <p className="font-black text-sm">حالة المطابقة المالية: {diffStatus.label}</p>
                    <p className="text-xs mt-0.5">
                        {record.cash_difference === 0 ? 'لا توجد فروقات مالية. النقدية المستلمة تطابق فواتير المبيعات المسجلة.' :
                         record.cash_difference < 0 ? 'تنبيه: يوجد عجز نقدي يستوجب توضيح المندوب وخصمه أو تسويته فوراً.' :
                         'يوجد فائض نقدي تم توريده إلى الخزينة وقيده كزيادة تحت الفحص.'}
                    </p>
                </div>
            </div>

            {/* Notes */}
            {record.notes && (
                <div className="mb-6 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                    <span className="font-bold block text-slate-600 mb-1">ملاحظات المندوب:</span>
                    <p>{record.notes}</p>
                </div>
            )}

            {/* Signatures */}
            <div className="grid grid-cols-2 gap-12 mt-12 pt-6 border-t border-slate-300 text-center text-xs">
                <div>
                    <p className="font-bold text-slate-700">توقيع واستلام أمين الخزينة / المشرف</p>
                    <div className="mt-8 border-b border-dashed border-slate-400 w-48 mx-auto" />
                </div>
                <div>
                    <p className="font-bold text-slate-700">توقيع المندوب المسلم</p>
                    <div className="mt-8 border-b border-dashed border-slate-400 w-48 mx-auto" />
                </div>
            </div>
        </div>
    );
});

ReconciliationPrintSheet.displayName = 'ReconciliationPrintSheet';

export default function ReconciliationPrintModal({ record, open, onClose }) {
    if (!record) return null;

    const handlePrint = () => {
        window.print();
    };

    return (
        <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0 rounded-2xl" dir="rtl">
                <DialogHeader className="p-4 border-b border-border flex flex-row items-center justify-between">
                    <DialogTitle className="text-base font-bold flex items-center gap-2">
                        <Printer className="h-4 w-4 text-primary" />
                        سند تصفية اليومية — {record.employee_name}
                    </DialogTitle>
                    <div className="flex items-center gap-2">
                        <Button size="sm" onClick={handlePrint} className="gap-1.5 font-bold">
                            <Printer className="h-4 w-4" />
                            طباعة السند
                        </Button>
                    </div>
                </DialogHeader>

                <div className="overflow-y-auto">
                    <ReconciliationPrintSheet record={record} />
                </div>
            </DialogContent>
        </Dialog>
    );
}
