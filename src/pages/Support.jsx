import { useEffect, useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import {
    LifeBuoy, Plus, MessageSquare, Clock, CheckCircle2, Hourglass, Send, Loader2, Lock, RotateCcw, Headset, Inbox, ShieldAlert,
} from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { useRole } from '@/lib/RoleContext';
import { AttachmentPicker, SelectedFiles, MessageAttachments } from '@/components/support/Attachments';
import { useTenant } from '@/lib/TenantContext';
import { useToast } from '@/components/ui/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { PageHero, StatCard, SectionCard, EmptyState, Toolbar, ToolbarSelect, CountChip } from '@/components/page';
import { cn } from '@/lib/utils';
import {
    TICKET_CATEGORIES, TICKET_PRIORITIES, TICKET_STATUSES, TICKET_STATUS_STYLES, TICKET_PRIORITY_STYLES,
    subscribeCompanyTickets, subscribeTicketMessages, createSupportTicket, replyToTicket,
    markTicketReadByCustomer, setTicketClosedByCustomer, isCompanySupportAdmin,
} from '@/firebase/collections/support_tickets';

const toDate = (v) => (v?.toDate ? v.toDate() : v ? new Date(v) : null);
const fmt = (v, pattern = 'dd MMM yyyy - hh:mm a') => {
    const d = toDate(v);
    return d ? format(d, pattern, { locale: ar }) : '—';
};

const emptyForm = { subject: '', category: 'technical', priority: 'normal', body: '' };

function StatusPill({ status }) {
    const s = TICKET_STATUS_STYLES[status] || TICKET_STATUS_STYLES.closed;
    return (
        <span className={cn('inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold', s.pill)}>
            <span className={cn('h-1.5 w-1.5 rounded-full', s.dot)} />
            {TICKET_STATUSES[status] || status}
        </span>
    );
}

export default function Support() {
    const { role } = useRole();
    if (!isCompanySupportAdmin(role)) {
        return (
            <div className="flex flex-col gap-5" dir="rtl">
                <PageHero className="mb-0" icon={LifeBuoy} tone="indigo" title="الدعم الفني" subtitle="التواصل مع فريق دعم منصة Nexora." />
                <SectionCard>
                    <EmptyState icon={ShieldAlert} text="صفحة الدعم الفني متاحة لأدمن الشركة فقط (مالك الشركة أو المدير العام). تواصل معه لرفع طلب الدعم." />
                </SectionCard>
            </div>
        );
    }
    return <SupportWorkspace />;
}

function SupportWorkspace() {
    const { user } = useAuth();
    const { tenant } = useTenant();
    const { toast } = useToast();

    const [tickets, setTickets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedId, setSelectedId] = useState(null);
    const [messages, setMessages] = useState([]);
    const [messagesLoading, setMessagesLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [reply, setReply] = useState('');
    const [sending, setSending] = useState(false);
    const [newOpen, setNewOpen] = useState(false);
    const [form, setForm] = useState(emptyForm);
    const [creating, setCreating] = useState(false);
    const [newFiles, setNewFiles] = useState([]);
    const [replyFiles, setReplyFiles] = useState([]);
    const fileError = (message) => toast({ title: 'تعذر إرفاق الملف', description: message, variant: 'destructive' });
    const endRef = useRef(null);

    // ── التذاكر لحظياً ──────────────────────────────────────────────────────
    useEffect(() => {
        const unsub = subscribeCompanyTickets(
            (list) => {
                setTickets(list);
                setLoading(false);
            },
            () => {
                setLoading(false);
                toast({ title: 'خطأ في الاتصال', description: 'تعذر تحميل تذاكر الدعم لحظياً.', variant: 'destructive' });
            }
        );
        return () => unsub?.();
    }, [toast]);

    const selected = tickets.find((t) => t.id === selectedId) || null;

    // ── رسائل التذكرة المختارة لحظياً ────────────────────────────────────────
    useEffect(() => {
        if (!selectedId) return undefined;
        const unsub = subscribeTicketMessages(
            selectedId,
            (list) => {
                setMessages(list);
                setMessagesLoading(false);
            },
            () => setMessagesLoading(false)
        );
        return () => unsub?.();
    }, [selectedId]);

    // تعليم كمقروءة عند فتح تذكرة عليها رد جديد
    useEffect(() => {
        if (selected?.unread_for_customer) markTicketReadByCustomer(selected.id).catch(() => {});
    }, [selected?.id, selected?.unread_for_customer]);

    useEffect(() => {
        endRef.current?.scrollIntoView({ block: 'end' });
    }, [messages.length, selectedId]);

    const openTicket = (id) => {
        if (id === selectedId) return;
        setMessages([]);
        setMessagesLoading(true);
        setReply('');
        setReplyFiles([]);
        setSelectedId(id);
    };

    const stats = useMemo(() => ({
        open: tickets.filter((t) => t.status === 'open' || t.status === 'in_progress').length,
        waiting: tickets.filter((t) => t.status === 'waiting_customer').length,
        resolved: tickets.filter((t) => t.status === 'resolved' || t.status === 'closed').length,
        unread: tickets.filter((t) => t.unread_for_customer).length,
    }), [tickets]);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return tickets.filter((t) => {
            if (statusFilter !== 'all' && t.status !== statusFilter) return false;
            if (!q) return true;
            return [t.subject, t.ticket_number, t.last_message_preview].some((f) => String(f || '').toLowerCase().includes(q));
        });
    }, [tickets, search, statusFilter]);

    const handleCreate = async (e) => {
        e.preventDefault();
        if (!form.subject.trim() || !form.body.trim()) return;
        setCreating(true);
        try {
            const id = await createSupportTicket(form, user, tenant?.name, newFiles);
            toast({ title: 'تم إرسال التذكرة', description: 'سيتواصل معك فريق الدعم في أقرب وقت.' });
            setForm(emptyForm);
            setNewFiles([]);
            setNewOpen(false);
            openTicket(id);
        } catch (err) {
            toast({ title: 'تعذر إرسال التذكرة', description: err.message, variant: 'destructive' });
        } finally {
            setCreating(false);
        }
    };

    const handleReply = async (e) => {
        e.preventDefault();
        if (!selected || (!reply.trim() && !replyFiles.length)) return;
        setSending(true);
        try {
            await replyToTicket(selected, reply, user, replyFiles);
            setReply('');
            setReplyFiles([]);
        } catch (err) {
            toast({ title: 'تعذر إرسال الرد', description: err.message, variant: 'destructive' });
        } finally {
            setSending(false);
        }
    };

    const toggleClosed = async () => {
        if (!selected) return;
        try {
            await setTicketClosedByCustomer(selected.id, selected.status !== 'closed');
        } catch (err) {
            toast({ title: 'تعذر تحديث التذكرة', description: err.message, variant: 'destructive' });
        }
    };

    return (
        <div className="flex flex-col gap-5" dir="rtl">
            <PageHero
                className="mb-0"
                icon={LifeBuoy}
                tone="indigo"
                title="الدعم الفني"
                subtitle="افتح تذكرة لفريق Nexora وتابع الردود لحظياً — كل الرسائل متزامنة مع فريق دعم المنصة."
                actions={
                    <button
                        type="button"
                        onClick={() => setNewOpen(true)}
                        className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-xs font-bold text-white shadow-sm shadow-primary/30 transition-colors hover:bg-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                        <Plus className="h-4 w-4" /> تذكرة جديدة
                    </button>
                }
            />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard title="تذاكر مفتوحة" value={stats.open} loading={loading} caption="قيد المراجعة من فريق الدعم" icon={MessageSquare} tone="indigo" />
                <StatCard title="بانتظار ردك" value={stats.waiting} loading={loading} valueClassName={stats.waiting ? 'text-warning' : undefined} caption="رد فريق الدعم ويحتاج متابعتك" icon={Hourglass} tone="amber" />
                <StatCard title="ردود جديدة" value={stats.unread} loading={loading} valueClassName={stats.unread ? 'text-primary' : undefined} caption="رسائل لم تقرأها بعد" icon={Clock} tone="violet" />
                <StatCard title="تم حلها / مغلقة" value={stats.resolved} loading={loading} valueClassName="text-success" caption="إجمالي التذاكر المنتهية" icon={CheckCircle2} tone="success" />
            </div>

            <div className="grid min-h-[560px] grid-cols-1 gap-5 xl:grid-cols-[380px_1fr]">
                {/* ── قائمة التذاكر ─────────────────────────────────────────── */}
                <SectionCard
                    title="تذاكري"
                    icon={Inbox}
                    actions={<CountChip>{filtered.length} تذكرة</CountChip>}
                    className="flex flex-col"
                    bodyClassName="flex flex-1 flex-col gap-3"
                >
                    <Toolbar
                        className="mb-0 border-0 bg-card-muted p-2 shadow-none lg:flex-col lg:items-stretch"
                        search={search}
                        onSearchChange={setSearch}
                        placeholder="بحث برقم التذكرة أو العنوان…"
                    >
                        <ToolbarSelect
                            className="lg:w-full"
                            ariaLabel="الحالة"
                            value={statusFilter}
                            onChange={setStatusFilter}
                            options={[{ value: 'all', label: 'كل الحالات' }, ...Object.entries(TICKET_STATUSES).map(([value, label]) => ({ value, label }))]}
                        />
                    </Toolbar>

                    <div className="-mx-1 max-h-[520px] flex-1 space-y-1.5 overflow-y-auto px-1">
                        {loading ? (
                            <div className="flex justify-center py-14"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
                        ) : filtered.length === 0 ? (
                            <EmptyState icon={LifeBuoy} text={tickets.length ? 'لا توجد تذاكر تطابق البحث.' : 'لم تفتح أي تذكرة دعم بعد.'} />
                        ) : (
                            filtered.map((t) => (
                                <button
                                    key={t.id}
                                    type="button"
                                    onClick={() => openTicket(t.id)}
                                    className={cn(
                                        'block w-full rounded-xl border p-3 text-start transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                                        t.id === selectedId ? 'border-primary/40 bg-primary-soft/60' : 'border-border bg-card hover:bg-card-muted'
                                    )}
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <span className="truncate text-[13px] font-bold text-foreground">{t.subject}</span>
                                        {t.unread_for_customer ? <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="رد جديد" /> : null}
                                    </div>
                                    <p className="mt-1 line-clamp-1 text-[11.5px] text-muted-foreground">{t.last_message_preview}</p>
                                    <div className="mt-2 flex items-center justify-between gap-2">
                                        <StatusPill status={t.status} />
                                        <span className="font-mono text-[10.5px] text-muted-foreground" dir="ltr">{t.ticket_number}</span>
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                </SectionCard>

                {/* ── المحادثة ──────────────────────────────────────────────── */}
                {selected ? (
                    <SectionCard
                        className="flex flex-col"
                        bodyClassName="flex flex-1 flex-col"
                        title={selected.subject}
                        subtitle={`${selected.ticket_number} · ${TICKET_CATEGORIES[selected.category] || selected.category} · فُتحت ${fmt(selected.created_at, 'dd MMM yyyy')}`}
                        icon={MessageSquare}
                        actions={
                            <>
                                <span className={cn('text-[11px] font-bold', TICKET_PRIORITY_STYLES[selected.priority])}>
                                    أولوية {TICKET_PRIORITIES[selected.priority] || selected.priority}
                                </span>
                                <StatusPill status={selected.status} />
                                <button
                                    type="button"
                                    onClick={toggleClosed}
                                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-[11.5px] font-bold text-secondary-text transition-colors hover:bg-card-muted"
                                >
                                    {selected.status === 'closed' ? <><RotateCcw className="h-3.5 w-3.5" /> إعادة فتح</> : <><Lock className="h-3.5 w-3.5" /> إغلاق التذكرة</>}
                                </button>
                            </>
                        }
                    >
                        <div className="max-h-[440px] min-h-[300px] flex-1 space-y-3 overflow-y-auto rounded-xl bg-card-muted p-4">
                            {messagesLoading ? (
                                <div className="flex justify-center py-14"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
                            ) : messages.length === 0 ? (
                                <EmptyState icon={MessageSquare} text="لا توجد رسائل بعد." />
                            ) : (
                                messages.map((m) => {
                                    const mine = m.author_side === 'customer';
                                    return (
                                        <div key={m.id} className={cn('flex', mine ? 'justify-start' : 'justify-end')}>
                                            <div
                                                className={cn(
                                                    'max-w-[80%] rounded-2xl px-4 py-2.5 shadow-card',
                                                    mine ? 'rounded-tr-sm bg-primary text-white' : 'rounded-tl-sm border border-border bg-card text-foreground'
                                                )}
                                            >
                                                <div className={cn('mb-1 flex items-center gap-1.5 text-[11px] font-bold', mine ? 'text-white/80' : 'text-primary')}>
                                                    {!mine ? <Headset className="h-3.5 w-3.5" /> : null}
                                                    {mine ? m.author?.name || 'أنت' : `فريق دعم Nexora · ${m.author?.name || ''}`}
                                                </div>
                                                {m.body ? <p className="whitespace-pre-wrap text-[13px] leading-relaxed">{m.body}</p> : null}
                                                <MessageAttachments attachments={m.attachments} onPrimary={mine} />
                                                <div className={cn('mt-1 text-[10px]', mine ? 'text-white/70' : 'text-muted-foreground')}>{fmt(m.created_at)}</div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                            <div ref={endRef} />
                        </div>

                        {selected.status === 'closed' ? (
                            <p className="mt-3 rounded-xl border border-border bg-card-muted px-4 py-3 text-center text-[12.5px] text-muted-foreground">
                                التذكرة مغلقة. أعد فتحها لإرسال رد جديد.
                            </p>
                        ) : (
                            <form onSubmit={handleReply} className="mt-3 flex flex-col gap-2">
                                <SelectedFiles files={replyFiles} onRemove={(i) => setReplyFiles(replyFiles.filter((_, idx) => idx !== i))} />
                                <div className="flex items-end gap-2">
                                <AttachmentPicker compact value={replyFiles} onChange={setReplyFiles} onError={fileError} disabled={sending} />
                                <Textarea
                                    value={reply}
                                    onChange={(e) => setReply(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleReply(e);
                                    }}
                                    placeholder="اكتب ردك هنا… (Ctrl + Enter للإرسال)"
                                    className="min-h-[52px] flex-1 resize-none"
                                    rows={2}
                                />
                                <button
                                    type="submit"
                                    disabled={sending || (!reply.trim() && !replyFiles.length)}
                                    className="inline-flex h-[52px] items-center gap-2 rounded-xl bg-primary px-5 text-xs font-bold text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 -scale-x-100" />}
                                    إرسال
                                </button>
                                </div>
                            </form>
                        )}
                    </SectionCard>
                ) : (
                    <SectionCard className="flex items-center justify-center">
                        <EmptyState icon={MessageSquare} text="اختر تذكرة من القائمة لعرض المحادثة، أو افتح تذكرة جديدة.">
                            <button
                                type="button"
                                onClick={() => setNewOpen(true)}
                                className="mt-1 inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-4 text-xs font-bold text-foreground transition-colors hover:bg-card-muted"
                            >
                                <Plus className="h-4 w-4" /> تذكرة جديدة
                            </button>
                        </EmptyState>
                    </SectionCard>
                )}
            </div>

            {/* ── تذكرة جديدة ───────────────────────────────────────────────── */}
            <Dialog open={newOpen} onOpenChange={setNewOpen}>
                <DialogContent className="max-w-xl" dir="rtl">
                    <DialogHeader>
                        <DialogTitle>تذكرة دعم جديدة</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleCreate} className="flex flex-col gap-4">
                        <label className="flex flex-col gap-1.5 text-[12.5px] font-semibold text-foreground">
                            عنوان المشكلة *
                            <Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="مثال: لا يمكن طباعة الفاتورة" required maxLength={140} />
                        </label>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <label className="flex flex-col gap-1.5 text-[12.5px] font-semibold text-foreground">
                                التصنيف
                                <ToolbarSelect
                                    className="lg:w-full"
                                    ariaLabel="التصنيف"
                                    value={form.category}
                                    onChange={(category) => setForm({ ...form, category })}
                                    options={Object.entries(TICKET_CATEGORIES).map(([value, label]) => ({ value, label }))}
                                />
                            </label>
                            <label className="flex flex-col gap-1.5 text-[12.5px] font-semibold text-foreground">
                                الأولوية
                                <ToolbarSelect
                                    className="lg:w-full"
                                    ariaLabel="الأولوية"
                                    value={form.priority}
                                    onChange={(priority) => setForm({ ...form, priority })}
                                    options={Object.entries(TICKET_PRIORITIES).map(([value, label]) => ({ value, label }))}
                                />
                            </label>
                        </div>
                        <label className="flex flex-col gap-1.5 text-[12.5px] font-semibold text-foreground">
                            وصف المشكلة *
                            <Textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} rows={6} placeholder="اشرح المشكلة بالتفصيل وخطوات حدوثها…" required />
                        </label>
                        <div className="flex flex-col gap-1.5 text-[12.5px] font-semibold text-foreground">
                            المرفقات <span className="text-[11px] font-normal text-muted-foreground">صور الشاشة أو ملفات توضّح المشكلة — حتى 5 ملفات، 10MB للملف</span>
                            <AttachmentPicker value={newFiles} onChange={setNewFiles} onError={fileError} disabled={creating} />
                        </div>
                        <button
                            type="submit"
                            disabled={creating || !form.subject.trim() || !form.body.trim()}
                            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary text-sm font-bold text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 -scale-x-100" />}
                            إرسال التذكرة
                        </button>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
