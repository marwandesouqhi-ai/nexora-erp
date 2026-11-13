import { db } from "../firebaseConfig";
import { collection, addDoc, doc, updateDoc, increment, serverTimestamp, deleteDoc, runTransaction, writeBatch } from "firebase/firestore";
import { fetchTenantDocs, withTenant } from "@/lib/tenantFirestore";

export const syncInvoiceDebts = async (companyId = null) => {
    const [salesDocs, purchasesDocs, debtsDocs] = await Promise.all([
        fetchTenantDocs('sales', { companyId }),
        fetchTenantDocs('purchases', { companyId }),
        fetchTenantDocs('debts', { companyId }),
    ]);
    const existingSources = new Set(debtsDocs.map((entry) => entry.source_id).filter(Boolean));
    const batch = writeBatch(db);
    let pendingWrites = 0;

    salesDocs.forEach((sale) => {
        const remaining = Number(sale.remaining_amount) || 0;
        if (!sale.customer_id || remaining <= 0 || existingSources.has(sale.id)) return;
        batch.set(doc(collection(db, 'debts')), withTenant({
            party_id: sale.customer_id,
            party_name: sale.customer_name || 'عميل نقدي',
            party_type: 'customer',
            source_type: 'sale',
            source_id: sale.id,
            invoice_number: sale.invoice_number || '',
            amount: Number(sale.total_amount ?? sale.total) || 0,
            paid_amount: Number(sale.paid_amount) || 0,
            remaining_amount: remaining,
            direction: 'owed_to_us',
            status: Number(sale.paid_amount) > 0 ? 'partial' : 'pending',
            description: `مديونية فاتورة بيع ${sale.invoice_number || ''}`,
            created_at: serverTimestamp(),
        }));
        existingSources.add(sale.id);
        pendingWrites += 1;
    });

    purchasesDocs.forEach((purchase) => {
        const remaining = Number(purchase.remaining_amount ?? (purchase.payment_status === 'paid' ? 0 : purchase.total)) || 0;
        if (!purchase.supplier_id || remaining <= 0 || existingSources.has(purchase.id)) return;
        batch.set(doc(collection(db, 'debts')), withTenant({
            party_id: purchase.supplier_id,
            party_name: purchase.supplier_company ? `${purchase.supplier_name || ''} - ${purchase.supplier_company}` : purchase.supplier_name || '',
            party_type: 'supplier',
            source_type: 'purchase',
            source_id: purchase.id,
            invoice_number: purchase.invoice_number || '',
            amount: Number(purchase.total) || 0,
            paid_amount: Number(purchase.paid_amount) || 0,
            remaining_amount: remaining,
            direction: 'we_owe',
            status: Number(purchase.paid_amount) > 0 ? 'partial' : 'pending',
            description: `مديونية فاتورة شراء ${purchase.invoice_number || ''}`,
            created_at: serverTimestamp(),
        }));
        existingSources.add(purchase.id);
        pendingWrites += 1;
    });

    if (pendingWrites > 0) await batch.commit();
};

export const addNewDebt = async (debtData) => {
    try {
        const amount = Number(debtData.amount) || 0;
        const paidAmount = Number(debtData.paid_amount) || 0;
        const remainingAmount = Math.max(0, amount - paidAmount);
        const payload = withTenant({
            party_name: debtData.party_name || "",
            party_type: debtData.party_type || "customer",
            amount,
            paid_amount: paidAmount,
            remaining_amount: remainingAmount,
            direction: debtData.direction || "owed_to_us",
            due_date: debtData.due_date || "",
            status: debtData.status || (remainingAmount > 0 ? "pending" : "settled"),
            description: debtData.description || "",
            notes: debtData.notes || "",
            created_at: serverTimestamp(),
        });
        const debtRef = await addDoc(collection(db, "debts"), payload);
        return { success: true, id: debtRef.id };
    } catch (error) {
        console.error("Debt create error: ", error);
        return { success: false, error };
    }
};

