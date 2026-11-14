import { db } from "../firebaseConfig";
import { collection, addDoc, serverTimestamp, doc, updateDoc, deleteDoc, setDoc } from "@/data/firestoreCompat";
import { fetchTenantDocs, withTenant } from "@/lib/tenantFirestore";

export const generateProductBarcode = (productId = '') => {
    const normalizedId = String(productId).replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    if (normalizedId) return `NXR${normalizedId}`;
    const randomPart = globalThis.crypto?.randomUUID?.().replace(/-/g, '').slice(0, 12) || `${Date.now()}${Math.floor(Math.random() * 1000)}`;
    return `NXR${randomPart.toUpperCase()}`;
};

// دالة إضافة منتج جديد للمخزن
export const addNewProduct = async (productData) => {
    try {
        const docRef = doc(collection(db, "products"));
        const payload = withTenant({
            barcode: productData.barcode?.trim() || generateProductBarcode(docRef.id),
            product_name: productData.name,          // اسم المنتج (مثلاً: مضاد حيوي X)
            category: productData.category,          // القسم (أدوية، إكسسوارات، إلخ)

            // الكميات والمخزون
            current_stock: Number(productData.initialStock) || 0, // الرصيد الافتتاحي
            stock: Number(productData.initialStock) || 0,
            min_stock_level: Number(productData.minLevel) || 5,   // حد الأمان (النواقص)
            min_stock: Number(productData.minLevel) || 5,
            unit: productData.unit || "قطعة",        // وحدة القياس

            // الأسعار والماليات
            purchase_price: Number(productData.costPrice),  // سعر الشراء (التكلفة)
            selling_price: Number(productData.sellPrice),   // سعر البيع للجمهور
            wholesale_price: Number(productData.wholesale), // سعر الجملة (لو فيه)

            // بيانات إضافية
            expiry_date: productData.expiry || null,  // تاريخ الانتهاء (مهم جداً للبيطري)
            supplier_id: productData.supplierId || "", // المورد المفضل للصنف ده
            supplier_name: productData.supplierName || "",
            supplier_company: productData.supplierCompany || "",

            // التوثيق
            created_at: serverTimestamp(),
            last_update: serverTimestamp()
        });

        await setDoc(docRef, payload);
        return { success: true, id: docRef.id };
    } catch (error) {
        console.error("Error adding product: ", error);
        return { success: false, error };
    }
};

// دالة جلب منتجات الشركة النشطة فقط
export const getProducts = async (companyId = null) => {
    return await fetchTenantDocs("products", {
        companyId,
        sortFn: (a, b) => (a.product_name || '').localeCompare(b.product_name || ''),
    });
};

export const createProductRecord = async (productData) => {
    const ref = await addDoc(collection(db, 'products'), withTenant({
        ...productData,
        created_at: serverTimestamp(),
        last_update: serverTimestamp(),
    }));
    return ref;
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
