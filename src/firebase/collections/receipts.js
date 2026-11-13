import { db } from "../firebaseConfig";
import {
    collection,
    doc,
    getDocs,
    updateDoc,
    query,
    where,
    orderBy,
    onSnapshot,
    serverTimestamp,
    increment,
    runTransaction
} from "firebase/firestore";
import { sendRepNotification } from "./notifications";
import { fetchTenantDocs, createTenantQuery, withTenant } from "@/lib/tenantFirestore";

const RECEIPTS_COLLECTION = "receipts";

export const PAYMENT_METHOD_LABELS = {
    cash: "نقداً (كاش)",
    bank_transfer: "تحويل بنكي",
    cheque: "شيك بنكي",
};

/**
 * جلب كافة سندات التحصيل الميدانية
 */
export const getReceipts = async (companyId = null) => {
    try {
        return await fetchTenantDocs(RECEIPTS_COLLECTION, {
            companyId,
            sortFn: (a, b) => {
                const timeA = a.created_at?.toMillis ? a.created_at.toMillis() : new Date(a.created_at || a.date || 0).getTime();
                const timeB = b.created_at?.toMillis ? b.created_at.toMillis() : new Date(b.created_at || b.date || 0).getTime();
                return timeB - timeA;
            },
        });
    } catch (error) {
        console.error("Error fetching receipts:", error);
        return [];
    }
};

/**
 * اشتراك لحظي لسندات التحصيل الميدانية
 */
export const subscribeReceipts = (onData, onError) => {
    try {
        const q = createTenantQuery(RECEIPTS_COLLECTION);
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
                console.error("subscribeReceipts error:", err);
                if (onError) onError(err);
            }
        );
    } catch (error) {
        console.error("subscribeReceipts setup error:", error);
        if (onError) onError(error);
        return () => {};
    }
};

/**
 * تسجيل سند تحصيل ميداني مع خفض مديونية العميل فورياً
 */
export const recordFieldReceipt = async (receiptData) => {
    try {
        const amount = Number(receiptData.amount) || 0;
        if (amount <= 0) throw new Error("مبلغ التحصيل يجب أن يكون أكبر من الصفر.");

        const customerId = receiptData.customerId || receiptData.customer_id;
        const repId = receiptData.employeeId || receiptData.employee_id;
        const repName = receiptData.employeeName || receiptData.employee_name || "مندوب";

        const result = await runTransaction(db, async (transaction) => {
            const receiptRef = doc(collection(db, RECEIPTS_COLLECTION));

            // خفض رصيد العميل إن وجد
            if (customerId) {
                const custRef = doc(db, "customers", customerId);
                const custSnap = await transaction.get(custRef);
                if (custSnap.exists()) {
                    transaction.update(custRef, {
                        balance: increment(-amount),
                        current_balance: increment(-amount),
                        updated_at: serverTimestamp(),
                    });
                }
            }

            const payload = withTenant({
                receiptNumber: receiptData.receiptNumber || `REC-${Date.now()}`,
                receipt_number: receiptData.receiptNumber || `REC-${Date.now()}`,
                customerId: customerId || "",
                customer_id: customerId || "",
                customerName: receiptData.customerName || receiptData.customer_name || "عميل",
                customer_name: receiptData.customerName || receiptData.customer_name || "عميل",
                employeeId: repId || "",
                employee_id: repId || "",
                employeeName: repName,
                employee_name: repName,
                amount,
                paymentMethod: receiptData.paymentMethod || "cash",
                payment_method: receiptData.paymentMethod || "cash",
                notes: receiptData.notes || "",
                date: receiptData.date || new Date().toISOString().slice(0, 10),
                time: receiptData.time || new Date().toLocaleTimeString("ar-EG"),
                is_settled_to_safe: false,
                settlement_status: "in_rep_custody", // in_rep_custody | deposited_to_safe
                created_at: serverTimestamp(),
            });

            transaction.set(receiptRef, payload);
            return { id: receiptRef.id };
        });

        return { success: true, id: result.id };
    } catch (error) {
        console.error("recordFieldReceipt error:", error);
        return { success: false, error: error.message || error };
    }
};

/**
 * تصفية وتوريد الخزينة: تسليم أمين الخزينة المبالغ النقدية من المندوب وإيداعها بالخزينة المركزية
 */
export const settleRepCustodyToSafe = async ({
    repId,
    repName,
    receiptIds = [],
    totalAmount = 0,
    accountId,
    cashierUser = "أمين الخزينة"
}) => {
    try {
        const amount = Number(totalAmount) || 0;
        if (amount <= 0) throw new Error("مبلغ التصفية يجب أن يكون أكبر من صفر.");
        if (!accountId) throw new Error("يجب اختيار خزينة أو حساب بنكي لإيداع المبالغ.");

        await runTransaction(db, async (transaction) => {
            const accountRef = doc(db, "accounts", accountId);
            const accountSnap = await transaction.get(accountRef);
            if (!accountSnap.exists()) throw new Error("حساب الخزينة غير موجود.");

            // 1. زيادة رصيد الخزينة المركزية
            transaction.update(accountRef, {
                balance: increment(amount),
                updated_at: serverTimestamp(),
            });

            // 2. تحديث السندات المحددة بأنها وُردت للخزينة
            for (const rId of receiptIds) {
                const rRef = doc(db, RECEIPTS_COLLECTION, rId);
                transaction.update(rRef, {
                    is_settled_to_safe: true,
                    settlement_status: "deposited_to_safe",
                    safe_account_id: accountId,
                    safe_account_name: accountSnap.data().name || "الخزينة الرئيسية",
                    settled_by: cashierUser,
                    settled_at: serverTimestamp(),
                });
            }

            // 3. تسجيل حركة تدفق مالي وارد بالخزينة
            const cashflowRef = doc(collection(db, "cashflow"));
            transaction.set(cashflowRef, withTenant({
                amount,
                type: "income",
                sub_type: "field_cash_settlement",
                account_id: accountId,
                description: `توريد عهدة نقدية من المندوب ${repName || ''} - عدد (${receiptIds.length}) سندات قبض`,
                timestamp: serverTimestamp(),
            }));
        });

        // 4. إرسال إشعار لحظي للمندوب بتأكيد استلام أمين الخزينة لعهدته النقدية
        if (repId) {
            await sendRepNotification({
                targetEmployeeId: repId,
                title: "تم توريد وتصفية العهدة النقدية",
                body: `تم استلام وتصفية عهدتك النقدية بمبلغ ${amount.toLocaleString()} جنيه بنجاح في خزينة الشركة.`,
                type: "custody_settled",
                metadata: { totalAmount: amount, receiptCount: receiptIds.length }
            });
        }

        return { success: true };
    } catch (error) {
        console.error("settleRepCustodyToSafe error:", error);
        return { success: false, error: error.message || error };
    }
};
