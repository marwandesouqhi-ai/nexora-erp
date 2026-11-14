import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { db, firebaseConfig } from '../api/firebase';
import { isSupabaseBackend } from '../api/backend';
import { callFunction } from '../api/functions';
import {
    collection,
    doc,
    getDoc,
    getDocs,
    setDoc,
    updateDoc,
    query,
    where,
    orderBy,
    serverTimestamp,
    Timestamp,
} from 'firebase/firestore';
import { SUBSCRIPTION_PLANS, SUBSCRIPTION_STATUS, getPlanFeatures } from '../config/subscriptionPlans';

const TENANTS_COLLECTION = 'companies';

/**
 * جلب جميع الشركات المسجلة في المنصة (خاص بلوحة تحكم Super Admin)
 */
export const getAllTenants = async () => {
    try {
        const q = query(collection(db, TENANTS_COLLECTION), orderBy('created_at', 'desc'));
        const snap = await getDocs(q);
        return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch (error) {
        console.error('Error fetching all tenants:', error);
        return [];
    }
};

/**
 * جلب بيانات شركة محددة برقمها
 */
export const getTenantById = async (tenantId) => {
    if (!tenantId) return null;
    try {
        const docRef = doc(db, TENANTS_COLLECTION, tenantId);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
            return { id: snap.id, ...snap.data() };
        }
        return null;
    } catch (error) {
        console.error(`Error fetching tenant ${tenantId}:`, error);
        return null;
    }
};

/**
 * إنشاء شركة جديدة في المنصة
 * @param {Object} tenantData بيانات الشركة
 * @param {Object} ownerData بيانات مالك الشركة
 */
export const createTenant = async (tenantData, ownerData = {}) => {
    try {
        const plan = SUBSCRIPTION_PLANS[tenantData.plan_id] || SUBSCRIPTION_PLANS.basic;
        
        // حساب تاريخ انتهاء الاشتراك
        const durationMonths = Number(tenantData.duration_months) || 1;
        const now = new Date();
        const expiresAtDate = new Date();
        expiresAtDate.setMonth(expiresAtDate.getMonth() + durationMonths);

        const tenantDocRef = doc(collection(db, TENANTS_COLLECTION));
        const tenantId = tenantDocRef.id;

        const newTenant = {
            id: tenantId,
            name: tenantData.name?.trim() || 'شركة جديدة',
            commercial_name: tenantData.commercial_name?.trim() || tenantData.name?.trim() || '',
            owner_name: ownerData.name?.trim() || '',
            owner_email: (ownerData.email || tenantData.owner_email || '').toLowerCase().trim(),
            owner_phone: ownerData.phone || tenantData.phone || '',
            phone: tenantData.phone || '',
            address: tenantData.address || '',
            currency: tenantData.currency || 'EGP',
            tax_rate: Number(tenantData.tax_rate) || 0,
            status: SUBSCRIPTION_STATUS.ACTIVE,
            suspended_reason: '',
            notes: tenantData.notes || '',
            created_at: serverTimestamp(),
            last_updated: serverTimestamp(),

            // بيانات الاشتراك
            subscription: {
                plan_id: plan.id,
                plan_name: plan.name,
                status: SUBSCRIPTION_STATUS.ACTIVE,
                billing_cycle: tenantData.billing_cycle || (durationMonths >= 12 ? 'yearly' : 'monthly'),
                start_date: Timestamp.fromDate(now),
                expires_at: Timestamp.fromDate(expiresAtDate),
                price_paid: Number(tenantData.price_paid) || (durationMonths >= 12 ? plan.yearlyPrice : plan.monthlyPrice * durationMonths),
                features: getPlanFeatures(plan.id, tenantData.custom_features),
                custom_overrides: Array.isArray(tenantData.custom_features) ? tenantData.custom_features : null,
                limits: { ...plan.limits, ...(tenantData.custom_limits || {}) },
                history: [
                    {
                        type: 'initial_creation',
                        action: 'اشتراك جديد',
                        date: Timestamp.fromDate(now),
                        plan_id: plan.id,
                        months: durationMonths,
                        price: Number(tenantData.price_paid) || 0,
                    }
                ]
            }
        };

        await setDoc(tenantDocRef, newTenant);

        let createdUser = null;
        let userWarning = null;

        // إذا تم طلب إنشاء حساب دخول للمالك فوراً
        if (ownerData.create_login && ownerData.email && ownerData.password) {
            try {
                const userRes = await createTenantUserAccount({
                    tenantId,
                    tenantName: newTenant.name,
                    name: ownerData.name || newTenant.name,
                    email: ownerData.email,
                    password: ownerData.password,
                    phone: ownerData.phone,
                    role: 'owner',
                });
                createdUser = userRes.user;
                newTenant.owner_uid = userRes.uid;
            } catch (uErr) {
                console.warn('Tenant created but initial user account creation failed:', uErr);
                userWarning = uErr.message;
            }
        } else if (ownerData.uid) {
            // إنشاء أو تحديث مستند مالك الشركة في Firestore إذا كان الـ UID متوفراً مسبقاً
            const userRef = doc(db, 'users', ownerData.uid);
            await setDoc(userRef, {
                uid: ownerData.uid,
                email: ownerData.email.toLowerCase().trim(),
                name: ownerData.name || 'مالك الشركة',
                phone: ownerData.phone || '',
                role: 'owner',
                company_id: tenantId,
                company_name: newTenant.name,
                is_active: true,
                created_at: serverTimestamp(),
            }, { merge: true });
        }

        return {
            success: true,
            tenantId,
            tenant: newTenant,
            createdUser,
            userWarning,
        };
    } catch (error) {
        console.error('Error creating tenant:', error);
        return { success: false, error: error.message || 'فشل في إنشاء الشركة' };
    }
};

