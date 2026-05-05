// src/services/GenericService.js
import { db } from "../firebaseConfig";
import {
    collection,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    getDocs,
    getDoc,
    query,
    where,
    orderBy,
    serverTimestamp
} from "firebase/firestore";

export const GenericService = {
    // 1. إضافة سجل جديد (مثلاً إضافة عميل أو منتج)
    add: async (collectionName, data) => {
        try {
            const docRef = await addDoc(collection(db, collectionName), {
                ...data,
                created_at: serverTimestamp(),
                updated_at: serverTimestamp(),
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
            const querySnapshot = await getDocs(collection(db, collectionName));
            return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error(`Error getting ${collectionName}: `, error);
            return [];
        }
    },

    // 3. تحديث سجل (مثلاً تعديل سعر منتج أو مديونية عميل)
    update: async (collectionName, id, updatedData) => {
        try {
            const docRef = doc(db, collectionName, id);
            await updateDoc(docRef, {
                ...updatedData,
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
            let q = collection(db, collectionName);
            if (constraints.length > 0 || orderByField) {
                const queryConstraints = [...constraints];
                if (orderByField) {
                    queryConstraints.push(orderBy(orderByField, orderDirection));
                }
                q = query(q, ...queryConstraints);
            }
            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error(`Error querying ${collectionName}: `, error);
            return [];
        }
    }
};