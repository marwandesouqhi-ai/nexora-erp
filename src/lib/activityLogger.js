// src/lib/activityLogger.js
import { db } from '../api/firebase';
import { collection, addDoc, serverTimestamp } from '@/data/firestoreCompat';
import { withTenant } from './tenantFirestore';

let cachedIp = '';

// جلب الـ IP مسبقاً لتوفير الوقت
fetch('https://api.ipify.org?format=json')
    .then(res => res.json())
    .then(data => { cachedIp = data.ip; })
    .catch(() => {});

const getClientIp = async () => {
    if (cachedIp) return cachedIp;
    try {
        const response = await fetch('https://api.ipify.org?format=json');
        const data = await response.json();
        cachedIp = data.ip;
        return cachedIp;
    } catch {
        return 'غير معروف';
    }
};

export const logActivity = async (activityData) => {
    try {
        const raw = typeof activityData === 'string'
            ? { action: activityData }
            : activityData || {};

        const user = raw.user && typeof raw.user === 'object' ? raw.user : {};
        const action = String(raw.action ?? 'unknown_action').trim() || 'unknown_action';
        const entityType = String(raw.entity_type ?? 'system').trim() || 'system';
        const details = raw.details == null ? '' : String(raw.details);
        
        const ip_address = raw.ip_address || await getClientIp();
        const device = raw.device || (typeof navigator !== 'undefined' ? navigator.userAgent : 'غير معروف');

        await addDoc(collection(db, 'activity_logs'), withTenant({
            user_id: user.uid || '',
            user_name: user.displayName || user.name || user.email || '',
            user_email: user.email || '',
            action,
            entity_type: entityType,
            details,
            ip_address,
            device,
            timestamp: serverTimestamp(),
        }));
    } catch (error) {
        console.error('خطأ في تسجيل النشاط:', error);
    }
};