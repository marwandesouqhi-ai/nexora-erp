import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getUsers } from '@/firebase/collections/users';
import { PERMISSION_GROUPS, ROLE_LABELS, ROLE_OPTIONS, getRolePermissions, useRole } from '@/lib/RoleContext';
import { useAuth } from '@/lib/AuthContext';
import { useTenant } from '@/lib/TenantContext';
import { createInvitation, listManagedInvitations, resendInvitation, revokeInvitation, updateManagedUserSecure } from '@/services/invitationService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { Check, Mail, Pencil, RefreshCw, Search, Shield, UserCog, UserPlus, X } from 'lucide-react';

import { PageHero, EmptyState } from '@/components/page';
const emptyInvite = { full_name: '', email: '', job_title: '', role: 'sales_rep', expires_in_hours: '168', permission_overrides: {} };
const emptyUser = { id: '', name: '', job_title: '', role: 'sales_rep', status: 'active', permission_overrides: {} };
const stamp = (value) => value?.toDate?.().toLocaleDateString?.('ar-EG') || (value ? new Date(value).toLocaleDateString('ar-EG') : '—');
const statusTone = (status) => status === 'active' || status === 'accepted' ? 'border-transparent bg-success-soft text-success hover:bg-success-soft' : status === 'pending' ? 'border-transparent bg-warning-soft text-warning hover:bg-warning-soft' : 'border-transparent bg-danger-soft text-danger hover:bg-danger-soft';

function PermissionMatrix({ value, onChange, role }) {
    const flip = (key) => {
        const defaults = getRolePermissions(role);
        const effective = Object.hasOwn(value, key) ? value[key] : defaults[key] === true;
        const next = { ...value };
        if (!effective === (defaults[key] === true)) delete next[key];
        else next[key] = !effective;
        onChange(next);
    };
    return <div className="max-h-72 space-y-3 overflow-y-auto rounded-xl border bg-card-muted p-3">
        {PERMISSION_GROUPS.map((group) => <div key={group.title} className="rounded-lg bg-card p-3">
            <p className="mb-2 text-xs font-bold text-muted-foreground">{group.title}</p>
            <div className="grid gap-2 sm:grid-cols-2">
                {group.permissions.map((permission) => {
                    const enabled = Object.hasOwn(value, permission.key) ? value[permission.key] : getRolePermissions(role)[permission.key] === true;
                    return <label key={permission.key} className="flex cursor-pointer items-center gap-2 text-xs"><Checkbox checked={enabled} onCheckedChange={() => flip(permission.key)} />{permission.label}</label>;
                })}
            </div>
        </div>)}
    </div>;
}

