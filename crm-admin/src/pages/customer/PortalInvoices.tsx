import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getCompanyInvoices } from '../../services/billingService';
import { getCompanies } from '../../services/companiesService';
import type { Invoice } from '../../types';
import { FileText, CheckCircle, AlertCircle, Clock, Download } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

export function PortalInvoices() {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchInvoices = async () => {
      try {
        const allComps = await getCompanies();
        const myComp = allComps.find(c => c.email?.toLowerCase() === user?.email?.toLowerCase());
        if (myComp) {
          const invs = await getCompanyInvoices(myComp.id);
          setInvoices(invs);
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    if (user?.email) {
      fetchInvoices();
    }
  }, [user]);

  return (
    <div className="p-8 font-cairo">
      <h1 className="text-3xl font-bold text-foreground tracking-tight flex items-center gap-3 mb-8 animate-fade-in">
        <FileText className="h-8 w-8 text-primary" />
        فواتيري
      </h1>

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
                  <th className="py-3.5 px-4 text-right text-xs font-bold text-muted-foreground uppercase">المبلغ</th>
                  <th className="py-3.5 px-4 text-right text-xs font-bold text-muted-foreground uppercase">تاريخ الاستحقاق</th>
                  <th className="py-3.5 px-4 text-right text-xs font-bold text-muted-foreground uppercase">الحالة</th>
                  <th className="py-3.5 px-4 text-left text-xs font-bold text-muted-foreground uppercase">تحميل</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-card">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-card-muted transition-colors">
                    <td className="whitespace-nowrap py-4 pr-6 pl-4 text-sm font-semibold text-foreground">
                      INV-{inv.id.substring(0,6).toUpperCase()}
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
                      <button className="text-muted-foreground hover:text-primary transition-colors" title="تحميل الفاتورة PDF">
                        <Download className="w-5 h-5"/>
                      </button>
                    </td>
                  </tr>
                ))}
                {invoices.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-muted-foreground">لا توجد فواتير حالياً.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
