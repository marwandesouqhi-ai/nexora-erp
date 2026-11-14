import { db } from "../firebaseConfig";
import { collection, doc, increment, serverTimestamp, runTransaction } from "firebase/firestore";
import { fetchTenantDocs, withTenant } from "@/lib/tenantFirestore";
import { isSupabaseBackend } from "@/api/backend";
import { callRpc } from "@/data/supabaseRpc";

const isToday = (value) => {
    const date = value?.toDate?.() || (value ? new Date(value) : new Date());
    if (Number.isNaN(date.getTime())) return false;
    const now = new Date();
    return date.getFullYear() === now.getFullYear()
        && date.getMonth() === now.getMonth()
        && date.getDate() === now.getDate();
};

export const addNewExpense = async (expenseData) => {
    const amount = Number(expenseData.amount) || 0;
    const category = expenseData.category || expenseData.expense_type || "general";
    const description = expenseData.description || expenseData.note || "";
    const accountId = expenseData.account_id || "";

    try {
        if (isSupabaseBackend) {
            const result = await callRpc('expense_operation', {
                operation: 'create',
                expense_id: null,
                payload: {
                    amount,
                    category,
                    description,
                    account_id: accountId || null,
                    expense_date: expenseData.expense_date instanceof Date
                        ? expenseData.expense_date.toISOString().slice(0, 10)
                        : (expenseData.expense_date || undefined),
                },
            });
            return { success: true, id: result.id };
        }
        const id = await runTransaction(db, async (transaction) => {
            const expenseRef = doc(collection(db, "expenses"));
            const statsRef = doc(db, "dashboard_stats", "today_summary");
            const accountRef = accountId ? doc(db, "accounts", accountId) : null;
            const accountSnap = accountRef ? await transaction.get(accountRef) : null;
            const updateTodayStats = isToday(expenseData.expense_date);
            if (updateTodayStats) await transaction.get(statsRef);

            if (accountRef && !accountSnap.exists()) {
                throw new Error("الحساب المالي غير موجود.");
            }

            transaction.set(expenseRef, withTenant({
                expense_type: category,
                category,
                amount,
                description,
                account_id: accountId,
                expense_date: expenseData.expense_date || serverTimestamp(),
                paid_by: expenseData.userId || expenseData.recorded_by || "",
                created_at: serverTimestamp(),
            }));

            if (accountRef) {
                transaction.update(accountRef, {
                    balance: increment(-amount),
                    updated_at: serverTimestamp(),
                });
            }

            transaction.set(doc(collection(db, "cashflow")), withTenant({
                amount: -amount,
                type: "expense",
                related_document: expenseRef.id,
                entry_type: "original",
                account_id: accountId,
                description: `مصروف: ${category} - ${description}`,
                timestamp: serverTimestamp(),
            }));

            if (updateTodayStats) {
                transaction.set(statsRef, {
                    daily_summary: {
                        expenses_today: increment(amount),
                        net_profit: increment(-amount),
                    },
                }, { merge: true });
            }

            return expenseRef.id;
        });

        return { success: true, id };
    } catch (error) {
        console.error("Expense Recording Error: ", error);
        return { success: false, error };
    }
};

export const recordExpense = async (expenseData) => addNewExpense(expenseData);

export const getExpenses = async (companyId = null) => {
    try {
        return await fetchTenantDocs("expenses", {
            companyId,
            sortFn: (a, b) => {
                const timeA = a.expense_date?.toMillis ? a.expense_date.toMillis() : new Date(a.expense_date || a.created_at || 0).getTime();
                const timeB = b.expense_date?.toMillis ? b.expense_date.toMillis() : new Date(b.expense_date || b.created_at || 0).getTime();
                return timeB - timeA;
            },
        });
    } catch (error) {
        console.error("Error getting expenses: ", error);
        return [];
    }
};

