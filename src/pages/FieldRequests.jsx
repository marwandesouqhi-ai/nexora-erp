import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import {
    subscribeFieldRequests,
    updateFieldRequestStatus,
    REQUEST_TYPE_LABELS,
    REQUEST_TYPE_COLORS,
    REQUEST_PRIORITY_LABELS,
    REQUEST_STATUS_LABELS,
    REQUEST_STATUS_COLORS,
} from '@/firebase/collections/field_requests';
import {
    Clipboard,
    AlertCircle,
    CheckCircle2,
    Clock,
    Banknote,
    MessageCircle,
    FileSpreadsheet,
    Loader2,
    Truck,
    HelpCircle
} from 'lucide-react';
import { PageHero, StatCard, SectionCard, CountChip, EmptyState, Toolbar } from '@/components/page';
import { cn } from '@/lib/utils';
import { getWaUrl } from '@/utils/whatsapp';
import { exportToCsv } from '@/utils/exportToCsv';

const TYPE_ICONS = {
    stock_replenishment: Truck,
    urgent_cash: Banknote,
    customer_issue: AlertCircle,
    general_support: HelpCircle,
};

export default function FieldRequests() {
    const { user } = useAuth();
    const { toast } = useToast();

    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [priorityFilter, setPriorityFilter] = useState('all'); // 'all' | 'urgent' | 'normal'
    const [typeFilter, setTypeFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
    const [updatingId, setUpdatingId] = useState(null);

    // Real-time listener for incoming field requests
    useEffect(() => {
        const unsub = subscribeFieldRequests(
            (data) => {
                setRequests(data);
                setLoading(false);
            },
            (err) => {
                console.error('Failed to subscribe field requests:', err);
                toast({
                    title: 'خطأ في الاتصال',
                    description: 'تعذر تحميل طلبات الميدان لحظياً.',
                    variant: 'destructive',
                });
                setLoading(false);
            }
        );
        return () => {
            if (unsub) unsub();
        };
    }, [toast]);

    // Statistics
    const stats = useMemo(() => {
        const total = requests.length;
        const pending = requests.filter(r => r.status === 'pending').length;
        const urgent = requests.filter(r => r.priority === 'urgent' && r.status !== 'fulfilled' && r.status !== 'rejected').length;
        const fulfilled = requests.filter(r => r.status === 'fulfilled').length;
        const approved = requests.filter(r => r.status === 'approved').length;

        return { total, pending, urgent, fulfilled, approved };
    }, [requests]);

    // Filtered requests
    const filteredRequests = useMemo(() => {
        return requests.filter(req => {
            const matchesSearch =
                !search ||
                (req.title && req.title.toLowerCase().includes(search.toLowerCase())) ||
                (req.details && req.details.toLowerCase().includes(search.toLowerCase())) ||
                (req.employee_name && req.employee_name.toLowerCase().includes(search.toLowerCase()));

            const matchesPriority = priorityFilter === 'all' || req.priority === priorityFilter;
            const matchesType = typeFilter === 'all' || req.type === typeFilter;
            const matchesStatus = statusFilter === 'all' || req.status === statusFilter;

            return matchesSearch && matchesPriority && matchesType && matchesStatus;
        });
    }, [requests, search, priorityFilter, typeFilter, statusFilter]);

    // Actions
    const handleStatusChange = async (req, newStatus) => {
        setUpdatingId(req.id);
        try {
            await updateFieldRequestStatus(req.id, newStatus, '', user);
            const statusLabel = REQUEST_STATUS_LABELS[newStatus] || newStatus;
            toast({
                title: `تم تحديث الطلب إلى (${statusLabel})`,
                description: `طلب ${req.employee_name}: ${req.title}`,
            });
        } catch (err) {
            console.error('Error updating field request status:', err);
            toast({
                title: 'تعذر تحديث حالة الطلب',
                description: err.message || 'حاول مرة أخرى.',
                variant: 'destructive',
            });
        } finally {
            setUpdatingId(null);
        }
    };

    // Open WhatsApp response
    const handleWaReply = (req) => {
        const statusLabel = REQUEST_STATUS_LABELS[req.status] || req.status;
        const typeLabel = REQUEST_TYPE_LABELS[req.type] || req.type;
        const msg = `مرحباً ${req.employee_name}،
بخصوص طلبك الميداني:
- نوع الطلب: ${typeLabel}
- العنوان: ${req.title}
- التفاصيل: ${req.details}
- حالة الطلب بالنظام: ${statusLabel}
نحن نتابع طلبك وسنوافيك باللازم فوراً.`;

        const phone = req.employee_phone || req.phone || '';
        const url = getWaUrl(phone, msg);
        window.open(url, '_blank', 'noopener,noreferrer');
    };

    // Export to CSV with UTF-8 BOM
    const handleExport = () => {
        const headers = [
            "كود الطلب",
            "المندوب",
            "نوع الطلب",
            "الأولوية",
            "عنوان الطلب",
            "التفاصيل",
            "الحالة",
            "المراجع",
            "تاريخ الإنشاء"
        ];

        const rows = filteredRequests.map(r => {
            const dateStr = r.created_at?.toDate
                ? r.created_at.toDate().toLocaleString('ar-EG')
                : (r.created_at ? String(r.created_at) : '');

            return [
                r.id,
                r.employee_name || r.employee_id,
                REQUEST_TYPE_LABELS[r.type] || r.type,
                REQUEST_PRIORITY_LABELS[r.priority] || r.priority,
                r.title || '',
                r.details || '',
                REQUEST_STATUS_LABELS[r.status] || r.status,
                r.reviewed_by || '',
                dateStr
            ];
        });

        exportToCsv(`طلبات_الميدان_${new Date().toISOString().slice(0, 10)}`, headers, rows);
        toast({ title: 'تم تصدير طلبات الميدان إلى Excel بنجاح' });
    };

    return (
        <div className="flex flex-col gap-5" dir="rtl">
            <PageHero
                className="mb-0"
                icon={Clipboard}
                tone="indigo"
                title="طلبات الميدان (Field Requests)"
                subtitle="متابعة نواقص البضاعة والسلف النقدية ومشاكل العملاء المرفوعة لحظياً من تطبيق المناديب"
                actions={
                    <button
                        type="button"
                        onClick={handleExport}
                        disabled={filteredRequests.length === 0}
                        className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-4 text-xs font-bold text-foreground transition-colors hover:bg-card-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <FileSpreadsheet className="h-4 w-4 text-success" aria-hidden="true" />
                        تصدير Excel (عربي)
                    </button>
                }
            />

            {/* KPI cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard
                    title="إجمالي الطلبات الواردة" value={stats.total} loading={loading}
                    caption={`${stats.approved} معتمد للتنفيذ`} icon={Clipboard} tone="indigo"
                />
                <StatCard
                    title="طلبات عاجلة طارئة" value={stats.urgent} loading={loading}
                    valueClassName={stats.urgent > 0 ? 'text-danger' : undefined}
                    caption="تتطلب تدخلاً فورياً من الإدارة" captionClassName="font-semibold text-danger"
                    icon={AlertCircle} tone="danger"
                    className={stats.urgent > 0 ? 'border-danger/30' : undefined}
                />
                <StatCard
                    title="قيد الانتظار والمراجعة" value={stats.pending} loading={loading}
                    valueClassName="text-warning"
                    caption="بانتظار قرار المشرف" icon={Clock} tone="amber"
                />
                <StatCard
                    title="تم التجهيز والصرف" value={stats.fulfilled} loading={loading}
                    valueClassName="text-success"
                    caption="تم تسليم البضاعة أو السلفة" icon={CheckCircle2} tone="success"
                />
            </div>

            {/* Filters */}
            <Toolbar
                className="mb-0"
                search={search}
                onSearchChange={setSearch}
                placeholder="بحث بعنوان الطلب، التفاصيل، أو اسم المندوب…"
                selects={[
                    {
                        ariaLabel: 'الأولوية',
                        value: priorityFilter,
                        onChange: setPriorityFilter,
                        options: [
                            { value: 'all', label: 'كل الأولويات' },
                            { value: 'urgent', label: 'عاجل طارئ' },
                            { value: 'normal', label: 'عادي' },
                        ],
                    },
                    {
                        ariaLabel: 'نوع الطلب',
                        value: typeFilter,
                        onChange: setTypeFilter,
                        options: [
                            { value: 'all', label: 'كل أنواع الطلبات' },
                            { value: 'stock_replenishment', label: 'نواقص بضاعة سيارة' },
                            { value: 'urgent_cash', label: 'سلفة نقدية عاجلة' },
                            { value: 'customer_issue', label: 'مشكلة عميل / نزاع' },
                            { value: 'general_support', label: 'دعم فني / عام' },
                        ],
                    },
                    {
                        ariaLabel: 'حالة المعالجة',
                        value: statusFilter,
                        onChange: setStatusFilter,
                        options: [
                            { value: 'all', label: 'كل حالات المعالجة' },
                            { value: 'pending', label: 'قيد المراجعة' },
                            { value: 'approved', label: 'معتمد من الإدارة' },
                            { value: 'fulfilled', label: 'تم تجهيز البضاعة' },
                            { value: 'rejected', label: 'مرفوض' },
                        ],
                    },
                ]}
            />

            {/* Requests list */}
            <SectionCard
                title="سجل طلبات المناديب الحية"
                icon={Clipboard}
                tone="indigo"
                actions={<CountChip>{filteredRequests.length} طلب</CountChip>}
            >
                {loading ? (
                    <div className="flex items-center justify-center py-14">
                        <Loader2 className="h-7 w-7 animate-spin text-primary" aria-label="جاري التحميل" />
                    </div>
                ) : filteredRequests.length === 0 ? (
                    <EmptyState icon={Clipboard} text="لا توجد طلبات ميدانية مسجلة تطابق خيارات الفلترة المحددة." />
                ) : (
                    <div className="grid gap-4 md:grid-cols-2">
                        {filteredRequests.map((req) => {
                            const TypeIcon = TYPE_ICONS[req.type] || Clipboard;
                            const isUrgent = req.priority === 'urgent';
                            const isPending = req.status === 'pending';
                            const isApproved = req.status === 'approved';
                            const isFulfilled = req.status === 'fulfilled';
                            const isRejected = req.status === 'rejected';
                            const isUpdating = updatingId === req.id;

                            const dateStr = req.created_at?.toDate
                                ? req.created_at.toDate().toLocaleString('ar-EG')
                                : (req.created_at ? String(req.created_at) : '—');

                            return (
                                <div
                                    key={req.id}
                                    className={cn(
                                        'flex flex-col justify-between rounded-2xl border p-5 transition-colors',
                                        isUrgent && !isFulfilled && !isRejected
                                            ? 'border-danger/40 bg-danger-soft/40'
                                            : 'border-border bg-card hover:border-border-strong'
                                    )}
                                >
                                    <div className="space-y-3">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex flex-wrap items-center gap-1.5">
                                                <span className={cn('inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold', REQUEST_TYPE_COLORS[req.type] || 'bg-card-muted text-muted-foreground')}>
                                                    <TypeIcon className="h-3 w-3" aria-hidden="true" />
                                                    {REQUEST_TYPE_LABELS[req.type] || req.type}
                                                </span>

                                                {isUrgent && (
                                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-danger-soft px-2.5 py-0.5 text-[11px] font-bold text-danger">
                                                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-danger" />
                                                        عاجل طارئ
                                                    </span>
                                                )}
                                            </div>

                                            <span className={cn('inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold', REQUEST_STATUS_COLORS[req.status] || 'bg-card-muted text-muted-foreground')}>
                                                {REQUEST_STATUS_LABELS[req.status] || req.status}
                                            </span>
                                        </div>

                                        <div>
                                            <h3 className="text-[15px] font-bold text-foreground">{req.title}</h3>
                                            <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
                                                {req.details}
                                            </p>
                                        </div>

                                        <div className="flex items-center justify-between border-t border-border pt-2 text-[11px] text-muted-foreground">
                                            <div>
                                                المندوب: <span className="font-bold text-foreground">{req.employee_name || '—'}</span>
                                            </div>
                                            <div>{dateStr}</div>
                                        </div>

                                        {req.reviewed_by && (
                                            <div className="text-[10px] italic text-muted-foreground">
                                                المراجع: {req.reviewed_by}
                                            </div>
                                        )}
                                    </div>

                                    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
                                        <div className="flex items-center gap-1.5">
                                            {isPending && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleStatusChange(req, 'approved')}
                                                    disabled={isUpdating}
                                                    className={cn(REQ_BTN, 'bg-primary text-white hover:bg-primary/90')}
                                                >
                                                    {isUpdating ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                                                    اعتماد الطلب
                                                </button>
                                            )}

                                            {(isPending || isApproved) && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleStatusChange(req, 'fulfilled')}
                                                    disabled={isUpdating}
                                                    className={cn(REQ_BTN, 'bg-[#16A34A] text-white hover:bg-[#15803D]')}
                                                >
                                                    {isUpdating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Truck className="h-3 w-3" />}
                                                    تم تجهيز البضاعة
                                                </button>
                                            )}

                                            {!isFulfilled && !isRejected && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleStatusChange(req, 'rejected')}
                                                    disabled={isUpdating}
                                                    className={cn(REQ_BTN, 'text-danger hover:bg-danger-soft')}
                                                >
                                                    رفض
                                                </button>
                                            )}
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => handleWaReply(req)}
                                            className={cn(REQ_BTN, 'border border-success/30 text-success hover:bg-success-soft')}
                                        >
                                            <MessageCircle className="h-3.5 w-3.5" />
                                            رد واتساب
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </SectionCard>
        </div>
    );
}

const REQ_BTN =
    'inline-flex h-8 items-center gap-1 rounded-xl px-3 text-xs font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-60';
