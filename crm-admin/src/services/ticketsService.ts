/**
 * تذاكر الدعم الفني — جهة فريق المنصة.
 * نفس المجموعة اللي بيكتب فيها Nexora ERP (support_tickets) — التزامن لحظي عبر onSnapshot.
 */
import {
    addDoc,
    collection,
    doc,
    increment,
    onSnapshot,
    serverTimestamp,
    updateDoc,
    type Unsubscribe,
} from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, db, storage } from '../lib/firebase';
import { logAction } from './auditService';
import type { SupportTicket, TicketAttachment, TicketMessage, TicketPriority, TicketStatus } from '../types';

const COL = 'support_tickets';

// ─── المرفقات (نفس قيود Nexora ERP) ──────────────────────────────────────────
export const MAX_ATTACHMENTS = 5;
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const ATTACHMENT_ACCEPT = 'image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv';
const ALLOWED_TYPES = [
    /^image\//,
    /^application\/pdf$/,
    /^application\/msword$/,
    /^application\/vnd\.openxmlformats-officedocument\.(wordprocessingml\.document|spreadsheetml\.sheet)$/,
    /^application\/vnd\.ms-excel$/,
    /^text\/plain$/,
    /^text\/csv$/,
];

export const formatBytes = (bytes = 0) =>
    bytes < 1024 ? `${bytes} B` : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(0)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

export const isImageAttachment = (a: Pick<TicketAttachment, 'content_type'>) => String(a?.content_type || '').startsWith('image/');

export const validateAttachments = (files: File[]): string | null => {
    if (files.length > MAX_ATTACHMENTS) return `الحد الأقصى ${MAX_ATTACHMENTS} ملفات في الرسالة الواحدة.`;
    for (const f of files) {
        if (f.size > MAX_ATTACHMENT_BYTES) return `الملف "${f.name}" أكبر من 10 ميجابايت.`;
        if (!ALLOWED_TYPES.some((re) => re.test(f.type || ''))) return `نوع الملف "${f.name}" غير مدعوم. المسموح: الصور، PDF، Word، Excel، TXT، CSV.`;
    }
    return null;
};

const safeName = (name: string) => String(name || 'file').replace(/[^\p{L}\p{N}._-]+/gu, '_').slice(-80);

/**
 * رفع مرفقات رد الفريق.
 * الملاحظات الداخلية في مسار منفصل (support_tickets_internal) لا يصل إليه العميل حتى بعرض محتوى المجلد.
 */
const uploadAttachments = async (ticket: SupportTicket, files: File[], internal: boolean): Promise<TicketAttachment[]> => {
    const error = validateAttachments(files);
    if (error) throw new Error(error);
    const base = internal ? `support_tickets_internal/${ticket.id}` : `${COL}/${ticket.company_id}/${ticket.id}`;
    return Promise.all(
        files.map(async (file, i) => {
            const path = `${base}/${Date.now()}_${i}_${safeName(file.name)}`;
            const fileRef = storageRef(storage, path);
            await uploadBytes(fileRef, file, { contentType: file.type });
            return { name: file.name, url: await getDownloadURL(fileRef), path, content_type: file.type, size: file.size };
        })
    );
};

export const TICKET_CATEGORIES: Record<string, string> = {
    technical: 'مشكلة تقنية',
    billing: 'الفواتير والاشتراك',
    account: 'الحساب والصلاحيات',
    feature: 'اقتراح ميزة',
    other: 'أخرى',
};

export const TICKET_PRIORITIES: Record<TicketPriority, string> = {
    low: 'منخفضة',
    normal: 'عادية',
    high: 'مرتفعة',
    urgent: 'عاجلة',
};

export const TICKET_STATUSES: Record<TicketStatus, string> = {
    open: 'مفتوحة',
    in_progress: 'قيد المعالجة',
    waiting_customer: 'بانتظار العميل',
    resolved: 'تم الحل',
    closed: 'مغلقة',
};

export const TICKET_STATUS_STYLES: Record<TicketStatus, { pill: string; dot: string }> = {
    open: { pill: 'bg-primary-soft text-primary', dot: 'bg-primary' },
    in_progress: { pill: 'bg-info-soft text-info', dot: 'bg-info' },
    waiting_customer: { pill: 'bg-warning-soft text-warning', dot: 'bg-warning' },
    resolved: { pill: 'bg-success-soft text-success', dot: 'bg-success' },
    closed: { pill: 'bg-card-muted text-muted-foreground', dot: 'bg-muted-foreground' },
};

