import { db } from "../firebaseConfig";
import { collection, addDoc, serverTimestamp, getDocs, updateDoc, doc, deleteDoc } from "firebase/firestore";

// دالة إضافة مورد جديد
export const addNewSupplier = async (supplierData) => {
    try {
        const docRef = await addDoc(collection(db, "suppliers"), {
            supplier_name: supplierData.name,      // اسم الشركة أو المورد
            company_branch: supplierData.branch || "", // الفرع أو مندوب الشركة
            phone: supplierData.phone,            // رقم التواصل
            email: supplierData.email || "",      // البريد الإلكتروني للمراسلات

            // الحقول المالية الخاصة بالموردين
            total_purchases_value: 0,             // إجمالي قيمة المشتريات منه
            current_balance: 0,                   // حساب المورد (لينا ولا علينا)

            // بيانات النشاط
            category: supplierData.category || "أدوية", // تخصص المورد (أدوية، معدات، إلخ)
            address: supplierData.address || "",  // عنوان مخازن المورد

            // التوثيق
            created_at: serverTimestamp(),
            last_transaction_date: null,          // تاريخ آخر فاتورة شراء منه
            is_active: true,                      // حالة التعامل مع المورد
            notes: supplierData.notes || ""
        });
        return { success: true, id: docRef.id };
    } catch (error) {
        console.error("Error adding supplier: ", error);
        return { success: false, error };
    }
};

// دالة جلب كل الموردين
export const getSuppliers = async () => {
    try {
        const querySnapshot = await getDocs(collection(db, "suppliers"));
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error("Error getting suppliers: ", error);
        return [];
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