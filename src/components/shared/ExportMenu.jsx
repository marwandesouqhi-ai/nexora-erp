import { useState, memo, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { Download, FileSpreadsheet, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/components/ui/use-toast';

/**
 * زرار تصدير بيانات إلى Excel / CSV.
 *
 * Props:
 *  - data: مصفوفة من الكائنات (كل كائن = صف، والمفاتيح = أسماء الأعمدة)
 *  - filename: اسم الملف بدون الامتداد
 *  - title: عنوان يظهر في التلميح (اختياري)
 *  - disabled: تعطيل الزرار (مثلاً عند عدم وجود بيانات مفلترة)
 */
import { exportObjectsToCsv } from '@/utils/exportToCsv';

function ExportMenu({ data = [], filename = 'export', title, disabled = false }) {
    const [loading, setLoading] = useState(false);
    const { toast } = useToast();

    const hasData = Array.isArray(data) && data.length > 0;
    const isDisabled = disabled || !hasData || loading;

    const buildWorkbook = useCallback(() => {
        const worksheet = XLSX.utils.json_to_sheet(data);
        if (!worksheet['!views']) worksheet['!views'] = [];
        worksheet['!views'].push({ RTL: true });
        
        // Auto-size columns to be slightly wider for Arabic text
        const keys = data.length > 0 ? Object.keys(data[0]) : [];
        worksheet['!cols'] = keys.map(() => ({ wch: 20 }));

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
        return workbook;
    }, [data]);

    const handleExport = useCallback(
        (format) => {
            if (isDisabled) return;
            setLoading(true);
            try {
                if (format === 'csv') {
                    // تصدير CSV بترميز UTF-8 BOM لضمان قراءة الحروف العربية في Microsoft Excel
                    exportObjectsToCsv(filename, data);
                    toast({ title: 'تم التصدير بنجاح', description: `${filename}.csv` });
                } else {
                    const workbook = buildWorkbook();
                    XLSX.writeFile(workbook, `${filename}.xlsx`, { bookType: 'xlsx' });
                    toast({ title: 'تم التصدير بنجاح', description: `${filename}.xlsx` });
                }
            } catch (err) {
                console.error('Export failed:', err);
                toast({
                    title: 'فشل التصدير',
                    description: 'حدث خطأ أثناء إنشاء الملف، حاول مرة أخرى.',
                    variant: 'destructive',
                });
            } finally {
                setLoading(false);
            }
        },
        [buildWorkbook, data, filename, isDisabled, toast]
    );

    return (
        <DropdownMenu dir="rtl">
            <DropdownMenuTrigger asChild>
                <Button
                    variant="outline"
                    disabled={isDisabled}
                    title={title || 'تصدير البيانات'}
                    className="gap-2 border-border "
                >
                    {loading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                    )}
                    تصدير
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem onClick={() => handleExport('xlsx')} className="gap-2">
                    <Download className="h-4 w-4" />
                    Excel (.xlsx)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport('csv')} className="gap-2">
                    <Download className="h-4 w-4" />
                    CSV (.csv)
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

export default memo(ExportMenu);