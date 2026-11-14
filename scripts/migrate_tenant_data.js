import fs from 'fs';
import path from 'path';

const PROJECT_ID = 'nexora-erp-86d44';
const DEFAULT_COMPANY_ID = 'XUxJmdciC0aw619x3xXz';

// Get access token from firebase-tools config
const getAccessToken = () => {
    const configPath = path.join(process.env.USERPROFILE, '.config', 'configstore', 'firebase-tools.json');
    if (!fs.existsSync(configPath)) {
        throw new Error('Firebase CLI configuration not found at ' + configPath);
    }
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const token = config?.tokens?.access_token;
    if (!token) {
        throw new Error('Access token not found in Firebase CLI config');
    }
    return token;
};

const BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

const collections = [
    'products',
    'customers',
    'sales',
    'suppliers',
    'purchases',
    'accounts',
    'expenses',
    'cashflow',
    'debts',
    'employees',
    'attendance',
    'payroll_adjustments',
    'salary_payments',
    'visits',
    'receipts',
    'field_expenses',
    'field_requests',
    'daily_reconciliations',
    'van_inventory',
    'inventory_adjustments',
    'inventory_movements',
    'production_orders',
    'profit_reports',
    'returns',
    'notifications',
    'activity_logs',
    'users'
];

async function fetchAllDocuments(collectionName, token) {
    let docs = [];
    let pageToken = '';

    do {
        const url = new URL(`${BASE_URL}/${collectionName}`);
        url.searchParams.set('pageSize', '300');
        if (pageToken) url.searchParams.set('pageToken', pageToken);

        const res = await fetch(url.toString(), {
            headers: { Authorization: `Bearer ${token}` }
        });

        if (!res.ok) {
            const err = await res.text();
            throw new Error(`Failed to list ${collectionName}: ${res.status} - ${err}`);
        }

        const data = await res.json();
        if (data.documents) {
            docs = docs.concat(data.documents);
        }
        pageToken = data.nextPageToken || '';
    } while (pageToken);

    return docs;
}

async function patchDocumentCompany(docName, token) {
    const url = new URL(`https://firestore.googleapis.com/v1/${docName}`);
    url.searchParams.set('updateMask.fieldPaths', 'company_id');

    const body = {
        fields: {
            company_id: { stringValue: DEFAULT_COMPANY_ID }
        }
    };

    const res = await fetch(url.toString(), {
        method: 'PATCH',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Failed to patch ${docName}: ${res.status} - ${err}`);
    }
}

async function runMigration() {
    console.log('🚀 Starting Multi-Tenant Data Migration for project:', PROJECT_ID);
    console.log('🎯 Target Default Company ID:', DEFAULT_COMPANY_ID);

    const token = getAccessToken();
    const stats = {};

    for (const coll of collections) {
        process.stdout.write(`Processing [${coll}]... `);
        try {
            const docs = await fetchAllDocuments(coll, token);
            let updatedCount = 0;
            let alreadySetCount = 0;

            for (const doc of docs) {
                const docId = doc.name.split('/').pop();
                const fields = doc.fields || {};

                // For users, skip super_admin if desired, but regular users must have company_id
                if (coll === 'users') {
                    const role = fields.role?.stringValue;
                    const isSuperAdmin = fields.is_super_admin?.booleanValue;
                    if (role === 'super_admin' || isSuperAdmin) {
                        alreadySetCount++;
                        continue;
                    }
                }

                if (!fields.company_id || !fields.company_id.stringValue) {
                    await patchDocumentCompany(doc.name, token);
                    updatedCount++;
                } else {
                    alreadySetCount++;
                }
            }

            stats[coll] = { total: docs.length, updated: updatedCount, unchanged: alreadySetCount };
            console.log(`Total: ${docs.length} (Updated: ${updatedCount}, Unchanged: ${alreadySetCount})`);
        } catch (e) {
            console.log(`Error: ${e.message}`);
            stats[coll] = { error: e.message };
        }
    }

    console.log('\n========================================');
    console.log('Migration Completed Successfully!');
    console.table(stats);
    console.log('========================================\n');
}

runMigration().catch(err => {
    console.error('Fatal Migration Error:', err);
    process.exit(1);
});
