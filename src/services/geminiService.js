/**
 * geminiService.js — تكامل الذكاء الاصطناعي مع Gemini
 *
 * يدعم:
 * 1. الربط المباشر بمفتاح API الشخصي من Google AI Studio (حسابك الشخصي في جيمناي)
 * 2. الربط عبر Firebase AI Logic كخيار بديل
 * 3. ترقية الموديل تلقائياً إلى الجيل الأحدث gemini-2.0-flash بدلاً من 1.5-flash المتقاعد
 * 4. streaming للردود الفورية بتأثير الكتابة التدريجية
 * 5. fallback ذكي محلي إذا تعذر الاتصال
 */

import app from '@/api/firebase';
import { appCheck } from '@/api/firebase';

// مفتاح التخزين المحلي لمفتاح API الشخصي
export const PERSONAL_KEY_STORAGE = 'nexora_gemini_api_key';

// اسم الموديل الافتراضي المعتمد (gemini-1.5-flash)
export const DEFAULT_GEMINI_MODEL = 'gemini-1.5-flash';
let _activeModel = (import.meta.env.VITE_GEMINI_MODEL || DEFAULT_GEMINI_MODEL).trim();

export const getActiveModel = () => _activeModel;
export const setActiveModel = (model) => {
    if (model && typeof model === 'string') _activeModel = model.trim();
};

export const GEMINI_MODEL = _activeModel;

const isTransientModelError = (error) =>
    /capacity|unavailable|overloaded|high demand|rate.?limit|temporar|\[500\]|\b503\b|\b429\b/i.test(error?.message || '');

// ====================================================
// إدارة مفتاح API الشخصي (Google AI Studio)
// ====================================================

/**
 * الحصول على مفتاح API الشخصي الحالي (من localStorage أو .env)
 * @returns {string}
 */
export function getPersonalApiKey() {
    try {
        const savedKey = localStorage.getItem(PERSONAL_KEY_STORAGE);
        if (savedKey && savedKey.trim()) return savedKey.trim();
    } catch {
        // localStorage قد يكون مقيداً
    }
    return (import.meta.env.VITE_GEMINI_API_KEY || '').trim();
}

/**
 * حفظ أو إزالة مفتاح API الشخصي
 * @param {string|null} key
 */
export function setPersonalApiKey(key) {
    try {
        if (key && key.trim()) {
            localStorage.setItem(PERSONAL_KEY_STORAGE, key.trim());
        } else {
            localStorage.removeItem(PERSONAL_KEY_STORAGE);
        }
    } catch (e) {
        console.error('Failed to set personal Gemini API key in localStorage:', e);
    }
}

/**
 * فحص صلاحية مفتاح Gemini عبر استعلام تجريبي خفيف
 * @param {string} key
 * @returns {Promise<{ ok: boolean, error?: string, reply?: string }>}
 */
export async function testGeminiApiKey(key) {
    const cleanKey = (key || '').trim();
    if (!cleanKey) {
        return { ok: false, error: 'يرجى إدخال مفتاح API أولاً.' };
    }

    let modelToUse = getActiveModel();
    try {
        let url = `https://generativelanguage.googleapis.com/v1beta/models/${modelToUse}:generateContent?key=${cleanKey}`;
        let res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [
                    {
                        role: 'user',
                        parts: [{ text: 'مرحباً، أجب بكلمة واحدة فقط: متصل' }]
                    }
                ],
                generationConfig: {
                    maxOutputTokens: 20,
                    temperature: 0.2
                }
            })
        });

        let data = await res.json();

        // الترقية التلقائية إذا نصحت جوجل بموديل أحدث
        if (!res.ok) {
            const errorMsg = data.error?.message || '';
            const match = errorMsg.match(/models\/(gemini-[a-zA-Z0-9.-]+)/);
            if (match && match[1] && match[1] !== modelToUse) {
                console.info(`[geminiService] Auto-switching test to recommended model: ${match[1]}`);
                setActiveModel(match[1]);
                modelToUse = match[1];
                url = `https://generativelanguage.googleapis.com/v1beta/models/${modelToUse}:generateContent?key=${cleanKey}`;
                res = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ role: 'user', parts: [{ text: 'مرحباً، أجب بكلمة واحدة فقط: متصل' }] }],
                        generationConfig: { maxOutputTokens: 20, temperature: 0.2 }
                    })
                });
                data = await res.json();
            }
        }

        if (!res.ok) {
            return {
                ok: false,
                error: data.error?.message || `فشل الاتصال: رمز الخطأ ${res.status}`
            };
        }

        const reply = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || 'متصل';
        return { ok: true, reply, model: modelToUse };
    } catch (err) {
        return {
            ok: false,
            error: err.message || 'تعذر الاتصال بخوادم Google AI Studio. تحقق من الإنترنت.'
        };
    }
}

