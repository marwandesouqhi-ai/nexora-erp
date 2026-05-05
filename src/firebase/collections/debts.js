import { db } from "../firebaseConfig";
import { collection, addDoc, doc, updateDoc, increment, serverTimestamp, getDocs, deleteDoc } from "firebase/firestore";

// دالة تسجيل عملية دفع أو تحصيل دين
export const recordDebtTransaction = async (debtData) => {
    try {
        // 1. تسجيل العملية في كوليكشن الديون (سجل المدفوعات)
        const debtRef = await addDoc(collection(db, "debts"), {
            party_id: debtData.partyId,       // ID العميل أو المورد
            party_name: debtData.partyName,   // اسم الطرف
            type: debtData.type,              // "customer_collection" أو "supplier_payment"
            amount_paid: Number(debtData.amount),
            payment_method: debtData.method,  // (cash, bank_transfer)
            transaction_date: serverTimestamp(),
            notes: debtData.notes || ""
        });

        // 2. تحديث الرصيد الحالي (Current Balance) في الكوليكشن المناسب
        const targetCollection = debtData.type === "customer_collection" ? "customers" : "suppliers";
        const partyRef = doc(db, targetCollection, debtData.partyId);

        // لو تحصيل من عميل: بنقلل مديونيته (بالسالب)
        // لو دفع لمورد: بنقلل اللي علينا ليه (بالسالب)
        await updateDoc(partyRef, {
            current_balance: increment(-debtData.amount),
            last_update: serverTimestamp()
        });

        // 3. تحديث الخزنة (Cashflow)
        // التحصيل من عميل = دخول فلوس (+) | الدفع لمورد = خروج فلوس (-)
        const cashEffect = debtData.type === "customer_collection" ? debtData.amount : -debtData.amount;
        const cashflowRef = await addDoc(collection(db, "cashflow"), {
            amount: cashEffect,
            type: debtData.type,
            description: `تسوية دين: ${debtData.partyName}`,
            timestamp: serverTimestamp()
        });

        return { success: true, id: debtRef.id };
    } catch (error) {
        console.error("Debt Transaction Error: ", error);
        return { success: false, error };
    }
};

// دالة جلب كل الديون
export const getDebts = async () => {
    try {
        const querySnapshot = await getDocs(collection(db, "debts"));
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error("Error getting debts: ", error);
        return [];
    }
};

// دالة تحديث دين
export const updateDebt = async (id, updatedData) => {
    try {
        const docRef = doc(db, "debts", id);
        await updateDoc(docRef, {
            ...updatedData,
            updated_at: serverTimestamp(),
        });
        return { success: true };
    } catch (error) {
        console.error("Error updating debt: ", error);
        return { success: false, error };
    }
};

// دالة حذف دين
export const deleteDebt = async (id) => {
    try {
        await deleteDoc(doc(db, "debts", id));
        return { success: true };
    } catch (error) {
        console.error("Error deleting debt: ", error);
        return { success: false, error };
    }
};