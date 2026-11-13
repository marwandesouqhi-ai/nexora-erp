import { memo } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { FileText, AlertCircle, Inbox } from 'lucide-react';

function toDate(value) {
    if (!value) return null;
    if (typeof value.toDate === 'function') return value.toDate();
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * جدول آخر الفواتير — قابل لإعادة الاستخدام في أي صفحة.
 *
 * Props:
 *  - sales: مصفوفة الفواتير
 *  - loading: حالة التحميل
 *  - error: رسالة خطأ (لو موجودة)
 *  - limit: عدد الصفوف المعروضة (افتراضي 5)
 *  - showFinancials: إظهار عمود الإجمالي (لصلاحيات المالية)
 *  - viewAllHref: رابط "عرض الكل"
 */
function RecentSalesList({
    sales = [],
    loading = false,
    error = null,
    limit = 5,
    showFinancials = true,
    viewAllHref = '/sales',
}) {
    const rows = sales.slice(0, limit);

    return (
        <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm ">
            <div className="flex items-center justify-between border-b border-border p-6 ">
                <h3 className="flex items-center gap-2 text-lg font-black text-secondary-text ">
                    <FileText className="h-5 w-5 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
                    أحدث الفواتير
                </h3>
                {viewAllHref && (
                    <Link
                        to={viewAllHref}
                        className="text-xs font-bold text-indigo-600 underline-offset-4 hover:underline dark:text-indigo-400"
                    >
                        عرض الكل
                    </Link>
                )}
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-start">
                    <thead className="bg-card-muted/50 ">
                        <tr className="text-xs font-black uppercase text-muted-foreground ">
                            <th scope="col" className="px-6 py-4">رقم الفاتورة</th>
                            <th scope="col" className="px-6 py-4">العميل</th>
                            {showFinancials && <th scope="col" className="px-6 py-4">الإجمالي</th>}
                            <th scope="col" className="px-6 py-4">الحالة</th>
                            <th scope="col" className="px-6 py-4">التاريخ</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border ">
                        {loading ? (
                            Array.from({ length: 3 }).map((_, i) => (
                                <tr key={i}>
                                    <td colSpan={showFinancials ? 5 : 4} className="px-6 py-4">
                                        <div className="h-4 w-full animate-pulse rounded bg-card-muted " />
                                    </td>
                                </tr>
                            ))
                        ) : error ? (
                            <tr>
                                <td colSpan={showFinancials ? 5 : 4} className="px-6 py-14 text-center">
                                    <AlertCircle className="mx-auto mb-2 h-8 w-8 text-red-400" aria-hidden="true" />
                                    <p className="text-xs font-bold text-red-500">
                                        {typeof error === 'string' ? error : 'حدث خطأ أثناء تحميل الفواتير'}
                                    </p>
                                </td>
                            </tr>
                        ) : rows.length === 0 ? (
                            <tr>
                                <td colSpan={showFinancials ? 5 : 4} className="px-6 py-14 text-center">
                                    <Inbox className="mx-auto mb-2 h-8 w-8 text-muted-foreground/60 " aria-hidden="true" />
                                    <p className="text-xs font-bold text-muted-foreground">لا توجد فواتير حتى الآن</p>
                                </td>
                            </tr>
                        ) : (
                            rows.map((s) => {
                                const created = toDate(s.created_date);
                                const isPaid = s.payment_status === 'paid';
                                return (
                                    <tr key={s.id} className="transition-colors hover:bg-card-muted ">
                                        <td className="px-6 py-4 font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">
                                            #{s.id?.slice(-6)}
                                        </td>
                                        <td className="px-6 py-4 text-sm font-bold text-secondary-text ">
                                            {s.customer_name || 'عميل نقدي'}
                                        </td>
                                        {showFinancials && (
                                            <td className="px-6 py-4 text-sm font-black text-foreground ">
                                                {Number(s.total || 0).toLocaleString()} ج.م
                                            </td>
                                        )}
                                        <td className="px-6 py-4">
                                            <span
                                                className={`rounded-full px-2 py-1 text-[10px] font-black ${isPaid
                                                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
                                                        : 'bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400'
                                                    }`}
                                            >
                                                {isPaid ? 'مدفوعة' : 'معلقة'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-xs font-medium text-muted-foreground ">
                                            {created ? format(created, 'dd/MM/yyyy') : '—'}
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default memo(RecentSalesList);