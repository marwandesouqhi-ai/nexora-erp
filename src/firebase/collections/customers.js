import { db } from "../firebaseConfig";
import {
    collection,
    addDoc,
    serverTimestamp,
    updateDoc,
    doc,
    deleteDoc,
} from "@/data/firestoreCompat";
import { fetchTenantDocs, withTenant } from "@/lib/tenantFirestore";

const customersCollection = collection(db, "customers");

/**
 * Normalize customer data so the UI always receives
 * the same field names.
 */
const normalizeCustomer = (id, data = {}) => ({
    id,

    name: data.name ?? data.customer_name ?? "",
    type: data.type ?? "pharmacy",
    contact_person: data.contact_person ?? "",
    phone: data.phone ?? "",
    phone2: data.phone2 ?? "",
    email: data.email ?? "",
    address: data.address ?? "",
    city: data.city ?? "",
    tax_number: data.tax_number ?? "",

    credit_limit: Number(
        data.credit_limit ?? data.debt_limit ?? 5000
    ) || 0,

    balance: Number(
        data.balance ?? data.current_balance ?? 0
    ) || 0,

    total_spent: Number(
        data.total_spent ?? data.total_purchases ?? 0
    ) || 0,

    notes: data.notes ?? "",
    status: data.status ?? "active",

    customer_grade: data.customer_grade ?? "C",
    is_blocked: data.is_blocked ?? false,

    created_at: data.created_at ?? null,
    updated_at: data.updated_at ?? null,
    company_id: data.company_id ?? "",
});

/**
 * Add new customer
 */
export const addNewCustomer = async (customerData) => {
    try {
        const customer = withTenant({
            // Basic information
            name: customerData.name?.trim() || "",
            customer_name: customerData.name?.trim() || "",

            type: customerData.type || "pharmacy",
            contact_person: customerData.contact_person?.trim() || "",

            phone: customerData.phone?.trim() || "",
            phone2: customerData.phone2?.trim() || "",

            email: customerData.email?.trim() || "",

            address: customerData.address?.trim() || "",
            city: customerData.city?.trim() || "",
            tax_number: customerData.tax_number?.trim() || "",

            // Financial information
            credit_limit: Number(customerData.credit_limit) || 5000,
            debt_limit: Number(customerData.credit_limit) || 5000,

            balance: 0,
            current_balance: 0,

            total_spent: 0,
            total_purchases: 0,

            // Status
            status: customerData.status || "active",

            customer_grade: "C",
            is_blocked: false,

            // Additional
            notes: customerData.notes?.trim() || "",

            created_at: serverTimestamp(),
            updated_at: serverTimestamp(),
        });

        // Required field validation
        if (!customer.name) {
            throw new Error("اسم العميل مطلوب");
        }

        if (!customer.phone) {
            throw new Error("رقم الهاتف الأساسي مطلوب");
        }

        const docRef = await addDoc(customersCollection, customer);

        return {
            success: true,
            id: docRef.id,
        };
    } catch (error) {
        console.error("Error adding customer:", error);

        return {
            success: false,
            error,
        };
    }
};

/**
 * Get all customers for active tenant
 */
export const getCustomers = async (companyId = null) => {
    try {
        const docs = await fetchTenantDocs("customers", {
            companyId,
            sortFn: (a, b) => (a.name || '').localeCompare(b.name || ''),
        });

        return docs.map((customerDoc) =>
            normalizeCustomer(customerDoc.id, customerDoc)
        );
    } catch (error) {
        console.error("Error getting customers:", error);
        throw error;
    }
};

/**
 * Update customer
 */
export const updateCustomer = async (id, updatedData) => {
    try {
        if (!id) {
            throw new Error("Customer ID is required");
        }

        const updatePayload = {
            name: updatedData.name?.trim() || "",
            customer_name: updatedData.name?.trim() || "",

            type: updatedData.type || "pharmacy",
            contact_person: updatedData.contact_person?.trim() || "",

            phone: updatedData.phone?.trim() || "",
            phone2: updatedData.phone2?.trim() || "",

            email: updatedData.email?.trim() || "",

            address: updatedData.address?.trim() || "",
            city: updatedData.city?.trim() || "",
            tax_number: updatedData.tax_number?.trim() || "",

            credit_limit: Number(updatedData.credit_limit) || 0,
            debt_limit: Number(updatedData.credit_limit) || 0,

            notes: updatedData.notes?.trim() || "",

            status: updatedData.status || "active",

            updated_at: serverTimestamp(),
        };

        const docRef = doc(db, "customers", id);

        await updateDoc(docRef, updatePayload);

        return {
            success: true,
        };
    } catch (error) {
        console.error("Error updating customer:", error);

        return {
            success: false,
            error,
        };
    }
};

/**
 * Delete customer
 */
export const deleteCustomerDoc = async (id) => {
    try {
        if (!id) {
            throw new Error("Customer ID is required");
        }

        await deleteDoc(doc(db, "customers", id));

        return {
            success: true,
        };
    } catch (error) {
        console.error("Error deleting customer:", error);

        return {
            success: false,
            error,
        };
    }
};