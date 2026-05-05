import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { db } from '@/api/firebase';
import { collection, getDocs, query, orderBy, limit, startAfter } from 'firebase/firestore';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import {
    History, Search, User as UserIcon, Activity,
    Clock, Filter, Trash2, PlusCircle, AlertCircle, RefreshCcw
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const getActionStyles = (action) => {
    if (action.includes('حذف')) return { icon: <Trash2 className="w-4 h-4" />, color: 'bg-red-500/10 text-red-600 border-red-200' };
    if (action.includes('إنشاء') || action.includes('إضافة')) return { icon: <PlusCircle className="w-4 h-4" />, color: 'bg-emerald-500/10 text-emerald-600 border-emerald-200' };
    return { icon: <Activity className="w-4 h-4" />, color: 'bg-indigo-500/10 text-indigo-600 border-indigo-200' };
};

export default function ActivityLog() {
    const [search, setSearch] = useState('');
    const [filterType, setFilterType] = useState('all');
    const qc = useQueryClient();

    const { data: logs = [], isLoading, isError, refetch } = useQuery({
        queryKey: ['activity_logs'],
        queryFn: async () => {
            const q = query(collection(db, 'activity_logs'), orderBy('timestamp', 'desc'), limit(50));
            const snap = await getDocs(q);
            return snap.docs.map(d => ({
                id: d.id,
                ...d.data(),
                date: d.data().timestamp?.toDate()
            }));
        }
    });

    const filteredLogs = logs.filter(log => {
        const matchesSearch = log.user?.toLowerCase().includes(search.toLowerCase()) ||
            log.details?.toLowerCase().includes(search.toLowerCase());
        const matchesType = filterType === 'all' ||
            (filterType === 'delete' && log.action.includes('حذف')) ||
            (filterType === 'create' && (log.action.includes('إضافة') || log.action.includes('إنشاء')));
        return matchesSearch && matchesType;
    });

    return (
        <div className="space-y-6" dir="rtl">
            {/* Header */}
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-wrap justify-between items-center gap-4">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-100">
                        <History className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-slate-800 tracking-tight">سجل الرقابة</h1>
                        <p className="text-sm text-slate-500 font-medium">تتبع نشاطات المستخدمين والعمليات الحساسة</p>
                    </div>
                </div>
                <Button variant="outline" onClick={() => refetch()} className="gap-2 text-slate-600 border-slate-200">
                    <RefreshCcw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} /> تحديث السجل
                </Button>
            </div>

            {/* Toolbar */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-3 relative">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <Input
                        placeholder="ابحث عن يوزر، عملية، أو تفاصيل الفاتورة..."
                        className="pr-10 bg-white border-slate-200 focus:ring-2 focus:ring-indigo-500/20"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <Select value={filterType} onValueChange={setFilterType}>
                    <SelectTrigger className="bg-white border-slate-200">
                        <div className="flex items-center gap-2">
                            <Filter className="w-4 h-4 text-indigo-600" />
                            <SelectValue placeholder="نوع العملية" />
                        </div>
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">جميع العمليات</SelectItem>
                        <SelectItem value="create">عمليات الإضافة</SelectItem>
                        <SelectItem value="delete">عمليات الحذف</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Main Content */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                {isLoading ? (
                    <div className="p-24 text-center">
                        <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-indigo-500 border-t-transparent"></div>
                        <p className="mt-4 text-slate-500 font-bold">جاري مراجعة السجلات...</p>
                    </div>
                ) : isError ? (
                    <div className="p-20 text-center space-y-4">
                        <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
                        <p className="text-slate-800 font-bold">حدث خطأ أثناء تحميل البيانات</p>
                        <Button onClick={() => refetch()}>إعادة المحاولة</Button>
                    </div>
                ) : filteredLogs.length === 0 ? (
                    <div className="p-24 text-center">
                        <div className="bg-slate-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Search className="w-8 h-8 text-slate-300" />
                        </div>
                        <p className="text-slate-500 font-bold text-lg">لم يتم العثور على أي سجلات</p>
                        <p className="text-slate-400 text-sm">جرب تغيير كلمات البحث أو الفلاتر</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-right border-collapse">
                            <thead>
                                <tr className="bg-slate-50/50 border-b border-slate-100">
                                    <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase">المستخدم</th>
                                    <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase">العملية</th>
                                    <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase">التفاصيل</th>
                                    <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase">التوقيت</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {filteredLogs.map((log) => {
                                    const style = getActionStyles(log.action);
                                    return (
                                        <tr key={log.id} className="hover:bg-slate-50/50 transition-colors group">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                                                        <UserIcon className="w-4 h-4" />
                                                    </div>
                                                    <span className="font-bold text-slate-700 text-sm">{log.user}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <Badge className={`${style.color} border shadow-none px-2 py-1 gap-1.5`}>
                                                    {style.icon}
                                                    {log.action}
                                                </Badge>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-600 font-medium">
                                                {log.details}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-bold text-slate-700">
                                                        {log.date ? format(log.date, 'dd MMMM yyyy', { locale: ar }) : '—'}
                                                    </span>
                                                    <span className="text-[10px] text-slate-400 font-mono">
                                                        {log.date ? format(log.date, 'hh:mm:ss a', { locale: ar }) : '—'}
                                                    </span>
                                                </div>
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
    );
}