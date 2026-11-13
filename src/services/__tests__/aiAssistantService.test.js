import { describe, it, expect } from 'vitest';
import {
    buildGuardrailDecision,
    buildAssistantSummary,
    runAssistantAction,
    runAssistantMessage,
} from '../aiAssistantService.js';
import { buildAutomationPlan, runAutomationPlan } from '../automationService.js';
import { detectIntentLocal, INTENTS } from '../intentEngine.js';

describe('assistant guardrails', () => {
    it('routes operational analysis requests to dedicated intents', () => {
        expect(detectIntentLocal('حلل ربحية اليوم').intent).toBe(INTENTS.QUERY_PROFITABILITY);
        expect(detectIntentLocal('ما هو صافي التدفق النقدي؟').intent).toBe(INTENTS.QUERY_CASHFLOW);
        expect(detectIntentLocal('اعرض آخر العمليات').intent).toBe(INTENTS.QUERY_ACTIVITY);
    });

    it('blocks write actions without explicit confirmation', () => {
        const decision = buildGuardrailDecision({ intent: 'write', confirmed: false, prompt: 'Create a new product' });
        expect(decision.allowed).toBe(false);
        expect(decision.reason).toMatch(/confirm/i);
    });

    it('allows confirmed write actions to proceed', async () => {
        const response = await runAssistantAction({ intent: 'write', confirmed: true, prompt: 'Create a new product' });
        expect(response.ok).toBe(true);
        expect(response.output).toContain('Create a new product');
    });

    it('builds a concise assistant summary from metrics', () => {
        const summary = buildAssistantSummary({
            salesCount: 4,
            lowStockCount: 2,
            outstandingDebt: 1200,
            pendingPayments: 3,
        });

        expect(summary).toContain('4');
        expect(summary).toContain('2');
        expect(summary).toContain('1200');
    });

    it('does not claim that unsupported write operations were completed', async () => {
        const response = await runAssistantMessage({
            userMessage: 'أضف عميل جديد باسم أحمد',
        });

        expect(response).toMatch(/غير مفعلة|لم يتم إجراء أي تغيير/);
    });

    it('blocks supplier queries when the user lacks permission', async () => {
        const response = await runAssistantMessage({
            userMessage: 'اعرض قائمة الموردين',
            permissions: { can: () => false },
        });

        expect(response).toMatch(/ليس لديك صلاحية عرض بيانات الموردين/);
    });
});

describe('automation engine', () => {
    it('builds a structured automation plan from the provided message', () => {
        const plan = buildAutomationPlan({ title: 'تنبيه مخزون منخفض', message: 'تم استنفاد 2 صنف' });
        expect(plan.kind).toBe('inventory_low_stock');
        expect(plan.title).toContain('تنبيه');
        expect(plan.summary).toContain('تم استنفاد 2 صنف');
    });

    it('runs automation through notification and activity callbacks', async () => {
        const notifications = [];
        const activities = [];

        const result = await runAutomationPlan(
            buildAutomationPlan({ title: 'تنبيه مخزون منخفض', message: 'تم استنفاد 2 صنف' }),
            {
                createNotification: async (channel, text) => {
                    notifications.push({ channel, text });
                },
                logActivity: async (entry) => {
                    activities.push(entry);
                },
                user: { uid: 'u1', email: 'owner@nexora.app' },
            }
        );

        expect(result.ok).toBe(true);
        expect(notifications).toHaveLength(1);
        expect(activities).toHaveLength(1);
        expect(result.output).toContain('تم استنفاد 2 صنف');
    });
});
