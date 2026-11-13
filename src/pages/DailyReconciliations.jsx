import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useRole } from '@/lib/RoleContext';
import { useToast } from '@/components/ui/use-toast';
import {
    subscribeDailyReconciliations,
    approveReconciliation,
    getDifferenceStatus,
    RECONCILIATION_STATUS_LABELS,
    RECONCILIATION_STATUS_COLORS,
} from '@/firebase/collections/daily_reconciliations';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
    CheckSquare,
    Printer,
    Search,
    AlertTriangle,
    CheckCircle2,
    Calendar,
    UserCheck,
    Banknote,
    MessageCircle,
    FileSpreadsheet,
    Loader2,
    Truck,
    Clock,
    PlusCircle
} from 'lucide-react';
import { getWaUrl } from '@/utils/whatsapp';
import { exportToCsv } from '@/utils/exportToCsv';
import ReconciliationPrintModal from '@/components/reconciliations/ReconciliationPrintModal';

import { PageHero, StatCard, EmptyState } from '@/components/page';
export default function DailyReconciliations() {
    const { user } = useAuth();
    const { can } = useRole();
    const { toast } = useToast();

    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [diffFilter, setDiffFilter] = useState('all'); // 'all' | 'exact' | 'deficit' | 'surplus'
    const [selectedDate, setSelectedDate] = useState('');
    const [approvingId, setApprovingId] = useState(null);
    const [printRecord, setPrintRecord] = useState(null);

    // Real-time Firestore subscription
    useEffect(() => {
        const unsub = subscribeDailyReconciliations(
            (data) => {
                setRecords(data);
                setLoading(false);
            },
            (err) => {
                console.error('Failed to subscribe daily reconciliations:', err);
                toast({
                    title: 'خطأ في الاتصال',
                    description: 'تعذر تحميل محاضر التصفية اليومية.',
                    variant: 'destructive',
                });
                setLoading(false);
            }
        );
        return () => {
            if (unsub) unsub();
        };
    }, [toast]);

    // Summary statistics
    const stats = useMemo(() => {
        const total = records.length;
        const approved = records.filter(r => r.status === 'approved').length;
        const pending = records.filter(r => r.status !== 'approved').length;
        const deficits = records.filter(r => Number(r.cash_difference || 0) < 0).length;
        const totalActualCash = records.reduce((sum, r) => sum + Number(r.actual_cash || 0), 0);
        const totalDeficitAmount = records
            .filter(r => Number(r.cash_difference || 0) < 0)
            .reduce((sum, r) => sum + Math.abs(Number(r.cash_difference || 0)), 0);

        return { total, approved, pending, deficits, totalActualCash, totalDeficitAmount };
    }, [records]);

    // Filtered records
    const filteredRecords = useMemo(() => {
        return records.filter(rec => {
            const matchesSearch =
                !search ||
                (rec.employee_name && rec.employee_name.toLowerCase().includes(search.toLowerCase())) ||
                (rec.employee_id && rec.employee_id.toLowerCase().includes(search.toLowerCase())) ||
                (rec.notes && rec.notes.toLowerCase().includes(search.toLowerCase()));

            const matchesStatus = statusFilter === 'all' || rec.status === statusFilter;

            let matchesDiff = true;
            const diff = Number(rec.cash_difference || 0);
            if (diffFilter === 'exact') matchesDiff = diff === 0;
            else if (diffFilter === 'deficit') matchesDiff = diff < 0;
            else if (diffFilter === 'surplus') matchesDiff = diff > 0;

            const matchesDate = !selectedDate || rec.date === selectedDate;

            return matchesSearch && matchesStatus && matchesDiff && matchesDate;
        });
    }, [records, search, statusFilter, diffFilter, selectedDate]);

    // Action: Approve reconciliation
    const handleApprove = async (rec) => {
        setApprovingId(rec.id);
        try {
            const auditor = user?.displayName || user?.email || 'المحاسب المالي';
            await approveReconciliation(rec.id, auditor);
            toast({
                title: 'تم اعتماد محضر التصفية بنجاح ✅',
                description: `تم إغلاق عهدة ${rec.employee_name} وترحيلها محاسبياً.`,
            });
        } catch (err) {
            console.error('Error approving reconciliation:', err);
            toast({
                title: 'تعذر اعتماد التصفية',
                description: err.message || 'حدث خطأ أثناء حفظ الاعتماد.',
                variant: 'destructive',
            });
        } finally {
            setApprovingId(null);
        }
    };

    // Action: Send WhatsApp message to representative
    const handleSendWa = (rec) => {
        const diffText = rec.cash_difference === 0 ? "مطابقة تماماً بدون فروقات" :
            rec.cash_difference < 0 ? `يوجد عجز نقدي بقيمة ${Math.abs(rec.cash_difference)} ج.م` :
            `يوجد فائض نقدي بقيمة ${rec.cash_difference} ج.م`;

        const msg = `مرحباً ${rec.employee_name}،
بخصوص محضر تصفية اليومية لتاريخ (${rec.date}):
- النقدية المسجلة: ${rec.system_cash} ج.م
- النقدية المسلمة: ${rec.actual_cash} ج.م
- نتيجة المطابقة: ${diffText}
- حالة المحضر: ${rec.status === 'approved' ? 'معتمد ومغلق ✅' : 'قيد التدقيق'}
تحياتنا، إدارة Nexora ERP`;

        const targetPhone = rec.employee_phone || rec.phone || '';
        const url = getWaUrl(targetPhone, msg);
        window.open(url, '_blank', 'noopener,noreferrer');
    };

    // Action: Export to CSV (UTF-8 BOM)
    const handleExport = () => {
        const headers = [
            "كود المحضر",
            "المندوب",
            "التاريخ",
            "الزيارات المنجزة",
            "إجمالي الزيارات",
            "النقدية بالنظام (ج.م)",
            "النقدية الفعلية (ج.م)",
            "الفارق المالي (ج.م)",
            "حالة المطابقة",
            "أصناف بضاعة السيارة",
            "حالة الاعتماد",
            "المحاسب المعتمد",
            "ملاحظات"
        ];

        const rows = filteredRecords.map(r => {
            const diffStatus = getDifferenceStatus(r.cash_difference);
            return [
                r.id,
                r.employee_name || r.employee_id,
                r.date,
                r.done_visits || 0,
                r.total_visits || 0,
                r.system_cash || 0,
                r.actual_cash || 0,
                r.cash_difference || 0,
                diffStatus.type === 'exact' ? 'مطابق' : diffStatus.type === 'deficit' ? 'عجز' : 'فائض',
                r.stock_items_count || 0,
                r.status === 'approved' ? 'معتمد' : 'قيد المراجعة',
                r.audited_by || '',
                r.notes || ''
            ];
        });

        exportToCsv(`محاضر_تصفية_اليومية_${new Date().toISOString().slice(0, 10)}`, headers, rows);
        toast({ title: 'تم تصدير محاضر التصفية إلى Excel بنجاح' });
    };

    return (
        <div className="space-y-6" dir="rtl">
            {/* Header */}
            <PageHero
                className="mb-0"
                icon={CheckSquare}
                tone="emerald"
                title="تصفية العهد وإغلاق اليومية"
                subtitle="مطابقة التحصيلات النقدية وجرد بضاعة السيارات (Van Stock) واعتماد محاضر الإغلاق اليومية للمناديب."
                actions={
                    <Button
                        variant="outline"
                        onClick={handleExport}
                        disabled={filteredRecords.length === 0}
                        className="gap-2 text-xs font-bold"
                    >
                        <FileSpreadsheet className="h-4 w-4 text-success" />
                        تصدير Excel (عربي)
                    </Button>
                }
            />

            {/* KPI Cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard title="إجمالي محاضر اليومية" value={stats.total} caption={`${stats.pending} بانتظار الاعتماد`} icon={Calendar} tone="indigo" />
                <StatCard title="التصفيات المعتمدة" value={stats.approved} valueClassName="text-success" caption="مرحلة بالخزينة العامة" icon={CheckCircle2} tone="success" />
                <StatCard title="النقدية الفعلية المسلمة" value={`${stats.totalActualCash.toLocaleString('en-US')} ج.م`} caption="محصلة من المناديب" icon={Banknote} tone="blue" />
                <StatCard
                    title="حالات العجز المالي"
                    value={`${stats.deficits} محضر`}
                    valueClassName={stats.deficits > 0 ? 'text-danger' : undefined}
                    caption={stats.totalDeficitAmount > 0 ? `عجز: ${stats.totalDeficitAmount.toLocaleString('en-US')} ج.م` : 'لا يوجد عجز'}
                    captionClassName="font-semibold text-danger"
                    icon={AlertTriangle}
                    tone="danger"
                    className={stats.deficits > 0 ? 'border-danger/30' : undefined}
                />
            </div>

            {/* Filters Bar */}
            <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="بحث باسم المندوب أو الكود أو الملاحظات..."
                        className="pr-9 text-xs rounded-xl"
                    />
                </div>

                <div className="w-40">
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="text-xs rounded-xl">
                            <SelectValue placeholder="حالة الاعتماد" />
                        </SelectTrigger>
                        <SelectContent dir="rtl">
                            <SelectItem value="all">كل حالات الاعتماد</SelectItem>
                            <SelectItem value="pending_review">بانتظار المراجعة</SelectItem>
                            <SelectItem value="approved">معتمد محاسبياً ✅</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="w-44">
                    <Select value={diffFilter} onValueChange={setDiffFilter}>
                        <SelectTrigger className="text-xs rounded-xl">
                            <SelectValue placeholder="حالة المطابقة المالية" />
                        </SelectTrigger>
                        <SelectContent dir="rtl">
                            <SelectItem value="all">كل الفوارق المالية</SelectItem>
                            <SelectItem value="exact">🟢 مطابق تماماً (0)</SelectItem>
                            <SelectItem value="deficit">🔴 يوجد عجز نقدي</SelectItem>
                            <SelectItem value="surplus">🟡 يوجد فائض نقدي</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="w-36">
                    <Input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="text-xs rounded-xl"
                        title="تصفية حسب التاريخ"
                    />
                </div>

                {selectedDate && (
                    <Button variant="ghost" size="sm" onClick={() => setSelectedDate('')} className="text-xs">
                        مسح التاريخ
                    </Button>
                )}
            </div>

            {/* Reconciliations Table */}
            <Card className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
                <CardHeader className="border-b border-border/50 bg-muted/20 px-6 py-4">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-base font-black text-foreground flex items-center gap-2">
                            <CheckSquare className="h-5 w-5 text-emerald-600" />
                            محاضر تصفية اليومية للمناديب
                        </CardTitle>
                        <Badge variant="outline" className="font-mono text-xs">
                            {filteredRecords.length} محضر
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="flex justify-center items-center py-16">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : filteredRecords.length === 0 ? (
                        <EmptyState text="لا توجد محاضر تصفية مسجلة تطابق خيارات البحث الحالية." />
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-right text-xs">
                                <thead>
                                    <tr className="border-b border-border bg-muted/40 text-muted-foreground font-bold">
                                        <th className="p-3.5">المندوب الميداني</th>
                                        <th className="p-3.5">التاريخ</th>
                                        <th className="p-3.5 text-center">الزيارات</th>
                                        <th className="p-3.5 text-center">بضاعة السيارة</th>
                                        <th className="p-3.5 text-center">المسجل بالنظام</th>
                                        <th className="p-3.5 text-center">المسلم للخزينة</th>
                                        <th className="p-3.5 text-center">الفارق المالي</th>
                                        <th className="p-3.5 text-center">الحالة</th>
                                        <th className="p-3.5 text-center">الإجراءات</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/60">
                                    {filteredRecords.map((rec) => {
                                        const diffStatus = getDifferenceStatus(rec.cash_difference);
                                        const isApproved = rec.status === 'approved';

                                        return (
                                            <tr key={rec.id} className="hover:bg-muted/20 transition-colors">
                                                <td className="p-3.5">
                                                    <div className="font-bold text-foreground">{rec.employee_name || 'مندوب ميداني'}</div>
                                                    <div className="text-[10px] text-muted-foreground font-mono">{rec.employee_id}</div>
                                                </td>
                                                <td className="p-3.5 font-mono text-foreground">{rec.date}</td>
                                                <td className="p-3.5 text-center">
                                                    <span className="font-mono font-bold">{rec.done_visits || 0}</span>
                                                    <span className="text-muted-foreground"> / {rec.total_visits || 0}</span>
                                                </td>
                                                <td className="p-3.5 text-center">
                                                    <Badge variant="outline" className="text-[11px] font-mono gap-1">
                                                        <Truck className="h-3 w-3 text-amber-500" />
                                                        {rec.stock_items_count || 0} صنف
                                                    </Badge>
                                                </td>
                                                <td className="p-3.5 text-center font-mono font-bold text-foreground">
                                                    {(Number(rec.system_cash) || 0).toLocaleString('ar')} ج.م
                                                </td>
                                                <td className="p-3.5 text-center font-mono font-black text-foreground">
                                                    {(Number(rec.actual_cash) || 0).toLocaleString('ar')} ج.م
                                                </td>
                                                {/* Color Coded Financial Difference */}
                                                <td className="p-3.5 text-center">
                                                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-mono font-bold border ${diffStatus.badgeClass}`}>
                                                        {diffStatus.icon === 'alert' && <AlertTriangle className="h-3.5 w-3.5 text-rose-600" />}
                                                        {diffStatus.icon === 'check' && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />}
                                                        {(Number(rec.cash_difference) || 0).toLocaleString('ar')} ج.م
                                                    </span>
                                                </td>
                                                <td className="p-3.5 text-center">
                                                    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold ${RECONCILIATION_STATUS_COLORS[rec.status] || 'bg-muted text-muted-foreground'}`}>
                                                        {RECONCILIATION_STATUS_LABELS[rec.status] || rec.status}
                                                    </span>
                                                    {rec.audited_by && (
                                                        <p className="text-[9px] text-muted-foreground mt-0.5">المعتمد: {rec.audited_by}</p>
                                                    )}
                                                </td>
                                                <td className="p-3.5 text-center">
                                                    <div className="flex items-center justify-center gap-1.5">
                                                        {!isApproved && (
                                                            <Button
                                                                size="sm"
                                                                onClick={() => handleApprove(rec)}
                                                                disabled={approvingId === rec.id}
                                                                className="h-8 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold gap-1"
                                                            >
                                                                {approvingId === rec.id ? (
                                                                    <Loader2 className="h-3 w-3 animate-spin" />
                                                                ) : (
                                                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                                                )}
                                                                اعتماد التصفية
                                                            </Button>
                                                        )}

                                                        <Button
                                                            variant="outline"
                                                            size="icon"
                                                            className="h-8 w-8 rounded-xl"
                                                            title="طباعة سند التصفية"
                                                            onClick={() => setPrintRecord(rec)}
                                                        >
                                                            <Printer className="h-3.5 w-3.5 text-secondary-text " />
                                                        </Button>

                                                        <Button
                                                            variant="outline"
                                                            size="icon"
                                                            className="h-8 w-8 rounded-xl text-emerald-600 hover:bg-emerald-500/10"
                                                            title="رد واتساب للمندوب"
                                                            onClick={() => handleSendWa(rec)}
                                                        >
                                                            <MessageCircle className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Print Modal */}
            <ReconciliationPrintModal
                record={printRecord}
                open={!!printRecord}
                onClose={() => setPrintRecord(null)}
            />
        </div>
    );
}