export const TICKET_PRIORITY_STYLES: Record<TicketPriority, string> = {
    low: 'text-muted-foreground',
    normal: 'text-secondary-text',
    high: 'text-warning',
    urgent: 'text-danger',
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const toMillis = (v: any): number => (v?.toMillis ? v.toMillis() : v ? new Date(v).getTime() : 0);

const actor = () => {
    const u = auth.currentUser;
    return { uid: u?.uid || '', name: u?.displayName || u?.email?.split('@')[0] || 'فريق الدعم', email: u?.email || '' };
};

const preview = (text: string) => {
    const clean = text.replace(/\s+/g, ' ').trim();
    return clean.length > 140 ? `${clean.slice(0, 140)}…` : clean;
};

/** كل التذاكر لكل الشركات — للفريق فقط (مطبق في firestore.rules) */
export const subscribeAllTickets = (onData: (t: SupportTicket[]) => void, onError?: (e: Error) => void): Unsubscribe =>
    onSnapshot(
        collection(db, COL),
        (snap) => {
            const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as SupportTicket);
            list.sort((a, b) => toMillis(b.last_message_at || b.created_at) - toMillis(a.last_message_at || a.created_at));
            onData(list);
        },
        (err) => {
            console.error('subscribeAllTickets error:', err);
            onError?.(err);
        }
    );

/** كل رسائل التذكرة بما فيها الملاحظات الداخلية */
export const subscribeTicketMessages = (
    ticketId: string,
    onData: (m: TicketMessage[]) => void,
    onError?: (e: Error) => void
): Unsubscribe =>
    onSnapshot(
        collection(db, COL, ticketId, 'messages'),
        (snap) => {
            const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as TicketMessage);
            list.sort((a, b) => toMillis(a.created_at) - toMillis(b.created_at));
            onData(list);
        },
        (err) => {
            console.error('subscribeTicketMessages error:', err);
            onError?.(err);
        }
    );

/** رد فريق الدعم (أو ملاحظة داخلية لا يراها العميل) — مع مرفقات اختيارية */
export const replyAsStaff = async (ticket: SupportTicket, body: string, internal: boolean, files: File[] = []) => {
    const text = body.trim();
    if (!text && !files.length) return;
    const attachments = files.length ? await uploadAttachments(ticket, files, internal) : [];
    await addDoc(collection(db, COL, ticket.id, 'messages'), {
        company_id: ticket.company_id,
        body: text,
        author: actor(),
        author_side: 'staff',
        internal,
        attachments,
        created_at: serverTimestamp(),
    });

    if (internal) {
        await updateDoc(doc(db, COL, ticket.id), { updated_at: serverTimestamp() });
        return;
    }

    const nextStatus: TicketStatus = ticket.status === 'closed' || ticket.status === 'resolved' ? ticket.status : 'waiting_customer';
    await updateDoc(doc(db, COL, ticket.id), {
        status: nextStatus,
        updated_at: serverTimestamp(),
        last_message_at: serverTimestamp(),
        last_message_preview: text ? preview(text) : `📎 ${attachments.map((a) => a.name).join('، ')}`.slice(0, 140),
        last_message_by: 'staff',
        unread_for_customer: true,
        unread_for_staff: false,
        message_count: increment(1),
        ...(ticket.assigned_to ? {} : { assigned_to: actor().email || null }),
    });
};

export const updateTicketFields = async (
    ticket: SupportTicket,
    data: Partial<Pick<SupportTicket, 'status' | 'priority' | 'assigned_to'>>
) => {
    await updateDoc(doc(db, COL, ticket.id), { ...data, updated_at: serverTimestamp() });
    const parts: string[] = [];
    if (data.status) parts.push(`الحالة → ${TICKET_STATUSES[data.status]}`);
    if (data.priority) parts.push(`الأولوية → ${TICKET_PRIORITIES[data.priority]}`);
    if (data.assigned_to !== undefined) parts.push(`الإسناد → ${data.assigned_to || 'بدون'}`);
    if (parts.length) {
        await logAction('تحديث تذكرة دعم', auth.currentUser?.email || 'System', ticket.id, `${ticket.ticket_number}: ${parts.join('، ')}`);
    }
};

export const markTicketReadByStaff = async (ticketId: string) => {
    await updateDoc(doc(db, COL, ticketId), { unread_for_staff: false });
};
