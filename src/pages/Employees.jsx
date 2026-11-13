import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getEmployees, addNewEmployee, updateEmployee, deleteEmployeeDoc } from '@/firebase/collections/employees';
import { useRole } from '@/lib/RoleContext';
import { useAuth } from '@/lib/AuthContext';
import { logActivity } from '@/lib/activityLogger';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, Search, Users, Pencil, Trash2, Wallet } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

import { PageHero, EmptyState } from '@/components/page';
const ROLE_LABELS = { owner: 'مالك النظام', admin: 'مدير عام', accountant: 'محاسب', sales_rep: 'مسؤول مبيعات', manager: 'مدير', warehouse_keeper: 'أمين مخزن' };
const STATUS_LABELS = { active: 'نشط', on_leave: 'إجازة', terminated: 'منتهي' };
const STATUS_COLORS = { active: 'bg-success/15 text-success', on_leave: 'bg-warning/15 text-warning', terminated: 'bg-destructive/15 text-destructive' };

const emptyForm = {
    name: '',
    email: '',
    role: 'sales_rep',
    phone: '',
    national_id: '',
    base_salary: 0,
    commission_rate: 0,
    allowances: 0,
    current_balance: 0,
    status: 'active',
    join_date: '',
    resignation_date: '',
    emergency_contact: '',
    bank_account: '',
    notes: '',
};

