import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getEmployees } from '@/firebase/collections/employees';
import {
    clockIn,
    clockOut,
    recordAttendanceStatus,
    deleteAttendanceRecord,
    subscribeAttendanceByDate,
    getAttendanceRecords
} from '@/firebase/collections/attendance';
import { useRole } from '@/lib/RoleContext';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
    Fingerprint,
    LogIn,
    LogOut,
    MapPin,
    Calendar,
    Users,
    Clock,
    AlertCircle,
    CheckCircle2,
    CalendarDays,
    Radio,
    Award,
    Plus,
    Trash2,
    RotateCw,
    Search,
    Compass,
    ExternalLink,
    Edit3,
    ShieldCheck
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import ExportMenu from '@/components/shared/ExportMenu';
import AttendanceLocationModal from '@/components/attendance/AttendanceLocationModal';
import AttendanceEditModal from '@/components/attendance/AttendanceEditModal';
import PayrollAdjustmentModal from '@/components/payroll/PayrollAdjustmentModal';

import { PageHero, HeroPill, StatCard } from '@/components/page';
const todayStr = () => new Date().toISOString().slice(0, 10);

const formatFirestoreTime = (val) => {
    if (!val) return '—';
    try {
        const date = val.toDate ? val.toDate() : new Date(val);
        if (isNaN(date.getTime())) return '—';
        return date.toLocaleTimeString('ar-EG', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        });
    } catch {
        return '—';
    }
};

const calculateDuration = (checkInVal, checkOutVal) => {
    if (!checkInVal) return '—';
    try {
        const start = checkInVal.toDate ? checkInVal.toDate() : new Date(checkInVal);
        const end = checkOutVal ? (checkOutVal.toDate ? checkOutVal.toDate() : new Date(checkOutVal)) : new Date();
        const diffMs = end - start;
        if (diffMs <= 0) return '0 د';
        const hours = Math.floor(diffMs / (1000 * 60 * 60));
        const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        if (hours > 0) return `${hours} س و ${mins} د`;
        return `${mins} دقيقة`;
    } catch {
        return '—';
    }
};