export default function Users() {
    const { can } = useRole();
    const { user: actor } = useAuth();
    const { tenant } = useTenant();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const companyId = actor?.company_id || tenant?.id || '';
    const [search, setSearch] = useState('');
    const [inviteOpen, setInviteOpen] = useState(false);
    const [editOpen, setEditOpen] = useState(false);
    const [invite, setInvite] = useState(emptyInvite);
    const [editing, setEditing] = useState(emptyUser);

    const usersQuery = useQuery({ queryKey: ['users', companyId], queryFn: () => getUsers(companyId), enabled: Boolean(companyId) });
    const invitationsQuery = useQuery({ queryKey: ['invitations', companyId], queryFn: () => listManagedInvitations(companyId), enabled: Boolean(companyId) });
    const refresh = () => { queryClient.invalidateQueries({ queryKey: ['users', companyId] }); queryClient.invalidateQueries({ queryKey: ['invitations', companyId] }); };
    const inviteMutation = useMutation({ mutationFn: () => createInvitation({ ...invite, company_id: companyId, expires_in_hours: Number(invite.expires_in_hours) }), onSuccess: () => { toast({ title: 'تم إرسال الدعوة بنجاح' }); setInvite(emptyInvite); setInviteOpen(false); refresh(); }, onError: (error) => toast({ title: 'تعذر إرسال الدعوة', description: error.message, variant: 'destructive' }) });
    const userMutation = useMutation({ mutationFn: () => updateManagedUserSecure(editing), onSuccess: () => { toast({ title: 'تم تحديث وصول المستخدم' }); setEditOpen(false); refresh(); }, onError: (error) => toast({ title: 'تعذر تحديث المستخدم', description: error.message, variant: 'destructive' }) });
    const resendMutation = useMutation({ mutationFn: resendInvitation, onSuccess: () => { toast({ title: 'تمت إعادة إرسال الدعوة' }); refresh(); }, onError: (error) => toast({ title: 'تعذر إعادة الإرسال', description: error.message, variant: 'destructive' }) });
    const revokeMutation = useMutation({ mutationFn: revokeInvitation, onSuccess: () => { toast({ title: 'تم إلغاء الدعوة' }); refresh(); }, onError: (error) => toast({ title: 'تعذر إلغاء الدعوة', description: error.message, variant: 'destructive' }) });
    const visibleUsers = useMemo(() => (usersQuery.data || []).filter((item) => `${item.name || ''} ${item.email || ''}`.toLowerCase().includes(search.toLowerCase())), [usersQuery.data, search]);
    const pending = useMemo(() => (invitationsQuery.data || []).filter((item) => item.status === 'pending' || item.status === 'failed'), [invitationsQuery.data]);
    const toggleAll = (target, setter) => {
        const next = {};
        PERMISSION_GROUPS.flatMap((group) => group.permissions).forEach((item) => { next[item.key] = true; });
        setter({ ...target, permission_overrides: next });
    };

    if (!can('can_manage_users')) return <div className="p-12 text-center text-muted-foreground">ليس لديك صلاحية إدارة المستخدمين.</div>;
    return <div className="space-y-6" dir="rtl">
        <PageHero className="mb-0" icon={UserCog} tone="slate" title="إدارة المستخدمين" subtitle="دعوات آمنة، أدوار، وصلاحيات لكل منظمة." actions={<Button className="gap-2" onClick={() => setInviteOpen(true)}><UserPlus className="h-4 w-4" />دعوة مستخدم</Button>} />
        <section className="rounded-2xl border border-border bg-card shadow-card"><div className="flex flex-col gap-3 border-b border-border p-4 md:flex-row md:items-center md:justify-between"><div className="relative w-full md:max-w-sm"><Search className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pr-9" placeholder="ابحث بالاسم أو البريد" value={search} onChange={(event) => setSearch(event.target.value)} /></div><Button variant="outline" size="sm" onClick={refresh}><RefreshCw className="ml-1 h-4 w-4" />تحديث</Button></div>
            <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-card-muted text-right text-xs font-semibold text-muted-foreground"><tr><th className="p-4">المستخدم</th><th className="p-4">المسمى الوظيفي</th><th className="p-4">الدور</th><th className="p-4">الحالة</th><th className="p-4">آخر دخول</th><th className="p-4" /></tr></thead><tbody>
                {usersQuery.isLoading ? <tr><td colSpan="6" className="p-8 text-center">جارٍ التحميل…</td></tr> : visibleUsers.map((item) => <tr key={item.id} className="border-b border-border transition-colors hover:bg-card-muted/60"><td className="p-4"><p className="font-bold">{item.name || '—'}</p><p className="text-xs text-muted-foreground">{item.email}</p></td><td className="p-4">{item.job_title || '—'}</td><td className="p-4">{ROLE_LABELS[item.role] || item.role}</td><td className="p-4"><Badge className={statusTone(item.status)}>{item.status === 'active' ? 'نشط' : item.status === 'suspended' ? 'موقوف' : item.status || '—'}</Badge></td><td className="p-4">{stamp(item.last_login_at)}</td><td className="p-4">{item.id !== actor?.uid && <Button variant="ghost" size="sm" onClick={() => { setEditing({ id: item.id, name: item.name || '', job_title: item.job_title || '', role: item.role || 'sales_rep', status: item.status || 'active', permission_overrides: item.permission_overrides || {} }); setEditOpen(true); }}><Pencil className="ml-1 h-4 w-4" />تعديل</Button>}</td></tr>)}
                {!usersQuery.isLoading && visibleUsers.length === 0 && <tr><td colSpan="6"><EmptyState text="لا يوجد مستخدمون." /></td></tr>}
            </tbody></table></div></section>
        <section className="rounded-2xl border border-border bg-card shadow-card"><div className="flex items-center gap-3 border-b border-border p-5"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-soft text-primary"><Mail className="h-[18px] w-[18px]" /></span><h2 className="text-base font-bold text-foreground">الدعوات المفتوحة</h2></div><div className="divide-y divide-border">{pending.length ? pending.map((item) => <div className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between" key={item.id}><div><p className="font-bold">{item.full_name || item.email}</p><p className="text-xs text-muted-foreground">{item.email} · ينتهي {stamp(item.expires_at)}</p></div><div className="flex items-center gap-2"><Badge className={statusTone(item.status)}>{item.status}</Badge><Button size="sm" variant="outline" disabled={resendMutation.isPending} onClick={() => resendMutation.mutate(item.id)}><RefreshCw className="ml-1 h-3 w-3" />إرسال مجددًا</Button><Button size="sm" variant="ghost" className="text-destructive" disabled={revokeMutation.isPending} onClick={() => revokeMutation.mutate(item.id)}><X className="ml-1 h-3 w-3" />إلغاء</Button></div></div>) : <EmptyState icon={Mail} text="لا توجد دعوات معلقة." />}</div></section>
        <Dialog open={inviteOpen} onOpenChange={setInviteOpen}><DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto"><DialogHeader><DialogTitle>دعوة موظف إلى {tenant?.name || 'المنظمة'}</DialogTitle></DialogHeader><div className="grid gap-4 md:grid-cols-2"><label className="space-y-1 text-sm">الاسم الكامل<Input value={invite.full_name} onChange={(e) => setInvite({ ...invite, full_name: e.target.value })} /></label><label className="space-y-1 text-sm">البريد الإلكتروني *<Input type="email" value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} /></label><label className="space-y-1 text-sm">المسمى الوظيفي<Input value={invite.job_title} onChange={(e) => setInvite({ ...invite, job_title: e.target.value })} /></label><label className="space-y-1 text-sm">صلاحية الدعوة<Select value={invite.expires_in_hours} onValueChange={(expires_in_hours) => setInvite({ ...invite, expires_in_hours })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="24">24 ساعة</SelectItem><SelectItem value="168">7 أيام</SelectItem><SelectItem value="720">30 يومًا</SelectItem></SelectContent></Select></label><label className="space-y-1 text-sm md:col-span-2">الدور<Select value={invite.role} onValueChange={(role) => setInvite({ ...invite, role })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{ROLE_OPTIONS.filter((role) => role !== 'owner').map((role) => <SelectItem value={role} key={role}>{ROLE_LABELS[role]}</SelectItem>)}</SelectContent></Select></label></div><PermissionEditor target={invite} setter={setInvite} toggleAll={toggleAll} /><Button disabled={!invite.email || inviteMutation.isPending} onClick={() => inviteMutation.mutate()}>{inviteMutation.isPending ? 'جارٍ الإرسال…' : <><Mail className="ml-2 h-4 w-4" />إرسال دعوة آمنة</>}</Button></DialogContent></Dialog>
        <Dialog open={editOpen} onOpenChange={setEditOpen}><DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto"><DialogHeader><DialogTitle>تعديل وصول المستخدم</DialogTitle></DialogHeader><div className="grid gap-4 md:grid-cols-2"><label className="space-y-1 text-sm">الاسم<Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></label><label className="space-y-1 text-sm">المسمى الوظيفي<Input value={editing.job_title} onChange={(e) => setEditing({ ...editing, job_title: e.target.value })} /></label><label className="space-y-1 text-sm">الدور<Select value={editing.role} onValueChange={(role) => setEditing({ ...editing, role })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{ROLE_OPTIONS.map((role) => <SelectItem value={role} key={role}>{ROLE_LABELS[role]}</SelectItem>)}</SelectContent></Select></label><label className="space-y-1 text-sm">حالة الحساب<Select value={editing.status} onValueChange={(status) => setEditing({ ...editing, status })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">نشط</SelectItem><SelectItem value="suspended">موقوف</SelectItem></SelectContent></Select></label></div><PermissionEditor target={editing} setter={setEditing} toggleAll={toggleAll} /><Button disabled={userMutation.isPending} onClick={() => userMutation.mutate()}>{userMutation.isPending ? 'جارٍ الحفظ…' : <><Check className="ml-2 h-4 w-4" />حفظ التغييرات</>}</Button></DialogContent></Dialog>
    </div>;
}

function PermissionEditor({ target, setter, toggleAll }) {
    return <div className="space-y-2"><div className="flex items-center justify-between"><p className="flex items-center gap-1 text-sm font-bold"><Shield className="h-4 w-4" />صلاحيات مخصصة</p><div className="flex gap-2"><Button variant="ghost" size="sm" onClick={() => setter({ ...target, permission_overrides: {} })}>مسح</Button><Button variant="ghost" size="sm" onClick={() => toggleAll(target, setter)}>تحديد الكل</Button></div></div><PermissionMatrix value={target.permission_overrides} role={target.role} onChange={(permission_overrides) => setter({ ...target, permission_overrides })} /></div>;
}
