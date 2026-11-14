/**
 * Drop-in replacement for the subset of `firebase/firestore` used by the simple
 * CRUD collection modules (Firebase -> Supabase migration, phase 4b).
 *
 * - Firebase backend: every function is the real SDK function, unchanged.
 * - Supabase backend: refs are lightweight descriptors and the calls are served by
 *   supabaseTenantDb (insert/update/delete/get) and Realtime (onSnapshot).
 *
 * Operations that need real transactions (runTransaction / writeBatch) are NOT
 * emulated; modules that use them are routed to Postgres RPCs instead.
 */
import * as fs from 'firebase/firestore';
import { isSupabaseBackend } from '@/api/backend';
import { getSupabase } from '@/api/supabase';
import { getActiveCompanyId } from '@/lib/currentTenant';
import {
    fetchRows,
    fetchRowById,
    insertRow,
    upsertRow,
    updateRow,
    deleteRow,
} from './supabaseTenantDb';
import { resolveTable } from './schemaColumns';

// Names that are the same on both backends.
export const {
    serverTimestamp,
    increment,
    writeBatch,
    runTransaction,
    Timestamp,
    limit,
} = fs;

const newId = () => globalThis.crypto.randomUUID();
const isDescriptor = (v, kind) => v && typeof v === 'object' && v.__sb === kind;

/* ---------------------------- refs & constraints ---------------------------- */

export const collection = (...args) => (isSupabaseBackend ? { __sb: 'col', name: args[1] } : fs.collection(...args));

export const doc = (...args) => {
    if (!isSupabaseBackend) return fs.doc(...args);
    const [first, name, id] = args;
    if (isDescriptor(first, 'col')) return { __sb: 'doc', name: first.name, id: name || newId() };
    return { __sb: 'doc', name, id: id ?? newId() };
};

export const where = (...args) => (isSupabaseBackend ? { __sb: 'where', field: args[0], op: args[1], value: args[2] } : fs.where(...args));
export const orderBy = (...args) => (isSupabaseBackend ? { __sb: 'order', field: args[0], dir: args[1] || 'asc' } : fs.orderBy(...args));
export const query = (ref, ...constraints) => (
    isSupabaseBackend ? { __sb: 'query', name: ref.name, constraints } : fs.query(ref, ...constraints)
);

/* ------------------------------- row helpers -------------------------------- */

const snapshotOfRow = (row) => ({
    id: row.id,
    exists: () => true,
    data: () => row,
});

const querySnapshotOf = (rows) => {
    const docs = rows.map(snapshotOfRow);
    return {
        docs,
        size: docs.length,
        empty: docs.length === 0,
        forEach: (cb) => docs.forEach(cb),
        docChanges: () => [],
    };
};

const compare = (a, b, op) => {
    // Timestamps/Dates compare by time, everything else by value.
    const norm = (v) => (v && typeof v.getTime === 'function' ? v.getTime() : v);
    const x = norm(a);
    const y = norm(b);
    switch (op) {
        case '==': return x === y;
        case '!=': return x !== y;
        case '>': return x > y;
        case '>=': return x >= y;
        case '<': return x < y;
        case '<=': return x <= y;
        case 'in': return Array.isArray(y) && y.includes(x);
        case 'not-in': return Array.isArray(y) && !y.includes(x);
        case 'array-contains': return Array.isArray(x) && x.includes(y);
        default: throw new Error(`Unsupported where operator on Supabase: ${op}`);
    }
};

async function runQuery(target) {
    const name = target.name;
    let rows = await fetchRows(name);
    for (const c of target.constraints || []) {
        if (c.__sb === 'where') rows = rows.filter((row) => compare(row[c.field], c.value, c.op));
    }
    const orders = (target.constraints || []).filter((c) => c.__sb === 'order');
    for (const o of [...orders].reverse()) {
        rows = [...rows].sort((a, b) => {
            const norm = (v) => (v && typeof v.getTime === 'function' ? v.getTime() : v);
            const x = norm(a[o.field]);
            const y = norm(b[o.field]);
            if (x === y) return 0;
            return (x > y ? 1 : -1) * (o.dir === 'desc' ? -1 : 1);
        });
    }
    return rows;
}

/* --------------------------------- reads ------------------------------------ */

export const getDoc = async (...args) => {
    if (!isSupabaseBackend) return fs.getDoc(...args);
    const [ref] = args;
    const row = await fetchRowById(ref.name, ref.id);
    return row
        ? snapshotOfRow(row)
        : { id: ref.id, exists: () => false, data: () => undefined };
};

export const getDocs = async (...args) => {
    if (!isSupabaseBackend) return fs.getDocs(...args);
    const [target] = args;
    const t = isDescriptor(target, 'col') ? { name: target.name, constraints: [] } : target;
    return querySnapshotOf(await runQuery(t));
};

/* -------------------------------- realtime ---------------------------------- */

export const onSnapshot = (...args) => {
    if (!isSupabaseBackend) return fs.onSnapshot(...args);
    const [target, onNext, onError] = args;
    const isDoc = isDescriptor(target, 'doc');
    const t = isDescriptor(target, 'col') ? { name: target.name, constraints: [] } : target;
    let active = true;

    const refresh = async () => {
        try {
            if (isDoc) {
                const snap = await getDoc(target);
                if (active) onNext(snap);
            } else {
                const snap = querySnapshotOf(await runQuery(t));
                if (active) onNext(snap);
            }
        } catch (err) {
            if (active && onError) onError(err);
        }
    };

    const sb = getSupabase();
    const table = resolveTable(isDoc ? target.name : t.name);
    const channel = sb
        .channel(`rt:${table}:${newId()}`)
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table, filter: `company_id=eq.${getActiveCompanyId()}` },
            () => { void refresh(); }
        )
        .subscribe();
    void refresh();

    return () => {
        active = false;
        sb.removeChannel(channel);
    };
};

/* --------------------------------- writes ----------------------------------- */

export const addDoc = async (...args) => {
    if (!isSupabaseBackend) return fs.addDoc(...args);
    const [ref, data] = args;
    return insertRow(ref.name, data);
};

export const setDoc = async (...args) => {
    if (!isSupabaseBackend) return fs.setDoc(...args);
    const [ref, data] = args;
    await upsertRow(ref.name, ref.id, data);
};

export const updateDoc = async (...args) => {
    if (!isSupabaseBackend) return fs.updateDoc(...args);
    const [ref, data] = args;
    await updateRow(ref.name, ref.id, data);
};

export const deleteDoc = async (...args) => {
    if (!isSupabaseBackend) return fs.deleteDoc(...args);
    const [ref] = args;
    await deleteRow(ref.name, ref.id);
};
