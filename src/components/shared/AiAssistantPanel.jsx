import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useRole } from '@/lib/RoleContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    ShieldCheck,
    Bot,
    Zap,
    Send,
    RefreshCw,
    TrendingUp,
    Package,
    DollarSign,
    AlertTriangle,
    BarChart3,
    Wifi,
    WifiOff,
    KeyRound,
    ExternalLink,
    CheckCircle2,
} from 'lucide-react';
import ChatMessage, { TypingIndicator } from '@/components/shared/ChatMessage';
import { buildAssistantSummary, runAssistantMessage } from '@/services/aiAssistantService';
import { getDailySummaryReport } from '@/services/assistantDataService';
import {
    isGeminiAvailable,
    getPersonalApiKey,
    setPersonalApiKey,
    testGeminiApiKey,
    getGeminiProviderInfo,
    GEMINI_MODEL,
} from '@/services/geminiService';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { logActivity } from '@/lib/activityLogger';

// ====================================================
// Quick Actions
// ====================================================

const QUICK_ACTIONS = [
    { key: 'low_stock', label: '📦 المخزون المنخفض', prompt: 'ما هي الأصناف منخفضة المخزون؟' },
    { key: 'today_sales', label: '📊 مبيعات اليوم', prompt: 'ما هو ملخص مبيعات اليوم؟' },
    { key: 'outstanding_debts', label: '💰 الديون المستحقة', prompt: 'ما هي الديون المستحقة؟' },
    { key: 'daily_report', label: '📋 التقرير اليومي', prompt: 'أعطني التقرير اليومي الشامل' },
    { key: 'expenses', label: '💸 مصروفات اليوم', prompt: 'كم بلغت مصروفات اليوم؟' },
    { key: 'profitability', label: '📈 تحليل الربحية', prompt: 'حلل ربحية اليوم وهامش الربح' },
    { key: 'cashflow', label: '💧 التدفق النقدي', prompt: 'ما هو صافي التدفق النقدي اليوم؟' },
    { key: 'activity', label: '🧾 آخر العمليات', prompt: 'اعرض آخر العمليات التي تمت على النظام' },
    { key: 'help', label: '❓ ما الذي تستطيع فعله؟', prompt: 'مساعدة — ماذا يمكنك أن تفعل؟' },
];

// ====================================================
// Main Component
// ====================================================

