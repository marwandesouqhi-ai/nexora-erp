import { useQuery } from '@tanstack/react-query';
import { db } from '@/api/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function Reports() {
    // جلب البيانات (المبيعات)
    const { data: sales = [] } = useQuery({
        queryKey: ['sales-reports'],
        queryFn: async () => {
            const snap = await getDocs(collection(db, 'sales'));
            return snap.docs.map(d => d.data());
        }
    });

    // حساب الإحصائيات
    const stats = sales.reduce((acc, sale) => {
        const saleTotal = Number(sale.total || 0);
        // نفترض أن كل item فيه cost_price مخزن وقت البيع
        const totalCost = sale.items?.reduce((sum, item) => sum + (Number(item.cost_price || 0) * item.quantity), 0) || 0;

        acc.totalSales += saleTotal;
        acc.totalCost += totalCost;
        acc.netProfit += (saleTotal - totalCost);
        return acc;
    }, { totalSales: 0, totalCost: 0, netProfit: 0 });

    const profitMargin = stats.totalSales > 0 ? (stats.netProfit / stats.totalSales) * 100 : 0;

    return (
        <div className="p-6 space-y-6" dir="rtl">
            <h1 className="text-3xl font-black text-slate-800">التقارير المالية</h1>

            {/* Cards الإحصائيات */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="border-none shadow-sm bg-indigo-600 text-white">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium opacity-80">إجمالي المبيعات</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black">{stats.totalSales.toLocaleString()} ج.م</div>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-sm bg-emerald-500 text-white">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium opacity-80">صافي الربح</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black">{stats.netProfit.toLocaleString()} ج.م</div>
                        <p className="text-xs mt-1">هامش ربح: {profitMargin.toFixed(1)}%</p>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-sm bg-slate-900 text-white">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium opacity-80">تكلفة البضاعة المباعة</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black">{stats.totalCost.toLocaleString()} ج.م</div>
                    </CardContent>
                </Card>
            </div>

            {/* الرسم البياني */}
            <Card className="rounded-2xl border-slate-100 shadow-sm">
                <CardHeader>
                    <CardTitle className="text-lg font-bold">تحليل المبيعات والربح</CardTitle>
                </CardHeader>
                <CardContent className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={sales.slice(-7)}> {/* آخر 7 عمليات */}
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="invoice_number" hide />
                            <Tooltip
                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                            />
                            <Bar dataKey="total" name="المبيعات" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>
        </div>
    );
}