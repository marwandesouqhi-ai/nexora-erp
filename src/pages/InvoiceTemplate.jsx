import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSystemSettings, updateSystemSettings, uploadInvoiceLogo, uploadInvoiceTemplateFile } from '@/firebase/collections/settings';
import PrintTemplate from '@/utils/printing/PrintTemplate';
import { useRole } from '@/lib/RoleContext';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { FileText, Save, Loader2, Palette, Eye, Upload, LayoutTemplate, Image as ImageIcon, X } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

import { PageHero, EmptyState } from '@/components/page';
const SAMPLE_SALE = {
    invoice_number: 'INV-1024',
    customer_name: 'أحمد محمد',
    total: 450,
    payment_status: 'paid',
    created_date: new Date(),
    items: [
        { product_name: 'منتج تجريبي 1', quantity: 2, price: 100, total: 200 },
        { product_name: 'منتج تجريبي 2', quantity: 1, price: 250, total: 250 },
    ],
};

const DEFAULT_FORM = {
    companyName: 'Nexora ERP',
    companySubtitle: 'نظام إدارة متكامل',
    footer: 'شكراً لتعاملكم معنا',
    logoUrl: '',
    showLogo: true,
    headerColor: '#2563eb',
    accentColor: '#f59e0b',
    textColor: '#0f172a',
    backgroundColor: '#f8fafc',
    headerText: 'نظام إدارة موارد المؤسسة',
    footerText: 'شكراً لثقتكم بنا',
    sourceMode: 'builtin', // builtin | uploaded
    uploadedTemplateUrl: null,
    uploadedTemplateName: '',
    showBarcode: true,
};

