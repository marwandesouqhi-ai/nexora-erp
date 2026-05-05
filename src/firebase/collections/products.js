import { db } from "../firebaseConfig";
import { collection, addDoc, serverTimestamp, getDocs, updateDoc, doc, deleteDoc, query, orderBy } from "firebase/firestore";

// دالة إضافة منتج جديد للمخزن
export const addNewProduct = async (productData) => {
    try {
        const docRef = await addDoc(collection(db, "products"), {
            barcode: productData.barcode || "",      // باركود الصنف لسهولة البحث
            product_name: productData.name,          // اسم المنتج (مثلاً: مضاد حيوي X)
            category: productData.category,          // القسم (أدوية، إكسسوارات، إلخ)

            // الكميات والمخزون
            current_stock: Number(productData.initialStock) || 0, // الرصيد الافتتاحي
            min_stock_level: Number(productData.minLevel) || 5,   // حد الأمان (النواقص)
            unit: productData.unit || "قطعة",        // وحدة القياس

            // الأسعار والماليات
            purchase_price: Number(productData.costPrice),  // سعر الشراء (التكلفة)
            selling_price: Number(productData.sellPrice),   // سعر البيع للجمهور
            wholesale_price: Number(productData.wholesale), // سعر الجملة (لو فيه)

            // بيانات إضافية
            expiry_date: productData.expiry || null,  // تاريخ الانتهاء (مهم جداً للبيطري)
            supplier_id: productData.supplierId || "", // المورد المفضل للصنف ده

            // التوثيق
            created_at: serverTimestamp(),
            last_update: serverTimestamp()
        });
        return { success: true, id: docRef.id };
    } catch (error) {
        console.error("Error adding product: ", error);
        return { success: false, error };
    }
};

// دالة جلب كل المنتجات
export const getProducts = async () => {
    try {
        const q = query(collection(db, "products"), orderBy("product_name"));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error("Error getting products: ", error);
        return [];
    }
};

// دالة تحديث منتج
export const updateProduct = async (id, updatedData) => {
    try {
        const docRef = doc(db, "products", id);
        await updateDoc(docRef, {
            ...updatedData,
            last_update: serverTimestamp(),
        });
        return { success: true };
    } catch (error) {
        console.error("Error updating product: ", error);
        return { success: false, error };
    }
};

// دالة حذف منتج
export const deleteProduct = async (id) => {
    try {
        await deleteDoc(doc(db, "products", id));
        return { success: true };
    } catch (error) {
        console.error("Error deleting product: ", error);
        return { success: false, error };
    }
};