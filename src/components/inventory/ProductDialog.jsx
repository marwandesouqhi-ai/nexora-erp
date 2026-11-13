import { memo, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';

const CATEGORY_LABELS = {
    medication: 'دواء',
    supplement: 'مكمل',
    vaccine: 'لقاح',
    equipment: 'معدات',
    feed: 'أعلاف',
    other: 'أخرى',
};

const UNIT_LABELS = {
    box: 'علبة',
    piece: 'قطعة',
    vial: 'فيال',
    kg: 'كيلو',
    liter: 'لتر',
    bottle: 'زجاجة',
};

function Field({ label, htmlFor, colSpan2, children }) {
    return (
        <div className={colSpan2 ? 'col-span-2' : ''}>
            <label htmlFor={htmlFor} className="mb-1 block text-xs font-bold text-muted-foreground ">
                {label}
            </label>
            {children}
        </div>
    );
}

/**
 * فورم إضافة / تعديل صنف بالمخزن — مكون تحكم (controlled component).
 *
 * Props:
 *  - open, onOpenChange: التحكم في ظهور الـ Dialog
 *  - form: كائن بيانات الفورم الحالي
 *  - onChange(nextForm): يُستدعى مع كل تعديل على أي حقل
 *  - onSubmit(): يُستدعى عند الحفظ
 *  - isEdit: هل نحن في وضع تعديل أم إضافة
 *  - loading: حالة الحفظ (تعطيل الأزرار وعرض مؤشر تحميل)
 */
function ProductDialog({
    open,
    onOpenChange,
    form,
    onChange,
    onSubmit,
    isEdit = false,
    loading = false,
}) {
    const set = (patch) => onChange({ ...form, ...patch });

    // إغلاق الديالوج بمفتاح Escape ما لم نكن في منتصف الحفظ
    useEffect(() => {
        if (!open) return;
        const handler = (e) => {
            if (e.key === 'Escape' && loading) e.preventDefault();
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [open, loading]);

    const canSubmit = !!form?.name?.trim() && !loading;

    return (
        <Dialog open={open} onOpenChange={(val) => !loading && onOpenChange(val)}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="text-xl font-black">
                        {isEdit ? 'تعديل الصنف' : 'إضافة صنف جديد للمخزن'}
                    </DialogTitle>
                </DialogHeader>

                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        if (canSubmit) onSubmit();
                    }}
                    className="grid grid-cols-2 gap-4 py-4"
                >
                    <Field label="اسم المنتج (إلزامي)" htmlFor="pd-name" colSpan2>
                        <Input
                            id="pd-name"
                            value={form?.name || ''}
                            onChange={(e) => set({ name: e.target.value })}
                            required
                            autoFocus
                        />
                    </Field>

                    <Field label="الباركود" htmlFor="pd-barcode">
                        <Input
                            id="pd-barcode"
                            value={form?.barcode || ''}
                            onChange={(e) => set({ barcode: e.target.value })}
                        />
                    </Field>

                    <Field label="الفئة" htmlFor="pd-category">
                        <Select value={form?.category || 'medication'} onValueChange={(v) => set({ category: v })}>
                            <SelectTrigger id="pd-category">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                                    <SelectItem key={k} value={k}>{v}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </Field>

                    <Field label="الوحدة" htmlFor="pd-unit">
                        <Select value={form?.unit || 'box'} onValueChange={(v) => set({ unit: v })}>
                            <SelectTrigger id="pd-unit">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {Object.entries(UNIT_LABELS).map(([k, v]) => (
                                    <SelectItem key={k} value={k}>{v}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </Field>

                    <Field label="سعر البيع" htmlFor="pd-price">
                        <Input
                            id="pd-price"
                            type="number"
                            min="0"
                            step="0.01"
                            value={form?.price ?? ''}
                            onChange={(e) => set({ price: e.target.value })}
                        />
                    </Field>

                    <Field label="سعر الشراء (التكلفة)" htmlFor="pd-cost">
                        <Input
                            id="pd-cost"
                            type="number"
                            min="0"
                            step="0.01"
                            value={form?.cost ?? ''}
                            onChange={(e) => set({ cost: e.target.value })}
                        />
                    </Field>

                    <Field label="الكمية الحالية" htmlFor="pd-stock">
                        <Input
                            id="pd-stock"
                            type="number"
                            min="0"
                            value={form?.stock ?? 0}
                            onChange={(e) => set({ stock: e.target.value })}
                        />
                    </Field>

                    <Field label="حد الأمان (تنبيه النقص)" htmlFor="pd-min-stock">
                        <Input
                            id="pd-min-stock"
                            type="number"
                            min="0"
                            value={form?.min_stock ?? 10}
                            onChange={(e) => set({ min_stock: e.target.value })}
                        />
                    </Field>

                    <Field label="تاريخ الانتهاء" htmlFor="pd-expiry">
                        <Input
                            id="pd-expiry"
                            type="date"
                            value={form?.expiry_date || ''}
                            onChange={(e) => set({ expiry_date: e.target.value })}
                        />
                    </Field>

                    <Field label="رقم التشغيلة (Batch)" htmlFor="pd-batch">
                        <Input
                            id="pd-batch"
                            value={form?.batch_number || ''}
                            onChange={(e) => set({ batch_number: e.target.value })}
                        />
                    </Field>

                    <Field label="ملاحظات" htmlFor="pd-desc" colSpan2>
                        <textarea
                            id="pd-desc"
                            value={form?.description || ''}
                            onChange={(e) => set({ description: e.target.value })}
                            rows={3}
                            className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 "
                        />
                    </Field>

                    <div className="col-span-2 flex justify-end gap-2 pt-2">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                            إلغاء
                        </Button>
                        <Button type="submit" disabled={!canSubmit} className="gap-2 bg-indigo-600 hover:bg-indigo-700">
                            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                            {isEdit ? 'حفظ التعديلات' : 'إضافة الصنف'}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}

export default memo(ProductDialog);