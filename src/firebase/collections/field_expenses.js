import { db } from "../firebaseConfig";
import {
    collection,
    doc,
    getDoc,
    updateDoc,
    onSnapshot,
    serverTimestamp,
    increment,
    runTransaction
} from "firebase/firestore";
import { sendRepNotification } from "./notifications";
import { fetchTenantDocs, createTenantQuery, withTenant } from "@/lib/tenantFirestore";

const FIELD_EXPENSES_COLLECTION = "field_expenses";

export const CATEGORY_LABELS = {
    fuel: "بنزين ووقود",
    toll: "كارتات وبوابات",
    maintenance: "صيانة دورية وطارئة",
    hospitality: "ضيافة وإكراميات",
    other: "نثريات ومصروفات أخرى",
};

/**
 * جلب كافة مصروفات وسلف المناديب الميدانية
 */
export const getFieldExpenses = async (companyId = null) => {
    try {
        return await fetchTenantDocs(FIELD_EXPENSES_COLLECTION, {
            companyId,
            sortFn: (a, b) => {
                const timeA = a.created_at?.toMillis ? a.created_at.toMillis() : new Date(a.created_at || a.date || 0).getTime();
                const timeB = b.created_at?.toMillis ? b.created_at.toMillis() : new Date(b.created_at || b.date || 0).getTime();
                return timeB - timeA;
            },
        });
    } catch (error) {
        console.error("Error fetching field expenses:", error);
        return [];
    }
};

/**
 * اشتراك لحظي لمصروفات وسلف المناديب الميدانية
 */
export const subscribeFieldExpenses = (onData, onError) => {
    try {
        const q = createTenantQuery(FIELD_EXPENSES_COLLECTION);
        return onSnapshot(
            q,
            (snap) => {
                const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
                list.sort((a, b) => {
                    const timeA = a.created_at?.toMillis?.() || (a.date ? new Date(a.date).getTime() : 0);
                    const timeB = b.created_at?.toMillis?.() || (b.date ? new Date(b.date).getTime() : 0);
                    return timeB - timeA;
                });
                onData(list);
            },
            (err) => {
                console.error("subscribeFieldExpenses error:", err);
                if (onError) onError(err);
            }
        );
    } catch (error) {
        console.error("subscribeFieldExpenses setup error:", error);
        if (onError) onError(error);
        return () => {};
    }
};

/**
 * اعتماد مصروف ميداني وخصمه من حساب الخزينة المالي
 */
export const approveFieldExpense = async (expenseId, { accountId, approvedBy = "الإدارة المالية", notes = "" }) => {
    try {
        const result = await runTransaction(db, async (transaction) => {
            const expenseRef = doc(db, FIELD_EXPENSES_COLLECTION, expenseId);
            const expenseSnap = await transaction.get(expenseRef);
            if (!expenseSnap.exists()) {
                throw new Error("سجل المصروف الميداني غير موجود.");
            }

            const exp = expenseSnap.data();
            const amount = Number(exp.amount) || 0;

            let accountRef = null;
            if (accountId) {
                accountRef = doc(db, "accounts", accountId);
                const accountSnap = await transaction.get(accountRef);
                if (!accountSnap.exists()) {
                    throw new Error("حساب الخزينة المالي غير موجود.");
                }
            }

            // 1. تحديث حالة المصروف الميداني
            transaction.update(expenseRef, {
                status: "approved",
                account_id: accountId || "",
                approved_by: approvedBy,
                approval_notes: notes || "",
                approved_at: serverTimestamp(),
                updated_at: serverTimestamp(),
            });

            // 2. خصم المبلغ من الخزينة إن حُدد حساب
            if (accountRef) {
                transaction.update(accountRef, {
                    balance: increment(-amount),
                    updated_at: serverTimestamp(),
                });

                // 3. تسجيل حركة التدفق المالي cashflow
                const cashflowRef = doc(collection(db, "cashflow"));
                const categoryName = CATEGORY_LABELS[exp.category] || exp.category || "مصروف ميداني";
                transaction.set(cashflowRef, withTenant({
                    amount: -amount,
                    type: "expense",
                    sub_type: "field_expense",
                    related_document: expenseId,
                    account_id: accountId,
                    description: `مصروف ميداني معتمد للمندوب ${exp.employee_name || ''} (${categoryName}): ${exp.notes || ''}`,
                    timestamp: serverTimestamp(),
                }));
            }

            // 4. تحديث إحصائيات لوحة التحكم المركزية
            const statsRef = doc(db, "dashboard_stats", "today_summary");
            transaction.set(statsRef, {
                daily_summary: {
                    expenses_today: increment(amount),
                    net_profit: increment(-amount),
                },
            }, { merge: true });

            return { success: true, employeeId: exp.employee_id, amount, category: exp.category };
        });

        // إرسال تنبيه موجه للمندوب على تطبيقه الميداني
        if (result.employeeId) {
            const catLabel = CATEGORY_LABELS[result.category] || "المصروف";
            await sendRepNotification({
                targetEmployeeId: result.employeeId,
                title: "تم اعتماد المصروف الميداني",
                body: `تم اعتماد طلب المصروف (${catLabel}) بقيمة ${result.amount} جنيه بنجاح وإدراجه بالخزينة.`,
                type: "expense_approved",
                metadata: { expenseId }
            });
        }

        return { success: true };
    } catch (error) {
        console.error("Error approving field expense:", error);
        return { success: false, error: error.message || error };
    }
};

/**
 * رفض مصروف ميداني مع كتابة سبب الرفض
 */
export const rejectFieldExpense = async (expenseId, { rejectionReason, rejectedBy = "الإدارة المالية" }) => {
    try {
        if (!rejectionReason || !rejectionReason.trim()) {
            throw new Error("يجب توضيح سبب الرفض للمندوب.");
        }

        const expenseRef = doc(db, FIELD_EXPENSES_COLLECTION, expenseId);
        const expenseSnap = await getDoc(expenseRef);
        const expData = expenseSnap.exists() ? expenseSnap.data() : null;

        await updateDoc(expenseRef, {
            status: "rejected",
            rejection_reason: rejectionReason.trim(),
            rejected_by: rejectedBy,
            rejected_at: serverTimestamp(),
            updated_at: serverTimestamp(),
        });

        // إرسال تنبيه موجه للمندوب لإعلامه بسبب الرفض
        if (expData && expData.employee_id) {
            const catLabel = CATEGORY_LABELS[expData.category] || "المصروف الميداني";
            await sendRepNotification({
                targetEmployeeId: expData.employee_id,
                title: "تم رفض المصروف الميداني",
                body: `تم رفض طلب مصروف (${catLabel}) بمبلغ ${expData.amount} جنيه. السبب: ${rejectionReason.trim()}`,
                type: "rejection",
                metadata: { expenseId, rejectionReason }
            });
        }

        return { success: true };
    } catch (error) {
        console.error("Error rejecting field expense:", error);
        return { success: false, error: error.message || error };
    }
};
