import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getCompanies } from '../../services/companiesService';
import type { Company } from '../../types';
import { Building2, Shield, Calendar, Activity } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

export function PortalHome() {
  const { user } = useAuth();
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCompanyData = async () => {
      try {
        const allComps = await getCompanies();
        // Assume customer email matches company email for demo purposes
        const myComp = allComps.find(c => c.email?.toLowerCase() === user?.email?.toLowerCase());
        setCompany(myComp || null);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    if (user?.email) {
      fetchCompanyData();
    }
  }, [user]);

  if (loading) return <div className="p-8">جاري التحميل...</div>;

  if (!company) return (
    <div className="p-8 text-center mt-20">
      <div className="text-muted-foreground mb-4"><Building2 className="w-16 h-16 mx-auto opacity-20"/></div>
      <h2 className="text-2xl font-bold text-secondary-text">عفواً، لم يتم العثور على بيانات شركتك</h2>
      <p className="text-muted-foreground mt-2">يرجى التواصل مع الدعم الفني لربط بريدك الإلكتروني ببيانات شركتك.</p>
    </div>
  );

  return (
    <div className="p-8 animate-fade-in">
      <div className="premium-card p-8 mb-8 bg-gradient-to-l from-primary/10 to-transparent border-primary/20">
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-3 mb-2">
          مرحباً، {company.name}
        </h1>
        <p className="text-secondary-text">هذه بوابتك المخصصة لإدارة اشتراكاتك وفواتيرك بكل سهولة وشفافية.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        
        <div className="premium-card p-6 flex flex-col hover:shadow-lg transition-all cursor-default">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-secondary-text">حالة الحساب</h3>
            <div className={`p-2 rounded-xl ${company.status === 'active' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
              <Activity className="h-6 w-6" />
            </div>
          </div>
          <span className={`text-2xl font-black ${company.status === 'active' ? 'text-emerald-600' : 'text-rose-600'}`}>
            {company.status === 'active' ? 'نشط' : 'معلق'}
          </span>
        </div>

        <div className="premium-card p-6 flex flex-col hover:shadow-lg transition-all cursor-default">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-secondary-text">الباقة الحالية</h3>
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <Shield className="h-6 w-6" />
            </div>
          </div>
          <span className="text-2xl font-black text-foreground">
            {company.subscription?.plan === 'basic' ? 'الأساسية' : 
             company.subscription?.plan === 'pro' ? 'الاحترافية' : 
             company.subscription?.plan === 'enterprise' ? 'الشركات' : 'غير محدد'}
          </span>
        </div>

        <div className="premium-card p-6 flex flex-col hover:shadow-lg transition-all cursor-default md:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-secondary-text">تاريخ الانتهاء</h3>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
              <Calendar className="h-6 w-6" />
            </div>
          </div>
          <span className="text-2xl font-black text-foreground">
            {company.subscription?.endDate ? format(new Date(company.subscription.endDate), 'dd MMMM yyyy', {locale: ar}) : 'غير محدد'}
          </span>
        </div>

      </div>
    </div>
  );
}
