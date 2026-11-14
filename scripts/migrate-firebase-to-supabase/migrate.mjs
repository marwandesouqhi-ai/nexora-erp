/**
 * Firestore + Firebase Auth  ->  Supabase (Postgres + Auth)
 *
 *   node migrate.mjs                 dry run: reads Firebase, transforms, prints counts, writes NOTHING
 *   node migrate.mjs --apply         writes to Supabase (idempotent: safe to re-run)
 *   node migrate.mjs --verify        compares row counts and money totals Firebase <-> Supabase
 *
 * Options:  --collections=sales,products   only these tenant collections
 *           --skip-auth                    do not create Supabase Auth users
 *           --send-reset                   e-mail a password-reset link to every migrated user
 *
 * Environment (never commit these):
 *   GOOGLE_APPLICATION_CREDENTIALS   path to a Firebase service-account JSON
 *   SUPABASE_URL                     https://<ref>.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY        service-role key (bypasses RLS)
 *
 * Design:
 *  - Every new id is a DETERMINISTIC UUIDv5 of "<collection>:<firestoreId>". References between
 *    documents (customer_id, items[].product_id, party_id...) are therefore rewritten by a pure
 *    function, with no lookup tables, and re-running the script updates the same rows (upsert).
 *  - The original Firestore id is kept in legacy_firebase_id.
 *  - Fields that are not columns are kept in the `metadata` jsonb column (nothing is dropped).
 *  - Firestore Timestamps become ISO strings.
 *  - Firebase password hashes cannot be imported by Supabase Auth: users get a random password
 *    and must use "forgot password" (or --send-reset).
 */
import crypto from 'node:crypto';
import admin from 'firebase-admin';
import { createClient } from '@supabase/supabase-js';

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const opt = (name) => argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
const APPLY = flag('apply');
const VERIFY = flag('verify');
const ONLY = opt('collections')?.split(',').map((s) => s.trim()).filter(Boolean);

let fdb; let sb;
function init() {
  for (const key of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'GOOGLE_APPLICATION_CREDENTIALS']) {
    if (!process.env[key]) {
      console.error(`Missing environment variable ${key}`);
      process.exit(1);
    }
  }
  admin.initializeApp();
  fdb = admin.firestore();
  sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// ─── deterministic ids ───────────────────────────────────────────────────────
const NAMESPACE = '6f1c2e0e-7a3b-4c55-9d0a-3b1d2f6a9c11'; // fixed: never change after the first run
const uuidV5 = (name) => {
  const ns = Buffer.from(NAMESPACE.replace(/-/g, ''), 'hex');
  const hash = crypto.createHash('sha1').update(ns).update(name).digest();
  hash[6] = (hash[6] & 0x0f) | 0x50;
  hash[8] = (hash[8] & 0x3f) | 0x80;
  const h = hash.subarray(0, 16).toString('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
};
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const newId = (collection, oldId) => (oldId ? (UUID_RE.test(oldId) ? oldId : uuidV5(`${collection}:${oldId}`)) : null);

// Firebase Auth uid -> Supabase auth user id (filled while migrating users)
const authIdByUid = new Map();
const userRef = (uid) => (uid ? authIdByUid.get(uid) ?? null : null);

// ─── value conversion ────────────────────────────────────────────────────────
const toPlain = (value) => {
  if (value === null || value === undefined) return value;
  if (typeof value?.toDate === 'function') return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map(toPlain);
  if (typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, toPlain(v)]));
  return value;
};
const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const dateOnly = (v) => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
};

