import { useEffect, useState } from 'react';
import { getCompanies } from '../services/companiesService';
import { Users, Building, CreditCard, TrendingUp, LayoutDashboard } from 'lucide-react';
import { PageHero, HeroPill, StatCard } from '../components/page';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

const COLORS = ['#8b5cf6', '#10b981', '#ef4444', '#f59e0b', '#6b7280'];

export function DashboardHome() {
  const [stats, setStats] = useState({ total: 0, active: 0, suspended: 0 });
  const [planData, setPlanData] = useState<{name: string, count: number}[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const companies = await getCompanies();
        setStats({
          total: companies.length,
          active: companies.filter(c => c.status === 'active').length,
          suspended: companies.filter(c => c.status === 'suspended').length,
        });

        const plans = companies.reduce((acc, curr) => {
          const planName = curr.subscription?.plan || 'لا يوجد';
          acc[planName] = (acc[planName] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        setPlanData(Object.keys(plans).map(key => ({ name: key, count: plans[key] })));
      } catch (error) {
        console.error("Failed to fetch stats", error);
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  const displayStats = [
    { name: 'إجمالي العملاء', value: stats.total, icon: Building, color: 'text-blue-600', bg: 'bg-blue-100', gradient: 'from-blue-500 to-blue-600' },
    { name: 'الاشتراكات النشطة', value: stats.active, icon: CreditCard, color: 'text-emerald-600', bg: 'bg-emerald-100', gradient: 'from-emerald-400 to-emerald-600' },
    { name: 'الحسابات المعلقة', value: stats.suspended, icon: Users, color: 'text-rose-600', bg: 'bg-rose-100', gradient: 'from-rose-400 to-rose-600' },
  ];

  const statusData = [
    { name: 'نشط', value: stats.active },
    { name: 'معلق', value: stats.suspended },
    { name: 'أخرى', value: stats.total - stats.active - stats.suspended }
  ].filter(d => d.value > 0);

  if (loading) {
    return (
      <div className="flex h-[80vh] items-center justify-center font-cairo">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-border border-t-primary"></div>
          <p className="text-muted-foreground font-medium">جاري تحميل البيانات...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div>
        
        <PageHero
          icon={LayoutDashboard}
          title="لوحة القيادة"
          subtitle="نظرة شاملة على أداء النظام وإحصائيات العملاء."
          actions={
            <HeroPill icon={TrendingUp} className="border-success/20 bg-success-soft text-success">
              معدل نمو ممتاز هذا الشهر
            </HeroPill>
          }
        />
        
        <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {displayStats.map((stat, idx) => (
            <StatCard
              key={stat.name}
              title={stat.name}
              value={stat.value}
              icon={stat.icon}
              tone={(['blue', 'emerald', 'rose'] as const)[idx] ?? 'indigo'}
              valueClassName={idx === 2 && stat.value > 0 ? 'text-danger' : undefined}
            />
          ))}
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Pie Chart */}
          <div className="premium-card p-6 animate-slide-up" style={{ animationDelay: '0.3s' }}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-foreground">حالة الشركات</h2>
              <span className="text-xs font-medium bg-card-muted text-secondary-text px-2 py-1 rounded-full">الكل</span>
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={100}
                    fill="#8884d8"
                    paddingAngle={4}
                    dataKey="value"
                    stroke="none"
                  >
                    {statusData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontFamily: 'Cairo' }}
                    itemStyle={{ fontWeight: 600 }}
                  />
                  <Legend wrapperStyle={{ fontFamily: 'Cairo', paddingTop: '20px' }} iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Bar Chart */}
          <div className="premium-card p-6 animate-slide-up" style={{ animationDelay: '0.4s' }}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-foreground">توزيع الباقات</h2>
              <span className="text-xs font-medium bg-card-muted text-secondary-text px-2 py-1 rounded-full">الاشتراكات</span>
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={planData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontFamily: 'Cairo' }} dy={10} />
                  <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontFamily: 'Cairo' }} dx={-10} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontFamily: 'Cairo' }}
                    cursor={{ fill: 'rgba(79, 70, 229, 0.05)' }}
                  />
                  <Bar dataKey="count" fill="url(#colorGradient)" radius={[6, 6, 0, 0]} name="عدد الشركات" barSize={40} />
                  <defs>
                    <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#8b5cf6" />
                      <stop offset="100%" stopColor="#4f46e5" />
                    </linearGradient>
                  </defs>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
