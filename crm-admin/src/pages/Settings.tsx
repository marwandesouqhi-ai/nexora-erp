import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { changePassword } from '../services/authService';
import { getSystemSettings, updateSystemSettings } from '../services/settingsService';
import type { SystemSettings } from '../services/settingsService';
import { getCompanies } from '../services/companiesService';
import { Shield, Settings as SettingsIcon, Database, Download, Save, Lock, Eye, EyeOff } from 'lucide-react';
import { PageHero } from '../components/page';

export function Settings() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'security' | 'system' | 'data'>('security');
  
  // Security State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [securityLoading, setSecurityLoading] = useState(false);
  const [securityMsg, setSecurityMsg] = useState({ text: '', type: '' });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // System Config State
  const [systemSettings, setSystemSettings] = useState<SystemSettings | null>(null);
  const [systemLoading, setSystemLoading] = useState(false);
  const [systemMsg, setSystemMsg] = useState({ text: '', type: '' });

  // Data Export State
  const [exportLoading, setExportLoading] = useState(false);

  useEffect(() => {
    async function fetchSettings() {
      if (activeTab === 'system' && !systemSettings) {
        try {
          const settings = await getSystemSettings();
          setSystemSettings(settings);
        } catch (error) {
          console.error("Failed to load settings", error);
        }
      }
    }
    fetchSettings();
  }, [activeTab, systemSettings]);

  const handlePasswordChange = async (e: FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setSecurityMsg({ text: 'كلمات المرور غير متطابقة', type: 'error' });
      return;
    }
    if (!user || !user.email) return;
    
    setSecurityLoading(true);
    try {
      await changePassword(user.email, currentPassword, newPassword);
      setSecurityMsg({ text: 'تم تحديث كلمة المرور بنجاح', type: 'success' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      console.error(error);
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password') {
         setSecurityMsg({ text: 'كلمة المرور الحالية غير صحيحة', type: 'error' });
      } else {
         setSecurityMsg({ text: error.message || 'فشل تحديث كلمة المرور', type: 'error' });
      }
    } finally {
      setSecurityLoading(false);
    }
  };

  const handleSystemSettingsSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!systemSettings) return;
    setSystemLoading(true);
    try {
      await updateSystemSettings(systemSettings);
      setSystemMsg({ text: 'تم حفظ إعدادات النظام بنجاح!', type: 'success' });
      setTimeout(() => setSystemMsg({ text: '', type: '' }), 3000);
    } catch (error) {
      console.error(error);
      setSystemMsg({ text: 'فشل حفظ الإعدادات.', type: 'error' });
    } finally {
      setSystemLoading(false);
    }
  };

  const handleExportData = async () => {
    setExportLoading(true);
    try {
      const companies = await getCompanies();
      const csvRows = [];
      const headers = ['المعرف', 'الاسم', 'البريد', 'الحالة', 'الباقة', 'تاريخ الإنشاء'];
      csvRows.push(headers.join(','));

      for (const company of companies) {
        const values = [
          company.id,
          `"${company.name || ''}"`,
          `"${company.email || ''}"`,
          company.status,
          company.subscription?.plan || 'لا يوجد',
          company.created_at || ''
        ];
        csvRows.push(values.join(','));
      }

      const csvData = "\uFEFF" + csvRows.join('\n'); // BOM for Arabic Excel
      const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.setAttribute('hidden', '');
      a.setAttribute('href', url);
      a.setAttribute('download', 'companies_export.csv');
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (error) {
      console.error("Export failed", error);
      alert("فشل تصدير البيانات.");
    } finally {
      setExportLoading(false);
    }
  };

  return (
    <div>
      <div className="mx-auto max-w-5xl">
        
        <PageHero
          icon={SettingsIcon}
          tone="slate"
          title="الإعدادات"
          subtitle="إدارة تفضيلات الحساب، الأمان، وخيارات النظام المتقدمة."
        />

        {/* Custom Tabs */}
        <div className="flex space-x-2 space-x-reverse mb-8 p-1 bg-card-muted border border-border rounded-xl max-w-fit">
          <button
            onClick={() => setActiveTab('security')}
            className={`flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg transition-all ${
              activeTab === 'security'
                ? 'bg-card text-primary shadow-sm ring-1 ring-border'
                : 'text-secondary-text hover:text-foreground hover:bg-card-muted'
            }`}
          >
            <Shield className="h-4 w-4" />
            الأمان والملف الشخصي
          </button>
          <button
            onClick={() => setActiveTab('system')}
            className={`flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg transition-all ${
              activeTab === 'system'
                ? 'bg-card text-primary shadow-sm ring-1 ring-border'
                : 'text-secondary-text hover:text-foreground hover:bg-card-muted'
            }`}
          >
            <SettingsIcon className="h-4 w-4" />
            إعدادات النظام
          </button>
          <button
            onClick={() => setActiveTab('data')}
            className={`flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg transition-all ${
              activeTab === 'data'
                ? 'bg-card text-primary shadow-sm ring-1 ring-border'
                : 'text-secondary-text hover:text-foreground hover:bg-card-muted'
            }`}
          >
            <Database className="h-4 w-4" />
            إدارة البيانات
          </button>
        </div>

        <div className="animate-slide-up" style={{ animationDelay: '0.1s' }}>
          {activeTab === 'security' && (
            <div className="space-y-6">
              {/* Profile Card */}
              <div className="premium-card p-8">
                <div className="flex items-center gap-4 mb-6">
                  <div className="h-16 w-16 rounded-full bg-gradient-to-tr from-primary to-blue-400 flex items-center justify-center text-white font-bold text-2xl shadow-lg ring-4 ring-blue-50">
                    A
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-foreground">مدير النظام الأساسي</h3>
                    <p className="text-sm text-muted-foreground mt-1">{user?.email}</p>
                  </div>
                  <div className="mr-auto">
                    <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-primary ring-1 ring-inset ring-blue-600/20">
                      Super Admin
                    </span>
                  </div>
                </div>
              </div>

              {/* Password Card */}
              <div className="premium-card p-8">
                <div className="flex items-start gap-4 mb-6">
                  <div className="bg-rose-50 p-3 rounded-xl">
                    <Lock className="h-6 w-6 text-rose-500" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-foreground">تغيير كلمة المرور</h3>
                    <p className="text-sm text-muted-foreground mt-1">تأكد من اختيار كلمة مرور قوية لتأمين النظام بشكل كامل.</p>
                  </div>
                </div>
                
                <form className="max-w-md space-y-5" onSubmit={handlePasswordChange}>
                  <div>
                    <label className="block text-sm font-semibold text-secondary-text mb-1">
                      كلمة المرور الحالية
                    </label>
                    <div className="relative">
                      <input
                        type={showCurrentPassword ? "text" : "password"}
                        required
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className="block w-full rounded-xl border-0 py-3 px-4 text-foreground shadow-sm ring-1 ring-inset ring-border focus:ring-2 focus:ring-inset focus:ring-primary sm:text-sm bg-input hover:bg-card transition-colors text-left"
                        dir="ltr"
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-secondary-text focus:outline-none"
                      >
                        {showCurrentPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-secondary-text mb-1">
                      كلمة المرور الجديدة
                    </label>
                    <div className="relative">
                      <input
                        type={showNewPassword ? "text" : "password"}
                        required
                        minLength={6}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="block w-full rounded-xl border-0 py-3 px-4 text-foreground shadow-sm ring-1 ring-inset ring-border focus:ring-2 focus:ring-inset focus:ring-primary sm:text-sm bg-input hover:bg-card transition-colors text-left"
                        dir="ltr"
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-secondary-text focus:outline-none"
                      >
                        {showNewPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-secondary-text mb-1">
                      تأكيد كلمة المرور
                    </label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        required
                        minLength={6}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="block w-full rounded-xl border-0 py-3 px-4 text-foreground shadow-sm ring-1 ring-inset ring-border focus:ring-2 focus:ring-inset focus:ring-primary sm:text-sm bg-input hover:bg-card transition-colors text-left"
                        dir="ltr"
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-secondary-text focus:outline-none"
                      >
                        {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={securityLoading}
                    className="flex w-full justify-center items-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-white shadow-md hover:bg-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50 transition-all"
                  >
                    <Save className="h-4 w-4" />
                    {securityLoading ? 'جاري التحديث...' : 'تحديث كلمة المرور'}
                  </button>
                  {securityMsg.text && (
                    <div className={`mt-4 text-sm font-medium p-3 rounded-lg ${securityMsg.type === 'error' ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
                      {securityMsg.text}
                    </div>
                  )}
                </form>
              </div>
            </div>
          )}

          {activeTab === 'system' && (
            <div className="premium-card p-8">
              <div className="flex items-start gap-4 mb-8">
                <div className="bg-indigo-50 p-3 rounded-xl">
                  <SettingsIcon className="h-6 w-6 text-indigo-500" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-foreground">الإعدادات المركزية للنظام</h3>
                  <p className="text-sm text-muted-foreground mt-1">تعديل التسعير وبريد الدعم الفني وحالة الصيانة.</p>
                </div>
              </div>
              
              {systemSettings ? (
                <form onSubmit={handleSystemSettingsSave} className="space-y-8 max-w-3xl">
                  <div>
                    <label className="block text-sm font-semibold text-secondary-text mb-1">بريد الدعم الفني المعتمد (Support Email)</label>
                    <input
                      type="email"
                      value={systemSettings.supportEmail}
                      onChange={(e) => setSystemSettings({...systemSettings, supportEmail: e.target.value})}
                      className="block w-full max-w-md rounded-xl border-0 py-3 px-4 text-foreground shadow-sm ring-1 ring-inset ring-border focus:ring-2 focus:ring-inset focus:ring-primary sm:text-sm bg-card-muted text-left hover:bg-card transition-colors"
                      dir="ltr"
                    />
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold text-foreground mb-4 border-b border-border pb-2">تسعير الباقات ($)</h4>
                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
                      <div>
                        <label className="block text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wider">الباقة الأساسية</label>
                        <input
                          type="number"
                          value={systemSettings.planBasicPrice}
                          onChange={(e) => setSystemSettings({...systemSettings, planBasicPrice: Number(e.target.value)})}
                          className="block w-full rounded-xl border-0 py-3 px-4 text-foreground shadow-sm ring-1 ring-inset ring-border focus:ring-2 focus:ring-inset focus:ring-primary sm:text-sm bg-input hover:bg-card transition-colors"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wider">الباقة الاحترافية</label>
                        <input
                          type="number"
                          value={systemSettings.planProPrice}
                          onChange={(e) => setSystemSettings({...systemSettings, planProPrice: Number(e.target.value)})}
                          className="block w-full rounded-xl border-0 py-3 px-4 text-foreground shadow-sm ring-1 ring-inset ring-border focus:ring-2 focus:ring-inset focus:ring-primary sm:text-sm bg-input hover:bg-card transition-colors"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wider">باقة الشركات</label>
                        <input
                          type="number"
                          value={systemSettings.planEnterprisePrice}
                          onChange={(e) => setSystemSettings({...systemSettings, planEnterprisePrice: Number(e.target.value)})}
                          className="block w-full rounded-xl border-0 py-3 px-4 text-foreground shadow-sm ring-1 ring-inset ring-border focus:ring-2 focus:ring-inset focus:ring-primary sm:text-sm bg-input hover:bg-card transition-colors"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 bg-amber-50 p-4 rounded-xl border border-amber-100">
                    <div className="flex h-6 items-center">
                      <input
                        id="maintenance"
                        type="checkbox"
                        checked={systemSettings.maintenanceMode}
                        onChange={(e) => setSystemSettings({...systemSettings, maintenanceMode: e.target.checked})}
                        className="h-5 w-5 rounded border-border-strong text-amber-600 focus:ring-amber-600 cursor-pointer"
                      />
                    </div>
                    <label htmlFor="maintenance" className="text-sm font-semibold text-amber-900 cursor-pointer">
                      تفعيل وضع الصيانة (Maintenance Mode)
                      <p className="text-xs text-amber-700 font-normal mt-0.5">سيتم إيقاف دخول العملاء إلى لوحة التحكم الخاصة بهم مؤقتاً.</p>
                    </label>
                  </div>

                  <div className="pt-4 border-t border-border flex items-center gap-4">
                    <button
                      type="submit"
                      disabled={systemLoading}
                      className="inline-flex items-center gap-2 justify-center rounded-xl bg-primary px-6 py-3 text-sm font-bold text-white shadow-md hover:bg-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50 transition-all"
                    >
                      <Save className="h-4 w-4" />
                      {systemLoading ? 'جاري الحفظ...' : 'حفظ التغييرات'}
                    </button>
                    {systemMsg.text && (
                      <span className={`text-sm font-medium ${systemMsg.type === 'error' ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {systemMsg.text}
                      </span>
                    )}
                  </div>
                </form>
              ) : (
                <div className="flex items-center justify-center py-12">
                   <div className="h-8 w-8 animate-spin rounded-full border-4 border-border border-t-primary"></div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'data' && (
            <div className="premium-card p-8">
              <div className="flex items-start gap-4 mb-6">
                <div className="bg-emerald-50 p-3 rounded-xl">
                  <Database className="h-6 w-6 text-emerald-500" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-foreground">تصدير بيانات العملاء</h3>
                  <p className="text-sm text-muted-foreground mt-1 max-w-xl">
                    يمكنك تنزيل نسخة كاملة من جميع العملاء والشركات الموجودة في النظام على هيئة ملف CSV ليتم تحليلها، أو أخذ نسخة احتياطية منها.
                  </p>
                </div>
              </div>
              <div className="mt-8">
                <button
                  onClick={handleExportData}
                  disabled={exportLoading}
                  className="inline-flex items-center gap-2 rounded-xl bg-card px-6 py-3 text-sm font-bold text-foreground shadow-sm ring-1 ring-inset ring-border hover:bg-card-muted disabled:opacity-50 transition-all"
                >
                  <Download className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                  {exportLoading ? 'جاري التصدير وتجهيز الملف...' : 'تحميل بصيغة CSV'}
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
