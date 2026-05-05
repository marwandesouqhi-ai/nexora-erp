import { db } from "../firebaseConfig";
import { collection, addDoc, doc, updateDoc, increment, serverTimestamp, getDocs, deleteDoc } from "firebase/firestore";

// دالة تسجيل فاتورة مشتريات جديدة
export const createPurchaseInvoice = async (purchaseData) => {
    try {
        // 1. تسجيل الفاتورة في كوليكشن المشتريات
        const invoiceRef = await addDoc(collection(db, "purchases"), {
            supplier_id: purchaseData.supplierId,
            supplier_name: purchaseData.supplierName,
            invoice_number: purchaseData.billNo || "", // رقم فاتورة المورد
            items: purchaseData.items, // مصفوفة فيها [product_id, qty, cost_price]
            total_amount: Number(purchaseData.totalAmount),
            paid_amount: Number(purchaseData.paidAmount),
            remaining_amount: Number(purchaseData.totalAmount - purchaseData.paidAmount),
            payment_type: purchaseData.paymentType, // (cash, credit)
            created_at: serverTimestamp(),
        });

        // 2. تحديث المخزن لكل صنف (زيادة الكمية وتحديث سعر الشراء)
        const updateInventoryPromises = purchaseData.items.map((item) => {
            const productRef = doc(db, "products", item.id);
            return updateDoc(productRef, {
                current_stock: increment(item.qty),
                purchase_price: item.cost_price, // تحديث سعر التكلفة لآخر سعر شراء
                last_update: serverTimestamp()
            });
        });

        // 3. تحديث حساب المورد (زيادة المديونية لو فيه باقي)
        const supplierRef = doc(db, "suppliers", purchaseData.supplierId);
        const updateSupplier = updateDoc(supplierRef, {
            current_balance: increment(purchaseData.totalAmount - purchaseData.paidAmount),
            total_purchases_value: increment(purchaseData.totalAmount),
            last_transaction_date: serverTimestamp()
        });

        // 4. تسجيل حركة الخزنة (خروج كاش للجزء المدفوع فقط)
        let updateCashflow = null;
        if (purchaseData.paidAmount > 0) {
            updateCashflow = addDoc(collection(db, "cashflow"), {
                amount: -Number(purchaseData.paidAmount), // بالسالب عشان خارج من الخزنة
                type: "purchase",
                description: `شراء بضاعة من: ${purchaseData.supplierName}`,
                timestamp: serverTimestamp()
            });
        }

        // تنفيذ الكل
        await Promise.all([
            ...updateInventoryPromises,
            updateSupplier,
            ...(updateCashflow ? [updateCashflow] : [])
        ]);

        return { success: true, id: invoiceRef.id };
    } catch (error) {
        console.error("Purchase Transaction Error: ", error);
        return { success: false, error };
    }
};

// دالة جلب كل فواتير المشتريات
export const getPurchases = async () => {
    try {
        const querySnapshot = await getDocs(collection(db, "purchases"));
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error("Error getting purchases: ", error);
        return [];
    }
};

// دالة تحديث فاتورة مشتريات
export const updatePurchase = async (id, updatedData) => {
    try {
        const docRef = doc(db, "purchases", id);
        await updateDoc(docRef, {
            ...updatedData,
            updated_at: serverTimestamp(),
        });
        return { success: true };
    } catch (error) {
        console.error("Error updating purchase: ", error);
        return { success: false, error };
    }
};

// دالة حذف فاتورة مشتريات
export const deletePurchase = async (id) => {
    try {
        await deleteDoc(doc(db, "purchases", id));
        return { success: true };
    } catch (error) {
        console.error("Error deleting purchase: ", error);
        return { success: false, error };
    }
};