export default function AiAssistantPanel() {
    const { can, role, permissions: basePerms } = useRole();
    const { user } = useAuth();

    // --- Chat state ---
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [isStreaming, setIsStreaming] = useState(false);
    const [tabValue, setTabValue] = useState('conversation');

    // --- Data state ---
    const [contextData, setContextData] = useState(null);
    const [loadingContext, setLoadingContext] = useState(true);
    const [geminiOnline, setGeminiOnline] = useState(null); // null=checking

    // --- Personal API Key state ---
    const [apiKeyModalOpen, setApiKeyModalOpen] = useState(false);
    const [tempApiKey, setTempApiKey] = useState('');
    const [testingKey, setTestingKey] = useState(false);
    const [testResult, setTestResult] = useState(null);
    const [providerInfo, setProviderInfo] = useState(() => getGeminiProviderInfo());

    const chatEndRef = useRef(null);
    const inputRef = useRef(null);
    const streamBufferRef = useRef('');

    const handleOpenKeyModal = () => {
        setTempApiKey(getPersonalApiKey());
        setTestResult(null);
        setApiKeyModalOpen(true);
    };

    const handleSaveKey = () => {
        setPersonalApiKey(tempApiKey);
        const info = getGeminiProviderInfo();
        setProviderInfo(info);
        setGeminiOnline(Boolean(tempApiKey.trim() || info.provider !== 'none'));
        setApiKeyModalOpen(false);
    };

    const handleClearKey = () => {
        setPersonalApiKey('');
        setTempApiKey('');
        const info = getGeminiProviderInfo();
        setProviderInfo(info);
        setGeminiOnline(info.provider !== 'none');
        setTestResult(null);
    };

    const handleTestKey = async () => {
        if (!tempApiKey.trim()) {
            setTestResult({ ok: false, msg: 'يرجى إدخال مفتاح أولاً' });
            return;
        }
        setTestingKey(true);
        setTestResult(null);
        const res = await testGeminiApiKey(tempApiKey);
        setTestingKey(false);
        if (res.ok) {
            setTestResult({ ok: true, msg: `تم الاتصال بنجاح بنموذج ${GEMINI_MODEL}!` });
        } else {
            setTestResult({ ok: false, msg: res.error || 'فشل الاتصال بمفتاح API هذا' });
        }
    };

    // ====================================================
    // تحميل البيانات والتحقق من Gemini
    // ====================================================

    const loadContextData = useCallback(async () => {
        setLoadingContext(true);
        try {
            const [report, online] = await Promise.all([
                getDailySummaryReport(),
                isGeminiAvailable(),
            ]);
            setContextData(report);
            setGeminiOnline(online);

            // رسالة ترحيب تلقائية
            if (messages.length === 0) {
                const welcomeMsg = buildWelcomeMessage(can, role, online);
                setMessages([{ role: 'assistant', content: welcomeMsg, id: 'welcome' }]);
            }
        } catch (err) {
            console.error('[AiAssistantPanel] loadContextData:', err);
            setGeminiOnline(false);
        } finally {
            setLoadingContext(false);
        }
    }, [can, role, messages.length]);

    useEffect(() => {
        if (!can('can_use_ai_assistant')) return;
        loadContextData();
        const intervalId = setInterval(loadContextData, 60000); // تحديث دوري كل دقيقة لتجنب Stale Context
        return () => clearInterval(intervalId);
    }, [can, loadContextData]);

    // Scroll to bottom عند وصول رسالة جديدة
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // ====================================================
    // إرسال رسالة
    // ====================================================

    const handleSend = useCallback(async () => {
        const text = input.trim();
        if (!text || isStreaming) return;

        setInput('');
        inputRef.current?.focus();

        // إضافة رسالة المستخدم
        const userMsg = { role: 'user', content: text, id: Date.now() };
        setMessages((prev) => [...prev, userMsg]);
        setIsStreaming(true);
        streamBufferRef.current = '';

        // إضافة placeholder للمساعد
        const assistantId = Date.now() + 1;
        setMessages((prev) => [
            ...prev,
            { role: 'assistant', content: '', id: assistantId, isStreaming: true },
        ]);

        try {
            const history = messages
                .filter((m) => m && (m.role === 'user' || m.role === 'assistant'))
                .filter((m) => typeof m.content === 'string' && m.content.trim())
                .filter((m) => m.id !== 'welcome')
                .map((m) => ({ ...m, content: m.content.substring(0, 500) })) // تقليم الرسائل الطويلة
                .slice(-6); // آخر 6 رسائل فقط لتقليل التكلفة

            const permissionsList = basePerms || {};

            await runAssistantMessage({
                userMessage: text,
                history,
                contextData: contextData || {},
                permissions: { can, role, permissionsList, user },
                onChunk: (chunk) => {
                    streamBufferRef.current += chunk;
                    const currentBuffer = streamBufferRef.current;
                    setMessages((prev) =>
                        prev.map((m) =>
                            m.id === assistantId
                                ? { ...m, content: currentBuffer }
                                : m
                        )
                    );
                },
            });

            // نهاية الـ streaming — إزالة مؤشر الكتابة
            setMessages((prev) =>
                prev.map((m) =>
                    m.id === assistantId ? { ...m, isStreaming: false } : m
                )
            );

            // تسجيل في الأنشطة
            await logActivity({
                user,
                action: 'assistant_response',
                entity_type: 'AI Assistant',
                details: 'استجاب مساعد الذكاء الاصطناعي لطلب المستخدم',
            });

        } catch (err) {
            console.error('[AiAssistantPanel] handleSend:', err);
            setMessages((prev) =>
                prev.map((m) =>
                    m.id === assistantId
                        ? {
                            ...m,
                            content: '⚠️ حدث خطأ. تحقق من الاتصال وحاول مرة أخرى.',
                            isStreaming: false,
                        }
                        : m
                )
            );
        } finally {
            setIsStreaming(false);
        }
    }, [input, isStreaming, messages, contextData, can, role, basePerms, user]);

    // إرسال بـ Enter
    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    // Quick Action
    const handleQuickAction = (action) => {
        setInput(action.prompt);
        setTabValue('conversation');
        setTimeout(() => inputRef.current?.focus(), 100);
    };

    // مسح المحادثة
    const handleClear = () => {
        setMessages([]);
        setTimeout(() => loadContextData(), 100);
    };

    // ====================================================
    // Guard — صلاحية المساعد
    // ====================================================

    if (!can('can_use_ai_assistant')) return null;

    // ====================================================
    // Computed values
    // ====================================================

    const summary = contextData
        ? buildAssistantSummary({
            salesCount: contextData.salesCount,
            lowStockCount: contextData.lowStockCount,
            outstandingDebt: contextData.outstandingDebt,
            pendingPayments: contextData.topDebts?.length ?? 0,
        })
        : null;

    // ====================================================
    // Render
    // ====================================================

    return (
        <Card className="border border-primary/20 bg-gradient-to-br from-primary-soft to-card shadow-card">

            {/* Header */}
            <CardHeader className="pb-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-100 dark:bg-indigo-900">
                            <Bot className="h-5 w-5 text-indigo-600 dark:text-indigo-300" />
                        </div>
                        <div>
                            <div className="text-lg font-black text-foreground ">
                                مساعد Nexora الذكي
                            </div>
                            <div className="text-xs text-muted-foreground">
                                تحليل تشغيلي بالبيانات الحية • Gemini للشرح والتوصيات
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        {/* زر إعدادات مفتاح Gemini الشخصي */}
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleOpenKeyModal}
                            className="h-7 gap-1.5 rounded-full border-indigo-500/20 bg-card text-xs font-bold text-indigo-700 hover:bg-indigo-500/10 shadow-sm dark:border-indigo-800 dark:text-indigo-300"
                            title="ربط حساب Google Gemini الشخصي"
                        >
                            <KeyRound className="h-3 w-3 text-amber-500" />
                            <span>
                                {providerInfo.provider === 'personal'
                                    ? 'حسابي الشخصي متصل 🔑'
                                    : 'ربط حساب Gemini الشخصي'}
                            </span>
                        </Button>

                        {/* حالة Gemini */}
                        <div
                            className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${geminiOnline === null
                                ? 'bg-card-muted text-muted-foreground'
                                : geminiOnline
                                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300'
                                    : 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300'
                                }`}
                        >
                            {geminiOnline === null ? (
                                <RefreshCw className="h-3 w-3 animate-spin" />
                            ) : geminiOnline ? (
                                <Wifi className="h-3 w-3" />
                            ) : (
                                <WifiOff className="h-3 w-3" />
                            )}
                            {geminiOnline === null
                                ? 'جارٍ الاتصال...'
                                : geminiOnline
                                    ? (providerInfo.provider === 'personal' ? 'Gemini 2.0 (شخصي)' : 'Gemini متصل')
                                    : 'Gemini غير متاح'}
                        </div>

                        <div className="rounded-full bg-muted px-3 py-1 text-xs">{role}</div>
                        <div className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs">
                            <Zap className="h-3.5 w-3.5" />
                            أدوات آمنة للقراءة والتحليل
                        </div>
                    </div>
                </div>

                {/* ملخص البيانات اللحظية */}
                {!loadingContext && summary && (
                    <div className="mt-2 space-y-1">
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 dark:border-emerald-900 dark:bg-emerald-950/30">
                            <div className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-300">
                                <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                                <span>{summary}</span>
                            </div>
                        </div>
                        {contextData?.hasErrors && (
                            <div className="flex items-center gap-1.5 px-2 text-xs text-amber-700 dark:text-amber-400">
                                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                                <span>تنبيه: تعذر تحديث بعض المؤشرات اللحظية لوجود مشكلة في الاتصال أو الصلاحيات.</span>
                            </div>
                        )}
                    </div>
                )}
                {loadingContext && (
                    <div className="mt-2 rounded-xl border border-border bg-card-muted px-4 py-2.5 ">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                            <span>جارٍ تحميل بيانات الشركة...</span>
                        </div>
                    </div>
                )}
            </CardHeader>

            <CardContent className="space-y-4">
                <Tabs value={tabValue} onValueChange={setTabValue} className="space-y-4">
                    <TabsList>
                        <TabsTrigger value="conversation">💬 المحادثة</TabsTrigger>
                        <TabsTrigger value="analysis">📊 تحليل البيانات</TabsTrigger>
                        <TabsTrigger value="recommendations">💡 التوصيات</TabsTrigger>
                    </TabsList>

                    {/* ====== تبويب المحادثة ====== */}
                    <TabsContent value="conversation" className="space-y-3">

                        {/* منطقة الرسائل */}
                        <div
                            className="flex max-h-[420px] min-h-[220px] flex-col gap-4 overflow-y-auto rounded-xl border border-border bg-background/60 p-4 "
                            dir="rtl"
                        >
                            {messages.length === 0 && !loadingContext && (
                                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                                    <div className="text-center">
                                        <Bot className="mx-auto mb-2 h-10 w-10 opacity-20" />
                                        <p>ابدأ المحادثة بكتابة سؤالك أو اختر من الاقتراحات</p>
                                    </div>
                                </div>
                            )}

                            {messages.map((msg) => (
                                <ChatMessage
                                    key={msg.id}
                                    role={msg.role}
                                    content={msg.content}
                                    isStreaming={msg.isStreaming}
                                />
                            ))}

                            {/* typing indicator عند بدء الرد */}
                            {isStreaming && messages.at(-1)?.content === '' && (
                                <TypingIndicator />
                            )}

                            <div ref={chatEndRef} />
                        </div>

                        {/* Quick Actions */}
                        <div className="flex flex-wrap gap-2">
                            {QUICK_ACTIONS.map((a) => (
                                <Button
                                    key={a.key}
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleQuickAction(a)}
                                    className="h-7 rounded-full text-xs"
                                    disabled={isStreaming}
                                >
                                    {a.label}
                                </Button>
                            ))}
                        </div>

                        {/* حقل الإدخال */}
                        <div className="flex items-end gap-2">
                            <div className="relative flex-1">
                                <textarea
                                    ref={inputRef}
                                    id="ai-assistant-input"
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder="اكتب سؤالك أو أمرك... (Enter للإرسال، Shift+Enter لسطر جديد)"
                                    rows={2}
                                    maxLength={1000}
                                    disabled={isStreaming}
                                    className="w-full resize-none rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-300 disabled:opacity-50 dark:focus:ring-indigo-700"
                                    dir="rtl"
                                />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <Button
                                    id="ai-send-btn"
                                    onClick={handleSend}
                                    disabled={isStreaming || !input.trim()}
                                    size="sm"
                                    className="h-9 gap-1.5 bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40"
                                >
                                    {isStreaming ? (
                                        <RefreshCw className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <Send className="h-4 w-4" />
                                    )}
                                </Button>
                                {messages.length > 1 && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={handleClear}
                                        className="h-9 px-2 text-xs text-muted-foreground hover:text-destructive"
                                        title="مسح المحادثة"
                                        disabled={isStreaming}
                                    >
                                        مسح
                                    </Button>
                                )}
                            </div>
                        </div>
                    </TabsContent>

                    {/* ====== تبويب تحليل البيانات ====== */}
                    <TabsContent value="analysis">
                        {loadingContext ? (
                            <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                جارٍ تحميل البيانات...
                            </div>
                        ) : contextData ? (
                            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                <KpiCard
                                    icon={<BarChart3 className="h-4 w-4" />}
                                    label="مبيعات اليوم"
                                    value={`${contextData.salesCount} فاتورة`}
                                    sub={`${Number(contextData.totalRevenue).toLocaleString('ar-EG')} ج.م`}
                                    color="indigo"
                                />
                                <KpiCard
                                    icon={<TrendingUp className="h-4 w-4" />}
                                    label="صافي الأرباح"
                                    value={`${Number(contextData.salesProfit).toLocaleString('ar-EG')} ج.م`}
                                    sub="اليوم"
                                    color="emerald"
                                />
                                <KpiCard
                                    icon={<Package className="h-4 w-4" />}
                                    label="مخزون منخفض"
                                    value={`${contextData.lowStockCount} صنف`}
                                    sub={contextData.lowStockCount > 0 ? 'يحتاج تغذية' : 'وضع جيد ✓'}
                                    color={contextData.lowStockCount > 0 ? 'amber' : 'emerald'}
                                />
                                <KpiCard
                                    icon={<DollarSign className="h-4 w-4" />}
                                    label="ديون مستحقة"
                                    value={`${Number(contextData.outstandingDebt).toLocaleString('ar-EG')} ج.م`}
                                    sub={`${contextData.topDebts?.length ?? 0} حالة`}
                                    color={contextData.outstandingDebt > 0 ? 'red' : 'emerald'}
                                />
                            </div>
                        ) : (
                            <div className="py-8 text-center text-sm text-muted-foreground">
                                تعذّر تحميل البيانات. تحقق من الاتصال.
                            </div>
                        )}

                        {/* أبرز الأصناف المنخفضة */}
                        {contextData?.lowStockItems?.length > 0 && (
                            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
                                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-800 dark:text-amber-200">
                                    <AlertTriangle className="h-4 w-4" />
                                    أصناف تحتاج تغذية فورية
                                </div>
                                <div className="grid gap-1.5 sm:grid-cols-2">
                                    {contextData.lowStockItems.map((p) => (
                                        <div key={p.id} className="flex items-center justify-between rounded-lg border border-amber-100 bg-card px-3 py-2 text-xs dark:border-amber-900 dark:bg-amber-950/50">
                                            <span className="font-medium text-secondary-text ">{p.product_name}</span>
                                            <span className="text-amber-700 dark:text-amber-300">{p.current_stock} / {p.min_stock_level} {p.unit}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* أبرز الديون */}
                        {contextData?.topDebts?.length > 0 && (
                            <div className="mt-3 rounded-xl border border-red-100 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/30">
                                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-red-800 dark:text-red-200">
                                    <DollarSign className="h-4 w-4" />
                                    أكبر الديون المستحقة
                                </div>
                                <div className="grid gap-1.5 sm:grid-cols-2">
                                    {contextData.topDebts.map((d) => (
                                        <div key={d.id} className="flex items-center justify-between rounded-lg border border-red-100 bg-card px-3 py-2 text-xs dark:border-red-900 dark:bg-red-950/50">
                                            <span className="font-medium text-secondary-text ">{d.party_name}</span>
                                            <span className="font-bold text-red-600 dark:text-red-400">{Number(d.remaining_amount).toLocaleString('ar-EG')} ج.م</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </TabsContent>

                    {/* ====== تبويب التوصيات ====== */}
                    <TabsContent value="recommendations">
                        <div className="space-y-3">
                            {loadingContext ? (
                                <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                    جارٍ توليد التوصيات...
                                </div>
                            ) : (
                                buildRecommendations(contextData, can).map((rec, i) => (
                                    <RecommendationCard key={i} {...rec} onAction={() => {
                                        setInput(rec.actionPrompt);
                                        setTabValue('conversation');
                                    }} />
                                ))
                            )}
                        </div>
                    </TabsContent>
                </Tabs>
            </CardContent>

            {/* Modal: ربط حساب Gemini الشخصي (Google AI Studio API Key) */}
            <Dialog open={apiKeyModalOpen} onOpenChange={setApiKeyModalOpen}>
                <DialogContent className="max-w-md rounded-2xl" dir="rtl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-lg font-black text-foreground">
                            <KeyRound className="h-5 w-5 text-indigo-600" />
                            ربط حساب Gemini الشخصي (Google AI Studio)
                        </DialogTitle>
                        <DialogDescription className="text-xs text-muted-foreground mt-1">
                            استخدم حسابك الشخصي في Google لتفعيل الذكاء الاصطناعي مجاناً وبسرعة فائقة مع أحدث نموذج ({GEMINI_MODEL}).
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2 text-xs">
                        <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-3 text-indigo-900 dark:border-indigo-900/50 dark:bg-indigo-950/20 dark:text-indigo-200">
                            <div className="font-bold mb-1">خطوات الحصول على المفتاح في دقيقة:</div>
                            <ol className="list-decimal list-inside space-y-1 text-[11px] text-muted-foreground">
                                <li>افتح منصة Google AI Studio وسجّل دخولك بحساب Google.</li>
                                <li>اضغط على <strong>"Create API key"</strong> وانسخ المفتاح.</li>
                                <li>الصق المفتاح في الحقل أدناه واضغط <strong>"حفظ واستخدام"</strong>.</li>
                            </ol>
                            <a
                                href="https://aistudio.google.com/app/apikey"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-2.5 inline-flex items-center gap-1.5 font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                            >
                                فتح صفحة مفاتيح Google AI Studio
                                <ExternalLink className="h-3 w-3" />
                            </a>
                        </div>

                        <div className="space-y-1.5">
                            <label className="font-bold text-foreground block">
                                مفتاح API الخاص بك (Gemini API Key):
                            </label>
                            <Input
                                type="password"
                                value={tempApiKey}
                                onChange={(e) => {
                                    setTempApiKey(e.target.value);
                                    setTestResult(null);
                                }}
                                placeholder="AIzaSy..."
                                className="font-mono text-xs rounded-xl"
                            />
                            <p className="text-[10px] text-muted-foreground">
                                يتم حفظ هذا المفتاح محلياً في متصفحك بشكل آمن ولا يشارك مع أي طرف آخر.
                            </p>
                        </div>

                        {/* نتيجة الفحص */}
                        {testResult && (
                            <div
                                className={`rounded-xl border p-2.5 text-xs font-bold flex items-center gap-2 ${
                                    testResult.ok
                                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                                        : 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300'
                                }`}
                            >
                                {testResult.ok ? (
                                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                                ) : (
                                    <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
                                )}
                                <span>{testResult.msg}</span>
                            </div>
                        )}

                        {/* أزرار الإجراءات */}
                        <div className="flex items-center justify-between gap-2 pt-2 border-t border-border">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={handleTestKey}
                                disabled={testingKey || !tempApiKey.trim()}
                                className="rounded-xl text-xs gap-1"
                            >
                                {testingKey && <RefreshCw className="h-3 w-3 animate-spin" />}
                                فحص المفتاح
                            </Button>

                            <div className="flex items-center gap-2">
                                {getPersonalApiKey() && (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={handleClearKey}
                                        className="text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 rounded-xl text-xs"
                                    >
                                        إزالة المفتاح
                                    </Button>
                                )}
                                <Button
                                    type="button"
                                    size="sm"
                                    onClick={handleSaveKey}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold"
                                >
                                    حفظ واستخدام
                                </Button>
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </Card>
    );
}

// ====================================================
// Sub-components
// ====================================================

function KpiCard({ icon, label, value, sub, color = 'indigo' }) {
    const colorMap = {
        indigo: 'border-indigo-100 bg-indigo-50 dark:border-indigo-900 dark:bg-indigo-950/40',
        emerald: 'border-emerald-100 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40',
        amber: 'border-amber-100 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40',
        red: 'border-red-100 bg-red-50 dark:border-red-900 dark:bg-red-950/40',
    };
    const iconColor = {
        indigo: 'text-indigo-600',
        emerald: 'text-emerald-600',
        amber: 'text-amber-600',
        red: 'text-red-500',
    };

    return (
        <div className={`rounded-xl border p-4 ${colorMap[color] || colorMap.indigo}`}>
            <div className={`mb-2 ${iconColor[color] || iconColor.indigo}`}>{icon}</div>
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="mt-0.5 text-base font-black text-foreground">{value}</div>
            <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>
        </div>
    );
}

function RecommendationCard({ icon, title, body, actionLabel, onAction, priority = 'normal' }) {
    const priorityStyle = priority === 'high'
        ? 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30'
        : priority === 'medium'
            ? 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30'
            : 'border-border bg-card ';

    return (
        <div className={`rounded-xl border p-4 ${priorityStyle}`}>
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                    <span className="text-lg">{icon}</span>
                    <div>
                        <div className="text-sm font-semibold text-foreground">{title}</div>
                        <div className="mt-1 text-xs text-muted-foreground">{body}</div>
                    </div>
                </div>
                {actionLabel && (
                    <Button
                        variant="outline"
                        size="sm"
                        className="shrink-0 text-xs"
                        onClick={onAction}
                    >
                        {actionLabel}
                    </Button>
                )}
            </div>
        </div>
    );
}

// ====================================================
// Helper functions
// ====================================================

function buildWelcomeMessage(can, role, geminiOnline) {
    const actions = [];
    if (can('can_view_inventory') || can('can_edit_inventory')) actions.push('المخزون المنخفض');
    if (can('can_view_debts') || can('can_view_financials')) actions.push('الديون المستحقة');
    if (can('can_view_sales')) actions.push('ملخص المبيعات');
    if (can('can_view_dashboard')) actions.push('التقرير اليومي');

    const status = geminiOnline ? 'مدعوم بـ Gemini AI 🤖' : 'في وضع محدود (Gemini غير متاح) ⚠️';
    const actionsText = actions.length ? `\n\nيمكنني مساعدتك في: ${actions.join(' • ')} وأكثر.` : '';

    return `مرحباً! أنا **مساعد Nexora الذكي** (${status}).${actionsText}\n\nاكتب سؤالك بشكل طبيعي أو اختر من الاقتراحات أدناه 👇`;
}

function buildRecommendations(data, can) {
    if (!data) return [];

    const recs = [];

    if (data.lowStockCount > 0 && (can('can_view_inventory') || can('can_edit_inventory'))) {
        recs.push({
            icon: '📦',
            title: `${data.lowStockCount} صنف يحتاج تغذية`,
            body: `هناك ${data.lowStockCount} منتج وصل مخزونه دون الحد الأدنى. يُنصح بمراجعتها وإعادة الطلب.`,
            actionLabel: 'عرض التفاصيل',
            actionPrompt: 'ما هي الأصناف منخفضة المخزون؟',
            priority: data.lowStockCount > 5 ? 'high' : 'medium',
        });
    }

    if (data.outstandingDebt > 0 && can('can_view_debts')) {
        recs.push({
            icon: '💰',
            title: `${Number(data.outstandingDebt).toLocaleString('ar-EG')} ج.م ديون مستحقة`,
            body: `يوجد ${data.topDebts?.length ?? 0} حالة دين مستحقة تحتاج متابعة وتحصيل.`,
            actionLabel: 'عرض الديون',
            actionPrompt: 'ما هي الديون المستحقة؟',
            priority: data.outstandingDebt > 10000 ? 'high' : 'medium',
        });
    }

    if (data.salesCount === 0 && can('can_view_sales')) {
        recs.push({
            icon: '📊',
            title: 'لا توجد مبيعات اليوم بعد',
            body: 'لم يتم تسجيل أي فاتورة مبيعات حتى الآن اليوم.',
            actionLabel: 'مبيعات اليوم',
            actionPrompt: 'ملخص مبيعات اليوم',
            priority: 'normal',
        });
    }

    if (data.expensesToday > 0) {
        recs.push({
            icon: '💸',
            title: `مصروفات اليوم: ${Number(data.expensesToday).toLocaleString('ar-EG')} ج.م`,
            body: 'تم تسجيل مصروفات اليوم. راجعها للتأكد من دقتها.',
            actionLabel: 'عرض التفاصيل',
            actionPrompt: 'كم بلغت مصروفات اليوم وما تفاصيلها؟',
            priority: 'normal',
        });
    }

    if (!recs.length) {
        recs.push({
            icon: '✅',
            title: 'كل شيء على ما يرام!',
            body: 'لا توجد تنبيهات طارئة الآن. استمر في تتبع بياناتك يومياً.',
            priority: 'normal',
        });
    }

    return recs;
}
