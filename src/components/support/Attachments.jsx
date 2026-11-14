import { useRef } from 'react';
import { Paperclip, X, FileText, Download, Image as ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
    ATTACHMENT_ACCEPT, MAX_ATTACHMENTS, formatBytes, isImageAttachment, validateAttachments,
} from '@/firebase/collections/support_tickets';

/**
 * زر إرفاق + قائمة الملفات المختارة قبل الإرسال.
 * value: File[] · onChange(File[]) · onError(message)
 */
export function AttachmentPicker({ value = [], onChange, onError, disabled = false, compact = false }) {
    const inputRef = useRef(null);

    const add = (list) => {
        const next = [...value, ...Array.from(list || [])];
        const err = validateAttachments(next);
        if (err) {
            onError?.(err);
            return;
        }
        onChange(next);
    };

    return (
        <div className="flex flex-col gap-2">
            <input
                ref={inputRef}
                type="file"
                multiple
                accept={ATTACHMENT_ACCEPT}
                className="hidden"
                onChange={(e) => {
                    add(e.target.files);
                    e.target.value = '';
                }}
            />
            <button
                type="button"
                disabled={disabled || value.length >= MAX_ATTACHMENTS}
                onClick={() => inputRef.current?.click()}
                className={cn(
                    'inline-flex items-center justify-center gap-1.5 rounded-xl border border-border bg-card text-xs font-bold text-secondary-text transition-colors hover:bg-card-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50',
                    compact ? 'h-[52px] w-[52px]' : 'h-10 self-start px-3.5'
                )}
                aria-label="إرفاق صورة أو ملف"
                title={`إرفاق صورة أو ملف (حتى ${MAX_ATTACHMENTS} ملفات، 10MB للملف)`}
            >
                <Paperclip className="h-4 w-4" />
                {compact ? null : 'إرفاق صورة أو ملف'}
            </button>
            {value.length > 0 && !compact ? <SelectedFiles files={value} onRemove={(i) => onChange(value.filter((_, idx) => idx !== i))} /> : null}
        </div>
    );
}

/** شرائح الملفات المختارة (قبل الرفع) */
export function SelectedFiles({ files, onRemove }) {
    if (!files.length) return null;
    return (
        <div className="flex flex-wrap gap-2">
            {files.map((f, i) => (
                <span
                    key={`${f.name}-${i}`}
                    className="inline-flex max-w-[240px] items-center gap-1.5 rounded-lg border border-border bg-card-muted py-1 pe-1 ps-2.5 text-[11.5px] font-semibold text-secondary-text"
                >
                    {f.type?.startsWith('image/') ? <ImageIcon className="h-3.5 w-3.5 shrink-0" /> : <FileText className="h-3.5 w-3.5 shrink-0" />}
                    <span className="truncate">{f.name}</span>
                    <span className="shrink-0 text-[10px] text-muted-foreground">{formatBytes(f.size)}</span>
                    <button
                        type="button"
                        onClick={() => onRemove(i)}
                        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-border hover:text-foreground"
                        aria-label={`إزالة ${f.name}`}
                    >
                        <X className="h-3 w-3" />
                    </button>
                </span>
            ))}
        </div>
    );
}

/** عرض مرفقات رسالة (صور كمعاينة + ملفات للتحميل) */
export function MessageAttachments({ attachments = [], onPrimary = false }) {
    if (!attachments.length) return null;
    const images = attachments.filter(isImageAttachment);
    const files = attachments.filter((a) => !isImageAttachment(a));
    return (
        <div className="mt-2 flex flex-col gap-2">
            {images.length ? (
                <div className="flex flex-wrap gap-2">
                    {images.map((a) => (
                        <a
                            key={a.path || a.url}
                            href={a.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block overflow-hidden rounded-lg border border-black/10 bg-card"
                            title={a.name}
                        >
                            <img src={a.url} alt={a.name} loading="lazy" className="h-28 w-28 object-cover transition-transform hover:scale-105" />
                        </a>
                    ))}
                </div>
            ) : null}
            {files.map((a) => (
                <a
                    key={a.path || a.url}
                    href={a.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    download={a.name}
                    className={cn(
                        'inline-flex max-w-full items-center gap-2 self-start rounded-lg px-2.5 py-1.5 text-[12px] font-semibold transition-colors',
                        onPrimary ? 'bg-white/15 text-white hover:bg-white/25' : 'border border-border bg-card-muted text-foreground hover:bg-border'
                    )}
                >
                    <FileText className="h-4 w-4 shrink-0" />
                    <span className="truncate">{a.name}</span>
                    <span className={cn('shrink-0 text-[10.5px]', onPrimary ? 'text-white/70' : 'text-muted-foreground')}>{formatBytes(a.size)}</span>
                    <Download className="h-3.5 w-3.5 shrink-0" />
                </a>
            ))}
        </div>
    );
}