export default function Attendance() {
    const { can } = useRole();
    const { user } = useAuth();
    const { toast } = useToast();
    const qc = useQueryClient();

    const [selectedDate, setSelectedDate] = useState(todayStr());
    const [liveRecords, setLiveRecords] = useState([]);
    const [isLiveConnected, setIsLiveConnected] = useState(false);
    const [selectedEmployee, setSelectedEmployee] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState('live'); // 'live' or 'history'

    // Modals
    const [locationModalRecord, setLocationModalRecord] = useState(null);
    const [editModalRecord, setEditModalRecord] = useState(null);
    const [adjustmentModalOpen, setAdjustmentModalOpen] = useState(false);
    const [adjustmentSelectedEmployee, setAdjustmentSelectedEmployee] = useState(null);

    // Employees data
    const { data: employees = [] } = useQuery({
        queryKey: ['employees-attendance'],
        queryFn: getEmployees,
    });

    // History data for all records tab
    const { data: allRecords = [], isLoading: historyLoading } = useQuery({
        queryKey: ['attendance-all'],
        queryFn: getAttendanceRecords,
        enabled: activeTab === 'history',
    });

    // Real-Time Listener on Attendance for Selected Date via onSnapshot
    useEffect(() => {
        setIsLiveConnected(false);
        const unsubscribe = subscribeAttendanceByDate(
            selectedDate,
            (records) => {
                setLiveRecords(records);
                setIsLiveConnected(true);
            },
            (err) => {
                console.error('Real-time attendance error:', err);
                setIsLiveConnected(false);
            }
        );

        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, [selectedDate]);

    // Manual Mutations
    const clockInMutation = useMutation({
        mutationFn: (emp) =>
            clockIn({
                employeeId: emp.id,
                employeeName: emp.name,
                method: 'manual',
            }),
        onSuccess: () => {
            toast({ title: 'تم تسجيل الحضور بنجاح' });
            setSelectedEmployee('');
        },
        onError: (err) => toast({ title: 'حدث خطأ', description: err.message, variant: 'destructive' }),
    });

    const clockOutMutation = useMutation({
        mutationFn: (id) => clockOut(id),
        onSuccess: () => {
            toast({ title: 'تم تسجيل الانصراف بنجاح' });
        },
        onError: (err) => toast({ title: 'حدث خطأ', description: err.message, variant: 'destructive' }),
    });

    const statusMutation = useMutation({
        mutationFn: ({ emp, status }) =>
            recordAttendanceStatus({
                employeeId: emp.id,
                employeeName: emp.name,
                date: selectedDate,
                status,
            }),
        onSuccess: (_, variables) => {
            toast({ title: variables.status === 'absent' ? 'تم تسجيل الغياب' : 'تم تسجيل الإجازة' });
            setSelectedEmployee('');
        },
        onError: (err) => toast({ title: 'حدث خطأ', description: err.message, variant: 'destructive' }),
    });

    const deleteMutation = useMutation({
        mutationFn: (id) => deleteAttendanceRecord(id),
        onSuccess: () => {
            toast({ title: 'تم حذف السجل بنجاح' });
        },
        onError: (err) => toast({ title: 'حدث خطأ في الحذف', description: err.message, variant: 'destructive' }),
    });

    // Employees not yet recorded today
    const recordedIds = new Set(liveRecords.map((r) => r.employee_id));
    const notRecordedYet = employees.filter((e) => !recordedIds.has(e.id));

    // Stats calculations
    const stats = useMemo(() => {
        let presentCount = 0;
        let activeShiftCount = 0;
        let completedShiftCount = 0;
        let lateCount = 0;
        let absentCount = 0;

        liveRecords.forEach((r) => {
            if (r.status === 'present') {
                presentCount++;
                if (!r.check_out) {
                    activeShiftCount++;
                } else {
                    completedShiftCount++;
                }
            } else if (r.status === 'late') {
                lateCount++;
                if (!r.check_out) activeShiftCount++;
                else completedShiftCount++;
            } else if (r.status === 'absent') {
                absentCount++;
            }
        });

        return {
            total: liveRecords.length,
            present: presentCount + lateCount,
            activeShift: activeShiftCount,
            completed: completedShiftCount,
            late: lateCount,
            absent: absentCount,
        };
    }, [liveRecords]);

    // Filter live records by search
    const filteredLiveRecords = useMemo(() => {
        if (!searchTerm.trim()) return liveRecords;
        return liveRecords.filter((r) =>
            (r.employee_name || '').toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [liveRecords, searchTerm]);

    // Export dataset for XLSX/CSV
    const exportData = useMemo(() => {
        return filteredLiveRecords.map((r, index) => {
            const hasGPS = r.check_in_lat != null && r.check_in_lng != null;
            let statusAr = 'حاضر';
            if (r.status === 'present' && !r.check_out) statusAr = 'دوام نشط 🟢';
            else if (r.status === 'present' && r.check_out) statusAr = 'اكتمل الدوام ✅';
            else if (r.status === 'late') statusAr = 'متأخر ⏱️';
            else if (r.status === 'absent') statusAr = 'غائب 🔴';
            else if (r.status === 'leave') statusAr = 'إجازة 🏖️';

            return {
                'م': index + 1,
                'اسم المندوب / الموظف': r.employee_name || '—',
                'التاريخ': r.date || selectedDate,
                'الحالة': statusAr,
                'طريقة التبصيم': r.method === 'biometric' ? 'بصمة بيومترية (Nexora Field)' : 'يدوي',
                'وقت الحضور': formatFirestoreTime(r.check_in),
                'وقت الانصراف': formatFirestoreTime(r.check_out),
                'مدة العمل': calculateDuration(r.check_in, r.check_out),
                'الموقع الجغرافي': hasGPS ? `${r.check_in_lat}, ${r.check_in_lng}` : 'غير متوفر',
                'دقة GPS (متر)': r.check_in_accuracy ? `±${Math.round(r.check_in_accuracy)}m` : '—',
            };
        });
    }, [filteredLiveRecords, selectedDate]);

    if (!can('can_view_employees')) {
        return (
            <div className="p-8 text-center text-muted-foreground" dir="rtl">
                غير مسموح لك بالوصول إلى لوحة الحضور والانصراف.
            </div>
        );
    }

    return (
        <div className="space-y-6" dir="rtl">
            {/* Header */}
            <PageHero
                className="mb-0"
                icon={Fingerprint}
                tone="rose"
                title="متابعة الحضور والانصراف البيومتري الميداني"
                subtitle="شاشة متابعة لحظية متزامنة مباشرة مع تطبيق المندوبين (Nexora Field) عبر Firebase"
                actions={
                    <>
                        <HeroPill
                            dot={isLiveConnected ? 'success' : 'warning'}
                            pulse={isLiveConnected}
                            className={isLiveConnected ? 'border-success/20 bg-success-soft text-success' : undefined}
                        >
                            {isLiveConnected ? 'تزامن لحظي نشط (Live)' : 'جاري الاتصال…'}
                        </HeroPill>

                        {can('can_manage_payroll') && (
                            <Button
                                onClick={() => {
                                    setAdjustmentSelectedEmployee(null);
                                    setAdjustmentModalOpen(true);
                                }}
                                className="gap-2 bg-[#16A34A] text-white hover:bg-[#15803D]"
                            >
                                <Award className="h-4 w-4" />
                                إضافة حافز أو جزاء لمندوب
                            </Button>
                        )}

                        <ExportMenu
                            data={exportData}
                            filename={`حضور_مندوبي_المبيعات_${selectedDate}`}
                            title="تصدير جدول الحضور الميداني"
                        />
                    </>
                }
            />

            {/* Date Picker Bar & Tab Switcher */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
                <div className="flex flex-wrap items-center gap-2">
                    <Button
                        size="sm"
                        variant={selectedDate === todayStr() ? 'default' : 'outline'}
                        onClick={() => setSelectedDate(todayStr())}
                        className="rounded-xl font-bold gap-1.5"
                    >
                        <CalendarDays className="h-4 w-4" />
                        اليوم
                    </Button>

                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                            const d = new Date();
                            d.setDate(d.getDate() - 1);
                            setSelectedDate(d.toISOString().slice(0, 10));
                        }}
                        className="rounded-xl"
                    >
                        أمس
                    </Button>

                    <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-2.5 py-1">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <Input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="h-8 border-none bg-transparent p-0 text-xs font-bold focus-visible:ring-0"
                        />
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <div className="relative w-56">
                        <Search className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            placeholder="بحث باسم المندوب..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="h-9 pr-9 text-xs rounded-xl"
                        />
                    </div>

                    <div className="flex rounded-xl border border-border p-1 bg-muted/40">
                        <button
                            onClick={() => setActiveTab('live')}
                            className={`rounded-lg px-3 py-1 text-xs font-bold transition-all ${
                                activeTab === 'live'
                                    ? 'bg-card text-foreground shadow-sm'
                                    : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            المتابعة اليومية ({selectedDate})
                        </button>
                        <button
                            onClick={() => setActiveTab('history')}
                            className={`rounded-lg px-3 py-1 text-xs font-bold transition-all ${
                                activeTab === 'history'
                                    ? 'bg-card text-foreground shadow-sm'
                                    : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            السجل التاريخي
                        </button>
                    </div>
                </div>
            </div>

            {/* KPI Cards for Selected Date */}
            {activeTab === 'live' && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                    <StatCard title="إجمالي الحضور" value={stats.present} icon={Users} tone="indigo" />
                    <StatCard title="دوام نشط في الميدان" value={stats.activeShift} valueClassName="text-success" icon={Radio} tone="success" className="border-success/25" />
                    <StatCard title="اكتمل الدوام وانصرف" value={stats.completed} icon={CheckCircle2} tone="blue" />
                    <StatCard title="متأخرون عن الدوام" value={stats.late} valueClassName="text-warning" icon={Clock} tone="amber" />
                    <StatCard title="غياب مسجل" value={stats.absent} valueClassName="text-danger" icon={AlertCircle} tone="rose" />
                </div>
            )}

            {/* Quick Admin Action Box: Register attendance manually if needed */}
            {activeTab === 'live' && notRecordedYet.length > 0 && (
                <Card className="rounded-2xl border border-border bg-card shadow-sm">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-bold text-muted-foreground flex items-center gap-2">
                            <LogIn className="h-4 w-4 text-primary" />
                            تسجيل يدوي سريع لموظف غير مسجل لليوم ({notRecordedYet.length} موظف لم يبصموا بعد)
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-wrap items-center gap-2">
                            <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                                <SelectTrigger className="w-64 rounded-xl border-border">
                                    <SelectValue placeholder="اختر موظفاً..." />
                                </SelectTrigger>
                                <SelectContent dir="rtl">
                                    {notRecordedYet.map((emp) => (
                                        <SelectItem key={emp.id} value={emp.id}>
                                            {emp.name} {emp.role === 'sales_rep' ? '— مندوب مبيعات' : ''}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            <Button
                                size="sm"
                                className="rounded-xl gap-1.5"
                                disabled={!selectedEmployee || clockInMutation.isPending}
                                onClick={() => {
                                    const emp = employees.find((e) => e.id === selectedEmployee);
                                    if (emp) clockInMutation.mutate(emp);
                                }}
                            >
                                <LogIn className="h-4 w-4" /> تسجيل حضور يدوي
                            </Button>

                            <Button
                                size="sm"
                                variant="outline"
                                className="rounded-xl gap-1.5 border-rose-500/20 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 dark:border-rose-900"
                                disabled={!selectedEmployee || statusMutation.isPending}
                                onClick={() => {
                                    const emp = employees.find((e) => e.id === selectedEmployee);
                                    if (emp) statusMutation.mutate({ emp, status: 'absent' });
                                }}
                            >
                                تسجيل غياب
                            </Button>

                            <Button
                                size="sm"
                                variant="outline"
                                className="rounded-xl gap-1.5"
                                disabled={!selectedEmployee || statusMutation.isPending}
                                onClick={() => {
                                    const emp = employees.find((e) => e.id === selectedEmployee);
                                    if (emp) statusMutation.mutate({ emp, status: 'leave' });
                                }}
                            >
                                تسجيل إجازة
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Main Live Attendance Table */}
            {activeTab === 'live' ? (
                <Card className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
                    <CardHeader className="border-b border-border/50 bg-muted/20 px-6 py-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <CardTitle className="text-base font-black text-foreground flex items-center gap-2">
                                <Radio className="h-4 w-4 text-emerald-500 animate-pulse" />
                                جدول الحضور الميداني اللحظي ليوم ({selectedDate})
                            </CardTitle>
                            <span className="text-xs text-muted-foreground font-medium">
                                تم العثور على {filteredLiveRecords.length} سجل
                            </span>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        {filteredLiveRecords.length === 0 ? (
                            <div className="py-12 text-center">
                                <Fingerprint className="mx-auto h-12 w-12 text-muted-foreground/40" />
                                <p className="mt-3 text-sm font-bold text-foreground">لا توجد تسجيلات حضور لهذا اليوم حتى الآن</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                    بمجرد قيام أي مندوب بالتبصيم في تطبيق Nexora Field سيظهر هنا لحظياً بدون تحديث الصفحة.
                                </p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="border-border hover:bg-transparent">
                                            <TableHead className="text-right font-black">المندوب / الموظف</TableHead>
                                            <TableHead className="text-right font-black">طريقة التبصيم</TableHead>
                                            <TableHead className="text-right font-black">وقت الحضور</TableHead>
                                            <TableHead className="text-right font-black">وقت الانصراف</TableHead>
                                            <TableHead className="text-right font-black">مدة الدوام</TableHead>
                                            <TableHead className="text-right font-black">حالة الدوام</TableHead>
                                            <TableHead className="text-right font-black">موقع الـ GPS</TableHead>
                                            <TableHead className="text-center font-black">إجراءات سريعة</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredLiveRecords.map((r) => {
                                            const hasGPS = r.check_in_lat != null && r.check_in_lng != null;
                                            const isActiveShift = r.status === 'present' && !r.check_out;
                                            const isCompleted = r.status === 'present' && r.check_out;

                                            return (
                                                <TableRow key={r.id} className="border-border hover:bg-muted/30 transition-colors">
                                                    {/* المندوب */}
                                                    <TableCell className="font-bold">
                                                        <div className="flex items-center gap-2">
                                                            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary text-xs font-black">
                                                                {r.employee_name ? r.employee_name.charAt(0) : 'م'}
                                                            </div>
                                                            <div>
                                                                <p className="text-sm font-black text-foreground">{r.employee_name}</p>
                                                                <p className="text-[10px] text-muted-foreground font-mono">ID: {r.employee_id?.slice(0, 8)}</p>
                                                            </div>
                                                        </div>
                                                    </TableCell>

                                                    {/* طريقة التبصيم */}
                                                    <TableCell>
                                                        {r.method === 'biometric' ? (
                                                            <Badge variant="outline" className="gap-1 border-primary/30 text-primary bg-primary/5 text-[11px] font-semibold">
                                                                <Fingerprint className="h-3 w-3" />
                                                                بصمة بيومترية
                                                            </Badge>
                                                        ) : (
                                                            <Badge variant="outline" className="text-[11px] text-muted-foreground font-semibold">
                                                                تسجيل يدوي
                                                            </Badge>
                                                        )}
                                                    </TableCell>

                                                    {/* وقت الحضور */}
                                                    <TableCell>
                                                        <span className="font-mono text-xs font-bold text-foreground">
                                                            {formatFirestoreTime(r.check_in)}
                                                        </span>
                                                    </TableCell>

                                                    {/* وقت الانصراف */}
                                                    <TableCell>
                                                        {r.check_out ? (
                                                            <span className="font-mono text-xs font-bold text-foreground">
                                                                {formatFirestoreTime(r.check_out)}
                                                            </span>
                                                        ) : r.status === 'present' ? (
                                                            <Badge variant="outline" className="text-xs text-muted-foreground">في الدوام</Badge>
                                                        ) : null}
                                                    </TableCell>

                                                    {/* شارة الحالة */}
                                                    <TableCell>
                                                        <div className="flex flex-col gap-1 items-start">
                                                            {isActiveShift && (
                                                                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                                                                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
                                                                    دوام نشط
                                                                </span>
                                                            )}
                                                            {isCompleted && (
                                                                <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2.5 py-1 text-xs font-bold text-blue-600 dark:text-blue-400 border border-blue-500/20">
                                                                    <CheckCircle2 className="h-3 w-3" />
                                                                    اكتمل الدوام
                                                                </span>
                                                            )}
                                                            {r.status === 'late' && (
                                                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-bold text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                                                    <Clock className="h-3 w-3" />
                                                                    متأخر {r.late_minutes ? `(${r.late_minutes} د)` : ''}
                                                                </span>
                                                            )}
                                                            {r.status === 'absent' && (
                                                                <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2.5 py-1 text-xs font-bold text-rose-600 dark:text-rose-400 border border-rose-500/20">
                                                                    <AlertCircle className="h-3 w-3" />
                                                                    غائب
                                                                </span>
                                                            )}
                                                            {r.status === 'leave' && (
                                                                <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/10 px-2.5 py-1 text-xs font-bold text-purple-600 border border-purple-500/20">
                                                                    <Calendar className="h-3 w-3" />
                                                                    إجازة
                                                                </span>
                                                            )}
                                                            {r.approved_by_hr && (
                                                                <Badge className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-[10px] py-0 px-1.5 gap-1 font-bold">
                                                                    <ShieldCheck className="h-2.5 w-2.5" />
                                                                    معتمد HR
                                                                </Badge>
                                                            )}
                                                        </div>
                                                    </TableCell>

                                                    {/* موقع الـ GPS */}
                                                    <TableCell>
                                                        {hasGPS ? (
                                                            <div className="flex items-center gap-1">
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    onClick={() => setLocationModalRecord(r)}
                                                                    className="h-8 gap-1.5 rounded-xl border-emerald-500/30 bg-emerald-500/5 text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400"
                                                                    title="فحص موقع التبصيم على Google Maps"
                                                                >
                                                                    <MapPin className="h-3.5 w-3.5" />
                                                                    <span className="text-xs font-bold">الخريطة</span>
                                                                    {r.check_in_accuracy && (
                                                                        <span className="text-[10px] text-muted-foreground font-mono">
                                                                            ±{Math.round(r.check_in_accuracy)}m
                                                                        </span>
                                                                    )}
                                                                </Button>
                                                                <a
                                                                    href={`https://www.google.com/maps?q=${r.check_in_lat},${r.check_in_lng}`}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                                                                    title="فتح مباشرة في خرائط Google"
                                                                >
                                                                    <ExternalLink className="h-3.5 w-3.5" />
                                                                </a>
                                                            </div>
                                                        ) : (
                                                            <span className="text-xs text-muted-foreground italic">غير محدد</span>
                                                        )}
                                                    </TableCell>

                                                    {/* إجراءات سريعة */}
                                                    <TableCell className="text-center">
                                                        <div className="flex items-center justify-center gap-1">
                                                            {/* تعديل واعتماد السجل من الموارد البشرية */}
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                onClick={() => setEditModalRecord(r)}
                                                                className="h-8 gap-1 rounded-lg text-primary hover:bg-primary/10"
                                                                title="تعديل أو اعتماد سجل الحضور (HR)"
                                                            >
                                                                <Edit3 className="h-3.5 w-3.5" />
                                                                <span className="text-xs font-bold hidden sm:inline">تدقيق</span>
                                                            </Button>

                                                            {/* تسجيل انصراف */}
                                                            {r.status === 'present' && !r.check_out && (
                                                                <Button
                                                                    size="sm"
                                                                    variant="ghost"
                                                                    onClick={() => clockOutMutation.mutate(r.id)}
                                                                    className="h-8 gap-1 rounded-lg text-amber-600 hover:bg-amber-500/10"
                                                                    title="تسجيل انصراف الموظف يدوياً"
                                                                >
                                                                    <LogOut className="h-3.5 w-3.5" />
                                                                    انصراف
                                                                </Button>
                                                            )}

                                                            {/* إضافة تسوية مالية */}
                                                            {can('can_manage_payroll') && (
                                                                <Button
                                                                    size="sm"
                                                                    variant="ghost"
                                                                    onClick={() => {
                                                                        const emp = employees.find((e) => e.id === r.employee_id) || {
                                                                            id: r.employee_id,
                                                                            name: r.employee_name,
                                                                        };
                                                                        setAdjustmentSelectedEmployee(emp);
                                                                        setAdjustmentModalOpen(true);
                                                                    }}
                                                                    className="h-8 gap-1 rounded-lg text-primary hover:bg-primary/10"
                                                                    title="إضافة حافز أو جزاء لهذا المندوب"
                                                                >
                                                                    <Award className="h-3.5 w-3.5" />
                                                                </Button>
                                                            )}

                                                            {/* حذف السجل */}
                                                            {can('can_manage_payroll') && (
                                                                <Button
                                                                    size="sm"
                                                                    variant="ghost"
                                                                    onClick={() => {
                                                                        if (window.confirm('هل أنت متأكد من حذف هذا السجل؟')) {
                                                                            deleteMutation.mutate(r.id);
                                                                        }
                                                                    }}
                                                                    className="h-8 text-rose-500 hover:bg-rose-500/10 rounded-lg"
                                                                    title="حذف السجل"
                                                                >
                                                                    <Trash2 className="h-3.5 w-3.5" />
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            ) : (
                /* Historical Tab */
                <Card className="rounded-2xl border border-border bg-card shadow-sm">
                    <CardHeader className="px-6 py-4 border-b border-border/50">
                        <CardTitle className="text-base font-black text-foreground">
                            السجل التاريخي لجميع التسجيلات
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        {historyLoading ? (
                            <div className="py-12 text-center text-sm text-muted-foreground">جاري تحميل السجلات...</div>
                        ) : (
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="border-border">
                                            <TableHead className="text-right font-black">الموظف</TableHead>
                                            <TableHead className="text-right font-black">التاريخ</TableHead>
                                            <TableHead className="text-right font-black">وقت الحضور</TableHead>
                                            <TableHead className="text-right font-black">وقت الانصراف</TableHead>
                                            <TableHead className="text-right font-black">مدة الدوام</TableHead>
                                            <TableHead className="text-right font-black">الحالة</TableHead>
                                            <TableHead className="text-right font-black">الموقع</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {allRecords.slice(0, 50).map((r) => (
                                            <TableRow key={r.id} className="border-border hover:bg-muted/30">
                                                <TableCell className="font-bold text-foreground">{r.employee_name}</TableCell>
                                                <TableCell className="font-mono text-xs text-muted-foreground">{r.date}</TableCell>
                                                <TableCell className="font-mono text-xs">{formatFirestoreTime(r.check_in)}</TableCell>
                                                <TableCell className="font-mono text-xs">{formatFirestoreTime(r.check_out)}</TableCell>
                                                <TableCell className="font-mono text-xs">{calculateDuration(r.check_in, r.check_out)}</TableCell>
                                                <TableCell>
                                                    <Badge variant={r.status === 'present' ? 'secondary' : r.status === 'absent' ? 'destructive' : 'outline'}>
                                                        {r.status === 'present' ? 'حاضر' : r.status === 'absent' ? 'غائب' : r.status === 'late' ? 'متأخر' : r.status}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    {r.check_in_lat != null ? (
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            onClick={() => setLocationModalRecord(r)}
                                                            className="h-7 text-xs gap-1 text-emerald-600"
                                                        >
                                                            <MapPin className="h-3 w-3" /> عرض
                                                        </Button>
                                                    ) : (
                                                        '—'
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
            )}

            {/* Location GPS Modal */}
            <AttendanceLocationModal
                record={locationModalRecord}
                open={!!locationModalRecord}
                onClose={() => setLocationModalRecord(null)}
            />

            {/* Attendance Edit & HR Approval Modal */}
            <AttendanceEditModal
                record={editModalRecord}
                open={!!editModalRecord}
                onClose={() => setEditModalRecord(null)}
            />

            {/* Payroll Adjustment Modal */}
            <PayrollAdjustmentModal
                open={adjustmentModalOpen}
                onClose={() => {
                    setAdjustmentModalOpen(false);
                    setAdjustmentSelectedEmployee(null);
                }}
                employees={employees}
                editAdjustment={
                    adjustmentSelectedEmployee
                        ? {
                              employee_id: adjustmentSelectedEmployee.id,
                              employee_name: adjustmentSelectedEmployee.name,
                          }
                        : null
                }
                onSuccess={() => {
                    qc.invalidateQueries({ queryKey: ['payroll-adjustments'] });
                }}
            />
        </div>
    );
}
