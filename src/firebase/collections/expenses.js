import { db } from "../firebaseConfig";
import { collection, addDoc, doc, updateDoc, increment, serverTimestamp, getDocs, deleteDoc } from "firebase/firestore";

// دالة تسجيل مصروف جديد
export const recordExpense = async (expenseData) => {
    try {
        // 1. تسجيل المصروف في كوليكشن المصاريف
        const expenseRef = await addDoc(collection(db, "expenses"), {
            expense_type: expenseData.category, // (رواتب، إيجار، كهرباء، صيانة)
            amount: Number(expenseData.amount),
            description: expenseData.description || "",
            expense_date: serverTimestamp(),
            paid_by: expenseData.userId, // ID الموظف اللي سجل المصروف
        });

        // 2. تحديث الخزنة (Cashflow) - خروج سيولة بالسالب
        await addDoc(collection(db, "cashflow"), {
            amount: -Number(expenseData.amount), // بالسالب لأنه مصروف
            type: "expense",
            description: `مصروف: ${expenseData.category} - ${expenseData.description}`,
            timestamp: serverTimestamp()
        });

        // 3. تحديث إحصائيات الداشبورد (زيادة إجمالي المصاريف اليومية)
        const statsRef = doc(db, "dashboard_stats", "today_summary");
        await updateDoc(statsRef, {
            "daily_summary.expenses_today": increment(expenseData.amount),
            "daily_summary.net_profit": increment(-expenseData.amount) // المصروف بيقلل صافي الربح فوراً
        });

        return { success: true, id: expenseRef.id };
    } catch (error) {
        console.error("Expense Recording Error: ", error);
        return { success: false, error };
    }
};

// دالة جلب كل المصاريف
export const getExpenses = async () => {
    try {
        const querySnapshot = await getDocs(collection(db, "expenses"));
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error("Error getting expenses: ", error);
        return [];
    }
};

// دالة تحديث مصروف
export const updateExpense = async (id, updatedData) => {
    try {
        const docRef = doc(db, "expenses", id);
        await updateDoc(docRef, {
            ...updatedData,
            updated_at: serverTimestamp(),
        });
        return { success: true };
    } catch (error) {
        console.error("Error updating expense: ", error);
        return { success: false, error };
    }
};

// دالة حذف مصروف
export const deleteExpense = async (id) => {
    try {
        await deleteDoc(doc(db, "expenses", id));
        return { success: true };
    } catch (error) {
        console.error("Error deleting expense: ", error);
        return { success: false, error };
    }
};