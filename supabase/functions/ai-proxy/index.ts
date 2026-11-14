// ai-proxy: server-side Gemini access (replaces Firebase AI Logic + App Check).
// The API key stays in the GEMINI_API_KEY secret. Authenticated users only, with a best-effort
// per-user rate limit (in-memory per isolate; use a table or Redis for a hard limit).
// Body: { model?, contents, systemInstruction?, generationConfig? }  ->  Gemini generateContent response.
import { HttpError, json, readBody, requireCaller, serve } from '../_shared/lib.ts';

const ALLOWED_MODELS = new Set(['gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-2.5-flash']);
const MAX_REQUESTS_PER_MINUTE = 20;
const MAX_BODY_CHARS = 60_000;

const hits = new Map<string, number[]>();
function rateLimit(userId: string) {
  const now = Date.now();
  const recent = (hits.get(userId) || []).filter((t) => now - t < 60_000);
  if (recent.length >= MAX_REQUESTS_PER_MINUTE) throw new HttpError(429, 'Too many requests. Try again in a minute.', 'resource-exhausted');
  recent.push(now);
  hits.set(userId, recent);
}

Deno.serve(serve(async (req) => {
  const caller = await requireCaller(req);
  rateLimit(caller.id);

  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) throw new HttpError(412, 'GEMINI_API_KEY is not configured.', 'failed-precondition');

  const body = await readBody(req);
  if (JSON.stringify(body).length > MAX_BODY_CHARS) throw new HttpError(413, 'Request too large.', 'invalid-argument');
  if (!Array.isArray(body.contents) || body.contents.length === 0) throw new HttpError(400, 'contents is required.', 'invalid-argument');

  const model = String(body.model || 'gemini-2.0-flash');
  if (!ALLOWED_MODELS.has(model)) throw new HttpError(400, 'Model not allowed.', 'invalid-argument');

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: body.contents,
        ...(body.systemInstruction ? { systemInstruction: body.systemInstruction } : {}),
        generationConfig: { maxOutputTokens: 1024, temperature: 0.7, topP: 0.95, ...(body.generationConfig as object || {}) },
      }),
    },
  );
  const text = await response.text();
  if (!response.ok) throw new HttpError(502, `Gemini request failed: ${response.status} ${text.slice(0, 300)}`, 'internal');
  return new Response(text, { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
}));
