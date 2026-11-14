import { db } from '@/api/firebase';
import {
    collection,
    query,
    where,
    doc,
    getDocs,
    setDoc,
    addDoc,
    serverTimestamp,
} from 'firebase/firestore';
import { getActiveCompanyId } from './currentTenant';
import { isSupabaseBackend } from '@/api/backend';
import { fetchRows, insertRow, upsertRow } from '@/data/supabaseTenantDb';

/**
 * مرجع مجموعة فايربيس
 */
export const getColRef = (collectionName) => collection(db, collectionName);

/**
 * إضافة معرف الشركة والتاريخ تلقائياً لأي سجل جديد
 */
export const withTenant = (data = {}) => {
    const activeCompanyId = getActiveCompanyId();
    if (!activeCompanyId) {
        throw new Error('لا توجد شركة نشطة. لا يمكن تنفيذ عملية على بيانات الشركة.');
    }
    return {
        ...data,
        // Never accept a tenant supplied by a UI payload. The active company is
        // derived from the signed-in profile, while Firestore Rules verify it.
        company_id: activeCompanyId,
        updated_at: isSupabaseBackend ? new Date().toISOString() : serverTimestamp(),
    };
};

/**
 * إنشاء استعلام محمي ومفلتر إجبارياً برقم الشركة النشطة
 */
export const createTenantQuery = (collectionName, ...additionalConstraints) => {
    const activeCompanyId = getActiveCompanyId();
    if (isSupabaseBackend) {
        // Constraints come from the firestoreCompat helpers (where/orderBy descriptors).
        // The company filter is applied by fetchRows and enforced by RLS.
        return { __sb: 'query', name: collectionName, constraints: additionalConstraints };
    }
    const colRef = collection(db, collectionName);
    if (!activeCompanyId) {
        // حماية أمنية: إذا لم يتوفر رقم شركة نشطة، يتم إرجاع استعلام فارغ يمنع تسريب البيانات
        return query(colRef, where('company_id', '==', '__NO_TENANT_ACCESS__'));
    }
    return query(colRef, where('company_id', '==', activeCompanyId), ...additionalConstraints);
};

/**
 * جلب مستندات المجموعة الخاصة بالشركة مع حماية تلقائية من أخطاء الفهارس
 */
export const fetchTenantDocs = async (collectionName, options = {}) => {
    const {
        filterFn = null,
        sortFn = null,
        orderByConstraint = null,
        companyId = null,
    } = options;

    // حماية: TanStack Query بيمرر كائن context كأول argument للـ queryFn
    // لذلك نتحقق أن companyId قيمة نصية حقيقية وليس object
    const rawCompanyId = typeof companyId === 'string' ? companyId : null;
    const activeCompanyId = getActiveCompanyId();
    // A browser session is never allowed to switch its data query to an
    // arbitrary organization, even before Firestore Rules reject the request.
    if (!activeCompanyId || (rawCompanyId && rawCompanyId !== activeCompanyId)) {
        return [];
    }
    const targetCompanyId = activeCompanyId;

    if (isSupabaseBackend) {
        // Server-side ordering/index fallbacks are Firestore-only; Postgres orders by created_at.
        try {
            let items = await fetchRows(collectionName, { companyId: targetCompanyId });
            if (filterFn) items = items.filter(filterFn);
            if (sortFn) items = items.sort(sortFn);
            return items;
        } catch (error) {
            console.error(`[tenantDb] Error fetching rows for "${collectionName}":`, error);
            return [];
        }
    }

    const colRef = collection(db, collectionName);

    // 1. محاولة الاستعلام بالترتيب من السيرفر إذا تم توفير قيد ترتيب
    if (orderByConstraint) {
        try {
            const orderedQuery = query(colRef, where('company_id', '==', targetCompanyId), orderByConstraint);
            const snap = await getDocs(orderedQuery);
            let items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
            if (filterFn) items = items.filter(filterFn);
            if (sortFn) items = items.sort(sortFn);
            return items;
        } catch (err) {
            // في حال تطلب الفايربيس فهرساً مركباً (Composite Index)، نتراجع تلقائياً للاستعلام البسيط والترتيب في الذاكرة
            console.warn(`[tenantFirestore] Server-side orderBy failed for "${collectionName}". Falling back to client-side sort:`, err.message);
        }
    }

    // 2. الاستعلام القياسي المفلتر بالشركة (لا يتطلب أبداً فهارس مركبة معقدة)
    try {
        const simpleQuery = query(colRef, where('company_id', '==', targetCompanyId));
        const snap = await getDocs(simpleQuery);
        let items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        if (filterFn) items = items.filter(filterFn);
        if (sortFn) items = items.sort(sortFn);
        return items;
    } catch (error) {
        console.error(`[tenantFirestore] Error fetching documents for "${collectionName}":`, error);
        return [];
    }
};

/**
 * حفظ أو إضافة مستند مع وسم الشركة تلقائياً
 */
export const addTenantDoc = async (collectionName, data) => {
    if (isSupabaseBackend) return await insertRow(collectionName, withTenant(data));
    const payload = withTenant(data);
    payload.created_at = serverTimestamp();
    return await addDoc(collection(db, collectionName), payload);
};

export const setTenantDoc = async (collectionName, docId, data, merge = true) => {
    if (isSupabaseBackend) {
        // Postgres upsert always merges; `merge = false` (full replace) is not supported.
        return await upsertRow(collectionName, docId, withTenant(data));
    }
    const payload = withTenant(data);
    const docRef = doc(db, collectionName, docId);
    return await setDoc(docRef, payload, { merge });
};
