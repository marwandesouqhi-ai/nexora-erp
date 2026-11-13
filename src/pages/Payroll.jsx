import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getEmployees } from '@/firebase/collections/employees';
import {
    addNewSalaryPayment,
    getSalaryPayments,
    updateSalaryPayment,
    deleteSalaryPaymentDoc,
} from '@/firebase/collections/salary_payments';
import {
    deleteAdjustmentDoc,
    batchUpdateAdjustmentStatus,
    subscribeAdjustments,
} from '@/firebase/collections/payroll_adjustments';
import { getAttendanceByMonth } from '@/firebase/collections/attendance';
import { useRole } from '@/lib/RoleContext';
import { useAuth } from '@/lib/AuthContext';
import { logActivity } from '@/lib/activityLogger';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
    BadgeDollarSign,
    Plus,
    Pencil,
    Trash2,
    Search,
    Award,
    AlertTriangle,
    MinusCircle,
    Calendar,
    CheckCircle2,
    Calculator,
    TrendingUp,
    DollarSign,
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import ExportMenu from '@/components/shared/ExportMenu';
import PayrollAdjustmentModal from '@/components/payroll/PayrollAdjustmentModal';

import { PageHero, StatCard, EmptyState } from '@/components/page';
const currentMonthStr = () => new Date().toISOString().slice(0, 7);

const emptyPaymentForm = {
    employee_id: '',
    employee_name: '',
    month_year: currentMonthStr(),
    base_salary: 0,
    commission_amount: 0,
    allowances: 0,
    bonus: 0,
    deductions: 0,
    tax_deducted: 0,
    payment_method: 'cash',
    payment_status: 'paid',
    notes: '',
    adjustment_ids_to_apply: [],
};