export const recordDebtTransaction = async (debtData) => {
    try {
        const debtRef = await addDoc(collection(db, "debts"), withTenant({
            party_id: debtData.partyId,
            party_name: debtData.partyName,
            type: debtData.type,
            amount_paid: Number(debtData.amount),
            payment_method: debtData.method,
            transaction_date: serverTimestamp(),
            notes: debtData.notes || "",
        }));

        const targetCollection = debtData.type === "customer_collection" ? "customers" : "suppliers";
        const partyRef = doc(db, targetCollection, debtData.partyId);
        await updateDoc(partyRef, {
            current_balance: increment(-debtData.amount),
            last_update: serverTimestamp(),
        });

        const cashEffect = debtData.type === "customer_collection" ? debtData.amount : -debtData.amount;
        await addDoc(collection(db, "cashflow"), withTenant({
            amount: cashEffect,
            type: debtData.type,
            description: `تسوية دين: ${debtData.partyName}`,
            timestamp: serverTimestamp(),
        }));

        return { success: true, id: debtRef.id };
    } catch (error) {
        console.error("Debt Transaction Error: ", error);
        return { success: false, error };
    }
};

export const getDebts = async (companyId = null) => {
    try {
        await syncInvoiceDebts(companyId);
        return await fetchTenantDocs("debts", { companyId });
    } catch (error) {
        console.error("Error getting debts: ", error);
        return [];
    }
};

export const updateDebt = async (id, updatedData) => {
    try {
        const docRef = doc(db, "debts", id);
        const amount = Number(updatedData.amount) || 0;
        const paidAmount = Number(updatedData.paid_amount) || 0;
        const remainingAmount = Math.max(0, amount - paidAmount);
        await updateDoc(docRef, {
            ...updatedData,
            amount,
            paid_amount: paidAmount,
            remaining_amount: remainingAmount,
            status: updatedData.status || (remainingAmount > 0 ? "pending" : "settled"),
            updated_at: serverTimestamp(),
        });
        return { success: true };
    } catch (error) {
        console.error("Error updating debt: ", error);
        return { success: false, error };
    }
};

export const settleDebt = async (id, amount) => {
    try {
        const docRef = doc(db, "debts", id);
        const paymentAmount = Number(amount) || 0;
        let result;

        await runTransaction(db, async (transaction) => {
            const debtSnap = await transaction.get(docRef);
            if (!debtSnap.exists()) throw new Error('الدين غير موجود.');
            const existing = debtSnap.data() || {};
            const currentPaid = Number(existing.paid_amount) || 0;
            const currentRemaining = Number(existing.remaining_amount ?? ((Number(existing.amount) || 0) - currentPaid));
            if (paymentAmount <= 0 || paymentAmount > currentRemaining) throw new Error('قيمة التسوية غير صحيحة.');

            const newPaid = currentPaid + paymentAmount;
            const remainingAmount = Math.max(0, currentRemaining - paymentAmount);
            const status = remainingAmount > 0 ? "partial" : "settled";
            const partyCollection = existing.party_type === 'supplier' || existing.direction === 'we_owe' ? 'suppliers' : 'customers';
            const partyRef = existing.party_id ? doc(db, partyCollection, existing.party_id) : null;
            const partySnap = partyRef ? await transaction.get(partyRef) : null;
            if (partyRef && !partySnap.exists()) throw new Error('الطرف المرتبط بالدين غير موجود.');

            transaction.update(docRef, {
                paid_amount: newPaid,
                remaining_amount: remainingAmount,
                status,
                updated_at: serverTimestamp(),
            });
            if (partyRef) {
                const balanceChange = existing.direction === 'we_owe' ? -paymentAmount : -paymentAmount;
                transaction.update(partyRef, {
                    balance: increment(balanceChange),
                    current_balance: increment(balanceChange),
                    last_update: serverTimestamp(),
                });
            }
            transaction.set(doc(collection(db, 'cashflow')), withTenant({
                amount: existing.direction === 'we_owe' ? -paymentAmount : paymentAmount,
                type: existing.direction === 'we_owe' ? 'supplier_debt_payment' : 'customer_debt_collection',
                related_document: id,
                description: `تسوية دين: ${existing.party_name || ''}`,
                timestamp: serverTimestamp(),
            }));
            result = { remainingAmount, status };
        });
        return { success: true, ...result };
    } catch (error) {
        console.error("Error settling debt: ", error);
        return { success: false, error };
    }
};

export const deleteDebtDoc = async (id) => {
    try {
        await deleteDoc(doc(db, "debts", id));
        return { success: true };
    } catch (error) {
        console.error("Error deleting debt: ", error);
        return { success: false, error };
    }
};

export const deleteDebt = deleteDebtDoc;