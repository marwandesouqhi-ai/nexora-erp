import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { LifeBuoy, Inbox, MessageSquare, AlertTriangle, Hourglass, Send, Loader2, StickyNote, Building2, User, Bell } from 'lucide-react';
import { PageHero, StatCard, SectionCard, EmptyState, Toolbar, ToolbarSelect, CountChip, cn } from '../components/page';
import {
    TICKET_CATEGORIES, TICKET_PRIORITIES, TICKET_STATUSES, TICKET_STATUS_STYLES, TICKET_PRIORITY_STYLES,
    subscribeAllTickets, subscribeTicketMessages, replyAsStaff, updateTicketFields, markTicketReadByStaff, toMillis,
} from '../services/ticketsService';
import { getTeamMembers } from '../services/teamService';
import { AttachButton, SelectedFiles, MessageAttachments } from '../components/TicketAttachments';
import type { SupportTicket, TicketMessage, TicketPriority, TicketStatus, TeamMember } from '../types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fmt = (v: any, pattern = 'dd MMM yyyy - hh:mm a') => {
    const ms = toMillis(v);
    return ms ? format(new Date(ms), pattern, { locale: ar }) : '—';
};

function StatusPill({ status }: { status: TicketStatus }) {
    const s = TICKET_STATUS_STYLES[status] || TICKET_STATUS_STYLES.closed;
    return (
        <span className={cn('inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold', s.pill)}>
            <span className={cn('h-1.5 w-1.5 rounded-full', s.dot)} />
            {TICKET_STATUSES[status] || status}
        </span>
    );
}

const FIELD_SELECT = 'h-9 rounded-lg border border-border bg-card px-2.5 text-[12px] font-semibold text-foreground outline-none focus:ring-2 focus:ring-primary/40';