/**
 * معرفة نوع المزود النشط حالياً
 * @returns {{ provider: 'personal'|'firebase'|'none', label: string, model: string }}
 */
export function getGeminiProviderInfo() {
    const personalKey = getPersonalApiKey();
    if (personalKey) {
        return {
            provider: 'personal',
            label: 'حسابك الشخصي (Google AI Studio)',
            model: GEMINI_MODEL,
        };
    }
    if (appCheck) {
        return {
            provider: 'firebase',
            label: 'مشروع Firebase AI Logic',
            model: GEMINI_MODEL,
        };
    }
    return {
        provider: 'none',
        label: 'مساعد النظام المحلي (بدون API)',
        model: 'Offline Assistant',
    };
}

// ====================================================
// تهيئة وتجهيز Firebase AI Logic (خيار بديل)
// ====================================================

let _ai = null;
let _model = null;
let _firebaseAvailable = null;
let _firebaseInitError = null;

async function initFirebaseAI() {
    if (_firebaseAvailable !== null) return _firebaseAvailable;

    if (!appCheck) {
        _firebaseInitError = new Error('Firebase App Check is required for Firebase AI Logic.');
        _firebaseAvailable = false;
        return _firebaseAvailable;
    }

    try {
        const { getAI, getGenerativeModel, GoogleAIBackend } = await import('firebase/ai');

        _ai = getAI(app, { backend: new GoogleAIBackend() });
        _model = getGenerativeModel(_ai, {
            model: GEMINI_MODEL,
            generationConfig: {
                maxOutputTokens: 1024,
                temperature: 0.7,
                topP: 0.95,
            },
        });

        _firebaseAvailable = true;
        console.info('[geminiService] Firebase AI Logic initialized ✓ using model:', GEMINI_MODEL);
    } catch (err) {
        _firebaseInitError = err;
        _firebaseAvailable = false;
        console.warn('[geminiService] Firebase AI Logic unavailable:', err.message);
    }

    return _firebaseAvailable;
}

// ====================================================
// تحويل تاريخ المحادثة لصيغة Gemini
// ====================================================

function toGeminiHistory(messages) {
    const normalizedMessages = (Array.isArray(messages) ? messages : [])
        .filter((m) => m && (m.role === 'user' || m.role === 'assistant'))
        .filter((m) => typeof m.content === 'string' && m.content.trim());

    if (!normalizedMessages.length) return [];

    const firstUserIndex = normalizedMessages.findIndex((m) => m.role === 'user');
    if (firstUserIndex === -1) return [];

    const history = normalizedMessages.slice(firstUserIndex).map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content.trim() }],
    }));

    if (history[0]?.role === 'model') {
        return history.slice(1);
    }

    return history;
}

// ====================================================
// إرسال الرسالة عبر حساب Google AI Studio الشخصي
// ====================================================

async function streamPersonalGeminiResponse({
    apiKey,
    userMessage,
    systemPrompt,
    history = [],
    onChunk,
}) {
    const contents = [];

    // إضافة المحادثات السابقة
    const geminiHistory = toGeminiHistory(history);
    for (const item of geminiHistory) {
        contents.push({
            role: item.role,
            parts: item.parts,
        });
    }

    // إضافة الرسالة الحالية
    contents.push({
        role: 'user',
        parts: [{ text: userMessage }],
    });

    const body = {
        contents,
        systemInstruction: {
            parts: [{ text: systemPrompt }],
        },
        generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1024,
            topP: 0.95,
        },
    };

    let modelToUse = getActiveModel();
    let url = `https://generativelanguage.googleapis.com/v1beta/models/${modelToUse}:streamGenerateContent?alt=sse&key=${apiKey}`;
    let response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMsg = errorData.error?.message || '';
        const match = errorMsg.match(/models\/(gemini-[a-zA-Z0-9.-]+)/);
        if (match && match[1] && match[1] !== modelToUse) {
            console.info(`[geminiService] Auto-retrying stream with recommended model: ${match[1]}`);
            setActiveModel(match[1]);
            modelToUse = match[1];
            url = `https://generativelanguage.googleapis.com/v1beta/models/${modelToUse}:streamGenerateContent?alt=sse&key=${apiKey}`;
            response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
        }
    }

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `خطأ Google AI Studio (${response.status})`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let fullText = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('data:')) {
                const dataStr = trimmed.slice(5).trim();
                if (dataStr && dataStr !== '[DONE]') {
                    try {
                        const parsed = JSON.parse(dataStr);
                        const chunk = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
                        if (chunk) {
                            fullText += chunk;
                            if (onChunk) onChunk(chunk);
                        }
                    } catch {
                        // ignore partial chunk json
                    }
                }
            }
        }
    }

    return fullText || 'تم استلام رد فارغ من Gemini.';
}

