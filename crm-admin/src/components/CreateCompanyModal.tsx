import { useState } from 'react';
import type { FormEvent } from 'react';
import { X, Building, Mail, CheckCircle2, MessageCircle } from 'lucide-react';
import { isValidWaNumber, normalizeWaNumber } from '../lib/whatsapp';
import { createCompany } from '../services/companiesService';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onCompanyCreated: () => void;
}

export function CreateCompanyModal({ isOpen, onClose, onCompanyCreated }: Props) {
  const [name, setName] = useState('');
  const [companyEmail, setCompanyEmail] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [adminWhatsapp, setAdminWhatsapp] = useState('');
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);

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
      const result = await createCompany({
        companyName: name,
        companyEmail,
        ownerName,
        ownerEmail,
        adminWhatsapp: normalizeWaNumber(adminWhatsapp),
      });
      if (result.passwordResetLink) {
        window.prompt('تم إنشاء الشركة وحساب مالك الـERP. انسخ رابط تعيين كلمة المرور وأرسله للمالك عبر قناة آمنة:', result.passwordResetLink);
      } else {
        window.alert('تم إنشاء الشركة وإرسال دعوة تعيين كلمة المرور إلى بريد المالك.');
      }
      onCompanyCreated();
      onClose();
      setName('');
      setCompanyEmail('');
      setOwnerName('');
      setOwnerEmail('');
      setAdminWhatsapp('');
    } catch (error) {
      console.error('Failed to create company', error);
      alert('حدث خطأ أثناء إضافة الشركة');
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
      <div className="relative w-full max-w-md transform overflow-hidden rounded-2xl bg-card text-right shadow-2xl transition-all sm:my-8 animate-slide-up border border-border">
        
        {/* Header */}
        <div className="bg-card-muted/50 px-6 py-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-2 rounded-xl">
              <Building className="h-5 w-5 text-primary" />
            </div>
            <h3 className="text-lg font-bold leading-6 text-foreground">إضافة شركة جديدة</h3>
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
        <form onSubmit={handleSubmit}>
          <div className="px-6 py-6 space-y-5">
            <div>
              <label htmlFor="name" className="block text-sm font-semibold text-secondary-text mb-1.5">
                اسم الشركة
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                  <Building className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                </div>
                <input
                  type="text"
                  name="name"
                  id="name"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="block w-full rounded-xl border-0 py-3 pr-10 pl-4 text-foreground shadow-sm ring-1 ring-inset ring-border placeholder:text-muted-foreground focus:ring-2 focus:ring-inset focus:ring-primary sm:text-sm sm:leading-6 bg-input hover:bg-card transition-colors"
                  placeholder="شركة التقنية الحديثة..."
                />
              </div>
            </div>
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-secondary-text mb-1.5">
                البريد الإلكتروني للشركة
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                  <Mail className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                </div>
                <input
                  type="email"
                  name="companyEmail"
                  id="companyEmail"
                  required
                  value={companyEmail}
                  onChange={(e) => setCompanyEmail(e.target.value)}
                  className="block w-full rounded-xl border-0 py-3 pr-10 pl-4 text-foreground shadow-sm ring-1 ring-inset ring-border placeholder:text-muted-foreground focus:ring-2 focus:ring-inset focus:ring-primary sm:text-sm sm:leading-6 bg-input hover:bg-card transition-colors text-left"
                  dir="ltr"
                  placeholder="contact@company.com"
                />
              </div>
            </div>
            <div>
              <label htmlFor="ownerName" className="block text-sm font-semibold text-secondary-text mb-1.5">اسم مالك حساب ERP</label>
              <input
                type="text"
                name="ownerName"
                id="ownerName"
                required
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                className="block w-full rounded-xl border-0 py-3 px-4 text-foreground shadow-sm ring-1 ring-inset ring-border placeholder:text-muted-foreground focus:ring-2 focus:ring-inset focus:ring-primary sm:text-sm sm:leading-6 bg-input hover:bg-card transition-colors"
                placeholder="أحمد محمد"
              />
            </div>
            <div>
              <label htmlFor="ownerEmail" className="block text-sm font-semibold text-secondary-text mb-1.5">بريد مالك حساب ERP</label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3"><Mail className="h-5 w-5 text-muted-foreground" aria-hidden="true" /></div>
                <input
                  type="email"
                  name="ownerEmail"
                  id="ownerEmail"
                  required
                  value={ownerEmail}
                  onChange={(e) => setOwnerEmail(e.target.value)}
                  className="block w-full rounded-xl border-0 py-3 pr-10 pl-4 text-foreground shadow-sm ring-1 ring-inset ring-border placeholder:text-muted-foreground focus:ring-2 focus:ring-inset focus:ring-primary sm:text-sm sm:leading-6 bg-input hover:bg-card transition-colors text-left"
                  dir="ltr"
                  placeholder="owner@company.com"
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
                  className="block w-full rounded-xl border-0 py-3 pr-10 pl-4 text-foreground shadow-sm ring-1 ring-inset ring-border placeholder:text-muted-foreground focus:ring-2 focus:ring-inset focus:ring-primary sm:text-sm bg-input hover:bg-card transition-colors text-left"
                  dir="ltr"
                  placeholder="+20 1012345678"
                />
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">يستقبل طلبات المناديب ومحاضر تصفية العهد وتنبيهات المخزون، ويظهر في لوحة تحكم الشركة.</p>
            </div>
            {formError ? <p className="rounded-xl border border-danger/25 bg-danger-soft px-3 py-2 text-[12.5px] font-semibold text-danger" role="alert">{formError}</p> : null}
          </div>
          
          {/* Footer */}
          <div className="bg-card-muted/50 px-6 py-4 flex flex-row-reverse border-t border-border gap-3">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex w-full justify-center items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-bold text-white shadow-md hover:bg-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:w-auto transition-all disabled:opacity-50"
            >
              {loading ? 'جاري الإضافة...' : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  حفظ الشركة
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
