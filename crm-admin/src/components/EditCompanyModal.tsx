import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { X, Building, Mail, CreditCard, Activity, CheckCircle2, MessageCircle } from 'lucide-react';
import { formatWaDisplay, isValidWaNumber, normalizeWaNumber } from '../lib/whatsapp';
import { updateCompany } from '../services/companiesService';
import type { Company } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  company: Company;
  onCompanyUpdated: () => void;
}

export function EditCompanyModal({ isOpen, onClose, company, onCompanyUpdated }: Props) {
  const [name, setName] = useState(company.name || '');
  const [email, setEmail] = useState(company.email || '');
  const [adminWhatsapp, setAdminWhatsapp] = useState(formatWaDisplay(company.admin_whatsapp));
  const [formError, setFormError] = useState('');
  const [status, setStatus] = useState<Company['status']>(company.status || 'active');
  const [plan, setPlan] = useState<string>(company.subscription?.plan || 'Basic');
  const [billingStatus, setBillingStatus] = useState<'paid' | 'pending' | 'overdue'>(company.subscription?.billing_status || 'pending');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setName(company.name || '');
    setEmail(company.email || '');
    setAdminWhatsapp(formatWaDisplay(company.admin_whatsapp));
    setStatus(company.status || 'active');
    setPlan(company.subscription?.plan || 'Basic');
    setBillingStatus(company.subscription?.billing_status || 'pending');
  }, [company]);

  if (!isOpen) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (adminWhatsapp.trim() && !isValidWaNumber(adminWhatsapp)) {
      setFormError('رقم واتساب الإدارة غير صحيح. مثال: 01012345678 أو +20 1012345678');
      return;
    }
    setLoading(true);
    try {
      if (!company.id) throw new Error('No company ID');
      await updateCompany(company.id, {
        name,
        email,
        admin_whatsapp: normalizeWaNumber(adminWhatsapp),
        status,
        subscription: {
          ...company.subscription,
          plan,
          billing_status: billingStatus
        }
      });
      onCompanyUpdated();
      onClose();
    } catch (error) {
      console.error('Failed to update company', error);
      alert('حدث خطأ أثناء التحديث');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 font-cairo flex items-center justify-center">
      <div 
        className="absolute inset-0 bg-slate-900/35 backdrop-blur-sm dark:bg-black/55 transition-opacity animate-fade-in" 
        onClick={onClose} 
      />
      <div className="relative w-full max-w-lg transform overflow-hidden rounded-2xl bg-card text-right shadow-2xl transition-all sm:my-8 animate-slide-up border border-border max-h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="bg-card-muted/50 px-6 py-4 border-b border-border flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-2 rounded-xl">
              <Building className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-bold leading-6 text-foreground">تعديل بيانات الشركة</h3>
              <p className="text-xs text-muted-foreground mt-0.5">ID: {company.id?.substring(0,8)}</p>
            </div>
          </div>
          <button
            type="button"
            className="rounded-lg bg-card p-2 text-muted-foreground hover:text-secondary-text hover:bg-card-muted transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 shadow-sm border border-border"
            onClick={onClose}
          >
            <span className="sr-only">إغلاق</span>
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col overflow-y-auto">
          <div className="px-6 py-6 space-y-6">
            
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-semibold text-secondary-text mb-1.5">اسم الشركة</label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                    <Building className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="block w-full rounded-xl border-0 py-2.5 pr-10 pl-4 text-foreground shadow-sm ring-1 ring-inset ring-border focus:ring-2 focus:ring-inset focus:ring-primary sm:text-sm bg-input hover:bg-card transition-colors"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-secondary-text mb-1.5">البريد الإلكتروني</label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                    <Mail className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full rounded-xl border-0 py-2.5 pr-10 pl-4 text-foreground shadow-sm ring-1 ring-inset ring-border focus:ring-2 focus:ring-inset focus:ring-primary sm:text-sm bg-input hover:bg-card transition-colors text-left"
                    dir="ltr"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="admin-whatsapp" className="block text-sm font-semibold text-secondary-text mb-1.5">رقم واتساب الإدارة</label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3"><MessageCircle className="h-5 w-5 text-success" aria-hidden="true" /></div>
                  <input
                    type="tel"
                    id="admin-whatsapp"
                    inputMode="tel"
                    value={adminWhatsapp}
                    onChange={(e) => setAdminWhatsapp(e.target.value)}
                    className="block w-full rounded-xl border-0 py-2.5 pr-10 pl-4 text-foreground shadow-sm ring-1 ring-inset ring-border placeholder:text-muted-foreground focus:ring-2 focus:ring-inset focus:ring-primary sm:text-sm bg-input hover:bg-card transition-colors text-left"
                    dir="ltr"
                    placeholder="+20 1012345678"
                  />
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">يستقبل طلبات المناديب ومحاضر تصفية العهد وتنبيهات المخزون، ويظهر في لوحة تحكم الشركة.</p>
              </div>
              {formError ? <p className="rounded-xl border border-danger/25 bg-danger-soft px-3 py-2 text-[12.5px] font-semibold text-danger" role="alert">{formError}</p> : null}
            </div>

            <div className="border-t border-border pt-6">
              <h4 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
                <Activity className="h-4 w-4 text-muted-foreground" />
                حالة الحساب
              </h4>
              <div className="flex gap-4">
                <label className={`flex-1 cursor-pointer rounded-xl border p-4 text-center transition-all ${status === 'active' ? 'border-success bg-success-soft ring-1 ring-success' : 'border-border hover:bg-card-muted'}`}>
                  <input type="radio" name="status" value="active" checked={status === 'active'} onChange={() => setStatus('active')} className="sr-only" />
                  <span className={`block text-sm font-bold ${status === 'active' ? 'text-success' : 'text-foreground'}`}>نشط</span>
                </label>
                <label className={`flex-1 cursor-pointer rounded-xl border p-4 text-center transition-all ${status === 'suspended' ? 'border-danger bg-danger-soft ring-1 ring-danger' : 'border-border hover:bg-card-muted'}`}>
                  <input type="radio" name="status" value="suspended" checked={status === 'suspended'} onChange={() => setStatus('suspended')} className="sr-only" />
                  <span className={`block text-sm font-bold ${status === 'suspended' ? 'text-danger' : 'text-foreground'}`}>معلق</span>
                </label>
              </div>
            </div>

            <div className="border-t border-border pt-6">
              <h4 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-muted-foreground" />
                الاشتراكات والفواتير
              </h4>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-semibold text-secondary-text mb-1.5">الباقة</label>
                  <select
                    value={plan}
                    onChange={(e) => setPlan(e.target.value)}
                    className="block w-full rounded-xl border-0 py-2.5 pl-3 pr-4 text-foreground shadow-sm ring-1 ring-inset ring-border focus:ring-2 focus:ring-inset focus:ring-primary sm:text-sm bg-input hover:bg-card transition-colors"
                  >
                    <option value="Basic">Basic</option>
                    <option value="Pro">Pro</option>
                    <option value="Enterprise">Enterprise</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-secondary-text mb-1.5">حالة الدفع</label>
                  <select
                    value={billingStatus}
                    onChange={(e) => setBillingStatus(e.target.value as any)}
                    className="block w-full rounded-xl border-0 py-2.5 pl-3 pr-4 text-foreground shadow-sm ring-1 ring-inset ring-border focus:ring-2 focus:ring-inset focus:ring-primary sm:text-sm bg-input hover:bg-card transition-colors"
                  >
                    <option value="paid">مدفوع</option>
                    <option value="pending">قيد الانتظار</option>
                    <option value="overdue">متأخر</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
          
          {/* Footer */}
          <div className="bg-card-muted/50 px-6 py-4 flex flex-row-reverse border-t border-border gap-3 shrink-0">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex w-full justify-center items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-bold text-white shadow-md hover:bg-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:w-auto transition-all disabled:opacity-50"
            >
              {loading ? 'جاري الحفظ...' : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  حفظ التعديلات
                </>
              )}
            </button>
            <button
              type="button"
              className="mt-3 inline-flex w-full justify-center rounded-xl bg-card px-6 py-2.5 text-sm font-bold text-foreground shadow-sm ring-1 ring-inset ring-border-strong hover:bg-card-muted sm:mt-0 sm:w-auto transition-all"
              onClick={onClose}
            >
              إلغاء
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
