import { db } from "../firebaseConfig";
import { collection, doc, updateDoc, where, onSnapshot, serverTimestamp, increment, runTransaction } from "@/data/firestoreCompat";
import { fetchTenantDocs, createTenantQuery, withTenant } from "@/lib/tenantFirestore";
import { isSupabaseBackend } from "@/api/backend";
import { callRpc } from "@/data/supabaseRpc";
import { getSupabase } from "@/api/supabase";
import { getActiveCompanyId } from "@/lib/currentTenant";

// Supabase keeps one row per rep with an `items` jsonb array; the UI expects one
// entry per (employee, product) like the old Firestore documents.
const flattenVans = (rows) => rows.flatMap((van) =>
    (Array.isArray(van.items) ? van.items : []).map((item) => {
        const productId = item.product_id || item.id;
        return {
            ...item,
            id: `${van.rep_id}_${productId}`,
            van_row_id: van.id,
            employee_id: van.rep_id,
            employee_name: van.rep_name,
            product_id: productId,
            quantity: Number(item.quantity) || 0,
            unit_price: Number(item.unit_price) || 0,
        };
    })
);

/**
 * صرف بضاعة من المخزن المركزي إلى عهدة سيارة المندوب (Van Sales Stock)
 */
export const disburseToVan = async ({
    employeeId,
    employeeName,
    productId,
    productName,
    quantity,
    unitPrice = 0,
    notes = '',
    userId = ''
}) => {
    try {
        const qty = Number(quantity);
        if (!employeeId || !productId || !Number.isFinite(qty) || qty <= 0) {
            throw new Error('بيانات الصرف غير مكتملة (المندوب، الصنف، والكمية مطلوبة).');
        }

        if (isSupabaseBackend) {
            const result = await callRpc('disburse_van', {
                payload: { employeeId, productId, quantity: qty, unitPrice: Number(unitPrice) || 0, notes },
            });
            return { success: true, vanDocId: result.vanDocId };
        }

        const vanDocId = `${employeeId}_${productId}`;
        const vanRef = doc(db, "van_inventory", vanDocId);
        const productRef = doc(db, "products", productId);

        const result = await runTransaction(db, async (transaction) => {
            const productSnap = await transaction.get(productRef);
            if (!productSnap.exists()) throw new Error('الصنف غير موجود بالمخزن المركزي.');

            const pData = productSnap.data();
            const availableStock = Number(pData.current_stock ?? pData.stock ?? 0);
            if (qty > availableStock) {
                throw new Error(`الكمية المطلوبة (${qty}) تفوق الرصيد المتاح بالمخزن (${availableStock}).`);
            }

            // 1. خصم الكمية من المخزن المركزي
            transaction.update(productRef, {
                current_stock: increment(-qty),
                stock: increment(-qty),
                last_update: serverTimestamp(),
            });

            // 2. فحص رصيد سيارة المندوب الحالي
            const vanSnap = await transaction.get(vanRef);
            if (vanSnap.exists()) {
                transaction.update(vanRef, {
                    quantity: increment(qty),
                    unit_price: Number(unitPrice) || Number(pData.price || 0),
                    updated_at: serverTimestamp(),
                    last_disbursed_at: serverTimestamp(),
                });
            } else {
                transaction.set(vanRef, withTenant({
                    employee_id: employeeId,
                    employee_name: employeeName,
                    product_id: productId,
                    product_name: productName || pData.product_name || pData.name || '',
                    sku: pData.sku || pData.barcode || '',
                    unit_price: Number(unitPrice) || Number(pData.price || 0),
                    quantity: qty,
                    created_at: serverTimestamp(),
                    updated_at: serverTimestamp(),
                    last_disbursed_at: serverTimestamp(),
                }));
            }

            // 3. تسجيل حركة المخزون
            const movementRef = doc(collection(db, "inventory_movements"));
            transaction.set(movementRef, withTenant({
                product_id: productId,
                product_name: productName || pData.product_name || pData.name || '',
                quantity: qty,
                direction: 'out',
                movement_type: 'van_disbursement',
                recipient_employee_id: employeeId,
                recipient_employee_name: employeeName,
                notes: notes || `صرف عهدة سيارة للمندوب ${employeeName}`,
                created_by: userId,
                created_at: serverTimestamp(),
            }));

            // 4. تسجيل في سجل النشاطات
            const activityRef = doc(collection(db, "activity_logs"));
            transaction.set(activityRef, withTenant({
                action: 'صرف عهدة سيارة',
                entity_type: 'VanInventory',
                details: `تم صرف عدد ${qty} قطعة من (${productName || pData.product_name}) لسيارة المندوب ${employeeName}`,
                user_id: userId,
                timestamp: serverTimestamp(),
            }));

            return { vanDocId };
        });

        return { success: true, ...result };
    } catch (error) {
        console.error("DisburseToVan Error:", error);
        return { success: false, error };
    }
};

