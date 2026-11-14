import { getSupabase } from '@/api/supabase';
import { getActiveCompanyId } from '@/lib/currentTenant';
import { TABLE_COLUMNS, resolveTable } from './schemaColumns';

/**
 * Supabase implementation of the tenant data helpers (Firebase -> Supabase
 * migration, phase 4). It keeps the Firestore document shape used across the UI:
 *  - rows come back as flat objects (`metadata` jsonb is merged into the top level),
 *  - timestamptz columns come back as Firestore-Timestamp-compatible Dates,
 *  - writes split a flat payload into real columns + `metadata`.
 * Tenant isolation is enforced by RLS; the company filter here is defence in depth.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (value) => typeof value === 'string' && UUID_RE.test(value);

/** Date that also answers to the Firestore Timestamp API (toDate/toMillis/seconds). */
class CompatTimestamp extends Date {
    toDate() { return new Date(this.getTime()); }
    toMillis() { return this.getTime(); }
    get seconds() { return Math.floor(this.getTime() / 1000); }
    get nanoseconds() { return (this.getTime() % 1000) * 1e6; }
}

const columnsOf = (table) => TABLE_COLUMNS[table] || null;

/** Firestore FieldValue sentinels (serverTimestamp, increment...) cannot be stored. */
const isFieldValueSentinel = (v) =>
    v && typeof v === 'object' && typeof v._methodName === 'string';

/** Firestore increment(n): the operand, or null for any other value. */
const incrementOperand = (v) =>
    isFieldValueSentinel(v) && v._methodName === 'increment' && Number.isFinite(Number(v._operand))
        ? Number(v._operand)
        : null;

function toDomainRow(table, row) {
    const cols = columnsOf(table) || {};
    const out = {};
    for (const [key, value] of Object.entries(row)) {
        if (key === 'metadata') continue;
        out[key] = cols[key] === 'tstz' && value ? new CompatTimestamp(value) : value;
    }
    if (table === 'profiles') out.uid = row.id; // same shape as the old users/{uid} documents
    // Free-form fields never override real columns.
    if (row.metadata && typeof row.metadata === 'object') {
        for (const [k, v] of Object.entries(row.metadata)) {
            if (!(k in out)) out[k] = v;
        }
    }
    return out;
}

function normaliseValue(value) {
    if (value instanceof Date) return value.toISOString();
    if (value && typeof value.toDate === 'function') return value.toDate().toISOString();
    return value;
}

/** Splits a flat payload into `{ columns, metadata }` for the table. */
function toDbPayload(table, data) {
    const cols = columnsOf(table);
    if (!cols) throw new Error(`Table "${table}" is not mapped to Supabase yet.`);
    const columns = {};
    const metadata = {};
    const increments = {}; // key -> operand, applied by read-modify-write (NOT atomic)
    for (const [key, raw] of Object.entries(data)) {
        if (raw === undefined) continue;
        if (key === 'id' || key === 'company_id') continue;
        const operand = incrementOperand(raw);
        if (operand !== null) { increments[key] = operand; continue; }
        if (isFieldValueSentinel(raw)) continue; // serverTimestamp() etc.: the DB sets timestamps
        const value = normaliseValue(raw);
        if (key in cols && key !== 'metadata') columns[key] = value;
        else metadata[key] = value;
    }
    return { columns, metadata, increments };
}

/** Maps a legacy Firestore id or a uuid to a PostgREST filter. */
const idFilter = (id) => (isUuid(id) ? ['id', id] : ['legacy_firebase_id', String(id)]);

export async function fetchRows(collectionName, { companyId = null } = {}) {
    const table = resolveTable(collectionName);
    if (!columnsOf(table)) return []; // collection has no Supabase table (yet)
    const active = getActiveCompanyId();
    const requested = typeof companyId === 'string' ? companyId : null;
    if (!active || (requested && requested !== active)) return [];

    let query = getSupabase().from(table).select('*').eq('company_id', active);
    if (columnsOf(table)?.created_at) query = query.order('created_at', { ascending: false });
    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map((row) => toDomainRow(table, row));
}

