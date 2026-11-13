const fs = require('fs');
const path = require('path');

const env = fs.readFileSync(path.join(process.cwd(), '.env'), 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .reduce((acc, line) => {
        const m = line.match(/^([^=]+)=(.*)$/);
        if (m) acc[m[1]] = m[2];
        return acc;
    }, {});

const instance = env.VITE_ULTRAMSG_INSTANCE_ID;
const token = env.VITE_ULTRAMSG_TOKEN;
const id = instance ? instance.replace(/^instance/i, '') : '';
const url = `https://api.ultramsg.com/wa/instance${id}/me?token=${token}`;

console.log({ instance, id, token: token ? 'SET' : 'MISSING', url });

(async () => {
    try {
        const res = await fetch(url);
        const text = await res.text();
        console.log('status', res.status);
        console.log('body:', text);
    } catch (e) {
        console.error('fetch failed', e);
        process.exit(1);
    }
})();
