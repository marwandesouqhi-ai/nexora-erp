// whatsapp: replaces sendWhatsappMessage / checkWhatsappConnection (Firebase callables).
// UltraMsg credentials live only in function secrets: ULTRAMSG_INSTANCE_ID, ULTRAMSG_TOKEN.
// Body: { action: 'send', phone, message, priority? } | { action: 'check' }
import { HttpError, adminClient, json, readBody, requireCaller, serve } from '../_shared/lib.ts';

const INSTANCE_ID = (Deno.env.get('ULTRAMSG_INSTANCE_ID') || '').replace(/^instance/i, '');
const TOKEN = Deno.env.get('ULTRAMSG_TOKEN') || '';

function formatPhone(phone: string): string {
  let cleaned = String(phone || '').replace(/\D/g, '');
  if (cleaned.startsWith('0')) cleaned = '20' + cleaned.substring(1);
  if (cleaned.length === 10) cleaned = '20' + cleaned;
  return cleaned;
}

async function callUltraMsg(path: string, params: Record<string, string> = {}, method: 'GET' | 'POST' = 'POST') {
  if (!INSTANCE_ID || !TOKEN) {
    throw new HttpError(412, 'UltraMsg credentials are not configured on the server.', 'failed-precondition');
  }
  const url = new URL(`https://api.ultramsg.com/wa/instance${INSTANCE_ID}/${path}`);
  const init: RequestInit = { method };
  if (method === 'GET') {
    url.searchParams.set('token', TOKEN);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  } else {
    init.headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
    init.body = new URLSearchParams({ token: TOKEN, ...params });
  }
  const response = await fetch(url, init);
  const text = await response.text();
  let result: Record<string, unknown>;
  try {
    result = JSON.parse(text);
  } catch {
    throw new HttpError(502, `UltraMsg returned invalid JSON: ${text}`, 'internal');
  }
  if (!response.ok) throw new HttpError(502, `UltraMsg request failed: ${response.status}`, 'internal');
  if (result.sent === 'true' || result.success === true || result.status === 'sent') return result;
  if (result.error || result.message) {
    throw new HttpError(502, `UltraMsg response indicates failure: ${result.error || result.message}`, 'internal');
  }
  return result;
}

Deno.serve(serve(async (req) => {
  const caller = await requireCaller(req);
  const admin = adminClient();
  // Only active ERP users or platform staff may use the company WhatsApp line.
  const [{ data: profile }, { data: staff }] = await Promise.all([
    admin.from('profiles').select('status,is_active').eq('id', caller.id).maybeSingle(),
    admin.from('platform_staff').select('status,is_active').eq('id', caller.id).maybeSingle(),
  ]);
  const ok = (row: { status?: string | null; is_active?: boolean | null } | null) => !!row && row.status !== 'suspended' && row.is_active !== false;
  if (!ok(profile) && !ok(staff)) throw new HttpError(403, 'Active account required.', 'permission-denied');

  const body = await readBody(req);
  if (body.action === 'check') {
    return json({ success: true, result: await callUltraMsg('me', {}, 'GET') });
  }

  const { phone, message, priority = '1' } = body as Record<string, string>;
  if (!phone || !message) throw new HttpError(400, 'Phone number and message are required.', 'invalid-argument');
  const to = formatPhone(phone);
  if (!/^20\d{10}$/.test(to)) throw new HttpError(400, 'A valid Egyptian phone number is required.', 'invalid-argument');
  if (String(message).trim().length > 4096) throw new HttpError(400, 'WhatsApp message is too long.', 'invalid-argument');
  const result = await callUltraMsg('chat', { to, body: String(message).trim(), priority: String(priority) });
  return json({ success: true, result });
}));
