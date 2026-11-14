/**
 * ChatMessage.jsx — Component لعرض رسالة واحدة في المحادثة
 */

import { Bot, User, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * @param {{ role: 'user'|'assistant'|'system', content: string, isStreaming?: boolean }} props
 */
export default function ChatMessage({ role, content, isStreaming = false }) {
    const isUser = role === 'user';
    const isSystem = role === 'system';

    if (isSystem) {
        return (
            <div className="flex items-start gap-2 px-1 py-0.5 text-xs text-muted-foreground">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{content}</span>
            </div>
        );
    }

    return (
        <div
            className={cn(
                'flex items-end gap-2.5',
                isUser ? 'flex-row-reverse' : 'flex-row'
            )}
        >
            {/* أيقونة الدور */}
            <div
                className={cn(
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs',
                    isUser
                        ? 'border-indigo-200 bg-indigo-100 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950 dark:text-indigo-300'
                        : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                )}
            >
                {isUser ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
            </div>

            {/* فقاعة الرسالة */}
            <div
                className={cn(
                    'max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm',
                    isUser
                        ? 'rounded-br-sm bg-indigo-600 text-white dark:bg-indigo-700'
                        : 'rounded-bl-sm border border-border bg-card text-foreground '
                )}
            >
                {/* عرض النص مع دعم줄 breaks */}
                <div className="whitespace-pre-wrap">
                    {formatMessageContent(content)}
                </div>

                {/* مؤشر الكتابة */}
                {isStreaming && (
                    <span className="ml-1 inline-flex items-center gap-0.5">
                        <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-current opacity-60 [animation-delay:-0.3s]" />
                        <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-current opacity-60 [animation-delay:-0.15s]" />
                        <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-current opacity-60" />
                    </span>
                )}
            </div>
        </div>
    );
}

// ====================================================
// تنسيق محتوى الرسالة (Markdown بسيط)
// ====================================================

function formatMessageContent(text) {
    if (!text) return null;

    const lines = text.split('\n');

    return lines.map((line, i) => {
        // **bold**
        const boldParsed = line.replace(/\*\*(.+?)\*\*/g, (_, m) => `__BOLD__${m}__BOLD__`);
        const parts = boldParsed.split('__BOLD__').map((part, j) =>
            j % 2 === 1 ? (
                <strong key={j} className="font-semibold">
                    {part}
                </strong>
            ) : (
                part
            )
        );

        return (
            <span key={i}>
                {parts}
                {i < lines.length - 1 && <br />}
            </span>
        );
    });
}

// ====================================================
// مؤشر الكتابة المستقل
// ====================================================

export function TypingIndicator() {
    return (
        <div className="flex items-end gap-2.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                <Bot className="h-3.5 w-3.5" />
            </div>
            <div className="rounded-2xl rounded-bl-sm border border-border bg-card px-4 py-3 shadow-sm ">
                <div className="flex items-center gap-1">
                    <span className="h-2 w-2 animate-bounce rounded-full bg-indigo-400 [animation-delay:-0.3s]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-indigo-400 [animation-delay:-0.15s]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-indigo-400" />
                </div>
            </div>
        </div>
    );
}
