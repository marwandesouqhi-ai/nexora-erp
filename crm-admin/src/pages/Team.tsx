import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { getTeamMembers, addTeamMember, deleteTeamMember, updateTeamMemberRole } from '../services/teamService';
import type { TeamMember, UserRole } from '../types';
import { Shield, Users, UserPlus, Trash2, ShieldCheck, Mail, ShieldAlert } from 'lucide-react';
import { PageHero } from '../components/page';
import { useAuth } from '../contexts/AuthContext';
import { Navigate } from 'react-router-dom';

export function Team() {
  const { isPlatformAdmin } = useAuth();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('support_agent');
  const [adding, setAdding] = useState(false);

  const fetchTeam = async () => {
    setLoading(true);
    try {
      const data = await getTeamMembers();
      setMembers(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isPlatformAdmin) {
      fetchTeam();
    }
  }, [isPlatformAdmin]);

  if (!isPlatformAdmin) {
    return <Navigate to="/" replace />;
  }

  const handleAddMember = async (e: FormEvent) => {
    e.preventDefault();
    setAdding(true);
    try {
      const passwordResetLink = await addTeamMember(newEmail, newName, newRole);
      window.prompt('تم إنشاء حساب موظف الدعم. انسخ رابط تعيين كلمة المرور وأرسله إليه عبر قناة آمنة:', passwordResetLink);
      setShowAddModal(false);
      setNewEmail('');
      setNewName('');
      setNewRole('support_agent');
      await fetchTeam();
    } catch (error) {
      console.error(error);
      alert('حدث خطأ أثناء إضافة الموظف');
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا الموظف؟ لن يتمكن من تسجيل الدخول مجدداً.')) return;
    try {
      await deleteTeamMember(id);
      await fetchTeam();
    } catch (error) {
      console.error(error);
      alert('حدث خطأ أثناء الحذف');
    }
  };

  const handleRoleChange = async (id: string, newRole: UserRole) => {
    try {
      await updateTeamMemberRole(id, newRole);
      await fetchTeam();
    } catch (error) {
      console.error(error);
      alert('فشل تحديث الصلاحية');
    }
  };

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'platform_admin':
        return <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 ring-1 ring-inset ring-blue-600/20"><ShieldCheck className="w-3 h-3"/> مدير المنصة</span>;
      case 'billing_admin':
        return <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20"><Users className="w-3 h-3"/> إدارة الاشتراكات</span>;
      case 'support_agent':
      default:
        return <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 ring-1 ring-inset ring-amber-600/20"><ShieldAlert className="w-3 h-3"/> دعم فني</span>;
    }
  };

  return (
    <div>
      <div>
        
        {/* Header */}
        <PageHero
          icon={Shield}
          tone="rose"
          title="فريق العمل والصلاحيات"
          subtitle="إدارة حسابات الموظفين وصلاحياتهم داخل النظام."
          actions={
            <button onClick={() => setShowAddModal(true)} className="inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50 bg-primary text-white shadow-sm shadow-primary/30 hover:bg-primary-hover">
              <UserPlus className="h-4 w-4" />
              إضافة موظف
            </button>
          }
        />

        {/* Team Table */}
        <div className="premium-card overflow-hidden animate-slide-up" style={{ animationDelay: '0.1s' }}>
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-border border-t-primary"></div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-border">
                <thead>
                  <tr className="bg-card-muted/50">
                    <th scope="col" className="py-3.5 pr-6 pl-4 text-right text-xs font-bold text-muted-foreground uppercase tracking-wider">الموظف</th>
                    <th scope="col" className="py-3.5 px-4 text-right text-xs font-bold text-muted-foreground uppercase tracking-wider">البريد الإلكتروني</th>
                    <th scope="col" className="py-3.5 px-4 text-right text-xs font-bold text-muted-foreground uppercase tracking-wider">الصلاحية (Role)</th>
                    <th scope="col" className="py-3.5 px-4 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider w-24">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border bg-card">
                  {members.map((member) => (
                    <tr key={member.id} className="hover:bg-card-muted transition-colors">
                      <td className="whitespace-nowrap py-4 pr-6 pl-4">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 flex-shrink-0 rounded-full bg-gradient-to-tr from-primary/20 to-blue-400/20 flex items-center justify-center">
                            <span className="text-primary font-bold">{member.name ? member.name.charAt(0).toUpperCase() : 'U'}</span>
                          </div>
                          <div>
                            <div className="font-semibold text-foreground">{member.name || 'بدون اسم'}</div>
                            <div className="text-xs text-muted-foreground">{member.status === 'active' ? 'نشط' : 'معلق'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap py-4 px-4 text-sm text-secondary-text">
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          {member.email}
                        </div>
                      </td>
                      <td className="whitespace-nowrap py-4 px-4">
                        <select
                          value={member.role || 'support_agent'}
                          onChange={(e) => handleRoleChange(member.id, e.target.value as UserRole)}
                          className="block w-full max-w-xs rounded-lg border-0 py-1.5 pl-3 pr-10 text-foreground ring-1 ring-inset ring-border-strong focus:ring-2 focus:ring-primary sm:text-sm sm:leading-6"
                        >
                          <option value="platform_admin">مدير المنصة</option>
                          <option value="billing_admin">إدارة الاشتراكات</option>
                          <option value="support_agent">دعم فني</option>
                        </select>
                        <div className="mt-2">{getRoleBadge(member.role)}</div>
                      </td>
                      <td className="whitespace-nowrap py-4 px-4 text-left">
                        <button
                          onClick={() => handleDelete(member.id)}
                          className="text-red-400 hover:text-red-600 transition-colors p-2 hover:bg-red-50 rounded-lg"
                          title="حذف الموظف"
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {members.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-muted-foreground">لا يوجد موظفين مسجلين في النظام.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Add Member Modal */}
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center font-cairo">
            <div className="fixed inset-0 bg-slate-900/35 backdrop-blur-sm dark:bg-black/55 transition-opacity" onClick={() => setShowAddModal(false)}></div>
            <div className="relative bg-card rounded-2xl shadow-xl w-full max-w-md p-6 animate-slide-up mx-4">
              <h2 className="text-xl font-bold text-foreground mb-4">إضافة موظف جديد</h2>
              <form onSubmit={handleAddMember} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-secondary-text mb-1">الاسم الكامل</label>
                  <input
                    type="text"
                    required
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="block w-full rounded-xl border-0 py-3 px-4 text-foreground shadow-sm ring-1 ring-inset ring-border focus:ring-2 focus:ring-inset focus:ring-primary sm:text-sm bg-input hover:bg-card transition-colors"
                    placeholder="محمد أحمد"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-secondary-text mb-1">البريد الإلكتروني</label>
                  <input
                    type="email"
                    required
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="block w-full rounded-xl border-0 py-3 px-4 text-foreground shadow-sm ring-1 ring-inset ring-border focus:ring-2 focus:ring-inset focus:ring-primary sm:text-sm bg-input hover:bg-card transition-colors text-left"
                    dir="ltr"
                    placeholder="employee@nexora.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-secondary-text mb-1">الصلاحية (Role)</label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as UserRole)}
                    className="block w-full rounded-xl border-0 py-3 px-4 text-foreground shadow-sm ring-1 ring-inset ring-border focus:ring-2 focus:ring-inset focus:ring-primary sm:text-sm bg-input hover:bg-card transition-colors"
                  >
                    <option value="support_agent">دعم فني (عرض العملاء والاشتراكات)</option>
                    <option value="billing_admin">إدارة الاشتراكات والفواتير</option>
                    <option value="platform_admin">مدير المنصة (كافة الصلاحيات)</option>
                  </select>
                </div>
                
                <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-border">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 text-sm font-semibold text-secondary-text bg-card border border-border-strong rounded-xl hover:bg-card-muted transition-colors"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={adding}
                    className="px-4 py-2 text-sm font-semibold text-white bg-primary rounded-xl hover:bg-primary-hover transition-colors shadow-sm disabled:opacity-50"
                  >
                    {adding ? 'جاري الإضافة...' : 'حفظ الموظف'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