/**
 * إنشاء حساب تسجيل دخول جديد لمستخدم تابع لشركة (المالك أو مدير)
 * يتم استخدام تطبيق Firebase ثانوي مؤقت لتفادي تسجيل خروج الـ Super Admin الحالي
 */
export const createTenantUserAccount = async ({
    tenantId,
    tenantName,
    name,
    email,
    password,
    phone = '',
    role = 'owner',
}) => {
    if (!email || !email.trim()) {
        throw new Error('البريد الإلكتروني مطلوب.');
    }
    if (!password || password.length < 6) {
        throw new Error('كلمة المرور يجب ألا تقل عن 6 أحرف.');
    }
    if (!tenantId) {
        throw new Error('رقم الشركة التعريفي مطلوب.');
    }

    const cleanEmail = email.trim().toLowerCase();

    if (isSupabaseBackend) {
        // Created server-side (service role); the caller must be a platform admin or a user manager.
        try {
            const created = await callFunction('createManagedUser', {
                name: name?.trim() || 'مسؤول الشركة',
                email: cleanEmail,
                password,
                phone: phone?.trim() || '',
                role: role || 'owner',
                company_id: tenantId,
                status: 'active',
            });
            return { success: true, uid: created.id, user: { uid: created.id, email: cleanEmail, role, company_id: tenantId } };
        } catch (error) {
            throw new Error(error.message || 'فشل إنشاء حساب المستخدم', { cause: error });
        }
    }

    const secondaryAppName = `TenantUserCreation_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
    const secondaryAuth = getAuth(secondaryApp);

    try {
        // 1. إنشاء الحساب في Firebase Authentication
        const cred = await createUserWithEmailAndPassword(secondaryAuth, cleanEmail, password);
        const uid = cred.user.uid;

        // تسجيل الخروج وحذف التطبيق الثانوي فوراً
        await signOut(secondaryAuth);
        await deleteApp(secondaryApp);

        // 2. إنشاء مستند المستخدم في Firestore
        const userDoc = {
            uid,
            name: name?.trim() || 'مسؤول الشركة',
            email: cleanEmail,
            phone: phone?.trim() || '',
            role: role || 'owner',
            company_id: tenantId,
            company_name: tenantName || '',
            status: 'active',
            is_active: true,
            created_at: serverTimestamp(),
            updated_at: serverTimestamp(),
        };

        await setDoc(doc(db, 'users', uid), userDoc, { merge: true });

        // 3. ربط مالك الشركة بمستند الشركة إذا كان الدور owner
        if (role === 'owner') {
            await updateDoc(doc(db, TENANTS_COLLECTION, tenantId), {
                owner_uid: uid,
                owner_name: userDoc.name,
                owner_email: cleanEmail,
                owner_phone: userDoc.phone,
                last_updated: serverTimestamp(),
            }).catch((err) => console.warn('Could not update company owner ref:', err));
        }

        return { success: true, uid, user: userDoc };
    } catch (error) {
        try {
            await deleteApp(secondaryApp);
        } catch {
            // ignore
        }

        if (error.code === 'auth/email-already-in-use') {
            throw new Error('هذا البريد الإلكتروني مسجل بالفعل لمستخدم آخر في النظام.', { cause: error });
        }
        if (error.code === 'auth/weak-password') {
            throw new Error('كلمة المرور ضعيفة جداً. يرجى اختيار كلمة مرور أقوى (6 أحرف على الأقل).', { cause: error });
        }
        if (error.code === 'auth/invalid-email') {
            throw new Error('صيغة البريد الإلكتروني غير صحيحة.', { cause: error });
        }
        throw new Error(error.message || 'فشل إنشاء حساب المستخدم', { cause: error });
    }
};

/**
 * جلب جميع مستخدمي شركة محددة
 */
export const getTenantUsers = async (tenantId) => {
    if (!tenantId) return [];
    try {
        const q = query(collection(db, 'users'), where('company_id', '==', tenantId));
        const snap = await getDocs(q);
        return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch (error) {
        console.error(`Error fetching users for tenant ${tenantId}:`, error);
        return [];
    }
};

/**
 * تجديد اشتراك الشركة
 * @param {string} tenantId رقم الشركة
 * @param {number} monthsCount عدد شهور التجديد
 * @param {number} pricePaid المبلغ المدفوع
 * @param {Date|null} customExpiryDate تاريخ مخصص اختياري
 */
export const renewTenantSubscription = async (tenantId, monthsCount = 1, pricePaid = 0, customExpiryDate = null) => {
    try {
        const tenant = await getTenantById(tenantId);
        if (!tenant) throw new Error('الشركة غير موجودة');

        const currentExpiresAt = tenant.subscription?.expires_at?.toDate
            ? tenant.subscription.expires_at.toDate()
            : new Date();
        
        // لو كان منتهي، نبدأ من تاريخ اليوم، وإلا نمدد على التاريخ السابق
        const baseDate = currentExpiresAt > new Date() ? currentExpiresAt : new Date();
        const newExpiryDate = customExpiryDate instanceof Date
            ? customExpiryDate
            : new Date(baseDate.setMonth(baseDate.getMonth() + Number(monthsCount)));

        const historyItem = {
            type: 'renewal',
            action: `تجديد لمدة ${monthsCount} شهر`,
            date: Timestamp.fromDate(new Date()),
            months: Number(monthsCount),
            price: Number(pricePaid) || 0,
            expires_at: Timestamp.fromDate(newExpiryDate),
        };

        const existingHistory = Array.isArray(tenant.subscription?.history) ? tenant.subscription.history : [];

        const updateData = {
            status: SUBSCRIPTION_STATUS.ACTIVE,
            suspended_reason: '',
            last_updated: serverTimestamp(),
            'subscription.status': SUBSCRIPTION_STATUS.ACTIVE,
            'subscription.expires_at': Timestamp.fromDate(newExpiryDate),
            'subscription.price_paid': Number(pricePaid),
            'subscription.history': [historyItem, ...existingHistory],
        };

        await updateDoc(doc(db, TENANTS_COLLECTION, tenantId), updateData);
        return { success: true, newExpiryDate };
    } catch (error) {
        console.error('Error renewing subscription:', error);
        return { success: false, error: error.message };
    }
};

/**
 * إيقاف الاشتراك مؤقتاً
 * @param {string} tenantId رقم الشركة
 * @param {string} reason سبب الإيقاف
 */
export const pauseTenantSubscription = async (tenantId, reason = 'إيقاف مؤقت من قبل إدارة النظام') => {
    try {
        const tenantRef = doc(db, TENANTS_COLLECTION, tenantId);
        await updateDoc(tenantRef, {
            status: SUBSCRIPTION_STATUS.PAUSED,
            suspended_reason: reason,
            last_updated: serverTimestamp(),
            'subscription.status': SUBSCRIPTION_STATUS.PAUSED,
        });
        return { success: true };
    } catch (error) {
        console.error('Error pausing subscription:', error);
        return { success: false, error: error.message };
    }
};

/**
 * استئناف تفعيل الاشتراك الموقوف
 * @param {string} tenantId رقم الشركة
 */
export const resumeTenantSubscription = async (tenantId) => {
    try {
        const tenant = await getTenantById(tenantId);
        if (!tenant) throw new Error('الشركة غير موجودة');

        const expiresAt = tenant.subscription?.expires_at?.toDate
            ? tenant.subscription.expires_at.toDate()
            : new Date();
        
        // التحقق إن كان الاشتراك انتهى أصله أم لا
        const isExpired = expiresAt < new Date();
        const newStatus = isExpired ? SUBSCRIPTION_STATUS.EXPIRED : SUBSCRIPTION_STATUS.ACTIVE;

        const tenantRef = doc(db, TENANTS_COLLECTION, tenantId);
        await updateDoc(tenantRef, {
            status: newStatus,
            suspended_reason: '',
            last_updated: serverTimestamp(),
            'subscription.status': newStatus,
        });
        return { success: true, status: newStatus };
    } catch (error) {
        console.error('Error resuming subscription:', error);
        return { success: false, error: error.message };
    }
};

/**
 * إلغاء اشتراك الشركة نهائياً
 * @param {string} tenantId رقم الشركة
 * @param {string} reason سبب الإلغاء
 */
export const cancelTenantSubscription = async (tenantId, reason = 'تم إلغاء الاشتراك') => {
    try {
        const tenantRef = doc(db, TENANTS_COLLECTION, tenantId);
        await updateDoc(tenantRef, {
            status: SUBSCRIPTION_STATUS.CANCELLED,
            suspended_reason: reason,
            last_updated: serverTimestamp(),
            'subscription.status': SUBSCRIPTION_STATUS.CANCELLED,
        });
        return { success: true };
    } catch (error) {
        console.error('Error cancelling subscription:', error);
        return { success: false, error: error.message };
    }
};

/**
 * تغيير باقة الشركة أو تعديل ميزاتها المخصصة
 * @param {string} tenantId رقم الشركة
 * @param {string} planId الباقة الجديدة
 * @param {Array|null} customFeatures مصفوفة ميزات مخصصة (اختياري)
 */
export const updateTenantPlanAndFeatures = async (tenantId, planId, customFeatures = null) => {
    try {
        const plan = SUBSCRIPTION_PLANS[planId] || SUBSCRIPTION_PLANS.custom;
        const features = Array.isArray(customFeatures) && customFeatures.length > 0
            ? customFeatures
            : plan.features;

        const tenantRef = doc(db, TENANTS_COLLECTION, tenantId);
        await updateDoc(tenantRef, {
            last_updated: serverTimestamp(),
            'subscription.plan_id': plan.id,
            'subscription.plan_name': plan.name,
            'subscription.features': features,
            'subscription.custom_overrides': Array.isArray(customFeatures) ? customFeatures : null,
            'subscription.limits': plan.limits,
        });
        return { success: true, features };
    } catch (error) {
        console.error('Error updating tenant plan and features:', error);
        return { success: false, error: error.message };
    }
};

/**
 * تحديث بيانات الشركة العامة
 */
export const updateTenantDetails = async (tenantId, updateData) => {
    try {
        const tenantRef = doc(db, TENANTS_COLLECTION, tenantId);
        await updateDoc(tenantRef, {
            ...updateData,
            last_updated: serverTimestamp(),
        });
        return { success: true };
    } catch (error) {
        console.error('Error updating tenant details:', error);
        return { success: false, error: error.message };
    }
};