// ─── per-collection mapping ──────────────────────────────────────────────────
// table        target table
// alias        Firestore field -> column name
// refs         scalar reference fields: column -> target collection (string) or fn(doc) => collection
// itemRefs     jsonb array fields whose elements hold product ids: [field, ...idKeys]
// dates        columns of type date (everything else timestamp-like becomes ISO)
// columns      real columns (anything else -> metadata). Kept in sync with src/data/schemaColumns.js
const MAP = {
  accounts: { table: 'accounts', alias: { account_name: 'name', account_type: 'type' } },
  customers: { table: 'customers', alias: {} },
  suppliers: { table: 'suppliers', alias: {} },
  employees: { table: 'employees', alias: {}, dates: ['join_date'] },
  products: { table: 'products', refs: { supplier_id: 'suppliers' }, dates: ['expiry_date'] },
  sales: {
    table: 'sales',
    alias: { total_amount: ['total_amount', 'total'] },
    refs: { customer_id: 'customers', account_id: 'accounts' },
    itemRefs: [['items', 'product_id', 'id']],
    special: (d, row) => { row.customer_legacy_id = d.customer_id || null; },
  },
  purchases: {
    table: 'purchases',
    alias: { invoice_no: ['invoice_no', 'invoice_number'], total_amount: ['total_amount', 'total'] },
    refs: { supplier_id: 'suppliers' },
    itemRefs: [['items', 'product_id', 'id']],
    special: (d, row) => { row.supplier_legacy_id = d.supplier_id || null; },
  },
  returns: {
    table: 'returns',
    refs: { party_id: 'customers', original_invoice_ref: 'sales' },
    itemRefs: [['items', 'product_id', 'id']],
  },
  debts: {
    table: 'debts',
    refs: {
      party_id: (d) => (d.party_type === 'supplier' || d.direction === 'we_owe' ? 'suppliers' : 'customers'),
      source_id: (d) => (d.source_type === 'purchase' ? 'purchases' : 'sales'),
    },
    dates: ['due_date'],
  },
  receipts: {
    table: 'receipts',
    refs: { customer_id: 'customers', employee_id: 'employees', account_id: 'accounts', safe_account_id: 'accounts' },
  },
  expenses: { table: 'expenses', refs: { account_id: 'accounts', employee_id: 'employees' }, dates: ['expense_date'] },
  cashflow: {
    table: 'cashflow',
    refs: {
      account_id: 'accounts',
      reference_id: (d) => ({ sale: 'sales', purchase: 'purchases', debt: 'debts', receipt: 'receipts', expense: 'expenses' }[d.reference_type] || null),
    },
  },
  inventory_movements: {
    table: 'inventory_movements',
    refs: {
      product_id: 'products',
      reference_id: (d) => ({ sale: 'sales', purchase: 'purchases', production: 'production_orders', van_inventory: 'van_inventory' }[d.reference_type] || null),
    },
  },
  inventory_adjustments: { table: 'inventory_adjustments', refs: {} },
  van_inventory: { table: 'van_inventory', refs: { rep_id: 'employees' }, itemRefs: [['items', 'product_id', 'id']] },
  production_orders: {
    table: 'manufacturing_orders',
    alias: { raw_materials: 'materials', product_id: 'finished_product_id', product_name: 'finished_product_name', quantity: 'qty_produced' },
    refs: { product_id: 'products' },
    itemRefs: [['raw_materials', 'product_id']],
    dates: ['start_date', 'due_date'],
    fromAlias: true,
  },
  attendance: { table: 'attendance', refs: { employee_id: 'employees' }, dates: ['attendance_date'] },
  visits: { table: 'visits', refs: { employee_id: 'employees', customer_id: 'customers' }, dates: ['visit_date'] },
  payroll_adjustments: { table: 'payroll_adjustments', refs: { employee_id: 'employees' }, dates: ['adjustment_date'] },
  salary_payments: { table: 'salary_payments', refs: { employee_id: 'employees' }, dates: ['payment_date'] },
  field_expenses: { table: 'field_expenses', refs: { employee_id: 'employees' } },
  field_requests: { table: 'field_requests', refs: { employee_id: 'employees' } },
  daily_reconciliations: { table: 'daily_reconciliations', refs: { rep_id: 'employees' }, dates: ['reconciliation_date'] },
  notifications: { table: 'notifications', refs: { recipient_id: 'employees' } },
  profit_reports: { table: 'profit_reports', refs: {}, dates: ['start_date', 'end_date'] },
  activity_logs: { table: 'activity_logs', refs: {} },
  settings: { table: 'settings', refs: {} },
};

