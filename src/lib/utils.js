import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * دمج أسماء CSS مع Tailwind
 */
export function cn(...inputs) {
    return twMerge(clsx(inputs));
}

/**
 * تنسيق الأرقام بـ RTL (عربي)
 */
export function formatNumber(number, decimals = 0) {
    return Number(number).toLocaleString('ar-EG', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    });
}

/**
 * تنسيق العملات
 */
export function formatCurrency(amount, currency = 'EGP') {
    const currencySymbols = {
        EGP: 'ج.م',
        USD: '$',
        EUR: '€',
    };
    return `${formatNumber(amount)} ${currencySymbols[currency] || currency}`;
}

/**
 * تحويل ملف إلى Base64
 */
export function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
    });
}

/**
 * التحقق من صحة رقم الهاتف
 */
export function isValidPhone(phone) {
    const phoneRegex = /^(\+20|0)?1[0-2]\d{8}$/;
    return phoneRegex.test(phone.replace(/\s/g, ''));
}

/**
 * التحقق من صحة البريد الإلكتروني
 */
export function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * تجريد المسافات والأحرف الخاصة
 */
export function sanitize(str) {
    return str.trim().replace(/\s+/g, ' ');
}

/**
 * حساب نسبة الخصم
 */
export function calculateDiscountPercent(original, discounted) {
    if (original === 0) return 0;
    return Math.round((1 - discounted / original) * 100);
}

/**
 * تجميع البيانات حسب قيمة معينة
 */
export function groupBy(arr, key) {
    return arr.reduce((acc, obj) => {
        const value = obj[key];
        if (!acc[value]) acc[value] = [];
        acc[value].push(obj);
        return acc;
    }, {});
}

/**
 * الحصول على الفرق بين تاريخين بالأيام
 */
export function daysBetween(date1, date2) {
    const millisecondsPerDay = 24 * 60 * 60 * 1000;
    return Math.floor((date2 - date1) / millisecondsPerDay);
}

/**
 * توليد رقم عشوائي
 */
export function randomBetween(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * توليد معرف فريد
 */
export function generateId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}