export default function InvoiceTemplate() {
    const { can } = useRole();
    const { user } = useAuth();
    const { toast } = useToast();
    const qc = useQueryClient();

    const [form, setForm] = useState(DEFAULT_FORM);
    const [showSource, setShowSource] = useState(false);
    const [uploadingLogo, setUploadingLogo] = useState(false);
    const [uploadingTemplate, setUploadingTemplate] = useState(false);

    const { data: settings, isLoading } = useQuery({ queryKey: ['system-settings-invoice-template'], queryFn: getSystemSettings });

    useEffect(() => {
        if (settings) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setForm((current) => ({
                ...current,
                companyName: settings.business_name || 'Nexora ERP',
                companySubtitle: settings.company_subtitle || current.companySubtitle,
                footer: settings.invoice_footer || current.footer,
                logoUrl: settings.invoice_template?.logo_url || settings.logo_url || current.logoUrl,
                showLogo: settings.invoice_template?.show_logo ?? current.showLogo,
                headerColor: settings.invoice_template?.header_color || settings.invoice_template?.primary_color || current.headerColor,
                accentColor: settings.invoice_template?.accent_color || current.accentColor,
                textColor: settings.invoice_template?.text_color || current.textColor,
                backgroundColor: settings.invoice_template?.background_color || current.backgroundColor,
                headerText: settings.invoice_template?.header_text || current.headerText,
                footerText: settings.invoice_template?.footer_text || current.footerText,
                sourceMode: settings.invoice_template?.source_mode || current.sourceMode,
                uploadedTemplateUrl: settings.invoice_template?.uploaded_template_url || current.uploadedTemplateUrl,
                uploadedTemplateName: settings.invoice_template?.uploaded_template_name || current.uploadedTemplateName,
                showBarcode: settings.invoice_template?.show_barcode ?? current.showBarcode,
            }));
        }
    }, [settings]);

    const jsonSource = useMemo(() => JSON.stringify({
        companyName: form.companyName,
        companySubtitle: form.companySubtitle,
        footer: form.footer,
        logoUrl: form.logoUrl,
        showLogo: form.showLogo,
        headerColor: form.headerColor,
        accentColor: form.accentColor,
        textColor: form.textColor,
        backgroundColor: form.backgroundColor,
        headerText: form.headerText,
        footerText: form.footerText,
        sourceMode: form.sourceMode,
        uploadedTemplateUrl: form.uploadedTemplateUrl,
        showBarcode: form.showBarcode,
    }, null, 2), [form]);

    // ✅ باج تم تصليحه: كل الألوان الأربعة بتتبعت صح دلوقتي
    const saveMutation = useMutation({
        mutationFn: async () => updateSystemSettings({
            name: form.companyName,
            footerNote: form.footer,
            invoice_template: {
                logo_url: form.logoUrl,
                show_logo: !!form.showLogo,
                header_color: form.headerColor,
                accent_color: form.accentColor,
                text_color: form.textColor,
                background_color: form.backgroundColor,
                header_text: form.headerText,
                footer_text: form.footerText,
                source_mode: form.sourceMode,
                uploaded_template_url: form.sourceMode === 'uploaded' ? (form.uploadedTemplateUrl || null) : null,
                uploaded_template_name: form.sourceMode === 'uploaded' ? (form.uploadedTemplateName || '') : '',
                show_barcode: !!form.showBarcode,
            },
            adminId: user?.uid,
        }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['system-settings-invoice-template'] });
            toast({ title: '✅ تم حفظ قالب الفاتورة' });
        },
        onError: () => toast({ title: '❌ تعذر حفظ القالب', variant: 'destructive' }),
    });

    const handleLogoUpload = async (file) => {
        if (!file) return;
        setUploadingLogo(true);
        try {
            const result = await uploadInvoiceLogo(file);
            if (result.success) {
                setForm((f) => ({ ...f, logoUrl: result.url }));
                toast({ title: '✅ تم رفع الشعار بنجاح' });
            } else {
                toast({ title: '❌ تعذر رفع الشعار', variant: 'destructive' });
            }
        } catch {
            toast({ title: '❌ تعذر رفع الشعار', variant: 'destructive' });
        } finally {
            setUploadingLogo(false);
        }
    };

    // ✅ رفع قالب فاتورة جاهز (صورة أو PDF)
    const handleTemplateUpload = async (file) => {
        if (!file) return;

        const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
        if (!allowedTypes.includes(file.type)) {
            toast({ title: '❌ صيغة غير مدعومة', description: 'الملفات المسموحة: PDF أو JPG أو PNG أو WEBP', variant: 'destructive' });
            return;
        }
        if (file.size > 10 * 1024 * 1024) {
            toast({ title: '❌ الملف كبير جدًا', description: 'الحد الأقصى 10 ميجابايت', variant: 'destructive' });
            return;
        }

        setUploadingTemplate(true);
        try {
            const result = await uploadInvoiceTemplateFile(file);
            if (result.success) {
                setForm((f) => ({ ...f, uploadedTemplateUrl: result.url, uploadedTemplateName: file.name }));
                toast({ title: '✅ تم رفع القالب بنجاح' });
            } else {
                toast({ title: '❌ تعذر رفع القالب', variant: 'destructive' });
            }
        } catch {
            toast({ title: '❌ تعذر رفع القالب', variant: 'destructive' });
        } finally {
            setUploadingTemplate(false);
        }
    };

    const removeUploadedTemplate = () => {
        setForm((f) => ({ ...f, uploadedTemplateUrl: null, uploadedTemplateName: '' }));
    };

    if (!can('can_manage_users') && !can('can_manage_settings')) {
        return <div className="p-8 text-center text-muted-foreground">غير مسموح لك بالوصول إلى هذه الصفحة.</div>;
    }

    const isPdfTemplate = form.uploadedTemplateUrl?.toLowerCase().includes('.pdf');

    return (
        <div className="space-y-6" dir="rtl">
            <PageHero
                className="mb-0"
                icon={FileText}
                tone="slate"
                title="قالب الفواتير"
                subtitle="صمّم أو ارفع قالب الفاتورة — يُطبّق على كل فواتير النظام"
                actions={
                    <Button className="gap-2" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || uploadingLogo || uploadingTemplate}>
                        {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        {saveMutation.isPending ? 'جاري الحفظ...' : 'حفظ القالب'}
                    </Button>
                }
            />

            {isLoading ? (
                <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : (
                <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
                    <Card className="rounded-2xl border border-border bg-card shadow-sm">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-lg font-black text-foreground">
                                <FileText className="h-5 w-5" /> إعدادات القالب
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-5">
                            {/* ✅ اختيار مصدر القالب */}
                            <Tabs value={form.sourceMode} onValueChange={(v) => setForm({ ...form, sourceMode: v })}>
                                <TabsList className="grid w-full grid-cols-2">
                                    <TabsTrigger value="builtin" className="gap-2">
                                        <LayoutTemplate className="h-4 w-4" /> قالب النظام
                                    </TabsTrigger>
                                    <TabsTrigger value="uploaded" className="gap-2">
                                        <Upload className="h-4 w-4" /> رفع قالب جاهز
                                    </TabsTrigger>
                                </TabsList>

                                {/* ---------- قالب النظام (builtin) ---------- */}
                                <TabsContent value="builtin" className="space-y-5 pt-4">
                                    <div className="grid gap-4 lg:grid-cols-2">
                                        <div>
                                            <label className="mb-1 block text-xs font-bold text-muted-foreground">اسم الشركة</label>
                                            <Input value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} />
                                        </div>
                                        <div>
                                            <label className="mb-1 block text-xs font-bold text-muted-foreground">الوصف الفرعي</label>
                                            <Input value={form.companySubtitle} onChange={(e) => setForm({ ...form, companySubtitle: e.target.value })} />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="mb-1 block text-xs font-bold text-muted-foreground">عنوان رأس الفاتورة</label>
                                        <Input value={form.headerText} onChange={(e) => setForm({ ...form, headerText: e.target.value })} />
                                    </div>

                                    <div>
                                        <label className="mb-1 block text-xs font-bold text-muted-foreground">نص التذييل</label>
                                        <Textarea value={form.footer} onChange={(e) => setForm({ ...form, footer: e.target.value })} className="min-h-[100px]" />
                                    </div>

                                    <div className="rounded-xl border border-border bg-muted/50 p-4">
                                        <div className="mb-3 flex items-center gap-2">
                                            <Palette className="h-4 w-4 text-muted-foreground" />
                                            <div>
                                                <p className="text-sm font-bold text-foreground">ألوان الفاتورة</p>
                                                <p className="text-xs text-muted-foreground">حدد الألوان الرئيسية لعنوان الفاتورة والنص والخلفية.</p>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                                            <ColorField label="الرأس" value={form.headerColor} onChange={(v) => setForm({ ...form, headerColor: v })} />
                                            <ColorField label="التمييز" value={form.accentColor} onChange={(v) => setForm({ ...form, accentColor: v })} />
                                            <ColorField label="النص" value={form.textColor} onChange={(v) => setForm({ ...form, textColor: v })} />
                                            <ColorField label="الخلفية" value={form.backgroundColor} onChange={(v) => setForm({ ...form, backgroundColor: v })} />
                                        </div>
                                    </div>

                                    <div className="grid gap-4 lg:grid-cols-2">
                                        <div>
                                            <label className="mb-1 block text-xs font-bold text-muted-foreground">رابط الشعار</label>
                                            <Input value={form.logoUrl} onChange={(e) => setForm({ ...form, logoUrl: e.target.value })} placeholder="https://example.com/logo.png" />
                                        </div>
                                        <div>
                                            <label className="mb-1 block text-xs font-bold text-muted-foreground">رفع شعار</label>
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    onChange={(e) => handleLogoUpload(e.target.files?.[0])}
                                                    disabled={uploadingLogo}
                                                    className="block w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground file:ml-3 file:rounded-md file:border-0 file:bg-primary/10 file:px-3 file:py-1.5 file:text-xs file:font-bold"
                                                />
                                                {uploadingLogo && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border px-4 py-3">
                                        <div className="flex items-center gap-3">
                                            <ImageIcon className="h-4 w-4 text-muted-foreground" />
                                            <div>
                                                <p className="text-sm font-bold text-foreground">إظهار الشعار</p>
                                                <p className="text-xs text-muted-foreground">تفعيل أو إخفاء الشعار في الفاتورة.</p>
                                            </div>
                                        </div>
                                        <Switch checked={form.showLogo} onCheckedChange={(v) => setForm({ ...form, showLogo: v })} />
                                    </div>

                                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border px-4 py-3">
                                        <div>
                                            <p className="text-sm font-bold text-foreground">إظهار الباركود</p>
                                            <p className="text-xs text-muted-foreground">يمكنك إيقاف عرض الباركود في الفاتورة.</p>
                                        </div>
                                        <Switch checked={form.showBarcode} onCheckedChange={(v) => setForm({ ...form, showBarcode: v })} />
                                    </div>
                                </TabsContent>

                                {/* ---------- رفع قالب جاهز (uploaded) ---------- */}
                                <TabsContent value="uploaded" className="space-y-4 pt-4">
                                    <div className="rounded-xl border border-dashed border-border bg-muted/30 p-6 text-center">
                                        {form.uploadedTemplateUrl ? (
                                            <div className="space-y-3">
                                                <Badge variant="secondary" className="gap-1">
                                                    <FileText className="h-3.5 w-3.5" />
                                                    {form.uploadedTemplateName || 'قالب مرفوع'}
                                                </Badge>
                                                {isPdfTemplate ? (
                                                    <iframe src={form.uploadedTemplateUrl} title="معاينة القالب" className="mx-auto h-64 w-full rounded-lg border border-border" />
                                                ) : (
                                                    <img src={form.uploadedTemplateUrl} alt="معاينة القالب" className="mx-auto max-h-64 rounded-lg border border-border object-contain" />
                                                )}
                                                <Button variant="outline" size="sm" className="gap-1" onClick={removeUploadedTemplate}>
                                                    <X className="h-3.5 w-3.5" /> إزالة القالب
                                                </Button>
                                            </div>
                                        ) : (
                                            <div className="space-y-3">
                                                <Upload className="mx-auto h-10 w-10 text-muted-foreground" />
                                                <p className="text-sm font-bold text-foreground">ارفع قالب فاتورة جاهز</p>
                                                <p className="text-xs text-muted-foreground">PDF أو صورة (JPG, PNG, WEBP) — حتى 10 ميجابايت</p>
                                                <input
                                                    type="file"
                                                    accept="application/pdf,image/png,image/jpeg,image/webp"
                                                    onChange={(e) => handleTemplateUpload(e.target.files?.[0])}
                                                    disabled={uploadingTemplate}
                                                    className="mx-auto block w-full max-w-xs rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground file:ml-3 file:rounded-md file:border-0 file:bg-primary/10 file:px-3 file:py-1.5 file:text-xs file:font-bold"
                                                />
                                                {uploadingTemplate && (
                                                    <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                                                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> جاري الرفع...
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        عند اختيار "رفع قالب جاهز"، سيتم استخدام هذا الملف بدل قالب النظام المُصمَّم في فواتيرك المطبوعة.
                                    </p>
                                </TabsContent>
                            </Tabs>

                            <div className="flex items-center gap-3 border-t border-border pt-4">
                                <Button className="gap-2" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || uploadingLogo || uploadingTemplate}>
                                    <Save className="h-4 w-4" /> {saveMutation.isPending ? 'جاري الحفظ...' : 'حفظ القالب'}
                                </Button>
                                <Button variant="outline" className="gap-2" onClick={() => setShowSource((prev) => !prev)}>
                                    <Eye className="h-4 w-4" /> {showSource ? 'إخفاء المصدر' : 'عرض المصدر'}
                                </Button>
                            </div>

                            {showSource && (
                                <div>
                                    <label className="mb-1 block text-xs font-bold text-muted-foreground">مصدر القالب</label>
                                    <Textarea value={jsonSource} readOnly className="min-h-[220px] bg-slate-950 text-slate-100" dir="ltr" />
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="rounded-2xl border border-border bg-muted/30 p-4 shadow-sm">
                        <div className="mb-4 flex items-center gap-2 text-lg font-black text-foreground">
                            <Palette className="h-5 w-5" />
                            معاينة الفاتورة
                        </div>
                        {form.sourceMode === 'uploaded' && form.uploadedTemplateUrl ? (
                            isPdfTemplate ? (
                                <iframe src={form.uploadedTemplateUrl} title="معاينة الفاتورة" className="h-[600px] w-full rounded-lg border border-border bg-white" />
                            ) : (
                                <img src={form.uploadedTemplateUrl} alt="معاينة الفاتورة" className="w-full rounded-lg border border-border bg-white object-contain" />
                            )
                        ) : form.sourceMode === 'uploaded' ? (
                            <EmptyState text="لم يتم رفع قالب بعد." />
                        ) : (
                            <PrintTemplate
                                sale={SAMPLE_SALE}
                                companyName={form.companyName}
                                companySubtitle={form.companySubtitle}
                                footer={form.footer}
                                showBarcode={form.showBarcode}
                                logoUrl={form.showLogo ? form.logoUrl : ''}
                                headerColor={form.headerColor}
                                accentColor={form.accentColor}
                                textColor={form.textColor}
                                backgroundColor={form.backgroundColor}
                            />
                        )}
                    </Card>
                </div>
            )}
        </div>
    );
}

function ColorField({ label, value, onChange }) {
    return (
        <div className="flex flex-col items-center gap-1.5 rounded-lg border border-border bg-white p-2">
            <Input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-10 w-full rounded-md p-0" />
            <span className="text-[11px] font-bold text-muted-foreground">{label}</span>
        </div>
    );
}