// ====================================================
// إرسال رسالة مع streaming (الدالة الموحدة الرئيسية)
// ====================================================

export async function streamAssistantResponse({
    userMessage,
    systemPrompt,
    history = [],
    onChunk,
}) {
    const personalKey = getPersonalApiKey();

    // 1. إذا كان لدى المستخدم مفتاح حساب شخصي في Google AI Studio:
    if (personalKey) {
        try {
            return await streamPersonalGeminiResponse({
                apiKey: personalKey,
                userMessage,
                systemPrompt,
                history,
                onChunk,
            });
        } catch (personalErr) {
            console.warn('[geminiService] Personal API key failed, checking fallback:', personalErr);
            // إذا كان خطأ مفتاح غير صالح نعرض للمستخدم رسالة توضيحية
            if (/API_KEY_INVALID|key not valid|permission_denied/i.test(personalErr.message)) {
                const msg = `⚠️ مفتاح Gemini الشخصي المدخل غير صالح أو انتهت صلاحيته. يرجى تعديله من زر "مفتاح Gemini الشخصي". (${personalErr.message})`;
                if (onChunk) onChunk(msg);
                return msg;
            }
        }
    }

    // 2. إذا لم يتوفر مفتاح شخصي، نحاول عبر Firebase AI Logic:
    const firebaseReady = await initFirebaseAI();
    if (firebaseReady && _model) {
        try {
            const geminiHistory = toGeminiHistory(history);
            const chat = _model.startChat({
                history: geminiHistory,
                systemInstruction: systemPrompt,
            });

            let result;
            try {
                result = await chat.sendMessageStream(userMessage);
            } catch (error) {
                if (isTransientModelError(error)) {
                    const msg = '⚠️ خوادم الذكاء الاصطناعي تشهد ضغطاً مؤقتاً (Capacity Limit / 503). يُرجى المحاولة بعد لحظات.';
                    if (onChunk) onChunk(msg);
                    return msg;
                }
                throw error;
            }

            let fullText = '';
            for await (const chunk of result.stream) {
                const chunkText = chunk.text();
                if (chunkText) {
                    fullText += chunkText;
                    if (onChunk) onChunk(chunkText);
                }
            }

            return fullText || 'لم أتلقَّ ردًا.';
        } catch (fbErr) {
            console.error('[geminiService] Firebase AI Logic stream error:', fbErr);
        }
    }

    // 3. Fallback محلي ذكي إذا تعذر الاتصال بكلا الطريقتين
    const fallback = getFallbackResponse(userMessage, true, _firebaseInitError);
    if (onChunk) onChunk(fallback);
    return fallback;
}

// ====================================================
// Fallback محلي (بدون API)
// ====================================================

function getFallbackResponse(text, isError = false, error = null) {
    if (isError) {
        if (isTransientModelError(error)) {
            return '⚠️ خوادم الذكاء الاصطناعي تشهد ضغطاً مؤقتاً (Capacity Limit / 503). يُرجى المحاولة بعد لحظات.';
        }
        return '🤖 خدمة الذكاء الاصطناعي الخارجية غير متصلة حالياً. يمكنك تفعيل حسابك الشخصي مجاناً عبر إدخال مفتاح API الخاص بك من زر "مفتاح Gemini الشخصي" في الأعلى، أو الاستفسار عن المخزون والمبيعات والديون مباشرة.';
    }

    const t = (text || '').toLowerCase();
    if (/مخزون|منخفض|stock/i.test(t)) {
        return '📦 يبدو أنك تسأل عن المخزون. تفقد الأصناف من شاشة إدارة الأصناف والتنبيهات للمخزون.';
    }
    if (/دين|ديون|مديونية/i.test(t)) {
        return '💰 يبدو أنك تسأل عن الديون والتحصيلات. تفقد شاشة الديون للتقارير الكاملة.';
    }
    if (/مبيعات|sale/i.test(t)) {
        return '📊 يبدو أنك تسأل عن المبيعات. تفقد شاشة المبيعات والفواتير للاطلاع على أداء اليوم.';
    }

    return '🤖 مساعد Nexora ERP جاهز لمساعدتك في استعراض بيانات النظام. لربط الذكاء الاصطناعي الكامل يمكنك إدخال مفتاح Gemini الشخصي مجاناً من إعدادات المساعد.';
}

/**
 * يتحقق مما إذا كان Gemini متاحاً (سواء عبر المفتاح الشخصي أو Firebase)
 * @returns {Promise<boolean>}
 */
export async function isGeminiAvailable() {
    if (getPersonalApiKey()) return true;
    const fbAvailable = await initFirebaseAI();
    return Boolean(fbAvailable && appCheck);
}

