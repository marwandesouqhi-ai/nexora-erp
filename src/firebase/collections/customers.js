import { db } from "../firebaseConfig";
import { collection, addDoc, serverTimestamp, getDocs, updateDoc, doc, deleteDoc } from "firebase/firestore";

// دالة إضافة عميل جديد ببيانات كاملة
export const addNewCustomer = async (customerData) => {
    try {
        const docRef = await addDoc(collection(db, "customers"), {
            customer_name: customerData.name, // اسم العميل أو العيادة
            phone: customerData.phone,       // رقم التواصل
            address: customerData.address,   // العنوان

            // الحقول المالية الاحترافية
            total_purchases: 0,              // لسه جديد، مسحوباته صفر
            current_balance: 0,              // رصيده الحالي (عليه كام)
            debt_limit: Number(customerData.debtLimit) || 5000, // حد الائتمان الافتراضي 5000

            // حقول التصنيف
            customer_grade: "C",             // بيبدأ تصنيف C لحد ما يسحب أكتر
            is_blocked: false,               // مش محظور في البداية

            // التوثيق
            created_at: serverTimestamp(),   // تاريخ التسجيل
            notes: customerData.notes || ""  // ملاحظات إضافية
        });
        return { success: true, id: docRef.id };
    } catch (error) {
        console.error("Error adding customer: ", error);
        return { success: false, error };
    }
};

// دالة جلب كل العملاء
export const getCustomers = async () => {
    try {
        const querySnapshot = await getDocs(collection(db, "customers"));
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error("Error getting customers: ", error);
        return [];
    }
};

// دالة تحديث بيانات عميل
export const updateCustomer = async (id, updatedData) => {
    try {
        const docRef = doc(db, "customers", id);
        await updateDoc(docRef, {
            ...updatedData,
            updated_at: serverTimestamp(),
        });
        return { success: true };
    } catch (error) {
        console.error("Error updating customer: ", error);
        return { success: false, error };
    }
};

// دالة حذف عميل
export const deleteCustomerDoc = async (id) => {
    try {
        await deleteDoc(doc(db, "customers", id));
        return { success: true };
    } catch (error) {
        console.error("Error deleting customer: ", error);
        return { success: false, error };
    }
};