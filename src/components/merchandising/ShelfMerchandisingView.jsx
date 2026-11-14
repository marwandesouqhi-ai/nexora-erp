import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Store, Camera, Eye, Tag } from 'lucide-react';

const STOCK_STATUS_LABELS = {
    available: 'متوفر بكثرة 🟢',
    low: 'مخزون منخفض 🟡',
    out_of_stock: 'نفذ من الرف 🔴',
};

const STOCK_STATUS_COLORS = {
    available: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30 dark:text-emerald-400',
    low: 'bg-amber-500/10 text-amber-600 border-amber-500/30 dark:text-amber-400',
    out_of_stock: 'bg-rose-500/10 text-rose-600 border-rose-500/30 dark:text-rose-400',
};

export default function ShelfMerchandisingView({ visits = [], customerName = '' }) {
    const [selectedPhoto, setSelectedPhoto] = useState(null);

    // Extract visits that have merchandising data
    const merchandisingRecords = visits
        .filter(v => v.merchandising_data || v.shelfSharePercent != null || v.shelfPhotoUrl)
        .map(v => {
            const m = v.merchandising_data || {};
            return {
                id: v.id,
                visitDate: v.date || v.created_at?.toDate?.()?.toLocaleDateString('ar-EG') || '—',
                repName: v.employee_name || v.rep_name || 'مندوب ميداني',
                customerName: v.customer_name || customerName || 'نقطة البيع',
                shelfPhotoUrl: m.shelfPhotoUrl || v.shelfPhotoUrl || v.photo_url || null,
                shelfSharePercent: Number(m.shelfSharePercent ?? v.shelfSharePercent ?? 0),
                ourFacingsCount: Number(m.ourFacingsCount ?? v.ourFacingsCount ?? 0),
                totalFacingsCount: Number(m.totalFacingsCount ?? v.totalFacingsCount ?? 0),
                stockStatus: m.stockStatus || v.stockStatus || 'available',
                competitorPrices: m.competitorPrices || v.competitorPrices || [],
                promotionsNotes: m.promotionsNotes || v.promotionsNotes || '',
            };
        });

    // Average shelf share
    const avgShelfShare = merchandisingRecords.length > 0
        ? Math.round(merchandisingRecords.reduce((acc, r) => acc + r.shelfSharePercent, 0) / merchandisingRecords.length)
        : 0;

    // Aggregate competitor pricing across records
    const allCompetitorPrices = [];
    merchandisingRecords.forEach(r => {
        if (Array.isArray(r.competitorPrices)) {
            r.competitorPrices.forEach(cp => {
                allCompetitorPrices.push({
                    ...cp,
                    customerName: r.customerName,
                    date: r.visitDate,
                });
            });
        }
    });

    if (merchandisingRecords.length === 0) {
        return (
            <div className="py-12 text-center text-sm text-muted-foreground" dir="rtl">
                <Store className="h-10 w-10 mx-auto text-muted-foreground/30 mb-2" />
                <p className="font-bold">لا توجد بيانات تدقيق رفوف مسجلة حتى الآن.</p>
                <p className="text-xs text-muted-foreground mt-1">
                    يقوم المندوب بتسجيل زيارة "تدقيق رفوف" والتقاط صور لحصة منتجاتنا ورصد أسعار المنافسين من تطبيق Nexora Field.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6" dir="rtl">
            {/* KPI Summary Bar */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Average Shelf Share Gauge */}
                <Card className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs font-semibold text-muted-foreground">متوسط حصة الرف (Shelf Share %)</p>
                            <p className="text-3xl font-black text-foreground mt-1">{avgShelfShare}%</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                                نسبة ظهور منتجاتنا مقارنة بإجمالي معروض الرف
                            </p>
                        </div>
                        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary font-black text-base">
                            {avgShelfShare}%
                        </span>
                    </div>
                    {/* Visual Progress Bar */}
                    <div className="mt-3 w-full bg-muted rounded-full h-2 overflow-hidden">
                        <div
                            className="bg-primary h-2 rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(100, avgShelfShare)}%` }}
                        />
                    </div>
                </Card>

                {/* Audited Visits Count */}
                <Card className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs font-semibold text-muted-foreground">جولات تدقيق الرفوف الميدانية</p>
                            <p className="text-3xl font-black text-foreground mt-1">{merchandisingRecords.length}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">زيارات موثقة بالصور والأسعار</p>
                        </div>
                        <Camera className="h-6 w-6 text-emerald-600" />
                    </div>
                </Card>

                {/* Monitored Competitor Prices */}
                <Card className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs font-semibold text-muted-foreground">أسعار المنافسين المرصودة</p>
                            <p className="text-3xl font-black text-foreground mt-1">{allCompetitorPrices.length}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">تسعيرة تم رصدها بالصيدليات</p>
                        </div>
                        <Tag className="h-6 w-6 text-amber-600" />
                    </div>
                </Card>
            </div>

            {/* Shelf Photos Gallery (Lightbox) */}
            <Card className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
                <CardHeader className="border-b border-border/50 bg-muted/20 px-6 py-4">
                    <CardTitle className="text-base font-black text-foreground flex items-center gap-2">
                        <Camera className="h-5 w-5 text-primary" />
                        معرض صور الرفوف وتوزيع البضاعة (Photo Lightbox)
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                        {merchandisingRecords.map((rec) => {
                            return (
                                <div
                                    key={rec.id}
                                    className="rounded-2xl border border-border bg-background overflow-hidden shadow-sm hover:border-primary/50 transition-all flex flex-col justify-between"
                                >
                                    {/* Photo Preview */}
                                    <div
                                        className="relative h-44 w-full bg-slate-900/10 dark:bg-slate-800/40 cursor-pointer group flex items-center justify-center overflow-hidden"
                                        onClick={() => rec.shelfPhotoUrl && setSelectedPhoto(rec.shelfPhotoUrl)}
                                    >
                                        {rec.shelfPhotoUrl ? (
                                            <>
                                                <img
                                                    src={rec.shelfPhotoUrl}
                                                    alt="صورة الرف"
                                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                                />
                                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white gap-1.5 text-xs font-bold">
                                                    <Eye className="h-4 w-4" />
                                                    تكبير الصورة (Lightbox)
                                                </div>
                                            </>
                                        ) : (
                                            <div className="text-center p-4 text-muted-foreground">
                                                <Camera className="h-8 w-8 mx-auto opacity-30 mb-1" />
                                                <span className="text-xs">لم يتم رفع صورة في هذه الزيارة</span>
                                            </div>
                                        )}

                                        <div className="absolute top-2 right-2">
                                            <Badge className="bg-primary/90 text-white font-mono text-[11px] shadow">
                                                حصة الرف: {rec.shelfSharePercent}%
                                            </Badge>
                                        </div>
                                    </div>

                                    {/* Record details */}
                                    <div className="p-4 space-y-2">
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="font-bold text-foreground">{rec.customerName}</span>
                                            <span className="text-muted-foreground font-mono">{rec.visitDate}</span>
                                        </div>

                                        <div className="flex items-center justify-between text-xs">
                                            <span className="text-muted-foreground">أوجه المنتجات:</span>
                                            <span className="font-bold font-mono">
                                                {rec.ourFacingsCount} وجه لنا / {rec.totalFacingsCount} إجمالي
                                            </span>
                                        </div>

                                        <div className="flex items-center justify-between text-xs">
                                            <span className="text-muted-foreground">حالة التوفر:</span>
                                            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${STOCK_STATUS_COLORS[rec.stockStatus] || 'bg-muted text-muted-foreground'}`}>
                                                {STOCK_STATUS_LABELS[rec.stockStatus] || rec.stockStatus}
                                            </span>
                                        </div>

                                        {rec.promotionsNotes && (
                                            <div className="p-2 bg-muted/40 rounded-xl text-[11px] text-muted-foreground mt-2">
                                                <span className="font-bold text-foreground block">عروض وترويج:</span>
                                                {rec.promotionsNotes}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>

            {/* Competitor Pricing Table */}
            {allCompetitorPrices.length > 0 && (
                <Card className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
                    <CardHeader className="border-b border-border/50 bg-muted/20 px-6 py-4">
                        <CardTitle className="text-base font-black text-foreground flex items-center gap-2">
                            <Tag className="h-5 w-5 text-amber-600" />
                            جدول رصد ومقارنة أسعار المنافسين في نقاط البيع
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <table className="w-full text-right text-xs">
                                <thead>
                                    <tr className="border-b border-border bg-muted/40 text-muted-foreground font-bold">
                                        <th className="p-3.5">نقطة البيع (الصيدلية)</th>
                                        <th className="p-3.5">الشركة المنافسة (Brand)</th>
                                        <th className="p-3.5">المنتج المنافس</th>
                                        <th className="p-3.5 text-center">سعر البيع المرصود</th>
                                        <th className="p-3.5 text-center">تاريخ الرصد</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/60">
                                    {allCompetitorPrices.map((cp, idx) => (
                                        <tr key={idx} className="hover:bg-muted/20 transition-colors">
                                            <td className="p-3.5 font-bold text-foreground">{cp.customerName}</td>
                                            <td className="p-3.5">
                                                <Badge variant="outline" className="font-bold">
                                                    {cp.brand || 'منافس'}
                                                </Badge>
                                            </td>
                                            <td className="p-3.5 font-bold text-foreground">{cp.product || '—'}</td>
                                            <td className="p-3.5 text-center font-mono font-black text-emerald-600">
                                                {(Number(cp.price) || 0).toLocaleString('ar')} ج.م
                                            </td>
                                            <td className="p-3.5 text-center font-mono text-muted-foreground">{cp.date}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Lightbox Dialog */}
            <Dialog open={!!selectedPhoto} onOpenChange={(open) => !open && setSelectedPhoto(null)}>
                <DialogContent className="max-w-4xl p-2 bg-black/95 border-none text-white rounded-2xl flex flex-col items-center justify-center" dir="rtl">
                    {selectedPhoto && (
                        <div className="relative max-h-[85vh] w-full flex items-center justify-center p-2">
                            <img
                                src={selectedPhoto}
                                alt="معاينة الرف المكبرة"
                                className="max-h-[80vh] w-auto max-w-full rounded-xl object-contain shadow-2xl"
                            />
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
