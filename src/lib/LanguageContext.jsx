import { createContext, useContext, useEffect, useState } from 'react';

const LanguageContext = createContext();

const STORAGE_KEY = 'nexora_lang';

// نصوص أساسية للواجهة، ممكن تتوسع فيها لاحقًا
const translations = {
    ar: {
        dashboard: 'لوحة التحكم',
        pos: 'نقطة البيع',
        inventory: 'المخازن',
        sales: 'المبيعات',
        customers: 'العملاء',
        purchases: 'المشتريات',
        suppliers: 'الموردين',
    },
    en: {
        dashboard: 'Dashboard',
        pos: 'Point of Sale',
        inventory: 'Inventory',
        sales: 'Sales',
        customers: 'Customers',
        purchases: 'Purchases',
        suppliers: 'Suppliers',
    },
};

export const LanguageProvider = ({ children }) => {
    const [language, setLanguage] = useState(() => {
        const saved = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
        return saved === 'en' ? 'en' : 'ar'; // العربية هي اللغة الافتراضية للنظام
    });

    const dir = language === 'ar' ? 'rtl' : 'ltr';

    useEffect(() => {
        document.documentElement.lang = language;
        document.documentElement.dir = dir;
        localStorage.setItem(STORAGE_KEY, language);
    }, [language, dir]);

    const toggleLanguage = () => setLanguage((prev) => (prev === 'ar' ? 'en' : 'ar'));

    // دالة ترجمة بسيطة: t('dashboard') => 'لوحة التحكم' أو 'Dashboard'
    const t = (key) => translations[language]?.[key] ?? key;

    return (
        <LanguageContext.Provider value={{ language, setLanguage, toggleLanguage, dir, t }}>
            {children}
        </LanguageContext.Provider>
    );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useLanguage = () => useContext(LanguageContext);