import { useEffect, useState } from 'react';
import { getInvoices, payInvoice, checkAndSuspendExpired } from '../services/billingService';
import type { Invoice } from '../types';
import { FileText, CheckCircle, AlertCircle, Clock, Download, RefreshCw } from 'lucide-react';
import { PageHero } from '../components/page';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { useAuth } from '../contexts/AuthContext';
import { Navigate } from 'react-router-dom';

export function Invoices() {
  const { isPlatformAdmin, userRole } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningAuto, setRunningAuto] = useState(false);

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const data = await getInvoices();
      setInvoices(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isPlatformAdmin || userRole === 'billing_admin') {
      fetchInvoices();
    }
  }, [isPlatformAdmin, userRole]);

  if (!isPlatformAdmin && userRole !== 'billing_admin') {
    return <Navigate to="/" replace />;
  }

  const handlePay = async (id: string) => {
    if (!window.confirm('هل متأكد من تحصيل هذه الفاتورة كمدفوعة؟')) return;
    try {
      await payInvoice(id);
      await fetchInvoices();
    } catch (error) {
      console.error(error);
      alert('حدث خطأ');
    }
  };

  const handleRunAutomation = async () => {
    setRunningAuto(true);
    try {
      await checkAndSuspendExpired();
      alert('تم تشغيل الأتمتة بنجاح، ومراجعة كافة الاشتراكات المنتهية.');
    } catch (error) {
      console.error(error);
      alert('حدث خطأ أثناء تشغيل الأتمتة');
    } finally {
      setRunningAuto(false);
    }
  };

  return (
    <div>
      <div>
        
        {/* Header */}
        <PageHero
          icon={FileText}
          tone="indigo"
          title="الفواتير والمالية"
          subtitle="إدارة فواتير الشركات وتحصيل المبالغ وأتمتة الاشتراكات."
          actions={isPlatformAdmin && (
            <button onClick={handleRunAutomation} disabled={runningAuto} className="inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50 bg-primary text-white shadow-sm shadow-primary/30 hover:bg-primary-hover">
              <RefreshCw className={`h-4 w-4 ${runningAuto ? 'animate-spin' : ''}`} />
              تشغيل المراجعة الآلية
            </button>
          )}
        />

        {/* Invoices Table */}
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
                    <th className="py-3.5 pr-6 pl-4 text-right text-xs font-bold text-muted-foreground uppercase">رقم الفاتورة</th>
                    <th className="py-3.5 px-4 text-right text-xs font-bold text-muted-foreground uppercase">الشركة</th>
                    <th className="py-3.5 px-4 text-right text-xs font-bold text-muted-foreground uppercase">المبلغ</th>
                    <th className="py-3.5 px-4 text-right text-xs font-bold text-muted-foreground uppercase">تاريخ الاستحقاق</th>
                    <th className="py-3.5 px-4 text-right text-xs font-bold text-muted-foreground uppercase">الحالة</th>
                    <th className="py-3.5 px-4 text-left text-xs font-bold text-muted-foreground uppercase">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border bg-card">
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-card-muted transition-colors">
                      <td className="whitespace-nowrap py-4 pr-6 pl-4 text-sm font-semibold text-foreground">
                        INV-{inv.id.substring(0,6).toUpperCase()}
                      </td>
                      <td className="whitespace-nowrap py-4 px-4 text-sm text-foreground font-medium">
                        {inv.companyName}
                      </td>
                      <td className="whitespace-nowrap py-4 px-4 text-sm font-bold text-emerald-600">
                        ${inv.amount}
                      </td>
                      <td className="whitespace-nowrap py-4 px-4 text-sm text-muted-foreground" dir="ltr">
                        {inv.dueDate ? format(new Date(inv.dueDate), 'dd MMM yyyy', { locale: ar }) : '-'}
                      </td>
                      <td className="whitespace-nowrap py-4 px-4">
                        {inv.status === 'paid' ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                            <CheckCircle className="w-3 h-3"/> مدفوعة
                          </span>
                        ) : inv.status === 'overdue' ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 ring-1 ring-inset ring-rose-600/20">
                            <AlertCircle className="w-3 h-3"/> متأخرة
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 ring-1 ring-inset ring-amber-600/20">
                            <Clock className="w-3 h-3"/> بانتظار الدفع
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap py-4 px-4 text-left">
                        <div className="flex justify-end gap-2">
                           <button className="text-muted-foreground hover:text-primary transition-colors" title="تحميل الفاتورة PDF">
                             <Download className="w-5 h-5"/>
                           </button>
                           {inv.status !== 'paid' && (
                             <button 
                               onClick={() => handlePay(inv.id)}
                               className="text-emerald-500 hover:text-emerald-700 transition-colors bg-emerald-50 hover:bg-emerald-100 px-3 py-1 rounded-lg text-xs font-bold"
                             >
                               تحصيل
                             </button>
                           )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {invoices.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-muted-foreground">لا توجد فواتير حالياً.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