export default function Employees() {
    const { can } = useRole();
    const { user } = useAuth();
    const { toast } = useToast();
    const qc = useQueryClient();

    const [search, setSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
    const [showDialog, setShowDialog] = useState(false);
    const [form, setForm] = useState(emptyForm);
    const [editId, setEditId] = useState(null);
    const [deleteId, setDeleteId] = useState(null);

    const { data: employees = [], isLoading } = useQuery({ queryKey: ['employees'], queryFn: getEmployees });

    const saveMutation = useMutation({
        mutationFn: async (data) => editId ? updateEmployee(editId, data) : addNewEmployee(data),
        onSuccess: async (_, data) => {
            qc.invalidateQueries({ queryKey: ['employees'] });
            await logActivity({ user, action: editId ? 'update_employee' : 'create_employee', entity_type: 'Employee', details: `${editId ? 'تعديل' : 'إضافة'} موظف: ${data.name}` });
            toast({ title: 'تمت العملية بنجاح', variant: 'success' });
            setShowDialog(false);
            setEditId(null);
            setForm(emptyForm);
        },
        onError: (error) => {
            toast({ title: 'حدث خطأ', description: error.message, variant: 'destructive' });
        }
    });

    const deleteMutation = useMutation({
        mutationFn: deleteEmployeeDoc,
        onSuccess: async () => {
            qc.invalidateQueries({ queryKey: ['employees'] });
            await logActivity({ user, action: 'delete_employee', entity_type: 'Employee', details: 'حذف موظف' });
            toast({ title: 'تم حذف الموظف بنجاح', variant: 'success' });
            setDeleteId(null);
        },
        onError: (error) => {
            toast({ title: 'خطأ في الحذف', description: error.message, variant: 'destructive' });
        }
    });

    const openEdit = (employee) => {
        setForm({ ...emptyForm, ...employee });
        setEditId(employee.id);
        setShowDialog(true);
    };

    const openNew = () => {
        setForm(emptyForm);
        setEditId(null);
        setShowDialog(true);
    };

    const filteredEmployees = employees.filter((employee) => {
        const matchesSearch = [employee.name, employee.email, employee.phone].some((value) => (value || '').toLowerCase().includes(search.toLowerCase()));
        const matchesRole = roleFilter === 'all' || employee.role === roleFilter;
        const matchesStatus = statusFilter === 'all' || employee.status === statusFilter;
        return matchesSearch && matchesRole && matchesStatus;
    });

    const activeEmployees = employees.filter((employee) => employee.status === 'active').length;
    const monthlySalaryBase = employees.reduce((sum, employee) => sum + (Number(employee.base_salary) || 0), 0);

    if (!can('can_view_employees')) {
        return <div className="p-8 text-center text-muted-foreground">غير مسموح لك بالوصول إلى هذه الصفحة.</div>;
    }

    return (
        <div className="space-y-6" dir="rtl">
            <PageHero
                className="mb-0"
                icon={Users}
                tone="rose"
                title="إدارة الموظفين"
                subtitle="تخزين بيانات الموظفين والرواتب الأساسية مع المرونة في التصفية."
                actions={can('can_edit_employees') && (
                    <Button onClick={openNew} className="gap-2">
                        <Plus className="h-4 w-4" /> موظف جديد
                    </Button>
                )}
            />

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <Card className="rounded-2xl border border-border bg-card shadow-sm">
                    <CardContent className="flex items-center justify-between p-5">
                        <div>
                            <p className="text-sm font-bold text-muted-foreground">الموظفون النشطون</p>
                            <p className="mt-2 text-2xl font-black text-foreground">{activeEmployees}</p>
                        </div>
                        <Users className="h-8 w-8 text-primary" />
                    </CardContent>
                </Card>
                <Card className="rounded-2xl border border-border bg-card shadow-sm">
                    <CardContent className="flex items-center justify-between p-5">
                        <div>
                            <p className="text-sm font-bold text-muted-foreground">إجمالي الرواتب الأساسية الشهرية</p>
                            <p className="mt-2 text-2xl font-black text-foreground">{monthlySalaryBase.toLocaleString('ar')} ج.م</p>
                        </div>
                        <Wallet className="h-8 w-8 text-success" />
                    </CardContent>
                </Card>
            </div>

            <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
                <div className="relative flex-1 min-w-56">
                    <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input placeholder="بحث بالاسم أو البريد أو الهاتف..." value={search} onChange={(e) => setSearch(e.target.value)} className="pr-10" />
                </div>
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                    <SelectTrigger className="w-44"><SelectValue placeholder="كل الأدوار" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">كل الأدوار</SelectItem>
                        <SelectItem value="sales_rep">مسؤول مبيعات</SelectItem>
                        <SelectItem value="accountant">محاسب</SelectItem>
                        <SelectItem value="admin">مدير</SelectItem>
                        <SelectItem value="owner">مالك</SelectItem>
                    </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-40"><SelectValue placeholder="كل الحالات" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">كل الحالات</SelectItem>
                        <SelectItem value="active">نشط</SelectItem>
                        <SelectItem value="on_leave">إجازة</SelectItem>
                        <SelectItem value="terminated">منتهي</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
                <table className="w-full text-sm text-right">
                    <thead className="border-b border-border bg-muted/50">
                        <tr>
                            <th className="px-5 py-3 font-bold">الاسم</th>
                            <th className="px-4 py-3 font-bold">الوظيفة</th>
                            <th className="px-4 py-3 font-bold">الهاتف</th>
                            <th className="px-4 py-3 font-bold">الراتب الأساسي</th>
                            <th className="px-4 py-3 font-bold">الحالة</th>
                            <th className="px-4 py-3 font-bold">تاريخ الالتحاق</th>
                            <th className="px-4 py-3" />
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading ? (
                            <tr><td colSpan={7} className="py-10 text-center text-muted-foreground">جاري التحميل...</td></tr>
                        ) : filteredEmployees.length === 0 ? (
                            <tr><td colSpan={7}><EmptyState text="لا توجد موظفين." /></td></tr>
                        ) : filteredEmployees.map((employee) => (
                            <tr key={employee.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                                <td className="px-5 py-3">
                                    <div className="font-black text-foreground">{employee.name}</div>
                                    <div className="text-xs text-muted-foreground">{employee.email}</div>
                                </td>
                                <td className="px-4 py-3">{ROLE_LABELS[employee.role] || employee.role}</td>
                                <td className="px-4 py-3">{employee.phone || '—'}</td>
                                <td className="px-4 py-3 font-bold text-foreground">{Number(employee.base_salary || 0).toLocaleString('ar')} ج.م</td>
                                <td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs font-bold ${STATUS_COLORS[employee.status] || 'bg-muted text-muted-foreground'}`}>{STATUS_LABELS[employee.status] || employee.status}</span></td>
                                <td className="px-4 py-3 text-muted-foreground">{employee.join_date || '—'}</td>
                                <td className="px-4 py-3 text-left">
                                    {can('can_edit_employees') && (
                                        <Button variant="ghost" size="icon" onClick={() => openEdit(employee)}>
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                    )}
                                    {can('can_edit_employees') && (
                                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setDeleteId(employee.id)}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <Dialog open={showDialog} onOpenChange={(open) => { if (!open) { setShowDialog(false); setEditId(null); setForm(emptyForm); } }}>
                <DialogContent className="max-w-3xl rounded-2xl" dir="rtl">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-black">{editId ? 'تعديل موظف' : 'إضافة موظف جديد'}</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-1.5"><label className="text-xs font-bold text-muted-foreground">الاسم *</label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                        <div className="space-y-1.5"><label className="text-xs font-bold text-muted-foreground">البريد الإلكتروني</label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                        <div className="space-y-1.5"><label className="text-xs font-bold text-muted-foreground">الوظيفة</label><Select value={form.role} onValueChange={(value) => setForm({ ...form, role: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="sales_rep">مسؤول مبيعات</SelectItem><SelectItem value="accountant">محاسب</SelectItem><SelectItem value="admin">مدير</SelectItem><SelectItem value="owner">مالك</SelectItem><SelectItem value="manager">مدير</SelectItem><SelectItem value="warehouse_keeper">أمين مخزن</SelectItem></SelectContent></Select></div>
                        <div className="space-y-1.5"><label className="text-xs font-bold text-muted-foreground">الهاتف</label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
                        <div className="space-y-1.5"><label className="text-xs font-bold text-muted-foreground">الرقم القومي</label><Input value={form.national_id} onChange={(e) => setForm({ ...form, national_id: e.target.value })} /></div>
                        <div className="space-y-1.5"><label className="text-xs font-bold text-muted-foreground">الراتب الأساسي</label><Input type="number" value={form.base_salary} onChange={(e) => setForm({ ...form, base_salary: Number(e.target.value) })} /></div>
                        <div className="space-y-1.5"><label className="text-xs font-bold text-muted-foreground">نسبة العمولة</label><Input type="number" value={form.commission_rate} onChange={(e) => setForm({ ...form, commission_rate: Number(e.target.value) })} /></div>
                        <div className="space-y-1.5"><label className="text-xs font-bold text-muted-foreground">البدلات</label><Input type="number" value={form.allowances} onChange={(e) => setForm({ ...form, allowances: Number(e.target.value) })} /></div>
                        <div className="space-y-1.5"><label className="text-xs font-bold text-muted-foreground">الرصيد الحالي</label><Input type="number" value={form.current_balance} onChange={(e) => setForm({ ...form, current_balance: Number(e.target.value) })} /></div>
                        <div className="space-y-1.5"><label className="text-xs font-bold text-muted-foreground">الحالة</label><Select value={form.status} onValueChange={(value) => setForm({ ...form, status: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">نشط</SelectItem><SelectItem value="on_leave">إجازة</SelectItem><SelectItem value="terminated">منتهي</SelectItem></SelectContent></Select></div>
                        <div className="space-y-1.5"><label className="text-xs font-bold text-muted-foreground">تاريخ الالتحاق</label><Input type="date" value={form.join_date} onChange={(e) => setForm({ ...form, join_date: e.target.value })} /></div>
                        <div className="space-y-1.5"><label className="text-xs font-bold text-muted-foreground">تاريخ الاستقالة</label><Input type="date" value={form.resignation_date} onChange={(e) => setForm({ ...form, resignation_date: e.target.value })} /></div>
                        <div className="space-y-1.5"><label className="text-xs font-bold text-muted-foreground">جهة الاتصال في الطوارئ</label><Input value={form.emergency_contact} onChange={(e) => setForm({ ...form, emergency_contact: e.target.value })} /></div>
                        <div className="space-y-1.5"><label className="text-xs font-bold text-muted-foreground">الحساب البنكي</label><Input value={form.bank_account} onChange={(e) => setForm({ ...form, bank_account: e.target.value })} /></div>
                        <div className="space-y-1.5 md:col-span-2"><label className="text-xs font-bold text-muted-foreground">الملاحظات</label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
                    </div>
                    <div className="mt-4 flex justify-end gap-2">
                        <Button variant="ghost" onClick={() => setShowDialog(false)}>إلغاء</Button>
                        <Button onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending || !form.name}>
                            {saveMutation.isPending ? 'جاري الحفظ...' : editId ? 'تحديث' : 'حفظ'}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
                        <AlertDialogDescription>هل أنت متأكد من حذف هذا الموظف؟</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>إلغاء</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteMutation.mutate(deleteId)} className="bg-destructive">حذف</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