export async function fetchRowById(collectionName, id) {
    const table = resolveTable(collectionName);
    const [col, val] = idFilter(id);
    const { data, error } = await getSupabase()
        .from(table).select('*').eq('company_id', getActiveCompanyId()).eq(col, val).maybeSingle();
    if (error) throw error;
    return data ? toDomainRow(table, data) : null;
}

export async function insertRow(collectionName, data, { id: explicitId } = {}) {
    const table = resolveTable(collectionName);
    const companyId = getActiveCompanyId();
    if (!companyId) throw new Error('لا توجد شركة نشطة. لا يمكن تنفيذ عملية على بيانات الشركة.');
    const { columns, metadata, increments } = toDbPayload(table, data);
    const cols = columnsOf(table);
    const sb = getSupabase();
    for (const [key, operand] of Object.entries(increments)) {
        if (key in cols) columns[key] = operand;
        else metadata[key] = operand;
    }
    if (cols.created_by && !columns.created_by) {
        const { data: sess } = await sb.auth.getSession();
        if (sess?.session?.user?.id) columns.created_by = sess.session.user.id;
    }
    const row = { ...columns, company_id: companyId, metadata, ...(explicitId ? { id: explicitId } : {}) };
    const { data: inserted, error } = await sb.from(table).insert(row).select('id').single();
    if (error) throw error;
    return { id: inserted.id };
}

export async function upsertRow(collectionName, docId, data) {
    const companyId = getActiveCompanyId();
    if (!companyId) throw new Error('لا توجد شركة نشطة. لا يمكن تنفيذ عملية على بيانات الشركة.');
    const existing = await fetchRowById(collectionName, docId);
    if (existing) return updateRow(collectionName, existing.id, data);
    const { id } = await insertRow(
        collectionName,
        { ...data, ...(isUuid(docId) ? {} : { legacy_firebase_id: String(docId) }) },
        isUuid(docId) ? { id: docId } : {}
    );
    return { id };
}

export async function updateRow(collectionName, id, data) {
    const table = resolveTable(collectionName);
    const { columns, metadata, increments } = toDbPayload(table, data);
    const sb = getSupabase();
    const [col, val] = idFilter(id);
    const patch = { ...columns, updated_at: new Date().toISOString() };
    if (Object.keys(increments).length) {
        // No server-side increment from the client: read the row and add. Financial
        // balances must use the RPCs; this path is only for low-contention counters.
        const { data: current, error: incError } = await sb.from(table).select('*')
            .eq('company_id', getActiveCompanyId()).eq(col, val).maybeSingle();
        if (incError) throw incError;
        if (!current) throw new Error('Document not found');
        const flat = toDomainRow(table, current);
        for (const [key, operand] of Object.entries(increments)) {
            const next = (Number(flat[key]) || 0) + operand;
            if (key in columnsOf(table)) patch[key] = next;
            else metadata[key] = next;
        }
    }
    if (Object.keys(metadata).length) {
        // Merge into the existing metadata instead of replacing it.
        const { data: row, error: readError } = await sb.from(table).select('metadata')
            .eq('company_id', getActiveCompanyId()).eq(col, val).maybeSingle();
        if (readError) throw readError;
        if (!row) throw new Error('Document not found');
        patch.metadata = { ...(row.metadata || {}), ...metadata };
    }
    if (!columnsOf(table)?.updated_at) delete patch.updated_at;
    const { error } = await sb.from(table).update(patch).eq('company_id', getActiveCompanyId()).eq(col, val);
    if (error) throw error;
}

export async function deleteRow(collectionName, id) {
    const table = resolveTable(collectionName);
    const [col, val] = idFilter(id);
    const { error } = await getSupabase()
        .from(table).delete().eq('company_id', getActiveCompanyId()).eq(col, val);
    if (error) throw error;
}
