import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getProducts } from '@/firebase/collections/products';
import { getUnreadNotifications, markAsRead } from '@/firebase/collections/notifications';
import { sendStockAlert } from '@/services/whatsappService';
import { useRole } from '@/lib/RoleContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { AlertTriangle, PackageX, Loader2, Search, Send, MessageCircle, BellRing } from 'lucide-react';

import { PageHero, StatCard } from '@/components/page';
export default function StockAlerts() {
    const { can } = useRole();
    const qc = useQueryClient();
    const { toast } = useToast();

    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all'); // all | out | near
    const [sortBy, setSortBy] = useState('stock_asc'); // stock_asc | stock_desc | name
    const [sendingId, setSendingId] = useState(null);
    const [sendingBulk, setSendingBulk] = useState(false);

    const { data: products = [], isLoading } = useQuery({ queryKey: ['products-stock-alerts'], queryFn: getProducts });
    const { data: notifications = [] } = useQuery({ queryKey: ['stock-notifications'], queryFn: getUnreadNotifications });

    const lowStock = useMemo(
        () => products.filter((p) => Number(p.current_stock) <= Number(p.min_stock_level ?? 5)),
        [products]
    );
    const outOfStock = useMemo(() => lowStock.filter((p) => Number(p.current_stock) <= 0), [lowStock]);
    const nearLimit = useMemo(() => lowStock.filter((p) => Number(p.current_stock) > 0), [lowStock]);

    // ✅ بحث + فلترة + ترتيب
    const displayedItems = useMemo(() => {
        let list = [...lowStock];

        if (searchTerm.trim()) {
            const term = searchTerm.trim().toLowerCase();
            list = list.filter((p) => (p.product_name || '').toLowerCase().includes(term));
        }

        if (statusFilter === 'out') {
            list = list.filter((p) => Number(p.current_stock) <= 0);
        } else if (statusFilter === 'near') {
            list = list.filter((p) => Number(p.current_stock) > 0);
        }

        list.sort((a, b) => {
            if (sortBy === 'stock_asc') return Number(a.current_stock) - Number(b.current_stock);
            if (sortBy === 'stock_desc') return Number(b.current_stock) - Number(a.current_stock);
            if (sortBy === 'name') return (a.product_name || '').localeCompare(b.product_name || '', 'ar');
            return 0;
        });

        return list;
    }, [lowStock, searchTerm, statusFilter, sortBy]);

    const handleMarkRead = async (id) => {
        await markAsRead(id);
        qc.invalidateQueries({ queryKey: ['stock-notifications'] });
    };

    // ✅ إرسال تنبيه واتساب لصنف معين
    const handleSendAlert = async (product) => {
        setSendingId(product.id);
        try {
            await sendStockAlert(product.product_name, product.current_stock);
            toast({
                title: '✅ تم إرسال التنبيه',
                description: `تم إرسال تنبيه واتساب بخصوص ${product.product_name}`,
                variant: 'success',
            });
        } catch (error) {
            toast({
                title: '❌ فشل إرسال التنبيه',
                description: error?.message || 'حدث خطأ غير متوقع',
                variant: 'destructive',
            });
        } finally {
            setSendingId(null);
        }
    };

    const handleSendBulkAlerts = async () => {
        if (displayedItems.length === 0) {
            toast({
                title: '⚠️ لا توجد أصناف لإرسالها',
                description: 'لم يتم العثور على أصناف منخفضة لتوجيه تنبيه واتساب.',
                variant: 'warning',
            });
            return;
        }

        setSendingBulk(true);
        try {
            await Promise.all(
                displayedItems.map((product) =>
                    sendStockAlert(product.product_name, product.current_stock)
                )
            );

            toast({
                title: '✅ تم إرسال جميع التنبيهات',
                description: 'تم إرسال تنبيهات واتساب لجميع الأصناف المحددة.',
                variant: 'success',
            });
        } catch (error) {
            toast({
                title: '❌ فشل في إرسال بعض التنبيهات',
                description: error?.message || 'حدث خطأ أثناء الإرسال الجماعي.',
                variant: 'destructive',
            });
        } finally {
            setSendingBulk(false);
        }
    };

    if (!can('can_view_inventory')) {
        return <div className="p-8 text-center text-muted-foreground">غير مسموح لك بالوصول إلى هذه الصفحة.</div>;
    }

    return (
        <div className="space-y-6" dir="rtl">
            <PageHero
                className="mb-0"
                icon={BellRing}
                tone="amber"
                title="تنبيهات المخزون"
                subtitle="متابعة الأصناف التي وصلت لحد الأمان أو نفدت من المخزن."
            />

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <StatCard title="أصناف نفدت تمامًا" value={outOfStock.length} valueClassName="text-danger" icon={PackageX} tone="danger" />
                <StatCard title="قريبة من حد الأمان" value={nearLimit.length} valueClassName="text-warning" icon={AlertTriangle} tone="amber" />
                <StatCard title="تنبيهات غير مقروءة" value={notifications.length} icon={BellRing} tone="indigo" />
            </div>

            {/* ✅ أدوات البحث والفلترة والترتيب */}
            <Card className="rounded-2xl border border-border bg-card shadow-sm">
                <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center">
                    <div className="relative flex-1">
                        <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="ابحث باسم الصنف..."
                            className="pr-9"
                        />
                    </div>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="md:w-48">
                            <SelectValue placeholder="الحالة" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">كل الأصناف</SelectItem>
                            <SelectItem value="out">نفدت تمامًا</SelectItem>
                            <SelectItem value="near">قريبة من الحد</SelectItem>
                        </SelectContent>
                    </Select>
                    <Select value={sortBy} onValueChange={setSortBy}>
                        <SelectTrigger className="md:w-48">
                            <SelectValue placeholder="ترتيب حسب" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="stock_asc">الأقل مخزونًا أولًا</SelectItem>
                            <SelectItem value="stock_desc">الأعلى مخزونًا أولًا</SelectItem>
                            <SelectItem value="name">أبجديًا</SelectItem>
                        </SelectContent>
                    </Select>
                </CardContent>
            </Card>

            <Card className="rounded-2xl border border-border bg-card shadow-sm">
                <CardHeader>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <CardTitle className="text-lg font-black text-foreground">الأصناف التي تحتاج طلب توريد</CardTitle>
                        <Button
                            size="sm"
                            variant="secondary"
                            className="gap-2"
                            disabled={sendingBulk || displayedItems.length === 0}
                            onClick={handleSendBulkAlerts}
                        >
                            {sendingBulk ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                                <Send className="h-3.5 w-3.5" />
                            )}
                            {sendingBulk ? 'جاري إرسال الكل...' : 'إرسال تنبيهات الكل'}
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
                    ) : displayedItems.length === 0 ? (
                        <p className="py-10 text-center text-sm text-muted-foreground">
                            {lowStock.length === 0 ? 'كل الأصناف فوق حد الأمان، لا توجد تنبيهات حاليًا.' : 'لا توجد نتائج مطابقة للبحث أو الفلتر.'}
                        </p>
                    ) : (
                        <div className="space-y-2">
                            {displayedItems.map((p) => (
                                <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-muted/40 px-4 py-3">
                                    <div>
                                        <p className="font-bold text-foreground">{p.product_name}</p>
                                        <p className="text-xs text-muted-foreground">حد الأمان: {p.min_stock_level ?? 5} {p.unit || 'قطعة'}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Badge variant={p.current_stock <= 0 ? 'destructive' : 'secondary'}>
                                            {p.current_stock <= 0 ? 'نفد تمامًا' : `متبقي ${p.current_stock}`}
                                        </Badge>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="gap-1"
                                            disabled={sendingBulk || sendingId === p.id}
                                            onClick={() => handleSendAlert(p)}
                                        >
                                            {sendingId === p.id ? (
                                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                            ) : (
                                                <Send className="h-3.5 w-3.5" />
                                            )}
                                            {sendingId === p.id ? 'جاري الإرسال...' : 'تنبيه واتساب'}
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {notifications.length > 0 && (
                <Card className="rounded-2xl border border-border bg-card shadow-sm">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg font-black text-foreground">
                            <MessageCircle className="h-5 w-5 text-emerald-500" />
                            سجل التنبيهات
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        {notifications.map((n) => (
                            <div key={n.id} className="flex items-center justify-between rounded-2xl border border-border px-4 py-3">
                                <p className="text-sm text-foreground">{n.message}</p>
                                <Button size="sm" variant="ghost" onClick={() => handleMarkRead(n.id)}>تمت المعالجة</Button>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}