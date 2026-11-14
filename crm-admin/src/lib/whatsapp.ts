/**
 * رقم واتساب إدارة الشركة — نفس قواعد التوحيد المستخدمة في Nexora ERP (src/utils/whatsapp.js)
 * يُحفظ في companies/{companyId}.admin_whatsapp بصيغة دولية أرقام فقط (مثال: 201012345678)
 */
export const normalizeWaNumber = (phone?: string | null): string => {
    if (!phone) return '';
    let digits = String(phone)
        .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
        .replace(/\D/g, '');
    if (digits.startsWith('00')) digits = digits.slice(2);
    if (digits.startsWith('0')) digits = `20${digits.slice(1)}`;
    if (digits.length === 10 && digits.startsWith('1')) digits = `20${digits}`;
    return digits;
};

export const isValidWaNumber = (phone?: string | null) => /^\d{10,15}$/.test(normalizeWaNumber(phone));

export const formatWaDisplay = (phone?: string | null): string => {
    const digits = normalizeWaNumber(phone);
    if (!digits) return '';
    if (digits.startsWith('20') && digits.length === 12) return `+20 ${digits.slice(2)}`;
    return `+${digits}`;
};
