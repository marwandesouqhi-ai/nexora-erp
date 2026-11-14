/**
 * محرك تصدير التقارير والجداول إلى Excel / CSV بترميز UTF-8 BOM
 * يضمن عرض النصوص باللغة العربية بدقة 100% داخل برنامج Microsoft Excel
 */

/**
 * تصدير مصفوفة رؤوس وصفوف إلى ملف CSV متوافق بالكامل مع Excel العربي
 * @param {string} filename - اسم الملف بدون أو مع امتداد .csv
 * @param {string[]} headers - عناوين الأعمدة
 * @param {any[][]} rows - صفوف البيانات
 */
export function exportToCsv(filename, headers, rows) {
    const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const headerLine = headers.map(escape).join(",");
    const rowLines = rows.map(r => r.map(escape).join(","));
    const csvContent = "\uFEFF" + [headerLine, ...rowLines].join("\r\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * تحويل كائنات البيانات وتصديرها مباشرة عبر exportToCsv
 * @param {string} filename - اسم الملف
 * @param {Array<Record<string, any>>} data - قائمة الكائنات
 */
export function exportObjectsToCsv(filename, data) {
    if (!Array.isArray(data) || data.length === 0) return;
    const headers = Object.keys(data[0]);
    const rows = data.map(item => headers.map(h => item[h]));
    exportToCsv(filename, headers, rows);
}
