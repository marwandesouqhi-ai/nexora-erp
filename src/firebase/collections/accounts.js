import { db } from "../firebaseConfig";
import { collection, addDoc, serverTimestamp, updateDoc, doc, deleteDoc } from "@/data/firestoreCompat";
import { fetchTenantDocs, withTenant } from "@/lib/tenantFirestore";

// دالة إضافة حساب/خزينة جديدة
export const addNewAccount = async (accountData) => {
    try {
        const docRef = await addDoc(collection(db, "accounts"), withTenant({
            name: accountData.name,
            type: accountData.type || "cash",
            balance: Number(accountData.balance) || 0,
            account_number: accountData.account_number || "",
            bank_name: accountData.bank_name || "",
            notes: accountData.notes || "",
            created_at: serverTimestamp(),
        }));
        return { success: true, id: docRef.id };
    } catch (error) {
        console.error("Error adding account: ", error);
        return { success: false, error };
    }
};

// دالة جلب كل الحسابات
export const getAccounts = async (companyId = null) => {
    try {
        return await fetchTenantDocs("accounts", {
            companyId,
            sortFn: (a, b) => (a.name || '').localeCompare(b.name || ''),
        });
    } catch (error) {
        console.error("Error getting accounts: ", error);
        return [];
    }
};

// دالة تحديث بيانات حساب
export const updateAccount = async (id, updatedData) => {
    try {
        const docRef = doc(db, "accounts", id);
        await updateDoc(docRef, {
            ...updatedData,
            balance: Number(updatedData.balance) || 0,
            updated_at: serverTimestamp(),
        });
        return { success: true };
    } catch (error) {
        console.error("Error updating account: ", error);
        return { success: false, error };
    }
};

// دالة حذف حساب
export const deleteAccountDoc = async (id) => {
    try {
        await deleteDoc(doc(db, "accounts", id));
        return { success: true };
    } catch (error) {
        console.error("Error deleting account: ", error);
        return { success: false, error };
    }
};

export const getRecentCashflow = async (limitCount = 100, companyId = null) => {
    try {
        const items = await fetchTenantDocs("cashflow", {
            companyId,
            sortFn: (a, b) => {
                const timeA = a.timestamp?.toMillis ? a.timestamp.toMillis() : new Date(a.timestamp || 0).getTime();
                const timeB = b.timestamp?.toMillis ? b.timestamp.toMillis() : new Date(b.timestamp || 0).getTime();
                return timeB - timeA;
            },
        });
        return items.slice(0, limitCount);
    } catch (error) {
        console.error("Error getting recent cashflow: ", error);
        return [];
    }
};