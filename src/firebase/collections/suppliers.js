import { db } from "../firebaseConfig";
import {
    collection,
    addDoc,
    doc,
    getDoc,
    updateDoc,
    deleteDoc,
    serverTimestamp,
} from "firebase/firestore";
import { fetchTenantDocs, withTenant } from "@/lib/tenantFirestore";

const suppliersCollection = collection(db, "suppliers");

// دالة إضافة مورد جديد
export const addNewSupplier = async (supplierData) => {
    try {
        const normalizedBalance = Number(supplierData.current_balance) || 0;
        const newSupplier = withTenant({
            name: supplierData.name?.trim() || "",
            company: supplierData.company?.trim() || "",
            whatsapp: supplierData.whatsapp?.trim() || "",
            phone: supplierData.phone?.trim() || "",
            email: supplierData.email?.trim() || "",
            address: supplierData.address?.trim() || "",
            notes: supplierData.notes?.trim() || "",
            category: supplierData.category?.trim() || "عام",
            current_balance: normalizedBalance,
            total_purchases_value: 0,
            is_active: supplierData.is_active !== false,
            created_at: serverTimestamp(),
            updated_at: serverTimestamp(),
            last_transaction_date: null,
        });

        const docRef = await addDoc(suppliersCollection, newSupplier);
        return { success: true, id: docRef.id };
    } catch (error) {
        console.error("Error adding supplier: ", error);
        return { success: false, error };
    }
};

// دالة جلب كل الموردين مرتبة بالاسم
export const getSuppliers = async (companyId = null) => {
    try {
        return await fetchTenantDocs("suppliers", {
            companyId,
            sortFn: (a, b) => (a.name || "").localeCompare(b.name || ""),
        });
    } catch (error) {
        console.error("Error getting suppliers: ", error);
        return [];
    }
};

// دالة جلب الموردين النشطين فقط
export async function getActiveSuppliers(companyId = null) {
    try {
        return await fetchTenantDocs("suppliers", {
            companyId,
            filterFn: (s) => s.is_active !== false,
            sortFn: (a, b) => (a.name || "").localeCompare(b.name || ""),
        });
    } catch (error) {
        console.error("Error getting active suppliers: ", error);
        return [];
    }
}

// دالة جلب مورد حسب المعرف
export const getSupplierById = async (id) => {
    try {
        const docRef = doc(db, "suppliers", id);
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) return null;
        return { id: docSnap.id, ...docSnap.data() };
    } catch (error) {
        console.error("Error getting supplier by id: ", error);
        return null;
    }
};

// دالة تحديث مورد
export const updateSupplier = async (id, updatedData) => {
    try {
        const docRef = doc(db, "suppliers", id);
        await updateDoc(docRef, {
            ...updatedData,
            updated_at: serverTimestamp(),
        });
        return { success: true };
    } catch (error) {
        console.error("Error updating supplier: ", error);
        return { success: false, error };
    }
};

// دالة حذف مورد
export const deleteSupplierDoc = async (id) => {
    try {
        await deleteDoc(doc(db, "suppliers", id));
        return { success: true };
    } catch (error) {
        console.error("Error deleting supplier: ", error);
        return { success: false, error };
    }
};