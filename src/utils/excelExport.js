/**
 * دوال تصدير البيانات إلى Excel
 */

import * as XLSX from 'xlsx';

/**
 * تصدير البيانات إلى ملف Excel
 */
export function exportToExcel(data, fileName = 'export', sheetName = 'Sheet1') {
    if (!data || data.length === 0) {
        console.error('لا توجد بيانات للتصدير');
        return;
    }

    try {
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, sheetName);

        // RTL Support
        if (!ws['!views']) ws['!views'] = [];
        ws['!views'].push({ RTL: true });

        // تنسيق العمود - تعديل العرض
        ws['!cols'] = Object.keys(data[0]).map(() => ({ wch: 20 }));

        XLSX.writeFile(wb, `${fileName}.xlsx`);
    } catch (error) {
        console.error('خطأ في التصدير:', error);
    }
}

/**
 * تحويل CSV إلى JSON
 */
export function csvToJson(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const csv = e.target.result;
                const lines = csv.split('\n');
                const headers = lines[0].split(',').map(h => h.trim());
                const data = [];

                for (let i = 1; i < lines.length; i++) {
                    if (lines[i].trim() === '') continue;
                    const obj = {};
                    const currentLine = lines[i].split(',');

                    for (let j = 0; j < headers.length; j++) {
                        obj[headers[j]] = currentLine[j]?.trim() || '';
                    }
                    data.push(obj);
                }

                resolve(data);
            } catch (error) {
                reject(error);
            }
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsText(file);
    });
}