export function Tickets() {
    const [tickets, setTickets] = useState<SupportTicket[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [messages, setMessages] = useState<TicketMessage[]>([]);
    const [messagesLoading, setMessagesLoading] = useState(false);
    const [team, setTeam] = useState<TeamMember[]>([]);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('active');
    const [priorityFilter, setPriorityFilter] = useState('all');
    const [reply, setReply] = useState('');
    const [internal, setInternal] = useState(false);
    const [sending, setSending] = useState(false);
    const [files, setFiles] = useState<File[]>([]);
    const endRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const unsub = subscribeAllTickets(
            (list) => {
                setTickets(list);
                setLoading(false);
            },
            () => {
                setLoading(false);
                setError('تعذر تحميل التذاكر لحظياً. تأكد من صلاحيات الحساب.');
            }
        );
        getTeamMembers().then(setTeam).catch(() => setTeam([]));
        return unsub;
    }, []);

    const selected = tickets.find((t) => t.id === selectedId) || null;

    useEffect(() => {
        if (!selectedId) return undefined;
        return subscribeTicketMessages(
            selectedId,
            (list) => {
                setMessages(list);
                setMessagesLoading(false);
            },
            () => setMessagesLoading(false)
        );
    }, [selectedId]);

    useEffect(() => {
        if (selected?.unread_for_staff) markTicketReadByStaff(selected.id).catch(() => {});
    }, [selected?.id, selected?.unread_for_staff]);

    useEffect(() => {
        endRef.current?.scrollIntoView({ block: 'end' });
    }, [messages.length, selectedId]);

    const openTicket = (id: string) => {
        if (id === selectedId) return;
        setMessages([]);
        setMessagesLoading(true);
        setReply('');
        setFiles([]);
        setInternal(false);
        setSelectedId(id);
    };

    const stats = useMemo(
        () => ({
            unread: tickets.filter((t) => t.unread_for_staff).length,
            active: tickets.filter((t) => t.status === 'open' || t.status === 'in_progress').length,
            waiting: tickets.filter((t) => t.status === 'waiting_customer').length,
            urgent: tickets.filter((t) => (t.priority === 'urgent' || t.priority === 'high') && t.status !== 'closed' && t.status !== 'resolved').length,
        }),
        [tickets]
    );

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return tickets.filter((t) => {
            if (statusFilter === 'active' && (t.status === 'closed' || t.status === 'resolved')) return false;
            if (statusFilter !== 'all' && statusFilter !== 'active' && t.status !== statusFilter) return false;
            if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
            if (!q) return true;
            return [t.subject, t.ticket_number, t.company_name, t.created_by?.email, t.last_message_preview].some((f) =>
                String(f || '').toLowerCase().includes(q)
            );
        });
    }, [tickets, search, statusFilter, priorityFilter]);

    const handleReply = async (e: FormEvent) => {
        e.preventDefault();
        if (!selected || (!reply.trim() && !files.length)) return;
        setSending(true);
        try {
            await replyAsStaff(selected, reply, internal, files);
            setReply('');
            setFiles([]);
        } catch (err) {
            console.error(err);
            setError(err instanceof Error && err.message ? err.message : 'تعذر إرسال الرد.');
        } finally {
            setSending(false);
        }
    };

    const update = (data: Partial<Pick<SupportTicket, 'status' | 'priority' | 'assigned_to'>>) => {
        if (!selected) return;
        updateTicketFields(selected, data).catch((err) => {
            console.error(err);
            setError('تعذر تحديث التذكرة.');
        });
    };

    return (
        <div className="flex flex-col gap-5">
            <PageHero
                icon={LifeBuoy}
                tone="indigo"
                className="mb-0"
                title="تذاكر الدعم الفني"
                subtitle="كل تذاكر عملاء Nexora ERP في مكان واحد — الردود متزامنة لحظياً مع شاشة الدعم داخل النظام."
                actions={
                    stats.unread ? (
                        <span className="inline-flex h-9 items-center gap-2 rounded-full border border-primary/20 bg-primary-soft px-3.5 text-xs font-bold text-primary">
                            <Bell className="h-4 w-4" />
                            {stats.unread} تذكرة بها رد جديد
                        </span>
                    ) : null
                }
            />

            {error ? (
                <div className="rounded-2xl border border-danger/25 bg-danger-soft px-4 py-3 text-[13px] font-semibold text-danger" role="alert">
                    {error}
                </div>
            ) : null}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard title="رسائل جديدة من العملاء" value={stats.unread} loading={loading} valueClassName={stats.unread ? 'text-primary' : undefined} caption="لم يقرأها الفريق بعد" icon={Inbox} tone="indigo" />
                <StatCard title="تذاكر نشطة" value={stats.active} loading={loading} caption="مفتوحة أو قيد المعالجة" icon={MessageSquare} tone="blue" />
                <StatCard title="بانتظار العميل" value={stats.waiting} loading={loading} caption="تم الرد وننتظر العميل" icon={Hourglass} tone="amber" />
                <StatCard title="عاجلة / مرتفعة" value={stats.urgent} loading={loading} valueClassName={stats.urgent ? 'text-danger' : undefined} caption="أولوية تحتاج تدخلاً سريعاً" icon={AlertTriangle} tone="danger" />
            </div>

            <div className="grid min-h-[600px] grid-cols-1 gap-5 xl:grid-cols-[400px_1fr]">
                {/* ── Inbox ───────────────────────────────────────────────── */}
                <SectionCard title="صندوق التذاكر" icon={Inbox} actions={<CountChip>{filtered.length} تذكرة</CountChip>} className="flex flex-col" bodyClassName="flex flex-1 flex-col gap-3">
                    <Toolbar className="mb-0 border-0 bg-card-muted p-2 shadow-none lg:flex-col lg:items-stretch" search={search} onSearchChange={setSearch} placeholder="رقم التذكرة، الشركة، العنوان…">
                        <div className="grid grid-cols-2 gap-2">
                            <ToolbarSelect
                                className="lg:w-full"
                                ariaLabel="الحالة"
                                value={statusFilter}
                                onChange={setStatusFilter}
                                options={[
                                    { value: 'active', label: 'غير المنتهية' },
                                    { value: 'all', label: 'كل الحالات' },
                                    ...Object.entries(TICKET_STATUSES).map(([value, label]) => ({ value, label })),
                                ]}
                            />
                            <ToolbarSelect
                                className="lg:w-full"
                                ariaLabel="الأولوية"
                                value={priorityFilter}
                                onChange={setPriorityFilter}
                                options={[{ value: 'all', label: 'كل الأولويات' }, ...Object.entries(TICKET_PRIORITIES).map(([value, label]) => ({ value, label }))]}
                            />
                        </div>
                    </Toolbar>

                    <div className="-mx-1 max-h-[560px] flex-1 space-y-1.5 overflow-y-auto px-1">
                        {loading ? (
                            <div className="flex justify-center py-14">
                                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                            </div>
                        ) : filtered.length === 0 ? (
                            <EmptyState icon={LifeBuoy} text={tickets.length ? 'لا توجد تذاكر تطابق الفلاتر.' : 'لا توجد تذاكر دعم حتى الآن.'} />
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
                                        <span className={cn('truncate text-[13px] text-foreground', t.unread_for_staff ? 'font-extrabold' : 'font-bold')}>{t.subject}</span>
                                        {t.unread_for_staff ? <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="رسالة جديدة" /> : null}
                                    </div>
                                    <div className="mt-1 flex items-center gap-1.5 text-[11px] text-secondary-text">
                                        <Building2 className="h-3 w-3" />
                                        <span className="truncate">{t.company_name || t.company_id}</span>
                                    </div>
                                    <p className="mt-1 line-clamp-1 text-[11.5px] text-muted-foreground">{t.last_message_preview}</p>
                                    <div className="mt-2 flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2">
                                            <StatusPill status={t.status} />
                                            <span className={cn('text-[10.5px] font-bold', TICKET_PRIORITY_STYLES[t.priority])}>{TICKET_PRIORITIES[t.priority]}</span>
                                        </div>
                                        <span className="font-mono text-[10.5px] text-muted-foreground" dir="ltr">
                                            {t.ticket_number}
                                        </span>
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                </SectionCard>

                {/* ── Conversation ────────────────────────────────────────── */}
                {selected ? (
                    <SectionCard
                        className="flex flex-col"
                        bodyClassName="flex flex-1 flex-col gap-3"
                        title={selected.subject}
                        subtitle={`${selected.ticket_number} · ${TICKET_CATEGORIES[selected.category] || selected.category} · ${fmt(selected.created_at, 'dd MMM yyyy')}`}
                        icon={MessageSquare}
                        actions={<StatusPill status={selected.status} />}
                    >
                        {/* Ticket meta + controls */}
                        <div className="grid gap-3 rounded-xl border border-border bg-card-muted p-3 md:grid-cols-[1fr_auto]">
                            <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[12px] text-secondary-text">
                                <span className="inline-flex items-center gap-1.5">
                                    <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                                    <b className="text-foreground">{selected.company_name || selected.company_id}</b>
                                </span>
                                <span className="inline-flex items-center gap-1.5">
                                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                                    {selected.created_by?.name} <span dir="ltr" className="text-muted-foreground">{selected.created_by?.email}</span>
                                </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <select aria-label="الحالة" className={FIELD_SELECT} value={selected.status} onChange={(e) => update({ status: e.target.value as TicketStatus })}>
                                    {Object.entries(TICKET_STATUSES).map(([value, label]) => (
                                        <option key={value} value={value}>
                                            {label}
                                        </option>
                                    ))}
                                </select>
                                <select aria-label="الأولوية" className={FIELD_SELECT} value={selected.priority} onChange={(e) => update({ priority: e.target.value as TicketPriority })}>
                                    {Object.entries(TICKET_PRIORITIES).map(([value, label]) => (
                                        <option key={value} value={value}>
                                            أولوية {label}
                                        </option>
                                    ))}
                                </select>
                                <select aria-label="الإسناد" className={FIELD_SELECT} value={selected.assigned_to || ''} onChange={(e) => update({ assigned_to: e.target.value || null })}>
                                    <option value="">بدون إسناد</option>
                                    {team.map((m) => (
                                        <option key={m.id} value={m.email}>
                                            {m.name || m.email}
                                        </option>
                                    ))}
                                    {selected.assigned_to && !team.some((m) => m.email === selected.assigned_to) ? (
                                        <option value={selected.assigned_to}>{selected.assigned_to}</option>
                                    ) : null}
                                </select>
                            </div>
                        </div>

                        <div className="max-h-[420px] min-h-[280px] flex-1 space-y-3 overflow-y-auto rounded-xl bg-card-muted p-4">
                            {messagesLoading ? (
                                <div className="flex justify-center py-14">
                                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                </div>
                            ) : messages.length === 0 ? (
                                <EmptyState icon={MessageSquare} text="لا توجد رسائل بعد." />
                            ) : (
                                messages.map((m) => {
                                    const staff = m.author_side === 'staff';
                                    return (
                                        <div key={m.id} className={cn('flex', staff ? 'justify-start' : 'justify-end')}>
                                            <div
                                                className={cn(
                                                    'max-w-[80%] rounded-2xl px-4 py-2.5 shadow-card',
                                                    m.internal
                                                        ? 'rounded-tr-sm border border-dashed border-warning/50 bg-warning-soft text-foreground'
                                                        : staff
                                                          ? 'rounded-tr-sm bg-primary text-white'
                                                          : 'rounded-tl-sm border border-border bg-card text-foreground'
                                                )}
                                            >
                                                <div
                                                    className={cn(
                                                        'mb-1 flex items-center gap-1.5 text-[11px] font-bold',
                                                        m.internal ? 'text-warning' : staff ? 'text-white/80' : 'text-primary'
                                                    )}
                                                >
                                                    {m.internal ? <StickyNote className="h-3.5 w-3.5" /> : null}
                                                    {m.internal ? `ملاحظة داخلية · ${m.author?.name}` : staff ? m.author?.name || 'فريق الدعم' : `${m.author?.name} · العميل`}
                                                </div>
                                                {m.body ? <p className="whitespace-pre-wrap text-[13px] leading-relaxed">{m.body}</p> : null}
                                                <MessageAttachments attachments={m.attachments} onPrimary={staff && !m.internal} />
                                                <div className={cn('mt-1 text-[10px]', staff && !m.internal ? 'text-white/70' : 'text-muted-foreground')}>{fmt(m.created_at)}</div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                            <div ref={endRef} />
                        </div>

                        <form onSubmit={handleReply} className="flex flex-col gap-2">
                            <div className="flex items-center gap-1 self-start rounded-full border border-border bg-card-muted p-1" role="tablist" aria-label="نوع الرد">
                                <button
                                    type="button"
                                    role="tab"
                                    aria-selected={!internal}
                                    onClick={() => setInternal(false)}
                                    className={cn('h-7 rounded-full px-3 text-[11.5px] font-bold transition-colors', !internal ? 'bg-primary text-white' : 'text-muted-foreground hover:text-foreground')}
                                >
                                    رد للعميل
                                </button>
                                <button
                                    type="button"
                                    role="tab"
                                    aria-selected={internal}
                                    onClick={() => setInternal(true)}
                                    className={cn('h-7 rounded-full px-3 text-[11.5px] font-bold transition-colors', internal ? 'bg-warning text-white' : 'text-muted-foreground hover:text-foreground')}
                                >
                                    ملاحظة داخلية
                                </button>
                            </div>
                            <SelectedFiles files={files} onRemove={(i) => setFiles(files.filter((_, idx) => idx !== i))} />
                            <div className="flex items-end gap-2">
                                <AttachButton value={files} onChange={setFiles} onError={setError} disabled={sending} />
                                <textarea
                                    value={reply}
                                    onChange={(e) => setReply(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleReply(e);
                                    }}
                                    rows={2}
                                    placeholder={internal ? 'ملاحظة يراها فريق الدعم فقط…' : 'اكتب ردك للعميل… (Ctrl + Enter للإرسال)'}
                                    className={cn(
                                        'min-h-[52px] flex-1 resize-none rounded-xl border-0 px-4 py-2.5 text-[13px] text-foreground outline-none placeholder:text-muted-foreground focus:ring-2',
                                        internal ? 'bg-warning-soft focus:ring-warning/40' : 'bg-input focus:ring-primary/40'
                                    )}
                                />
                                <button
                                    type="submit"
                                    disabled={sending || (!reply.trim() && !files.length)}
                                    className={cn(
                                        'inline-flex h-[52px] items-center gap-2 rounded-xl px-5 text-xs font-bold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-60',
                                        internal ? 'bg-warning hover:bg-warning/90' : 'bg-primary hover:bg-primary-hover'
                                    )}
                                >
                                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : internal ? <StickyNote className="h-4 w-4" /> : <Send className="h-4 w-4 -scale-x-100" />}
                                    {internal ? 'حفظ الملاحظة' : 'إرسال'}
                                </button>
                            </div>
                        </form>
                    </SectionCard>
                ) : (
                    <SectionCard className="flex items-center justify-center">
                        <EmptyState icon={MessageSquare} text="اختر تذكرة من الصندوق لعرض المحادثة والرد على العميل." />
                    </SectionCard>
                )}
            </div>
        </div>
    );
}