// Load the real column lists from the app's own schema file so the two never drift.
import { readFileSync } from 'node:fs';
const schemaSrc = readFileSync(new URL('../../src/data/schemaColumns.js', import.meta.url), 'utf8');
const signature = schemaSrc.match(/const SIGNATURE = `([\s\S]*?)`;/)?.[1] || '';
const COLUMNS = Object.fromEntries(
  signature.trim().split('\n').map((line) => {
    const open = line.indexOf('(');
    return [line.slice(0, open), Object.fromEntries(line.slice(open + 1, -1).split(',').map((c) => c.split(':')))];
  }),
);

function transform(collection, id, raw, companyUuid) {
  const spec = MAP[collection];
  const cols = COLUMNS[spec.table];
  const doc = toPlain(raw);
  const row = {};
  const metadata = {};

  for (const [key, value] of Object.entries(doc)) {
    if (value === undefined || ['id', 'company_id', 'created_by', 'uid'].includes(key)) continue;
    // production_orders: Firestore field name differs from the column name
    const column = spec.fromAlias
      ? Object.entries(spec.alias || {}).find(([, src]) => src === key)?.[0] || key
      : key;
    if (column in cols && column !== 'metadata') row[column] = value;
    else metadata[key] = value;
  }
  // Column aliases with several source names (first present wins)
  if (!spec.fromAlias) {
    for (const [column, source] of Object.entries(spec.alias || {})) {
      const sources = Array.isArray(source) ? source : [source];
      const hit = sources.find((s) => doc[s] !== undefined && doc[s] !== null);
      if (hit && column in cols) row[column] = doc[hit];
    }
  }
  // Reference rewriting
  for (const [column, target] of Object.entries(spec.refs || {})) {
    const targetCollection = typeof target === 'function' ? target(doc) : target;
    const old = doc[column] ?? (spec.fromAlias ? doc[spec.alias?.[column]] : undefined);
    if (old && targetCollection) row[column] = newId(targetCollection, String(old));
    else if (column in row && !old) row[column] = null;
  }
  for (const [field, ...keys] of spec.itemRefs || []) {
    const source = doc[field] ?? doc[spec.alias?.[field]];
    if (Array.isArray(source)) {
      row[field] = source.map((item) => {
        const key = keys.find((k) => item?.[k]);
        return key ? { ...item, product_id: newId('products', String(item[key])) } : item;
      });
    }
  }
  for (const column of spec.dates || []) if (row[column] !== undefined) row[column] = dateOnly(row[column]);
  // Plain numeric columns must be numeric
  for (const [column, type] of Object.entries(cols)) {
    if (type === 'numeric' && row[column] !== undefined) row[column] = num(row[column]);
  }
  spec.special?.(doc, row);

  // Timestamps
  for (const column of Object.keys(cols)) {
    if (cols[column] === 'tstz' && typeof row[column] === 'string' && Number.isNaN(Date.parse(row[column]))) delete row[column];
  }
  row.id = newId(collection, id);
  row.company_id = companyUuid;
  row.legacy_firebase_id = id;
  if ('legacy_firebase_uid' in cols && doc.created_by) row.legacy_firebase_uid = String(doc.created_by);
  const creator = userRef(doc.created_by);
  if (creator && ('created_by' in cols)) row.created_by = creator;
  if (!cols.created_at && row.created_at) delete row.created_at;
  row.metadata = metadata;
  return row;
}

// ─── Firebase readers ────────────────────────────────────────────────────────
async function readAll(collection) {
  const snap = await fdb.collection(collection).get();
  return snap.docs.map((d) => ({ id: d.id, data: d.data() }));
}

async function upsertBatches(table, rows, conflict = 'id') {
  const size = 500;
  for (let i = 0; i < rows.length; i += size) {
    const chunk = rows.slice(i, i + size);
    const { error } = await sb.from(table).upsert(chunk, { onConflict: conflict });
    if (error) throw new Error(`${table}: ${error.message}`);
  }
}

