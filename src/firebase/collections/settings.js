import { db } from "../firebaseConfig";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";

// ID ثابت لإعدادات النظام
const SETTINGS_DOC_ID = "system_config";

// 1. دالة حفظ أو تحديث الإعدادات
export const updateSystemSettings = async (settingsData) => {
    try {
        const settingsRef = doc(db, "settings", SETTINGS_DOC_ID);
        await setDoc(settingsRef, {
            business_name: settingsData.name || "Nexora ERP",
            logo_url: settingsData.logo || "",
            phone: settingsData.phone || "",
            address: settingsData.address || "",
            currency: settingsData.currency || "EGP",
            tax_rate: Number(settingsData.taxRate) || 0, // نسبة الضريبة لو موجودة
            invoice_footer: settingsData.footerNote || "شكراً لتعاملكم معنا",

            // إعدادات النظام التقنية
            last_updated: serverTimestamp(),
            updated_by: settingsData.adminId
        }, { merge: true }); // استخدام merge عشان ميسمحش بمسح البيانات القديمة لو مبعتناش كل الحقول

        return { success: true };
    } catch (error) {
        console.error("Settings Update Error: ", error);
        return { success: false, error };
    }
};

// 2. دالة جلب الإعدادات (عشان نعرض اللوجو والاسم في الهيدر)
export const getSystemSettings = async () => {
    try {
        const docRef = doc(db, "settings", SETTINGS_DOC_ID);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            return docSnap.data();
        } else {
            return null;
        }
    } catch (error) {
        console.error("Error fetching settings: ", error);
        return null;
    }
};