export const updateExpense = async (id, updatedData) => {
    const amount = Number(updatedData.amount) || 0;
    const category = updatedData.category || updatedData.expense_type || "general";
    const description = updatedData.description || updatedData.note || "";
    const accountId = updatedData.account_id || "";

    try {
        if (isSupabaseBackend) {
            await callRpc('expense_operation', {
                operation: 'update',
                expense_id: id,
                payload: { amount, category, description, account_id: accountId || null },
            });
            return { success: true };
        }
        await runTransaction(db, async (transaction) => {
            const expenseRef = doc(db, "expenses", id);
            const statsRef = doc(db, "dashboard_stats", "today_summary");
            const expenseSnap = await transaction.get(expenseRef);
            if (!expenseSnap.exists()) throw new Error("المصروف غير موجود.");

            const previous = expenseSnap.data();
            const previousAmount = Number(previous.amount) || 0;
            const previousAccountId = previous.account_id || "";
            const previousAccountRef = previousAccountId ? doc(db, "accounts", previousAccountId) : null;
            const nextAccountRef = accountId ? doc(db, "accounts", accountId) : null;
            const previousAccountSnap = previousAccountRef ? await transaction.get(previousAccountRef) : null;
            const nextAccountSnap = nextAccountRef && accountId !== previousAccountId ? await transaction.get(nextAccountRef) : previousAccountSnap;
            const updateTodayStats = isToday(previous.expense_date || previous.created_at);
            if (updateTodayStats) await transaction.get(statsRef);

            if (previousAccountRef && !previousAccountSnap.exists()) throw new Error("الحساب السابق غير موجود.");
            if (nextAccountRef && !nextAccountSnap.exists()) throw new Error("الحساب الجديد غير موجود.");

            transaction.update(expenseRef, {
                expense_type: category,
                category,
                amount,
                description,
                account_id: accountId,
                updated_at: serverTimestamp(),
            });

            if (previousAccountRef && previousAccountId === accountId) {
                transaction.update(previousAccountRef, { balance: increment(previousAmount - amount), updated_at: serverTimestamp() });
            } else {
                if (previousAccountRef) transaction.update(previousAccountRef, { balance: increment(previousAmount), updated_at: serverTimestamp() });
                if (nextAccountRef) transaction.update(nextAccountRef, { balance: increment(-amount), updated_at: serverTimestamp() });
            }

            transaction.set(doc(collection(db, "cashflow")), withTenant({
                amount: previousAmount - amount,
                type: "expense_adjustment",
                related_document: id,
                entry_type: "adjustment",
                account_id: accountId,
                description: `تعديل مصروف: ${category} - ${description}`,
                timestamp: serverTimestamp(),
            }));

            if (updateTodayStats) {
                transaction.set(statsRef, {
                    daily_summary: {
                        expenses_today: increment(amount - previousAmount),
                        net_profit: increment(previousAmount - amount),
                    },
                }, { merge: true });
            }
        });
        return { success: true };
    } catch (error) {
        console.error("Error updating expense: ", error);
        return { success: false, error };
    }
};

export const deleteExpenseDoc = async (id) => {
    try {
        if (isSupabaseBackend) {
            await callRpc('expense_operation', {
                operation: 'delete',
                expense_id: id,
                payload: {},
            });
            return { success: true };
        }
        await runTransaction(db, async (transaction) => {
            const expenseRef = doc(db, "expenses", id);
            const statsRef = doc(db, "dashboard_stats", "today_summary");
            const expenseSnap = await transaction.get(expenseRef);
            if (!expenseSnap.exists()) throw new Error("المصروف غير موجود.");

            const expense = expenseSnap.data();
            const amount = Number(expense.amount) || 0;
            const accountRef = expense.account_id ? doc(db, "accounts", expense.account_id) : null;
            const accountSnap = accountRef ? await transaction.get(accountRef) : null;
            const updateTodayStats = isToday(expense.expense_date || expense.created_at);
            if (updateTodayStats) await transaction.get(statsRef);

            if (accountRef && !accountSnap.exists()) throw new Error("الحساب المرتبط غير موجود.");

            transaction.delete(expenseRef);
            if (accountRef) transaction.update(accountRef, { balance: increment(amount), updated_at: serverTimestamp() });
            transaction.set(doc(collection(db, "cashflow")), withTenant({
                amount,
                type: "expense_reversal",
                related_document: id,
                entry_type: "reversal",
                account_id: expense.account_id || "",
                description: `عكس مصروف: ${expense.description || expense.category || "عام"}`,
                timestamp: serverTimestamp(),
            }));
            if (updateTodayStats) {
                transaction.set(statsRef, {
                    daily_summary: {
                        expenses_today: increment(-amount),
                        net_profit: increment(amount),
                    },
                }, { merge: true });
            }
        });
        return { success: true };
    } catch (error) {
        console.error("Error deleting expense: ", error);
        return { success: false, error };
    }
};

export const deleteExpense = deleteExpenseDoc;