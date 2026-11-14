import { useEffect, useState } from 'react';
import { getCompanies } from '../services/companiesService';
import type { Company } from '../types';
import { Calendar, CreditCard, ArrowUpRight, Search, FileText } from 'lucide-react';
import { PageHero } from '../components/page';

export function Subscriptions() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const data = await getCompanies();
        setCompanies(data);
      } catch (error) {
        console.error('Failed to fetch companies', error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  return (
    <div>
      <div>
        
        {/* Header Section */}
        <PageHero
          icon={CreditCard}
          tone="violet"
          title="إدارة الاشتراكات"
          subtitle="تابع باقات الاشتراكات وحالة الفواتير لجميع الشركات المسجلة بالمنصة."
          actions={
            <button type="button" className="inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50 border border-border bg-card text-foreground hover:bg-card-muted">
              <FileText className="h-4 w-4 text-muted-foreground" />
              تصدير التقرير
            </button>
          }
        />

        {/* Table Card */}
        <div className="premium-card overflow-hidden animate-slide-up" style={{ animationDelay: '0.2s' }}>
          
          {/* Table Toolbar */}
          <div className="p-5 border-b border-border flex items-center justify-between bg-card-muted/50">
            <div className="relative max-w-sm w-full">
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                <Search className="h-4 w-4 text-muted-foreground" />
              </div>
              <input 
                type="text"
                className="block w-full rounded-lg border-0 py-2 pr-10 pl-4 text-foreground ring-1 ring-inset ring-border placeholder:text-muted-foreground focus:ring-2 focus:ring-inset focus:ring-primary sm:text-sm bg-input hover:bg-card transition-colors"
                placeholder="ابحث عن اشتراك..."
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-card-muted/50">
                <tr>
                  <th scope="col" className="py-4 pl-4 pr-6 text-right text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    الشركة
                  </th>
                  <th scope="col" className="px-6 py-4 text-right text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    الباقة الحالية
                  </th>
                  <th scope="col" className="px-6 py-4 text-right text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    حالة الفواتير
                  </th>
                  <th scope="col" className="px-6 py-4 text-right text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    تاريخ البدء
                  </th>
                  <th scope="col" className="px-6 py-4 text-right text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    التجديد القادم
                  </th>
                  <th scope="col" className="relative py-4 pl-6 pr-4 text-left">
                    <span className="sr-only">التفاصيل</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-card">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-20 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <div className="h-8 w-8 animate-spin rounded-full border-4 border-border border-t-primary mb-4"></div>
                        <span className="text-muted-foreground font-medium text-sm">جاري جلب الاشتراكات...</span>
                      </div>
                    </td>
                  </tr>
                ) : companies.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-20 text-center">
                      <div className="text-muted-foreground mb-2"><CreditCard className="h-12 w-12 mx-auto opacity-20" /></div>
                      <span className="text-muted-foreground font-medium text-sm">لا توجد اشتراكات حتى الآن.</span>
                    </td>
                  </tr>
                ) : (
                  companies.map((company) => {
                    const sub = company.subscription;
                    
                    // Determine Plan Colors
                    const isEnterprise = sub?.plan === 'Enterprise';
                    const isPro = sub?.plan === 'Pro';
                    const planBg = isEnterprise ? 'bg-fuchsia-50' : isPro ? 'bg-indigo-50' : 'bg-card-muted';
                    const planText = isEnterprise ? 'text-fuchsia-700' : isPro ? 'text-indigo-700' : 'text-secondary-text';
                    const planRing = isEnterprise ? 'ring-fuchsia-600/20' : isPro ? 'ring-indigo-600/20' : 'ring-slate-500/20';
                    const planDot = isEnterprise ? 'bg-fuchsia-500' : isPro ? 'bg-indigo-500' : 'bg-slate-500';

                    // Determine Billing Status Colors
                    const isPaid = sub?.billing_status === 'paid';
                    const isOverdue = sub?.billing_status === 'overdue';
                    const billBg = isPaid ? 'bg-emerald-50' : isOverdue ? 'bg-rose-50' : 'bg-amber-50';
                    const billText = isPaid ? 'text-emerald-700' : isOverdue ? 'text-rose-700' : 'text-amber-700';
                    const billRing = isPaid ? 'ring-emerald-600/20' : isOverdue ? 'ring-rose-600/20' : 'ring-amber-600/20';

                    return (
                      <tr key={company.id} className="hover:bg-blue-50/30 transition-colors duration-200">
                        <td className="whitespace-nowrap py-4 pl-4 pr-6">
                          <div className="flex items-center">
                            <div className="mr-4">
                              <div className="font-semibold text-foreground">{company.name}</div>
                              <div className="text-xs text-muted-foreground mt-0.5">{company.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-6 py-4">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${planBg} ${planText} ${planRing}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ml-1.5 ${planDot}`}></span>
                            {sub?.plan || 'لا يوجد'}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-6 py-4">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${billBg} ${billText} ${billRing}`}>
                            {isPaid ? 'مدفوع' : isOverdue ? 'متأخر' : 'قيد الانتظار'}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            {sub?.start_date ? new Date(sub.start_date).toLocaleDateString('ar-EG') : 'N/A'}
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-secondary-text">
                          {sub?.next_billing_date ? new Date(sub.next_billing_date).toLocaleDateString('ar-EG') : 'N/A'}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-left">
                          <button className="text-primary hover:text-primary-hover hover:bg-blue-50 p-1.5 rounded-md transition-colors">
                            <ArrowUpRight className="h-5 w-5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          
          {/* Pagination Footer (Visual) */}
          <div className="bg-card-muted/50 px-6 py-4 border-t border-border flex items-center justify-between">
            <span className="text-sm text-muted-foreground">يعرض {companies.length} اشتراكات</span>
            <div className="flex gap-2">
              <button className="px-3 py-1 rounded-md text-sm font-medium text-muted-foreground bg-card border border-border cursor-not-allowed">السابق</button>
              <button className="px-3 py-1 rounded-md text-sm font-medium text-secondary-text bg-card border border-border hover:bg-card-muted">التالي</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
