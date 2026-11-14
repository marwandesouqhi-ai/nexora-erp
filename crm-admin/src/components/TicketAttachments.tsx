import { useRef } from 'react';
import { Paperclip, X, FileText, Download, Image as ImageIcon } from 'lucide-react';
import { cn } from './page';
import { ATTACHMENT_ACCEPT, MAX_ATTACHMENTS, formatBytes, isImageAttachment, validateAttachments } from '../services/ticketsService';
import type { TicketAttachment } from '../types';

/** زر إرفاق مربع بجانب صندوق الرد */
export function AttachButton({
    value,
    onChange,
    onError,
    disabled = false,
}: {
    value: File[];
    onChange: (files: File[]) => void;
    onError: (message: string) => void;
    disabled?: boolean;
}) {
    const inputRef = useRef<HTMLInputElement>(null);
    return (
        <>
            <input
                ref={inputRef}
                type="file"
                multiple
                accept={ATTACHMENT_ACCEPT}
                className="hidden"
                onChange={(e) => {
                    const next = [...value, ...Array.from(e.target.files || [])];
                    e.target.value = '';
                    const err = validateAttachments(next);
                    if (err) onError(err);
                    else onChange(next);
                }}
            />
            <button
                type="button"
                disabled={disabled || value.length >= MAX_ATTACHMENTS}
                onClick={() => inputRef.current?.click()}
                aria-label="إرفاق صورة أو ملف"
                title={`إرفاق صورة أو ملف (حتى ${MAX_ATTACHMENTS} ملفات، 10MB للملف)`}
                className="inline-flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-xl border border-border bg-card text-secondary-text transition-colors hover:bg-card-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
            >
                <Paperclip className="h-4 w-4" />
            </button>
        </>
    );
}

export function SelectedFiles({ files, onRemove }: { files: File[]; onRemove: (index: number) => void }) {
    if (!files.length) return null;
    return (
        <div className="flex flex-wrap gap-2">
            {files.map((f, i) => (
                <span
                    key={`${f.name}-${i}`}
                    className="inline-flex max-w-[240px] items-center gap-1.5 rounded-lg border border-border bg-card-muted py-1 pe-1 ps-2.5 text-[11.5px] font-semibold text-secondary-text"
                >
                    {f.type.startsWith('image/') ? <ImageIcon className="h-3.5 w-3.5 shrink-0" /> : <FileText className="h-3.5 w-3.5 shrink-0" />}
                    <span className="truncate">{f.name}</span>
                    <span className="shrink-0 text-[10px] text-muted-foreground">{formatBytes(f.size)}</span>
                    <button
                        type="button"
                        onClick={() => onRemove(i)}
                        aria-label={`إزالة ${f.name}`}
                        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-border hover:text-foreground"
                    >
                        <X className="h-3 w-3" />
                    </button>
                </span>
            ))}
        </div>
    );
}

export function MessageAttachments({ attachments = [], onPrimary = false }: { attachments?: TicketAttachment[]; onPrimary?: boolean }) {
    if (!attachments.length) return null;
    const images = attachments.filter(isImageAttachment);
    const files = attachments.filter((a) => !isImageAttachment(a));
    return (
        <div className="mt-2 flex flex-col gap-2">
            {images.length ? (
                <div className="flex flex-wrap gap-2">
                    {images.map((a) => (
                        <a key={a.path || a.url} href={a.url} target="_blank" rel="noopener noreferrer" title={a.name} className="block overflow-hidden rounded-lg border border-black/10 bg-card">
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
                        onPrimary ? 'bg-white/15 text-white hover:bg-card/25' : 'border border-border bg-card text-foreground hover:bg-card-muted'
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