export default function Payroll() {
    const { can } = useRole();
    const { user } = useAuth();
    const { toast } = useToast();
    const qc = useQueryClient();

    // Active View Tab: 'performance' | 'adjustments' | 'payments'
    const [activeTab, setActiveTab] = useState('performance');

    // Month Selector for Performance & Adjustments
    const [selectedMonth, setSelectedMonth] = useState(currentMonthStr());
    const [selectedEmployeeId, setSelectedEmployeeId] = useState('all');

    // Payment Form Modal
    const [showPaymentDialog, setShowPaymentDialog] = useState(false);
    const [paymentForm, setPaymentForm] = useState(emptyPaymentForm);
    const [editPaymentId, setEditPaymentId] = useState(null);
    const [deletePaymentId, setDeletePaymentId] = useState(null);

    // Adjustment Modal
    const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
    const [editAdjustment, setEditAdjustment] = useState(null);
    const [deleteAdjustmentId, setDeleteAdjustmentId] = useState(null);

    // Filter adjustments by type
    const [adjustmentTypeFilter, setAdjustmentTypeFilter] = useState('all');
    const [adjustmentsSearch, setAdjustmentsSearch] = useState('');

    // Real-time adjustments state
    const [liveAdjustments, setLiveAdjustments] = useState([]);

    // Query Employees
    const { data: employees = [] } = useQuery({
        queryKey: ['employees-payroll'],
        queryFn: getEmployees,
    });

    // Query Salary Payments
    const { data: payments = [], isLoading: paymentsLoading } = useQuery({
        queryKey: ['salary-payments'],
        queryFn: getSalaryPayments,
    });

    // Query Monthly Attendance for Performance
    const { data: monthlyAttendance = [], isLoading: attendanceLoading } = useQuery({
        queryKey: ['monthly-attendance', selectedMonth],
        queryFn: () => getAttendanceByMonth(selectedMonth),
    });

    // Subscribe to Adjustments in Real-Time
    useEffect(() => {
        const unsub = subscribeAdjustments(
            (data) => setLiveAdjustments(data),
            (err) => console.error('Adjustments subscription error:', err)
        );
        return () => {
            if (unsub) unsub();
        };
    }, []);

    // Filter Adjustments by Month & Employee & Type
    const filteredAdjustments = useMemo(() => {
        return liveAdjustments.filter((adj) => {
            const matchesMonth = selectedMonth === 'all' || (adj.date && adj.date.startsWith(selectedMonth));
            const matchesEmployee = selectedEmployeeId === 'all' || adj.employee_id === selectedEmployeeId;
            const matchesType = adjustmentTypeFilter === 'all' || adj.type === adjustmentTypeFilter;
            const matchesSearch =
                !adjustmentsSearch.trim() ||
                (adj.employee_name || '').toLowerCase().includes(adjustmentsSearch.toLowerCase()) ||
                (adj.title || '').toLowerCase().includes(adjustmentsSearch.toLowerCase());
            return matchesMonth && matchesEmployee && matchesType && matchesSearch;
        });
    }, [liveAdjustments, selectedMonth, selectedEmployeeId, adjustmentTypeFilter, adjustmentsSearch]);

    // Total Adjustments Metrics
    const adjustmentMetrics = useMemo(() => {
        let incentives = 0;
        let penalties = 0;
        let deductions = 0;

        filteredAdjustments.forEach((item) => {
            const amt = Number(item.amount) || 0;
            if (item.type === 'incentive') incentives += amt;
            else if (item.type === 'penalty') penalties += amt;
            else if (item.type === 'deduction') deductions += amt;
        });

        const net = incentives - (penalties + deductions);
        return { incentives, penalties, deductions, net };
    }, [filteredAdjustments]);

    // Calculate Performance & Summary Per Employee for Selected Month
    const performanceSummary = useMemo(() => {
        // Filter attendance for selected month
        const monthAttendance = monthlyAttendance;

        return employees.map((emp) => {
            // Calculate attendance days and working hours
            const empAttendance = monthAttendance.filter((a) => a.employee_id === emp.id);
            const presentDays = empAttendance.filter((a) => a.status === 'present' || a.status === 'late').length;

            let totalMinutes = 0;
            empAttendance.forEach((a) => {
                if (a.check_in && a.check_out) {
                    try {
                        const start = a.check_in.toDate ? a.check_in.toDate() : new Date(a.check_in);
                        const end = a.check_out.toDate ? a.check_out.toDate() : new Date(a.check_out);
                        const diffMs = end - start;
                        if (diffMs > 0) totalMinutes += diffMs / (1000 * 60);
                    } catch {
                        // ignore invalid dates
                    }
                }
            });
            const totalHours = Math.round((totalMinutes / 60) * 10) / 10;

            // Calculate adjustments for this employee in selected month
            const empAdjustments = liveAdjustments.filter(
                (adj) => adj.employee_id === emp.id && adj.date && adj.date.startsWith(selectedMonth)
            );

            let empIncentives = 0;
            let empPenalties = 0;
            let empDeductions = 0;
            const pendingAdjustmentIds = [];

            empAdjustments.forEach((adj) => {
                const amt = Number(adj.amount) || 0;
                if (adj.type === 'incentive') empIncentives += amt;
                else if (adj.type === 'penalty') empPenalties += amt;
                else if (adj.type === 'deduction') empDeductions += amt;

                if (adj.status !== 'applied') {
                    pendingAdjustmentIds.push(adj.id);
                }
            });

            const netAdjustment = empIncentives - (empPenalties + empDeductions);
            const baseSalary = Number(emp.base_salary) || 0;
            const allowances = Number(emp.allowances) || 0;
            const estimatedNet = baseSalary + allowances + netAdjustment;

            // Check if already paid for this month
            const isPaidThisMonth = payments.some(
                (p) => p.employee_id === emp.id && p.month_year === selectedMonth && p.payment_status === 'paid'
            );

            return {
                employee: emp,
                presentDays,
                totalHours,
                baseSalary,
                allowances,
                incentives: empIncentives,
                penalties: empPenalties,
                deductions: empDeductions,
                netAdjustment,
                estimatedNet,
                isPaidThisMonth,
                pendingAdjustmentIds,
            };
        });
    }, [employees, monthlyAttendance, liveAdjustments, selectedMonth, payments]);

    // Save Payment Mutation
    const savePaymentMutation = useMutation({
        mutationFn: async (data) => {
            if (editPaymentId) {
                return updateSalaryPayment(editPaymentId, data);
            }
            const res = await addNewSalaryPayment(data);
            // If there are adjustment IDs that were applied, update their status to 'applied'
            if (res.success && data.adjustment_ids_to_apply?.length > 0) {
                await batchUpdateAdjustmentStatus(data.adjustment_ids_to_apply, 'applied');
            }
            return res;
        },
        onSuccess: async (_, data) => {
            qc.invalidateQueries({ queryKey: ['salary-payments'] });
            await logActivity({
                user,
                action: editPaymentId ? 'update_payroll' : 'create_payroll',
                entity_type: 'SalaryPayment',
                details: `${editPaymentId ? 'تعديل' : 'إضافة'} رواتب: ${data.employee_name}`,
            });
            toast({ title: 'تم تسجيل الراتب بنجاح', variant: 'success' });
            setShowPaymentDialog(false);
            setEditPaymentId(null);
            setPaymentForm(emptyPaymentForm);
        },
        onError: (error) => {
            toast({ title: 'حدث خطأ', description: error.message, variant: 'destructive' });
        },
    });

    // Delete Payment Mutation
    const deletePaymentMutation = useMutation({
        mutationFn: deleteSalaryPaymentDoc,
        onSuccess: async () => {
            qc.invalidateQueries({ queryKey: ['salary-payments'] });
            await logActivity({ user, action: 'delete_payroll', entity_type: 'SalaryPayment', details: 'حذف سجل راتب' });
            toast({ title: 'تم حذف السجل بنجاح', variant: 'success' });
            setDeletePaymentId(null);
        },
        onError: (error) => {
            toast({ title: 'خطأ في الحذف', description: error.message, variant: 'destructive' });
        },
    });

    // Delete Adjustment Mutation
    const deleteAdjustmentMutation = useMutation({
        mutationFn: deleteAdjustmentDoc,
        onSuccess: () => {
            toast({ title: 'تم حذف بند التسوية بنجاح' });
            setDeleteAdjustmentId(null);
        },
        onError: (err) => toast({ title: 'فشل الحذف', description: err.message, variant: 'destructive' }),
    });

    // Open Pre-filled Payment Approval for an Employee from Performance Table
    const handleApprovePayroll = (perf) => {
        setEditPaymentId(null);
        setPaymentForm({
            employee_id: perf.employee.id,
            employee_name: perf.employee.name,
            month_year: selectedMonth,
            base_salary: perf.baseSalary,
            commission_amount: 0,
            allowances: perf.allowances,
            bonus: perf.incentives,
            deductions: perf.penalties + perf.deductions,
            tax_deducted: 0,
            payment_method: 'cash',
            payment_status: 'paid',
            notes: `اعتماد التسوية الشهرية لشهر ${selectedMonth}: حوافز ${perf.incentives} ج.م - جزاءات وخصومات ${perf.penalties + perf.deductions} ج.م`,
            adjustment_ids_to_apply: perf.pendingAdjustmentIds,
        });
        setShowPaymentDialog(true);
    };

    // Filtered Payments History
    const filteredPayments = payments.filter((payment) => {
        const matchesEmployee = selectedEmployeeId === 'all' || payment.employee_id === selectedEmployeeId;
        const matchesMonth = selectedMonth === 'all' || payment.month_year === selectedMonth;
        return matchesEmployee && matchesMonth;
    });

    const payrollTotal = filteredPayments.reduce((sum, item) => sum + (Number(item.net_salary) || 0), 0);

    // Export Data for Performance Summary
    const performanceExportData = useMemo(() => {
        return performanceSummary.map((p, index) => ({
            'م': index + 1,
            'اسم الموظف / المندوب': p.employee.name,
            'الشهر': selectedMonth,
            'الراتب الأساسي': p.baseSalary,
            'أيام الحضور': p.presentDays,
            'ساعات العمل': p.totalHours,
            'إجمالي الحوافز (+)': p.incentives,
            'إجمالي الجزاءات (-)': p.penalties,
            'إجمالي الخصومات (-)': p.deductions,
            'صافي التسويات': p.netAdjustment,
            'الصافي المستحق': p.estimatedNet,
            'حالة الصرف': p.isPaidThisMonth ? 'تم الصرف ✅' : 'قيد الانتظار ⏳',
        }));
    }, [performanceSummary, selectedMonth]);

    // Export Data for Adjustments
    const adjustmentsExportData = useMemo(() => {
        return filteredAdjustments.map((a, index) => ({
            'م': index + 1,
            'الموظف': a.employee_name,
            'النوع': a.type === 'incentive' ? 'حافز' : a.type === 'penalty' ? 'جزاء إداري' : 'خصم سلفة',
            'العنوان': a.title,
            'المبلغ (ج.م)': a.amount,
            'التاريخ': a.date,
            'السبب': a.reason || '—',
            'الحالة': a.status === 'applied' ? 'تم الترحيل للراتب' : a.status === 'approved' ? 'معتمد' : 'معلق',
            'المسؤول': a.created_by || '—',
        }));
    }, [filteredAdjustments]);

    if (!can('can_view_employees')) {
        return <div className="p-8 text-center text-muted-foreground" dir="rtl">غير مسموح لك بالوصول إلى هذه الصفحة.</div>;
    }

    return (
        <div className="space-y-6" dir="rtl">
            {/* Header */}
            <PageHero
                className="mb-0"
                icon={BadgeDollarSign}
                tone="rose"
                title="الرواتب والحوافز والجزاءات الميدانية"
                subtitle="ربط مباشر بين بصمة الحضور الميداني، وتسويات الحوافز والجزاءات، وكشوف صرف الرواتب"
                actions={can('can_manage_payroll') && (
                    <>
                        <Button
                            onClick={() => {
                                setEditAdjustment(null);
                                setShowAdjustmentModal(true);
                            }}
                            className="gap-2 bg-[#16A34A] text-white hover:bg-[#15803D]"
                        >
                            <Award className="h-4 w-4" />
                            إضافة حافز أو جزاء
                        </Button>

                        <Button
                            onClick={() => {
                                setPaymentForm(emptyPaymentForm);
                                setEditPaymentId(null);
                                setShowPaymentDialog(true);
                            }}
                            variant="outline"
                            className="gap-2"
                        >
                            <Plus className="h-4 w-4" /> صرف راتب يدوي
                        </Button>
                    </>
                )}
            />

            {/* Navigation Tabs & Month Filter Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
                <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-border p-1 bg-muted/40">
                    <button
                        onClick={() => setActiveTab('performance')}
                        className={`rounded-lg px-4 py-2 text-xs font-black transition-all ${
                            activeTab === 'performance'
                                ? 'bg-card text-foreground shadow-sm'
                                : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        ملخص كشف الحساب والأداء الشهري 📊
                    </button>
                    <button
                        onClick={() => setActiveTab('adjustments')}
                        className={`rounded-lg px-4 py-2 text-xs font-black transition-all ${
                            activeTab === 'adjustments'
                                ? 'bg-card text-foreground shadow-sm'
                                : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        سجل الحوافز والجزاءات والخصومات ({liveAdjustments.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('payments')}
                        className={`rounded-lg px-4 py-2 text-xs font-black transition-all ${
                            activeTab === 'payments'
                                ? 'bg-card text-foreground shadow-sm'
                                : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        سجل الرواتب المدفوعة ({payments.length})
                    </button>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    {/* Month Picker */}
                    <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-1.5 shadow-sm">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="text-xs font-bold text-muted-foreground">الشهر:</span>
                        <Input
                            type="month"
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            className="h-7 w-36 border-none bg-transparent p-0 text-xs font-black focus-visible:ring-0"
                        />
                    </div>

                    {/* Employee Filter */}
                    <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
                        <SelectTrigger className="w-48 rounded-xl border-border h-9 text-xs font-bold">
                            <SelectValue placeholder="كل الموظفين" />
                        </SelectTrigger>
                        <SelectContent dir="rtl">
                            <SelectItem value="all">كل الموظفين</SelectItem>
                            {employees.map((emp) => (
                                <SelectItem key={emp.id} value={emp.id}>
                                    {emp.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* TAB 1: MONTHLY PAYROLL & PERFORMANCE SUMMARY */}
            {activeTab === 'performance' && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-lg font-black text-foreground">
                                ملخص الأداء وساعات الحضور وكشف التسويات لشهر ({selectedMonth})
                            </h2>
                            <p className="text-xs text-muted-foreground">
                                حساب تلقائي لأيام الحضور وساعات العمل من واقع بصمة الميدان، مع تجميع الحوافز والجزاءات لاستخراج الراتب الصافي
                            </p>
                        </div>
                        <ExportMenu
                            data={performanceExportData}
                            filename={`ملخص_رواتب_وأداء_${selectedMonth}`}
                            title="تصدير كشف الأداء والرواتب"
                        />
                    </div>

                    <Card className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
                        <CardContent className="p-0">
                            {attendanceLoading ? (
                                <div className="py-12 text-center text-sm text-muted-foreground">جاري تجميع بيانات الأداء والحضور...</div>
                            ) : performanceSummary.length === 0 ? (
                                <EmptyState text="لا يوجد موظفون مسجلون." />
                            ) : (
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="border-border hover:bg-transparent">
                                                <TableHead className="text-right font-black">المندوب / الموظف</TableHead>
                                                <TableHead className="text-right font-black">الراتب الأساسي</TableHead>
                                                <TableHead className="text-right font-black">أيام الحضور</TableHead>
                                                <TableHead className="text-right font-black">ساعات العمل</TableHead>
                                                <TableHead className="text-right font-black">الحوافز (+)</TableHead>
                                                <TableHead className="text-right font-black">الجزاءات (-)</TableHead>
                                                <TableHead className="text-right font-black">الخصومات (-)</TableHead>
                                                <TableHead className="text-right font-black">صافي التسوية</TableHead>
                                                <TableHead className="text-right font-black">الصافي المستحق</TableHead>
                                                <TableHead className="text-center font-black">الإجراء</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {performanceSummary.map((perf) => (
                                                <TableRow key={perf.employee.id} className="border-border hover:bg-muted/30 transition-colors">
                                                    <TableCell className="font-bold">
                                                        <div>
                                                            <p className="text-sm font-black text-foreground">{perf.employee.name}</p>
                                                            <p className="text-[10px] text-muted-foreground">
                                                                {perf.employee.role === 'sales_rep' ? 'مندوب مبيعات ميداني' : perf.employee.role}
                                                            </p>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="font-mono text-xs font-bold">
                                                        {perf.baseSalary.toLocaleString('ar-EG')} ج.م
                                                    </TableCell>
                                                    <TableCell>
                                                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-black text-emerald-600 dark:text-emerald-400">
                                                            <CheckCircle2 className="h-3 w-3" />
                                                            {perf.presentDays} يوم
                                                        </span>
                                                    </TableCell>
                                                    <TableCell className="font-mono text-xs font-bold text-foreground">
                                                        {perf.totalHours > 0 ? `${perf.totalHours} ساعة` : '—'}
                                                    </TableCell>
                                                    <TableCell className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
                                                        +{perf.incentives.toLocaleString('ar-EG')}
                                                    </TableCell>
                                                    <TableCell className="font-mono text-xs font-bold text-rose-600 dark:text-rose-400">
                                                        -{perf.penalties.toLocaleString('ar-EG')}
                                                    </TableCell>
                                                    <TableCell className="font-mono text-xs font-bold text-amber-600 dark:text-amber-400">
                                                        -{perf.deductions.toLocaleString('ar-EG')}
                                                    </TableCell>
                                                    <TableCell className="font-mono text-xs font-black">
                                                        <span
                                                            className={
                                                                perf.netAdjustment > 0
                                                                    ? 'text-emerald-600'
                                                                    : perf.netAdjustment < 0
                                                                    ? 'text-rose-600'
                                                                    : 'text-muted-foreground'
                                                            }
                                                        >
                                                            {perf.netAdjustment > 0 ? `+${perf.netAdjustment.toLocaleString('ar-EG')}` : perf.netAdjustment.toLocaleString('ar-EG')} ج.م
                                                        </span>
                                                    </TableCell>
                                                    <TableCell className="font-mono text-sm font-black text-foreground">
                                                        {perf.estimatedNet.toLocaleString('ar-EG')} ج.م
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        {perf.isPaidThisMonth ? (
                                                            <Badge variant="outline" className="border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-bold">
                                                                تم الصرف ✅
                                                            </Badge>
                                                        ) : (
                                                            can('can_manage_payroll') && (
                                                                <Button
                                                                    size="sm"
                                                                    onClick={() => handleApprovePayroll(perf)}
                                                                    className="gap-1.5 rounded-xl bg-primary text-primary-foreground font-bold shadow-sm"
                                                                >
                                                                    <Calculator className="h-3.5 w-3.5" />
                                                                    اعتماد التسوية وصرف الراتب
                                                                </Button>
                                                            )
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* TAB 2: PAYROLL ADJUSTMENTS (INCENTIVES, PENALTIES, DEDUCTIONS) */}
            {activeTab === 'adjustments' && (
                <div className="space-y-4">
                    {/* Metrics Overview Cards */}
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        <StatCard title="إجمالي الحوافز (+)" value={`${adjustmentMetrics.incentives.toLocaleString('en-US')} ج.م`} valueClassName="text-success" icon={Award} tone="success" />
                        <StatCard title="إجمالي الجزاءات (-)" value={`${adjustmentMetrics.penalties.toLocaleString('en-US')} ج.م`} valueClassName="text-danger" icon={AlertTriangle} tone="rose" />
                        <StatCard title="إجمالي الخصومات (-)" value={`${adjustmentMetrics.deductions.toLocaleString('en-US')} ج.م`} valueClassName="text-warning" icon={MinusCircle} tone="amber" />
                        <StatCard title="صافي أثر التسويات" value={`${adjustmentMetrics.net.toLocaleString('en-US')} ج.م`} valueClassName={adjustmentMetrics.net >= 0 ? 'text-success' : 'text-danger'} icon={TrendingUp} tone="indigo" />
                    </div>

                    {/* Filter Bar */}
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
                        <div className="relative flex-1 min-w-56">
                            <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                placeholder="بحث باسم المندوب أو عنوان البند..."
                                value={adjustmentsSearch}
                                onChange={(e) => setAdjustmentsSearch(e.target.value)}
                                className="pr-10 rounded-xl"
                            />
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <Select value={adjustmentTypeFilter} onValueChange={setAdjustmentTypeFilter}>
                                <SelectTrigger className="w-40 rounded-xl border-border">
                                    <SelectValue placeholder="نوع التسوية" />
                                </SelectTrigger>
                                <SelectContent dir="rtl">
                                    <SelectItem value="all">كل الأنواع</SelectItem>
                                    <SelectItem value="incentive">حوافز ومكافآت 🟢</SelectItem>
                                    <SelectItem value="penalty">جزاءات إدارية 🔴</SelectItem>
                                    <SelectItem value="deduction">خصومات وسلف 🟡</SelectItem>
                                </SelectContent>
                            </Select>

                            <ExportMenu
                                data={adjustmentsExportData}
                                filename={`سجل_الحوافز_والجزاءات_${selectedMonth}`}
                                title="تصدير كشف الحوافز والجزاءات"
                            />
                        </div>
                    </div>

                    {/* Adjustments Table */}
                    <Card className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
                        <CardContent className="p-0">
                            {filteredAdjustments.length === 0 ? (
                                <div className="py-12 text-center">
                                    <Award className="mx-auto h-12 w-12 text-muted-foreground/30" />
                                    <p className="mt-3 text-sm font-bold text-foreground">لا توجد تسويات مسجلة لهذا التحديد</p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        يمكنك إضافة حافز أو جزاء جديد بالضغط على الزر أعلاه وسيظهر فوراً في تطبيق المندوب.
                                    </p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="border-border hover:bg-transparent">
                                                <TableHead className="text-right font-black">المندوب</TableHead>
                                                <TableHead className="text-right font-black">نوع البند</TableHead>
                                                <TableHead className="text-right font-black">عنوان البند والسبب</TableHead>
                                                <TableHead className="text-right font-black">المبلغ</TableHead>
                                                <TableHead className="text-right font-black">تاريخ الاستحقاق</TableHead>
                                                <TableHead className="text-right font-black">الحالة</TableHead>
                                                <TableHead className="text-right font-black">المسؤول</TableHead>
                                                <TableHead className="text-center font-black">إجراءات</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {filteredAdjustments.map((adj) => (
                                                <TableRow key={adj.id} className="border-border hover:bg-muted/30">
                                                    <TableCell className="font-black text-foreground">
                                                        {adj.employee_name}
                                                    </TableCell>
                                                    <TableCell>
                                                        {adj.type === 'incentive' && (
                                                            <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[11px] font-bold">
                                                                حافز 🟢
                                                            </Badge>
                                                        )}
                                                        {adj.type === 'penalty' && (
                                                            <Badge className="bg-rose-500/10 text-rose-600 border-rose-500/20 text-[11px] font-bold">
                                                                جزاء إداري 🔴
                                                            </Badge>
                                                        )}
                                                        {adj.type === 'deduction' && (
                                                            <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-[11px] font-bold">
                                                                خصم سلفة 🟡
                                                            </Badge>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        <div>
                                                            <p className="text-xs font-bold text-foreground">{adj.title}</p>
                                                            {adj.reason && <p className="text-[10px] text-muted-foreground mt-0.5">{adj.reason}</p>}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="font-mono text-sm font-black">
                                                        <span
                                                            className={
                                                                adj.type === 'incentive'
                                                                    ? 'text-emerald-600'
                                                                    : 'text-rose-600'
                                                            }
                                                        >
                                                            {adj.type === 'incentive' ? '+' : '-'}
                                                            {Number(adj.amount || 0).toLocaleString('ar-EG')} ج.م
                                                        </span>
                                                    </TableCell>
                                                    <TableCell className="font-mono text-xs text-muted-foreground">{adj.date}</TableCell>
                                                    <TableCell>
                                                        {adj.status === 'applied' ? (
                                                            <Badge variant="outline" className="border-blue-500/30 text-blue-600 bg-blue-500/5 text-[10px]">
                                                                تم ترحيله للراتب ✅
                                                            </Badge>
                                                        ) : adj.status === 'approved' ? (
                                                            <Badge variant="outline" className="border-emerald-500/30 text-emerald-600 bg-emerald-500/5 text-[10px]">
                                                                معتمد للترحيل ⏳
                                                            </Badge>
                                                        ) : (
                                                            <Badge variant="outline" className="text-[10px]">
                                                                قيد المراجعة
                                                            </Badge>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-xs text-muted-foreground">{adj.created_by || '—'}</TableCell>
                                                    <TableCell className="text-center">
                                                        {can('can_manage_payroll') && (
                                                            <div className="flex items-center justify-center gap-1">
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => {
                                                                        setEditAdjustment(adj);
                                                                        setShowAdjustmentModal(true);
                                                                    }}
                                                                    className="h-7 text-xs gap-1"
                                                                >
                                                                    <Pencil className="h-3 w-3" /> تعديل
                                                                </Button>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => setDeleteAdjustmentId(adj.id)}
                                                                    className="h-7 text-xs text-rose-500 hover:bg-rose-500/10"
                                                                >
                                                                    <Trash2 className="h-3 w-3" />
                                                                </Button>
                                                            </div>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* TAB 3: SALARY PAYMENTS HISTORY */}
            {activeTab === 'payments' && (
                <div className="space-y-4">
                    <Card className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-bold text-muted-foreground">إجمالي الرواتب المصروفة</p>
                                <p className="mt-1 text-2xl font-black text-foreground">
                                    {payrollTotal.toLocaleString('ar-EG')} ج.م
                                </p>
                            </div>
                            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                                <DollarSign className="h-5 w-5" />
                            </span>
                        </div>
                    </Card>

                    <Card className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
                        <CardHeader className="border-b border-border/50 px-6 py-4">
                            <CardTitle className="text-base font-black text-foreground">
                                سجل مسيرات الرواتب المنفذة
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            {paymentsLoading ? (
                                <div className="py-12 text-center text-sm text-muted-foreground">جاري تحميل السجلات...</div>
                            ) : filteredPayments.length === 0 ? (
                                <EmptyState text="لا توجد سجلات رواتب مسجلة لهذا التحديد." />
                            ) : (
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="border-border">
                                                <TableHead className="text-right font-black">الموظف</TableHead>
                                                <TableHead className="text-right font-black">الشهر</TableHead>
                                                <TableHead className="text-right font-black">الأساسي</TableHead>
                                                <TableHead className="text-right font-black">البدلات</TableHead>
                                                <TableHead className="text-right font-black">المكافآت/الحوافز</TableHead>
                                                <TableHead className="text-right font-black">الخصومات</TableHead>
                                                <TableHead className="text-right font-black">صافي الراتب</TableHead>
                                                <TableHead className="text-right font-black">طريقة الدفع</TableHead>
                                                <TableHead className="text-center font-black">إجراءات</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {filteredPayments.map((payment) => (
                                                <TableRow key={payment.id} className="border-border hover:bg-muted/30">
                                                    <TableCell className="font-black text-foreground">{payment.employee_name}</TableCell>
                                                    <TableCell className="font-mono text-xs">{payment.month_year}</TableCell>
                                                    <TableCell className="font-mono text-xs font-bold">{Number(payment.base_salary || 0).toLocaleString('ar-EG')} ج.م</TableCell>
                                                    <TableCell className="font-mono text-xs">{Number(payment.allowances || 0).toLocaleString('ar-EG')} ج.م</TableCell>
                                                    <TableCell className="font-mono text-xs font-bold text-emerald-600">+{Number(payment.bonus || 0).toLocaleString('ar-EG')} ج.م</TableCell>
                                                    <TableCell className="font-mono text-xs font-bold text-rose-600">-{Number(payment.deductions || 0).toLocaleString('ar-EG')} ج.م</TableCell>
                                                    <TableCell className="font-mono text-sm font-black text-foreground">{Number(payment.net_salary || 0).toLocaleString('ar-EG')} ج.م</TableCell>
                                                    <TableCell>
                                                        <Badge variant="outline" className="text-[10px]">
                                                            {payment.payment_method === 'cash' ? 'نقداً' : payment.payment_method === 'bank_transfer' ? 'تحويل بنكي' : payment.payment_method}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        {can('can_manage_payroll') && (
                                                            <div className="flex items-center justify-center gap-1">
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => {
                                                                        setPaymentForm({ ...emptyPaymentForm, ...payment });
                                                                        setEditPaymentId(payment.id);
                                                                        setShowPaymentDialog(true);
                                                                    }}
                                                                    className="h-7 text-xs"
                                                                >
                                                                    <Pencil className="h-3 w-3 ml-1" /> تعديل
                                                                </Button>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => setDeletePaymentId(payment.id)}
                                                                    className="h-7 text-xs text-rose-500 hover:bg-rose-500/10"
                                                                >
                                                                    <Trash2 className="h-3 w-3" />
                                                                </Button>
                                                            </div>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Dialog: Record/Edit Salary Payment */}
            <Dialog
                open={showPaymentDialog}
                onOpenChange={(open) => {
                    if (!open) {
                        setShowPaymentDialog(false);
                        setEditPaymentId(null);
                        setPaymentForm(emptyPaymentForm);
                    }
                }}
            >
                <DialogContent className="max-w-3xl rounded-2xl p-6" dir="rtl">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-black text-foreground">
                            {editPaymentId ? 'تعديل سجل الراتب' : 'اعتماد وصرف الراتب الشهري'}
                        </DialogTitle>
                        <DialogDescription className="text-xs text-muted-foreground">
                            مراجعة صافي الاستحقاق بعد احتساب بدلات الحضور والحوافز والجزاءات المعتمدة.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 md:grid-cols-2 mt-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-muted-foreground">الموظف</label>
                            <Select
                                onValueChange={(empId) => {
                                    const emp = employees.find((e) => e.id === empId);
                                    if (emp) {
                                        setPaymentForm((prev) => ({
                                            ...prev,
                                            employee_id: emp.id,
                                            employee_name: emp.name,
                                            base_salary: Number(emp.base_salary || 0),
                                            allowances: Number(emp.allowances || 0),
                                        }));
                                    }
                                }}
                                value={paymentForm.employee_id}
                            >
                                <SelectTrigger className="rounded-xl border-border">
                                    <SelectValue placeholder="اختر موظفاً" />
                                </SelectTrigger>
                                <SelectContent dir="rtl">
                                    {employees.map((e) => (
                                        <SelectItem key={e.id} value={e.id}>
                                            {e.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-muted-foreground">الشهر المستحق</label>
                            <Input
                                value={paymentForm.month_year}
                                onChange={(e) => setPaymentForm({ ...paymentForm, month_year: e.target.value })}
                                className="rounded-xl font-mono"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-muted-foreground">الراتب الأساسي</label>
                            <Input
                                type="number"
                                value={paymentForm.base_salary}
                                onChange={(e) => setPaymentForm({ ...paymentForm, base_salary: Number(e.target.value) })}
                                className="rounded-xl font-mono font-bold"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-muted-foreground">البدلات</label>
                            <Input
                                type="number"
                                value={paymentForm.allowances}
                                onChange={(e) => setPaymentForm({ ...paymentForm, allowances: Number(e.target.value) })}
                                className="rounded-xl font-mono"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-emerald-600">المكافآت والحوافز (+)</label>
                            <Input
                                type="number"
                                value={paymentForm.bonus}
                                onChange={(e) => setPaymentForm({ ...paymentForm, bonus: Number(e.target.value) })}
                                className="rounded-xl font-mono font-bold text-emerald-600 border-emerald-500/30"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-rose-600">الخصومات والجزاءات (-)</label>
                            <Input
                                type="number"
                                value={paymentForm.deductions}
                                onChange={(e) => setPaymentForm({ ...paymentForm, deductions: Number(e.target.value) })}
                                className="rounded-xl font-mono font-bold text-rose-600 border-rose-500/30"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-muted-foreground">طريقة الدفع</label>
                            <Select
                                value={paymentForm.payment_method}
                                onValueChange={(val) => setPaymentForm({ ...paymentForm, payment_method: val })}
                            >
                                <SelectTrigger className="rounded-xl border-border">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent dir="rtl">
                                    <SelectItem value="cash">نقداً (خزينة)</SelectItem>
                                    <SelectItem value="bank_transfer">تحويل بنكي</SelectItem>
                                    <SelectItem value="instapay">إنستاباي</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-muted-foreground">الحالة</label>
                            <Select
                                value={paymentForm.payment_status}
                                onValueChange={(val) => setPaymentForm({ ...paymentForm, payment_status: val })}
                            >
                                <SelectTrigger className="rounded-xl border-border">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent dir="rtl">
                                    <SelectItem value="paid">مدفوع ومصروف</SelectItem>
                                    <SelectItem value="pending">معلق</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1.5 md:col-span-2">
                            <label className="text-xs font-bold text-muted-foreground">ملاحظات الصرف</label>
                            <Input
                                value={paymentForm.notes}
                                onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                                className="rounded-xl"
                            />
                        </div>
                    </div>

                    {/* صافي الحسبة */}
                    <div className="mt-4 rounded-2xl bg-muted/40 p-4 flex items-center justify-between border border-border">
                        <span className="text-sm font-bold text-foreground">صافي الراتب المستحق للصرف:</span>
                        <span className="text-xl font-black text-primary font-mono">
                            {(
                                Number(paymentForm.base_salary || 0) +
                                Number(paymentForm.allowances || 0) +
                                Number(paymentForm.bonus || 0) -
                                Number(paymentForm.deductions || 0)
                            ).toLocaleString('ar-EG')}{' '}
                            ج.م
                        </span>
                    </div>

                    <div className="mt-6 flex justify-end gap-2">
                        <Button variant="ghost" onClick={() => setShowPaymentDialog(false)} className="rounded-xl">
                            إلغاء
                        </Button>
                        <Button
                            onClick={() => savePaymentMutation.mutate(paymentForm)}
                            disabled={savePaymentMutation.isPending || !paymentForm.employee_name}
                            className="rounded-xl font-bold bg-primary text-primary-foreground min-w-28"
                        >
                            {savePaymentMutation.isPending ? 'جاري الحفظ...' : editPaymentId ? 'تحديث السجل' : 'اعتماد وحفظ الصرف'}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Modal: Payroll Adjustment (Incentives / Penalties) */}
            <PayrollAdjustmentModal
                open={showAdjustmentModal}
                onClose={() => {
                    setShowAdjustmentModal(false);
                    setEditAdjustment(null);
                }}
                employees={employees}
                editAdjustment={editAdjustment}
                onSuccess={() => {
                    qc.invalidateQueries({ queryKey: ['payroll-adjustments'] });
                }}
            />

            {/* Alert Dialog: Delete Payment Confirmation */}
            <AlertDialog open={!!deletePaymentId} onOpenChange={() => setDeletePaymentId(null)}>
                <AlertDialogContent className="rounded-2xl" dir="rtl">
                    <AlertDialogHeader>
                        <AlertDialogTitle>تأكيد حذف سجل الراتب</AlertDialogTitle>
                        <AlertDialogDescription>هل أنت متأكد من حذف هذا السجل نهائياً؟</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="gap-2">
                        <AlertDialogCancel className="rounded-xl">إلغاء</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => deletePaymentMutation.mutate(deletePaymentId)}
                            className="bg-destructive hover:bg-destructive/90 rounded-xl"
                        >
                            تأكيد الحذف
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Alert Dialog: Delete Adjustment Confirmation */}
            <AlertDialog open={!!deleteAdjustmentId} onOpenChange={() => setDeleteAdjustmentId(null)}>
                <AlertDialogContent className="rounded-2xl" dir="rtl">
                    <AlertDialogHeader>
                        <AlertDialogTitle>تأكيد حذف بند التسوية</AlertDialogTitle>
                        <AlertDialogDescription>هل أنت متأكد من حذف هذا البند من سجل الحوافز والجزاءات؟</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="gap-2">
                        <AlertDialogCancel className="rounded-xl">إلغاء</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => deleteAdjustmentMutation.mutate(deleteAdjustmentId)}
                            className="bg-destructive hover:bg-destructive/90 rounded-xl"
                        >
                            تأكيد الحذف
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}