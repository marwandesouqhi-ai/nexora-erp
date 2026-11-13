// src/services/GenericService.js
import { db } from "../firebase/firebaseConfig";
import {
    updateDoc,
    deleteDoc,
    doc,
    getDocs,
    getDoc,
    orderBy,
    serverTimestamp
} from "firebase/firestore";
import { addTenantDoc, createTenantQuery, fetchTenantDocs, withTenant } from '@/lib/tenantFirestore';

// Generic access is deliberately limited to tenant-owned ERP collections.
// Authentication, users, invitations, companies, and audit logs have dedicated
// server-side workflows and must never be reached through this helper.
const TENANT_COLLECTIONS = new Set([
    'accounts', 'attendance', 'cashflow', 'customers', 'debts', 'employees',
    'expenses', 'inventory_adjustments', 'inventory_movements', 'notifications',
    'products', 'purchases', 'returns', 'sales', 'suppliers', 'van_inventory',
    'visits', 'field_expenses', 'field_requests', 'daily_reconciliations',
    'payroll_adjustments', 'salary_payments', 'production_orders', 'profit_reports',
    'settings',
]);

const assertTenantCollection = (collectionName) => {
    if (!TENANT_COLLECTIONS.has(collectionName)) {
        throw new Error(`Unsupported tenant collection: ${collectionName}`);
    }
};

export const GenericService = {
    // 1. إضافة سجل جديد (مثلاً إضافة عميل أو منتج)
    add: async (collectionName, data) => {
        try {
            assertTenantCollection(collectionName);
            const docRef = await addTenantDoc(collectionName, {
                ...data,
                created_at: serverTimestamp(),
            });
            return { success: true, id: docRef.id };
        } catch (error) {
            console.error(`Error adding to ${collectionName}: `, error);
            return { success: false, error };
        }
    },

    // 2. جلب كل البيانات (للمنصات والجداول)
    getAll: async (collectionName) => {
        try {
            assertTenantCollection(collectionName);
            return await fetchTenantDocs(collectionName);
        } catch (error) {
            console.error(`Error getting ${collectionName}: `, error);
            return [];
        }
    },

    // 3. تحديث سجل (مثلاً تعديل سعر منتج أو مديونية عميل)
    update: async (collectionName, id, updatedData) => {
        try {
            assertTenantCollection(collectionName);
            const docRef = doc(db, collectionName, id);
            await updateDoc(docRef, {
                ...updatedData,
                // Never allow an update payload to switch tenant ownership.
                ...withTenant({}),
                updated_at: serverTimestamp(),
            });
            return { success: true };
        } catch (error) {
            console.error(`Error updating ${collectionName}: `, error);
            return { success: false, error };
        }
    },

    // 4. حذف سجل
    delete: async (collectionName, id) => {
        try {
            assertTenantCollection(collectionName);
            await deleteDoc(doc(db, collectionName, id));
            return { success: true };
        } catch (error) {
            console.error(`Error deleting from ${collectionName}: `, error);
            return { success: false, error };
        }
    },

    // 5. جلب سجل واحد بالمعرف
    getById: async (collectionName, id) => {
        try {
            assertTenantCollection(collectionName);
            const docSnap = await getDoc(doc(db, collectionName, id));
            if (docSnap.exists()) {
                return { success: true, data: { id: docSnap.id, ...docSnap.data() } };
            } else {
                return { success: false, error: "Document not found" };
            }
        } catch (error) {
            console.error(`Error getting ${collectionName} by id: `, error);
            return { success: false, error };
        }
    },

    // 6. استعلام متقدم مع شروط
    query: async (collectionName, constraints = [], orderByField = null, orderDirection = 'asc') => {
        try {
            assertTenantCollection(collectionName);
            const queryConstraints = [...constraints];
            if (orderByField) queryConstraints.push(orderBy(orderByField, orderDirection));
            const q = createTenantQuery(collectionName, ...queryConstraints);
            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error(`Error querying ${collectionName}: `, error);
            return [];
        }
    }
};