/**
 * جلب عهدة سيارة مندوب معين
 */
export const getVanInventoryByEmployee = async (employeeId, companyId = null) => {
    try {
        if (isSupabaseBackend) {
            const rows = await fetchTenantDocs("van_inventory", { companyId });
            return flattenVans(rows).filter((item) => item.employee_id === employeeId && item.quantity > 0);
        }
        const docs = await fetchTenantDocs("van_inventory", {
            companyId,
            filterFn: (item) => item.employee_id === employeeId && Number(item.quantity) > 0,
        });
        return docs;
    } catch (error) {
        console.error("getVanInventoryByEmployee error:", error);
        return [];
    }
};

/**
 * استماع لحظي لعهدة سيارة مندوب معين (Real-time listener)
 */
export const subscribeVanInventoryByEmployee = (employeeId, onData, onError) => {
    try {
        if (isSupabaseBackend) {
            const sb = getSupabase();
            const refresh = () => getVanInventoryByEmployee(employeeId).then(onData).catch((err) => onError && onError(err));
            const channel = sb
                .channel(`van:${employeeId}`)
                .on('postgres_changes',
                    { event: '*', schema: 'public', table: 'van_inventory', filter: `company_id=eq.${getActiveCompanyId()}` },
                    refresh)
                .subscribe();
            refresh();
            return () => { sb.removeChannel(channel); };
        }
        const q = createTenantQuery(
            "van_inventory",
            where("employee_id", "==", employeeId)
        );
        return onSnapshot(
            q,
            (snap) => {
                const list = snap.docs
                    .map((d) => ({ id: d.id, ...d.data() }))
                    .filter((item) => Number(item.quantity) > 0);
                onData(list);
            },
            (err) => {
                console.error("subscribeVanInventoryByEmployee error:", err);
                if (onError) onError(err);
            }
        );
    } catch (error) {
        console.error("subscribeVanInventoryByEmployee setup error:", error);
        if (onError) onError(error);
        return () => {};
    }
};

/**
 * جلب جميع عهد السيارات النشطة لجميع المندوبين
 */
export const getAllVanInventories = async (companyId = null) => {
    try {
        if (isSupabaseBackend) {
            const rows = await fetchTenantDocs("van_inventory", { companyId });
            return flattenVans(rows).filter((item) => item.quantity > 0);
        }
        const docs = await fetchTenantDocs("van_inventory", {
            companyId,
            filterFn: (item) => Number(item.quantity) > 0,
        });
        return docs;
    } catch (error) {
        console.error("getAllVanInventories error:", error);
        return [];
    }
};

/**
 * خصم كمية مباعة من عهدة سيارة المندوب عند إتمام فاتورة مبيعات ميدانية
 */
export const deductFromVanInventory = async (employeeId, productId, soldQty) => {
    try {
        if (isSupabaseBackend) {
            // No server RPC for van sales yet: read-modify-write of the rep's items array.
            // Not atomic - two simultaneous field sales by the same rep could race.
            const sb = getSupabase();
            const companyId = getActiveCompanyId();
            const { data: van, error } = await sb.from('van_inventory').select('id,items')
                .eq('company_id', companyId).eq('rep_id', String(employeeId)).limit(1).maybeSingle();
            if (error) throw error;
            if (!van) throw new Error('عهدة المندوب غير موجودة.');
            let found = false;
            const items = (van.items || []).map((item) => {
                if ((item.product_id || item.id) !== productId) return item;
                found = true;
                const next = (Number(item.quantity) || 0) - Number(soldQty);
                if (next < 0) throw new Error('الكمية المباعة أكبر من عهدة المندوب.');
                return { ...item, quantity: next };
            });
            if (!found) throw new Error('الصنف غير موجود في عهدة المندوب.');
            const { error: updateError } = await sb.from('van_inventory')
                .update({ items, updated_at: new Date().toISOString() }).eq('id', van.id).eq('company_id', companyId);
            if (updateError) throw updateError;
            return { success: true };
        }
        const vanDocId = `${employeeId}_${productId}`;
        const vanRef = doc(db, "van_inventory", vanDocId);
        await updateDoc(vanRef, {
            quantity: increment(-Number(soldQty)),
            updated_at: serverTimestamp(),
        });
        return { success: true };
    } catch (error) {
        console.error("deductFromVanInventory error:", error);
        return { success: false, error };
    }
};