// ─── steps ───────────────────────────────────────────────────────────────────
const report = [];
const note = (step, detail) => { report.push({ step, ...detail }); console.log(`• ${step}:`, JSON.stringify(detail)); };

async function migrateCompanies() {
  const docs = await readAll('companies');
  const rows = docs.map(({ id, data }) => {
    const d = toPlain(data);
    const { name, email, phone, address, status, suspended_reason, subscription, created_at, updated_at, ...rest } = d;
    return {
      id: newId('companies', id),
      legacy_source_id: id,
      company_code: d.company_code || id,
      name: name || '', email: email || null, phone: phone || null, address: address || null,
      status: status || 'active',
      suspended_reason: suspended_reason || null,
      subscription: subscription || {},
      metadata: { ...rest },
      ...(created_at ? { created_at } : {}),
    };
  });
  note('companies', { read: docs.length, write: APPLY ? rows.length : 0 });
  if (APPLY && rows.length) await upsertBatches('companies', rows);
  return new Map(docs.map(({ id }) => [id, newId('companies', id)]));
}

async function migrateAuth(companyIds) {
  if (flag('skip-auth')) return;
  const users = [];
  let token;
  do {
    const page = await admin.auth().listUsers(1000, token);
    users.push(...page.users);
    token = page.pageToken;
  } while (token);

  const profileDocs = new Map((await readAll('users')).map((d) => [d.id, d.data]));
  const staffDocs = new Map((await readAll('platform_staff')).map((d) => [d.id, d.data]));
  let created = 0; let existing = 0; let skipped = 0;
  const profiles = []; const staff = [];

  for (const u of users) {
    const profile = profileDocs.get(u.uid);
    const staffDoc = staffDocs.get(u.uid);
    if (!profile && !staffDoc) { skipped += 1; continue; } // orphan Auth account
    const email = (u.email || '').toLowerCase();
    if (!email) { skipped += 1; continue; }

    let supabaseId = null;
    if (APPLY) {
      const { data, error } = await sb.auth.admin.createUser({
        email, email_confirm: true, password: crypto.randomBytes(24).toString('base64url'),
        user_metadata: { name: profile?.name || staffDoc?.name || u.displayName || '', legacy_firebase_uid: u.uid },
        ...(u.disabled ? { ban_duration: '876000h' } : {}),
      });
      if (error) {
        if (!/already|registered|exists/i.test(error.message)) throw new Error(`auth ${email}: ${error.message}`);
        // already migrated on a previous run: find it
        for (let p = 1; p <= 20 && !supabaseId; p++) {
          const { data: list } = await sb.auth.admin.listUsers({ page: p, perPage: 200 });
          supabaseId = list?.users.find((x) => (x.email || '').toLowerCase() === email)?.id || null;
          if (!list || list.users.length < 200) break;
        }
        existing += 1;
      } else {
        supabaseId = data.user.id; created += 1;
        if (flag('send-reset')) await sb.auth.resetPasswordForEmail(email).catch(() => null);
      }
    } else {
      supabaseId = newId('auth', u.uid); // placeholder for dry-run reference checks
    }
    if (!supabaseId) { skipped += 1; continue; }
    authIdByUid.set(u.uid, supabaseId);

    if (staffDoc) {
      staff.push({
        id: supabaseId, name: staffDoc.name || '', email, role: staffDoc.role,
        status: staffDoc.status || 'active', is_active: staffDoc.is_active !== false,
      });
    } else {
      const d = toPlain(profile);
      profiles.push({
        id: supabaseId,
        company_id: companyIds.get(d.company_id) || null,
        name: d.name || '', email, phone: d.phone || null, avatar_url: d.avatar_url || null,
        role: d.role || 'viewer',
        permission_overrides: d.permission_overrides || {},
        status: d.status || 'active', is_active: d.is_active !== false,
      });
    }
  }
  note('auth users', { firebase: users.length, created, existing, skipped, profiles: profiles.length, platform_staff: staff.length });
  if (APPLY) {
    if (profiles.length) await upsertBatches('profiles', profiles);
    if (staff.length) await upsertBatches('platform_staff', staff);
  }
}

