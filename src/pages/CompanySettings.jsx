import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSystemSettings, updateSystemSettings } from '@/firebase/collections/settings';
import { useRole } from '@/lib/RoleContext';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Building2, Save, Loader2, MessageCircle } from 'lucide-react';
import { doc, updateDoc, serverTimestamp } from '@/data/firestoreCompat';
import { db } from '@/api/firebase';
import { useTenant } from '@/lib/TenantContext';
import { normalizeWaNumber, formatWaDisplay, isValidWaNumber } from '@/utils/whatsapp';
import { useToast } from '@/components/ui/use-toast';

import { PageHero } from '@/components/page';
const emptyForm = { name: 'Nexora ERP', logo: '', phone: '', address: '', currency: 'EGP', taxRate: 0, footerNote: 'شكراً لتعاملكم معنا' };

export default function CompanySettings() {
    const { can } = useRole();
    const { user } = useAuth();
    const { toast } = useToast();
    const qc = useQueryClient();
    const [form, setForm] = useState(emptyForm);
    const { tenant } = useTenant();
    // null = لم يعدّل المستخدم الحقل بعد → نعرض القيمة الحالية من مستند الشركة
    const [waInput, setWaInput] = useState(null);
    const waValue = waInput ?? formatWaDisplay(tenant?.admin_whatsapp);

    const waMutation = useMutation({
        mutationFn: async () => {
            const normalized = normalizeWaNumber(waValue);
            if (normalized && !isValidWaNumber(normalized)) throw new Error('رقم واتساب غير صحيح. مثال: 01012345678 أو +20 1012345678');
            if (!tenant?.id) throw new Error('لا توجد شركة مرتبطة بحسابك.');
            await updateDoc(doc(db, 'companies', tenant.id), { admin_whatsapp: normalized, updated_at: serverTimestamp() });
        },
        onSuccess: () => { setWaInput(null); toast({ title: 'تم حفظ رقم واتساب الإدارة' }); },
        onError: (err) => toast({ title: 'تعذر حفظ الرقم', description: err?.message, variant: 'destructive' }),
    });

    const { data: settings, isLoading } = useQuery({ queryKey: ['system-settings'], queryFn: getSystemSettings });

    useEffect(() => {
        if (settings) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setForm({
                name: settings.business_name || emptyForm.name,
                logo: settings.logo_url || '',
                phone: settings.phone || '',
                address: settings.address || '',
                currency: settings.currency || 'EGP',
                taxRate: settings.tax_rate ?? 0,
                footerNote: settings.invoice_footer || emptyForm.footerNote,
            });
        }
    }, [settings]);

    const saveMutation = useMutation({
        mutationFn: () => updateSystemSettings({ ...form, adminId: user?.uid }),
        onSuccess: () => { qc.invalidateQueries(['system-settings']); toast({ title: 'تم حفظ إعدادات الشركة' }); },
        onError: () => toast({ title: 'تعذر حفظ الإعدادات', variant: 'destructive' }),
    });

    if (!can('can_manage_users')) {
        return <div className="p-8 text-center text-muted-foreground">غير مسموح لك بالوصول إلى هذه الصفحة.</div>;
    }

    return (
        <div className="space-y-6" dir="rtl">
            <PageHero
                className="mb-0"
                icon={Building2}
                tone="slate"
                title="إعدادات الشركة"
                subtitle="بيانات الشركة الأساسية المستخدمة في الفواتير والنظام بالكامل."
            />

            <Card className="rounded-2xl border border-border bg-card shadow-sm">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg font-black text-foreground">
                        <MessageCircle className="h-5 w-5 text-success" /> رقم واتساب الإدارة
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">
                        الرقم الذي يستقبل طلبات المناديب ومحاضر تصفية العهد والتقارير الميدانية وتنبيهات المخزون، ويظهر في لوحة التحكم.
                    </p>
                </CardHeader>
                <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
                    <div className="flex-1">
                        <label className="mb-1 block text-xs font-bold text-muted-foreground">رقم الواتساب</label>
                        <Input dir="ltr" className="text-left" value={waValue} onChange={(e) => setWaInput(e.target.value)} placeholder="+20 1012345678" inputMode="tel" />
                    </div>
                    <Button className="gap-2" onClick={() => waMutation.mutate()} disabled={waMutation.isPending || waInput === null}>
                        <Save className="h-4 w-4" /> {waMutation.isPending ? 'جاري الحفظ...' : 'حفظ الرقم'}
                    </Button>
                </CardContent>
            </Card>

            {isLoading ? (
                <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : (
                <Card className="rounded-2xl border border-border bg-card shadow-sm">
                    <CardHeader><CardTitle className="flex items-center gap-2 text-lg font-black text-foreground"><Building2 className="h-5 w-5" /> بيانات الشركة</CardTitle></CardHeader>
                    <CardContent className="grid gap-4 md:grid-cols-2">
                        <div>
                            <label className="mb-1 block text-xs font-bold text-muted-foreground">اسم الشركة</label>
                            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-bold text-muted-foreground">رابط الشعار (Logo URL)</label>
                            <Input value={form.logo} onChange={(e) => setForm({ ...form, logo: e.target.value })} placeholder="https://..." />
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-bold text-muted-foreground">رقم الهاتف</label>
                            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-bold text-muted-foreground">العملة</label>
                            <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v })}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="EGP">جنيه مصري (EGP)</SelectItem>
                                    <SelectItem value="SAR">ريال سعودي (SAR)</SelectItem>
                                    <SelectItem value="USD">دولار أمريكي (USD)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-bold text-muted-foreground">نسبة الضريبة (%)</label>
                            <Input type="number" value={form.taxRate} onChange={(e) => setForm({ ...form, taxRate: e.target.value })} />
                        </div>
                        <div className="md:col-span-2">
                            <label className="mb-1 block text-xs font-bold text-muted-foreground">العنوان</label>
                            <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
                        </div>
                        <div className="md:col-span-2">
                            <label className="mb-1 block text-xs font-bold text-muted-foreground">ملاحظة أسفل الفاتورة</label>
                            <Textarea value={form.footerNote} onChange={(e) => setForm({ ...form, footerNote: e.target.value })} />
                        </div>
                        <div className="md:col-span-2">
                            <Button className="gap-2" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                                <Save className="h-4 w-4" /> {saveMutation.isPending ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
