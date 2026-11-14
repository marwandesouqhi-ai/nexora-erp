import { db } from "../firebaseConfig";
import { storage } from "@/api/firebase";
import { doc, setDoc, getDoc, serverTimestamp } from "@/data/firestoreCompat";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { getActiveCompanyId } from "@/lib/currentTenant";
import { withTenant } from "@/lib/tenantFirestore";
import { isSupabaseBackend } from "@/api/backend";
import { getSupabase } from "@/api/supabase";

const SETTINGS_BUCKET = 'settings';
const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60;

// Supabase Storage: private bucket, files under {company_id}/..., long-lived signed URL for display.
const uploadCompanyAssetSb = async (file, prefix, defaultExt) => {
    const companyId = getActiveCompanyId();
    if (!companyId) throw new Error('لا توجد شركة نشطة.');
    const ext = file.name.split('.').pop() || defaultExt;
    const path = `${companyId}/${prefix}_${Date.now()}.${ext}`;
    const bucket = getSupabase().storage.from(SETTINGS_BUCKET);
    const { error } = await bucket.upload(path, file, { contentType: file.type || undefined, upsert: false });
    if (error) throw error;
    const { data, error: signError } = await bucket.createSignedUrl(path, ONE_YEAR_SECONDS);
    if (signError) throw signError;
    return data.signedUrl;
};

export const getSettingsDocId = (companyId = null) => {
    const activeCompanyId = getActiveCompanyId();
    const cId = companyId === activeCompanyId ? companyId : activeCompanyId;
    return cId ? `settings_${cId}` : "system_config";
};

// 1. دالة حفظ أو تحديث الإعدادات
export const updateSystemSettings = async (settingsData, companyId = null) => {
    try {
        const targetDocId = getSettingsDocId(companyId);
        const settingsRef = doc(db, "settings", targetDocId);
        await setDoc(
            settingsRef,
            withTenant({
                business_name: settingsData.name || "Nexora ERP",
                logo_url: settingsData.logo || "",
                phone: settingsData.phone || "",
                address: settingsData.address || "",
                currency: settingsData.currency || "EGP",
                tax_rate: Number(settingsData.taxRate) || 0,
                invoice_footer: settingsData.footerNote || "شكراً لتعاملكم معنا",
                invoice_template: settingsData.invoice_template || {},
                last_updated: serverTimestamp(),
                updated_by: settingsData.adminId || "",
            }),
            { merge: true }
        );

        return { success: true };
    } catch (error) {
        console.error("Settings Update Error: ", error);
        return { success: false, error };
    }
};

export const uploadInvoiceLogo = async (file) => {
    try {
        if (!file) {
            throw new Error("No logo file provided.");
        }

        if (isSupabaseBackend) return { success: true, url: await uploadCompanyAssetSb(file, 'invoice_logo', 'png') };

        const ext = file.name.split('.').pop() || 'png';
        const logoRef = storageRef(storage, `settings/invoice_logo_${Date.now()}.${ext}`);
        await uploadBytes(logoRef, file);
        const url = await getDownloadURL(logoRef);

        return { success: true, url };
    } catch (error) {
        console.error("Invoice logo upload failed:", error);
        return { success: false, error };
    }
};

export const uploadInvoiceTemplateFile = async (file) => {
    try {
        if (!file) {
            throw new Error("No template file provided.");
        }

        if (isSupabaseBackend) return { success: true, url: await uploadCompanyAssetSb(file, 'invoice_template', 'pdf') };

        const ext = file.name.split('.').pop() || 'pdf';
        const templateRef = storageRef(storage, `settings/invoice_template_${Date.now()}.${ext}`);
        await uploadBytes(templateRef, file);
        const url = await getDownloadURL(templateRef);

        return { success: true, url };
    } catch (error) {
        console.error("Invoice template upload failed:", error);
        return { success: false, error };
    }
};

// 2. دالة جلب الإعدادات (عشان نعرض اللوجو والاسم في الهيدر)
export const getSystemSettings = async (companyId = null) => {
    try {
        const targetDocId = getSettingsDocId(companyId);
        const docRef = doc(db, "settings", targetDocId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            return docSnap.data();
        }

        return null;
    } catch (error) {
        console.error("Error fetching settings: ", error);
        return null;
    }
};