async function migrateCollection(collection, companyIds) {
  const spec = MAP[collection];
  const docs = await readAll(collection);
  const rows = []; let orphans = 0;
  for (const { id, data } of docs) {
    const companyUuid = companyIds.get(data.company_id);
    if (!companyUuid) { orphans += 1; continue; }
    rows.push(transform(collection, id, data, companyUuid));
  }
  note(collection, { read: docs.length, write: APPLY ? rows.length : 0, would_write: rows.length, skipped_no_company: orphans });
  if (APPLY && rows.length) await upsertBatches(spec.table, rows);
}

// Dependency order keeps references meaningful even without FK enforcement on legacy text ids.
const ORDER = [
  'accounts', 'customers', 'suppliers', 'employees', 'products',
  'sales', 'purchases', 'returns', 'debts', 'receipts', 'expenses', 'cashflow',
  'inventory_movements', 'inventory_adjustments', 'van_inventory', 'production_orders',
  'attendance', 'visits', 'payroll_adjustments', 'salary_payments',
  'field_expenses', 'field_requests', 'daily_reconciliations',
  'notifications', 'profit_reports', 'activity_logs', 'settings',
];

async function verify(companyIds) {
  console.log('\nVerification (Firebase vs Supabase)');
  let mismatches = 0;
  for (const collection of ORDER.filter((c) => !ONLY || ONLY.includes(c))) {
    const spec = MAP[collection];
    const [{ count: fbCount }, { count: sbCount, error }] = await Promise.all([
      fdb.collection(collection).count().get().then((s) => ({ count: s.data().count })),
      sb.from(spec.table).select('id', { count: 'exact', head: true }).in('company_id', [...companyIds.values()]),
    ]);
    if (error) throw error;
    const ok = fbCount === sbCount;
    if (!ok) mismatches += 1;
    console.log(`${ok ? '✓' : '✗'} ${collection.padEnd(24)} firebase=${fbCount}  supabase=${sbCount}`);
  }
  // Money checks per company: sales total, products stock, customer balances
  for (const [oldId, uuid] of companyIds) {
    const sums = async (collection, field) => (await fdb.collection(collection).where('company_id', '==', oldId).get())
      .docs.reduce((acc, d) => acc + num(d.data()[field] ?? (field === 'total_amount' ? d.data().total : 0)), 0);
    const sbSum = async (table, field) => {
      const { data } = await sb.from(table).select(field).eq('company_id', uuid);
      return (data || []).reduce((acc, r) => acc + num(r[field]), 0);
    };
    for (const [collection, table, field] of [['sales', 'sales', 'total_amount'], ['products', 'products', 'current_stock'], ['customers', 'customers', 'balance']]) {
      const [a, b] = [await sums(collection, field), await sbSum(table, field)];
      const ok = Math.abs(a - b) < 0.01;
      if (!ok) mismatches += 1;
      console.log(`${ok ? '✓' : '✗'} ${oldId} ${collection}.${field}: firebase=${a.toFixed(2)} supabase=${b.toFixed(2)}`);
    }
  }
  console.log(mismatches ? `\n${mismatches} mismatch(es) - do NOT cut over.` : '\nAll checks passed.');
  process.exit(mismatches ? 2 : 0);
}

// ─── main ───────────────────────────────────────────────────────────────────
export { transform, newId, uuidV5, MAP };

async function main() {
  init();
console.log(APPLY ? 'MODE: APPLY (writes to Supabase)' : VERIFY ? 'MODE: VERIFY' : 'MODE: DRY RUN (no writes)');
const companyIds = await migrateCompanies();
if (VERIFY) await verify(companyIds);
await migrateAuth(companyIds);
for (const collection of ORDER.filter((c) => !ONLY || ONLY.includes(c))) {
  await migrateCollection(collection, companyIds);
}
console.log('\nDone.', APPLY ? 'Now run with --verify before any cut-over.' : 'Re-run with --apply to write.');
}

import { pathToFileURL } from 'node:url';
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
