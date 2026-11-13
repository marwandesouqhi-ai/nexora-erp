import { useMemo, useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getNotifications, markAsRead, createNotification } from '@/firebase/collections/notifications';
import { sendWhatsappMessage, checkWhatsappConnection } from '@/services/whatsappService';
import { getProducts } from '@/firebase/collections/products';
import { getCustomers } from '@/firebase/collections/customers';
import { getSuppliers } from '@/firebase/collections/suppliers';
import { useRole } from '@/lib/RoleContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { MessageCircle, Send, CheckCircle2, Loader2, RefreshCw } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { getWaUrl, normalizeWaNumber, formatWaDisplay } from '@/utils/whatsapp';
import { useTenant } from '@/lib/TenantContext';

import { PageHero, EmptyState } from '@/components/page';
const templates = [
    {
        key: 'stock_low',
        label: 'تنبيه مخزون منخفض',
        message: '⚠️ تنبيه: وصل المخزون لحد الأمان، يرجى التوريد حالًا.',
        type: 'stock_low',
        severity: 'warning',
    },
    {
        key: 'payment_followup',
        label: 'متابعة دفعة',
        message: '📌 تذكير: لديك دفعة مستحقة، يرجى التواصل مع العميل.',
        type: 'payment_followup',
        severity: 'info',
    },
];

