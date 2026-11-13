import { useEffect, useState } from 'react';
import { getAuditLogs } from '../services/auditService';
import type { AuditLog } from '../types';
import { ShieldAlert, Activity, Search, RefreshCw } from 'lucide-react';
import { PageHero } from '../components/page';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

export function AuditLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const data = await getAuditLogs(100);
      setLogs(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const filteredLogs = logs.filter(log => 
    log.action.includes(searchTerm) || 
    log.userEmail.includes(searchTerm) ||
    (log.details && log.details.includes(searchTerm))
  );

  return (
    <div>
      <div>
        
        {/* Header */}
        <PageHero
          icon={ShieldAlert}
          tone="slate"
          title="سجل النظام والنشاطات"
          subtitle="تتبع كافة الإجراءات والتعديلات الحساسة التي تتم في النظام، مع معلومات مفصلة عن وقت الحدوث ومن قام بها."
          actions={
            <button onClick={fetchLogs} disabled={loading} className="inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50 border border-border bg-card text-foreground hover:bg-card-muted">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              تحديث السجل
            </button>
          }
        />

        {/* Search */}
        <div className="mb-6 animate-slide-up" style={{ animationDelay: '0.1s' }}>
          <div className="relative max-w-md">
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
              <Search className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            </div>
            <input
              type="text"
              className="block w-full rounded-xl border-0 py-3 pr-10 pl-4 text-foreground shadow-sm ring-1 ring-inset ring-border focus:ring-2 focus:ring-inset focus:ring-primary sm:text-sm sm:leading-6 bg-card hover:bg-card-muted transition-colors"
              placeholder="ابحث في سجل النشاطات (حسب البريد، الحدث، أو التفاصيل)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Logs Timeline / Table */}
        <div className="premium-card overflow-hidden animate-slide-up" style={{ animationDelay: '0.2s' }}>
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-border border-t-primary"></div>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="flex flex-col justify-center items-center h-64 text-muted-foreground">
              <Activity className="h-12 w-12 text-muted-foreground/60 mb-3" />
              <p className="text-lg font-medium">لا توجد سجلات مطابقة</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-border">
                <thead>
                  <tr className="bg-card-muted/50">
                    <th scope="col" className="py-3.5 pr-6 pl-4 text-right text-xs font-bold text-muted-foreground uppercase tracking-wider w-1/4">الإجراء</th>
                    <th scope="col" className="py-3.5 px-4 text-right text-xs font-bold text-muted-foreground uppercase tracking-wider w-1/4">المستخدم</th>
                    <th scope="col" className="py-3.5 px-4 text-right text-xs font-bold text-muted-foreground uppercase tracking-wider w-1/4">التفاصيل</th>
                    <th scope="col" className="py-3.5 px-4 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider w-1/4">التاريخ والوقت</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border bg-card">
                  {filteredLogs.map((log) => {
                    let dateStr = 'غير معروف';
                    try {
                       if (log.timestamp) {
                           dateStr = format(new Date(log.timestamp), 'dd MMMM yyyy - hh:mm a', { locale: ar });
                       }
                    } catch (e) {}

                    return (
                      <tr key={log.id} className="hover:bg-card-muted transition-colors">
                        <td className="whitespace-nowrap py-4 pr-6 pl-4 text-sm font-semibold text-foreground">
                           <div className="flex items-center gap-2">
                             <div className="h-2 w-2 rounded-full bg-primary animate-pulse"></div>
                             {log.action}
                           </div>
                        </td>
                        <td className="whitespace-nowrap py-4 px-4 text-sm text-secondary-text">
                          {log.userEmail}
                        </td>
                        <td className="py-4 px-4 text-sm text-muted-foreground max-w-xs truncate">
                          {log.details || '-'}
                        </td>
                        <td className="whitespace-nowrap py-4 px-4 text-left text-sm text-muted-foreground" dir="ltr">
                          {dateStr}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