export default function WhatsappAlerts() {
    const { tenant } = useTenant();
    const adminWa = normalizeWaNumber(tenant?.admin_whatsapp);
    const { can } = useRole();
    const { toast } = useToast();
    const qc = useQueryClient();
    const [phone, setPhone] = useState('');
    const [subject, setSubject] = useState('');
    const [message, setMessage] = useState('');
    const [productId, setProductId] = useState('');
    const [recipientType, setRecipientType] = useState('customer');
    const [recipientId, setRecipientId] = useState('');
    const [connectionStatus, setConnectionStatus] = useState(null);
    const [checkingConnection, setCheckingConnection] = useState(false);
    const [statusFilter, setStatusFilter] = useState('all');

    const { data: notifications = [], isLoading } = useQuery({
        queryKey: ['whatsapp-notifications'],
        queryFn: () => getNotifications({ channel: 'whatsapp' }),
    });
    const { data: products = [] } = useQuery({ queryKey: ['products-whatsapp'], queryFn: getProducts });
    const { data: customers = [] } = useQuery({ queryKey: ['wa-customers'], queryFn: getCustomers });
    const { data: suppliers = [] } = useQuery({ queryKey: ['wa-suppliers'], queryFn: getSuppliers });

    const selectedProduct = products.find((p) => p.id === productId);
    const sentTodayCount = useMemo(() => notifications.filter((n) => {
        const created = n.created_at?.toDate?.();
        if (!created) return false;
        const today = new Date();
        return created.toDateString() === today.toDateString();
    }).length, [notifications]);

    const customersCount = customers.length;
    const suppliersCount = suppliers.length;

    // ✅ الفحص التلقائي لحالة الاتصال عند فتح الصفحة
    useEffect(() => {
        checkWhatsappConnection().then(setConnectionStatus).catch(() => {});
    }, []);

    // ✅ التحقق اليدوي من الاتصال
    const handleCheckConnection = async () => {
        setCheckingConnection(true);
        try {
            const status = await checkWhatsappConnection();
            setConnectionStatus(status);
            toast({
                title: '✅ اتصال واتساب جاهز',
                description: status.status || 'جاهز للاستخدام',
                variant: 'success'
            });
        } catch (error) {
            toast({
                title: '❌ خطأ في الاتصال',
                description: error.message,
                variant: 'destructive'
            });
        } finally {
            setCheckingConnection(false);
        }
    };

    const filteredNotifications = useMemo(() => notifications.filter((notification) => {
        const status = notification.metadata?.status || 'success';
        return statusFilter === 'all' || status === statusFilter;
    }), [notifications, statusFilter]);

    const sendMutation = useMutation({
        mutationFn: async ({ phoneNumber, body, notificationType, recipient_type, recipient_id }) => {
            try {
                const result = await sendWhatsappMessage({ phone: phoneNumber, message: body, priority: '1' });
                await createNotification({
                    type: notificationType || 'whatsapp_manual',
                    message: `تم إرسال رسالة واتساب إلى ${phoneNumber}`,
                    severity: 'info',
                    extra: {
                        channel: 'whatsapp',
                        recipient_type: recipient_type || 'phone',
                        recipient_id: recipient_id || phoneNumber,
                        metadata: { body, status: 'success', provider_response: result || null },
                    },
                });
            } catch (error) {
                await createNotification({
                    type: notificationType || 'whatsapp_manual',
                    message: `فشل إرسال رسالة واتساب إلى ${phoneNumber}`,
                    severity: 'error',
                    extra: {
                        channel: 'whatsapp',
                        recipient_type: recipient_type || 'phone',
                        recipient_id: recipient_id || phoneNumber,
                        metadata: { body, status: 'failed', error: error?.message || 'خطأ غير معروف' },
                    },
                });
                throw error;
            }
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['whatsapp-notifications'] });
            toast({
                title: '✅ تم إرسال رسالة واتساب بنجاح',
                variant: 'success'
            });
            setPhone('');
            setMessage('');
            setSubject('');
            setProductId('');
            setRecipientId('');
        },
        onError: (error) => {
            console.error('❌ WhatsApp send error:', error);
            toast({
                title: '❌ تعذر إرسال رسالة واتساب',
                description: error?.message || 'خطأ غير معروف',
                variant: 'destructive'
            });
        },
    });

    const buildTemplateBody = (template) =>
        `${template.message}${selectedProduct ? `\nالمنتج: ${selectedProduct.product_name}` : ''}`;

    const handleApplyTemplate = (template) => {
        const body = buildTemplateBody(template);
        setMessage(body);
        setSubject(template.label);
        toast({
            title: `تم تطبيق قالب: ${template.label}`,
            description: 'يمكنك مراجعة نص الرسالة ثم الضغط على "فتح في واتساب مباشرة".',
        });
    };

    const handleSendDirect = async () => {
        const target = recipientType === 'customer'
            ? customers.find((c) => c.id === recipientId)
            : suppliers.find((s) => s.id === recipientId);
        const phoneNumber = (target && target.phone) || phone || adminWa || import.meta.env.VITE_DEFAULT_WHATSAPP_PHONE || '';

        if (!phoneNumber || !message.trim()) {
            toast({
                title: '❌ بيانات ناقصة',
                description: 'يرجى اختيار العميل/المورد أو إدخال رقم الهاتف وكتابة نص الرسالة',
                variant: 'destructive'
            });
            return;
        }

        try {
            await createNotification({
                type: subject || 'whatsapp_direct',
                message: `تم إرسال رسالة واتساب (مباشر) إلى ${phoneNumber}`,
                severity: 'info',
                extra: {
                    channel: 'whatsapp',
                    recipient_type: recipientType,
                    recipient_id: recipientId || phoneNumber,
                    metadata: { body: message, status: 'success', mode: 'direct_wa' },
                },
            });
            qc.invalidateQueries({ queryKey: ['whatsapp-notifications'] });
        } catch (e) {
            console.warn('Notification log error:', e);
        }

        window.open(getWaUrl(phoneNumber, message), '_blank', 'noopener,noreferrer');
        toast({
            title: '✅ تم فتح واتساب وتسجيل الرسالة',
            description: `تم توثيق الرسالة للرقم ${phoneNumber} في سجل التنبيهات.`,
            variant: 'success'
        });
    };


    const sendManualMessage = () => {
        const target = recipientType === 'customer'
            ? customers.find(c => c.id === recipientId)
            : suppliers.find(s => s.id === recipientId);
        const phoneNumber = (target && target.phone) || phone || adminWa || import.meta.env.VITE_DEFAULT_WHATSAPP_PHONE || '';

        if (!phoneNumber || !message.trim()) {
            toast({
                title: '❌ بيانات ناقصة',
                description: 'أكمل رقم الهاتف والرسالة',
                variant: 'destructive'
            });
            return;
        }

        sendMutation.mutate({
            phoneNumber,
            body: message,
            notificationType: subject || 'whatsapp_manual',
            recipient_type: recipientType,
            recipient_id: recipientId || phoneNumber
        });
    };

    const handleMarkRead = async (id) => {
        await markAsRead(id);
        qc.invalidateQueries({ queryKey: ['whatsapp-notifications'] });
    };

    if (!can('can_manage_automations')) {
        return <div className="p-8 text-center text-muted-foreground">غير مسموح لك بالوصول إلى هذه الصفحة.</div>;
    }

    return (
        <div className="space-y-6" dir="rtl">
            <PageHero
                className="mb-0"
                icon={MessageCircle}
                tone="emerald"
                title="نظام واتساب الذكي"
                subtitle="مولّد تنبيهات ذكي للعملاء والموردين"
            />

            {/* ✅ بطاقة حالة الاتصال والربط */}
            <Card className="rounded-2xl border border-emerald-500/30 bg-card p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
                            <MessageCircle className="h-5 w-5" />
                        </div>
                        <div>
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="font-bold text-foreground text-sm">نظام مراسلات واتساب:</span>
                                <Badge className="bg-emerald-500/15 text-emerald-600 border border-emerald-500/30 text-xs font-bold">
                                    {adminWa
                                        ? <>المراسلة المباشرة نشطة (<span dir="ltr">{formatWaDisplay(adminWa)}</span>) 🟢</>
                                        : 'لم يُضف رقم واتساب الإدارة بعد — أضفه من إعدادات الشركة'}
                                </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                يدعم النظام إرسال التنبيهات المباشرة بنقرة زر بدون اشتراكات، مع دعم بوابات الربط الآلي الخلفية.
                            </p>
                        </div>
                    </div>
                    <Button
                        onClick={handleCheckConnection}
                        disabled={checkingConnection}
                        size="sm"
                        variant="outline"
                        className="rounded-xl text-xs gap-1.5"
                    >
                        {checkingConnection ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                        {checkingConnection ? 'جاري الفحص...' : 'فحص حالة الاتصال'}
                    </Button>
                </div>

                {connectionStatus && (
                    <div className="mt-3 pt-3 border-t border-border/60 text-xs space-y-1">
                        <p className="font-bold text-foreground">
                            الحالة: <span className="text-emerald-600 font-black">{connectionStatus.status}</span>
                        </p>
                        {connectionStatus.notice && (
                            <p className="text-muted-foreground text-[11px] leading-relaxed">
                                ℹ️ {connectionStatus.notice}
                            </p>
                        )}
                    </div>
                )}
            </Card>

            <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
                <Card className="rounded-2xl border border-border bg-card shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-lg font-black text-foreground">إرسال رسالة واتساب</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-2">
                            <div>
                                <label className="mb-1 block text-xs font-bold text-muted-foreground">الجهة المستلمة</label>
                                <div className="flex gap-2">
                                    <Button
                                        variant={recipientType === 'customer' ? 'default' : 'outline'}
                                        onClick={() => setRecipientType('customer')}
                                    >
                                        عميل
                                    </Button>
                                    <Button
                                        variant={recipientType === 'supplier' ? 'default' : 'outline'}
                                        onClick={() => setRecipientType('supplier')}
                                    >
                                        مورد
                                    </Button>
                                </div>
                                <div className="mt-3">
                                    <Select value={recipientId} onValueChange={setRecipientId}>
                                        <SelectTrigger>
                                            <SelectValue placeholder={recipientType === 'customer' ? 'اختر عميل' : 'اختر مورد'} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {(recipientType === 'customer' ? customers : suppliers).map((p) => (
                                                <SelectItem key={p.id} value={p.id}>
                                                    {p.name || p.company_name || p.product_name || p.phone}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div>
                                <label className="mb-1 block text-xs font-bold text-muted-foreground">رقم التليفون (بديل)</label>
                                <Input
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    placeholder="201012345678"
                                    dir="ltr"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-bold text-muted-foreground">موضوع الرسالة</label>
                            <Input
                                value={subject}
                                onChange={(e) => setSubject(e.target.value)}
                                placeholder="مثلاً: تذكير دفع"
                            />
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-bold text-muted-foreground">نص الرسالة</label>
                            <Textarea
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                placeholder="اكتب نص الرسالة هنا"
                                className="min-h-[120px]"
                            />
                        </div>
                        <div className="flex flex-wrap gap-2.5 pt-2">
                            <Button
                                type="button"
                                className="gap-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                                onClick={handleSendDirect}
                            >
                                <MessageCircle className="h-4 w-4" />
                                فتح في واتساب مباشرة (wa.me) 🟢
                            </Button>
                            <Button
                                className="gap-2 rounded-xl text-xs"
                                variant="outline"
                                disabled={sendMutation.isPending}
                                onClick={sendManualMessage}
                            >
                                <Send className="h-4 w-4" />
                                {sendMutation.isPending ? 'جاري الإرسال...' : 'إرسال آلي عبر البوابة'}
                            </Button>
                        </div>

                        <div className="pt-3 mt-2 border-t border-border/60">
                            <label className="mb-2 block text-xs font-bold text-muted-foreground">قوالب جاهزة سريعة (اضغط لتجهيز القالب فوراً):</label>
                            <div className="flex flex-wrap gap-2">
                                {templates.map((template) => (
                                    <Button
                                        key={template.key}
                                        type="button"
                                        variant="secondary"
                                        size="sm"
                                        className="rounded-xl text-xs gap-1.5"
                                        onClick={() => handleApplyTemplate(template)}
                                    >
                                        <span>{template.severity === 'warning' ? '⚠️' : '📌'}</span>
                                        {template.label}
                                    </Button>
                                ))}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="rounded-2xl border border-border bg-card shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-lg font-black text-foreground">مؤشرات التنبيهات</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="rounded-2xl border border-border p-4">
                                <p className="text-xs font-bold text-muted-foreground">تنبيهات مرسلة</p>
                                <p className="mt-2 text-3xl font-black text-foreground">{notifications.filter((n) => (n.metadata?.status || 'success') === 'success').length}</p>
                            </div>
                            <div className="rounded-2xl border border-border p-4">
                                <p className="text-xs font-bold text-muted-foreground">اليوم</p>
                                <p className="mt-2 text-3xl font-black text-foreground">{sentTodayCount}</p>
                            </div>
                            <div className="rounded-2xl border border-border p-4">
                                <p className="text-xs font-bold text-muted-foreground">موردون</p>
                                <p className="mt-2 text-3xl font-black text-foreground">{suppliersCount}</p>
                            </div>
                            <div className="rounded-2xl border border-border p-4">
                                <p className="text-xs font-bold text-muted-foreground">عملاء</p>
                                <p className="mt-2 text-3xl font-black text-foreground">{customersCount}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card className="rounded-2xl border border-border bg-card shadow-sm">
                <CardHeader>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <CardTitle className="flex items-center gap-2 text-lg font-black text-foreground">
                            <MessageCircle className="h-5 w-5 text-emerald-500" />
                            سجل رسائل واتساب
                        </CardTitle>
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-36"><SelectValue placeholder="حالة الرسالة" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">كل الحالات</SelectItem>
                                <SelectItem value="success">ناجحة</SelectItem>
                                <SelectItem value="failed">فاشلة</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex justify-center py-10">
                            <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        </div>
                    ) : filteredNotifications.length === 0 ? (
                        <EmptyState text="لا توجد رسائل واتساب مسجلة حاليًا." />
                    ) : (
                        <div className="space-y-3">
                            {filteredNotifications.map((n) => {
                                const status = n.metadata?.status || 'success';
                                return (
                                    <div key={n.id} className="rounded-2xl border border-border p-4">
                                        <div className="flex flex-wrap items-center justify-between gap-3">
                                            <div>
                                                <p className="text-sm font-bold text-foreground">{n.message}</p>
                                                <p className="mt-1 text-xs text-muted-foreground">{n.channel} • {n.recipient_type}</p>
                                            </div>
                                            <Badge variant={status === 'failed' ? 'destructive' : 'secondary'}>
                                                {status === 'failed' ? 'فشل الإرسال' : n.is_read ? 'مقروءة' : 'لم تُقرأ'}
                                            </Badge>
                                        </div>
                                        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                                            <span>{n.created_at?.toDate?.()?.toLocaleString('ar-EG') ?? '—'}</span>
                                            {!n.is_read && (
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="gap-1"
                                                    onClick={() => handleMarkRead(n.id)}
                                                >
                                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                                    تمت القراءة
                                                </Button>
                                            )}
                                            {status === 'failed' && <p className="mt-2 text-xs text-destructive">{n.metadata?.error || 'تعذر الإرسال'}</p>}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}