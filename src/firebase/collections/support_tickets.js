/**
 * تذاكر الدعم الفني (Support Tickets)
 * ─────────────────────────────────────────────────────────────────────────────
 * المجموعة مشتركة بين Nexora ERP (العميل) ولوحة إدارة المنصة crm-admin (فريق الدعم):
 *
 *   support_tickets/{ticketId}
 *     company_id, company_name, ticket_number, subject, category, priority, status,
 *     created_by { uid, name, email }, assigned_to (email|null),
 *     created_at, updated_at, last_message_at, last_message_preview, last_message_by ('customer'|'staff'),
 *     unread_for_staff, unread_for_customer, message_count
 *
 *   support_tickets/{ticketId}/messages/{messageId}
 *     company_id, body, author { uid, name, email }, author_side ('customer'|'staff'),
 *     internal (ملاحظة داخلية لفريق الدعم فقط — لا تظهر للعميل), created_at,
 *     attachments [{ name, url, path, content_type, size }]
 *
 * المرفقات في Firebase Storage:
 *   support_tickets/{companyId}/{ticketId}/{file}   ← مرفقات العميل وردود الفريق العادية
 *   support_tickets_internal/{ticketId}/{file}      ← مرفقات الملاحظات الداخلية (فريق المنصة فقط)
 *
 * فتح التذاكر ومتابعتها متاح لأدمن الشركة فقط (owner / admin / general_manager).
 * التزامن لحظي في الاتجاهين عبر onSnapshot. الصلاحيات مطبقة في firestore.rules و storage.rules.
 */
import { auth, db, storage } from '@/api/firebase';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import {
    addDoc,
    collection,
    doc,
    increment,
    onSnapshot,
    query,
    serverTimestamp,
    updateDoc,
    where,
} from 'firebase/firestore';
import { createTenantQuery } from '@/lib/tenantFirestore';
import { getActiveCompanyId } from '@/lib/currentTenant';

export const SUPPORT_TICKETS_COLLECTION = 'support_tickets';

/** الأدوار المسموح لها بفتح ومتابعة تذاكر الدعم داخل الشركة */
export const SUPPORT_ADMIN_ROLES = ['owner', 'admin', 'general_manager'];
export const isCompanySupportAdmin = (role) => SUPPORT_ADMIN_ROLES.includes(role);

// ─── المرفقات ─────────────────────────────────────────────────────────────────
export const MAX_ATTACHMENTS = 5;
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024; // 10MB
export const ATTACHMENT_ACCEPT =
    'image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv';

const ALLOWED_TYPES = [
    /^image\//,
    /^application\/pdf$/,
    /^application\/msword$/,
    /^application\/vnd\.openxmlformats-officedocument\.(wordprocessingml\.document|spreadsheetml\.sheet)$/,
    /^application\/vnd\.ms-excel$/,
    /^text\/plain$/,
    /^text\/csv$/,
];

export const formatBytes = (bytes = 0) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const isImageAttachment = (a) => String(a?.content_type || '').startsWith('image/');

/** يرجّع رسالة خطأ عربية أو null لو الملفات سليمة */
export const validateAttachments = (files = []) => {
    if (files.length > MAX_ATTACHMENTS) return `الحد الأقصى ${MAX_ATTACHMENTS} ملفات في الرسالة الواحدة.`;
    for (const f of files) {
        if (f.size > MAX_ATTACHMENT_BYTES) return `الملف "${f.name}" أكبر من 10 ميجابايت.`;
        if (!ALLOWED_TYPES.some((re) => re.test(f.type || ''))) {
            return `نوع الملف "${f.name}" غير مدعوم. المسموح: الصور، PDF، Word، Excel، TXT، CSV.`;
        }
    }
    return null;
};

const safeName = (name) => String(name || 'file').replace(/[^\p{L}\p{N}._-]+/gu, '_').slice(-80);

/** رفع المرفقات لمسار التذكرة في Storage */
export const uploadTicketAttachments = async (companyId, ticketId, files = []) => {
    const error = validateAttachments(files);
    if (error) throw new Error(error);
    return Promise.all(
        files.map(async (file, i) => {
            const path = `${SUPPORT_TICKETS_COLLECTION}/${companyId}/${ticketId}/${Date.now()}_${i}_${safeName(file.name)}`;
            const fileRef = storageRef(storage, path);
            await uploadBytes(fileRef, file, { contentType: file.type });
            return {
                name: file.name,
                url: await getDownloadURL(fileRef),
                path,
                content_type: file.type,
                size: file.size,
            };
        })
    );
};

const previewWithFiles = (text, attachments) =>
    String(text || '').trim()
        ? preview(text)
        : attachments.length
          ? `📎 ${attachments.map((a) => a.name).join('، ')}`.slice(0, 140)
          : '';

export const TICKET_CATEGORIES = {
    technical: 'مشكلة تقنية',
    billing: 'الفواتير والاشتراك',
    account: 'الحساب والصلاحيات',
    feature: 'اقتراح ميزة',
    other: 'أخرى',
};

export const TICKET_PRIORITIES = {
    low: 'منخفضة',
    normal: 'عادية',
    high: 'مرتفعة',
    urgent: 'عاجلة',
};

export const TICKET_STATUSES = {
    open: 'مفتوحة',
    in_progress: 'قيد المعالجة',
    waiting_customer: 'بانتظار ردك',
    resolved: 'تم الحل',
    closed: 'مغلقة',
};

/** ألوان الحالة (pill + dot) — مبنية على توكنز الثيم */
export const TICKET_STATUS_STYLES = {
    open: { pill: 'bg-primary-soft text-primary', dot: 'bg-primary' },
    in_progress: { pill: 'bg-info-soft text-info', dot: 'bg-info' },
    waiting_customer: { pill: 'bg-warning-soft text-warning', dot: 'bg-warning' },
    resolved: { pill: 'bg-success-soft text-success', dot: 'bg-success' },
    closed: { pill: 'bg-card-muted text-muted-foreground', dot: 'bg-muted-foreground' },
};

export const TICKET_PRIORITY_STYLES = {
    low: 'text-muted-foreground',
    normal: 'text-secondary-text',
    high: 'text-warning',
    urgent: 'text-danger',
};

const toMillis = (v) => (v?.toMillis ? v.toMillis() : v ? new Date(v).getTime() : 0);

const actorOf = (user) => ({
    uid: auth.currentUser?.uid || user?.uid || '',
    name: user?.displayName || user?.full_name || user?.name || user?.email?.split('@')[0] || 'مستخدم',
    email: user?.email || auth.currentUser?.email || '',
});

const preview = (text) => {
    const clean = String(text || '').replace(/\s+/g, ' ').trim();
    return clean.length > 140 ? `${clean.slice(0, 140)}…` : clean;
};

/** رقم تذكرة مقروء للبشر */
const newTicketNumber = () => `TKT-${Date.now().toString(36).toUpperCase().slice(-6)}`;

/** استماع لحظي لتذاكر الشركة الحالية (الأحدث نشاطاً أولاً) */
export const subscribeCompanyTickets = (onData, onError) => {
    const q = createTenantQuery(SUPPORT_TICKETS_COLLECTION);
    return onSnapshot(
        q,
        (snap) => {
            const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
            list.sort((a, b) => toMillis(b.last_message_at || b.created_at) - toMillis(a.last_message_at || a.created_at));
            onData(list);
        },
        (err) => {
            console.error('subscribeCompanyTickets error:', err);
            onError?.(err);
        }
    );
};

/**
 * استماع لحظي لرسائل تذكرة — العميل يرى الرسائل غير الداخلية فقط.
 * (الفلاتر company_id + internal مطلوبة لتطابق قواعد Firestore)
 */
export const subscribeTicketMessages = (ticketId, onData, onError) => {
    const companyId = getActiveCompanyId();
    const q = query(
        collection(db, SUPPORT_TICKETS_COLLECTION, ticketId, 'messages'),
        where('company_id', '==', companyId || '__NO_TENANT_ACCESS__'),
        where('internal', '==', false)
    );
    return onSnapshot(
        q,
        (snap) => {
            const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
            list.sort((a, b) => toMillis(a.created_at) - toMillis(b.created_at));
            onData(list);
        },
        (err) => {
            console.error('subscribeTicketMessages error:', err);
            onError?.(err);
        }
    );
};

/** فتح تذكرة جديدة + أول رسالة (مع مرفقات اختيارية) */
export const createSupportTicket = async ({ subject, category, priority, body }, user, companyName = '', files = []) => {
    const companyId = getActiveCompanyId();
    if (!companyId) throw new Error('لا توجد شركة مرتبطة بحسابك لفتح تذكرة دعم.');
    const fileError = validateAttachments(files);
    if (fileError) throw new Error(fileError);
    const author = actorOf(user);

    const ticketRef = await addDoc(collection(db, SUPPORT_TICKETS_COLLECTION), {
        company_id: companyId,
        company_name: companyName || '',
        ticket_number: newTicketNumber(),
        subject: String(subject || '').trim(),
        category: TICKET_CATEGORIES[category] ? category : 'other',
        priority: TICKET_PRIORITIES[priority] ? priority : 'normal',
        status: 'open',
        created_by: author,
        assigned_to: null,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
        last_message_at: serverTimestamp(),
        last_message_preview: previewWithFiles(body, files),
        last_message_by: 'customer',
        unread_for_staff: true,
        unread_for_customer: false,
        message_count: 1,
    });

    const attachments = files.length ? await uploadTicketAttachments(companyId, ticketRef.id, files) : [];

    await addDoc(collection(db, SUPPORT_TICKETS_COLLECTION, ticketRef.id, 'messages'), {
        company_id: companyId,
        body: String(body || '').trim(),
        author,
        author_side: 'customer',
        internal: false,
        attachments,
        created_at: serverTimestamp(),
    });

    return ticketRef.id;
};

/** رد العميل على تذكرة (يعيد فتحها إن كانت بانتظار الرد أو محلولة) */
export const replyToTicket = async (ticket, body, user, files = []) => {
    const text = String(body || '').trim();
    if (!text && !files.length) return;
    const attachments = files.length ? await uploadTicketAttachments(ticket.company_id, ticket.id, files) : [];
    await addDoc(collection(db, SUPPORT_TICKETS_COLLECTION, ticket.id, 'messages'), {
        company_id: ticket.company_id,
        body: text,
        author: actorOf(user),
        author_side: 'customer',
        internal: false,
        attachments,
        created_at: serverTimestamp(),
    });

    const reopen = ticket.status === 'waiting_customer' || ticket.status === 'resolved';
    await updateDoc(doc(db, SUPPORT_TICKETS_COLLECTION, ticket.id), {
        ...(reopen ? { status: 'open' } : {}),
        updated_at: serverTimestamp(),
        last_message_at: serverTimestamp(),
        last_message_preview: previewWithFiles(text, attachments),
        last_message_by: 'customer',
        unread_for_staff: true,
        unread_for_customer: false,
        message_count: increment(1),
    });
};

/** تعليم التذكرة كمقروءة من جهة العميل */
export const markTicketReadByCustomer = async (ticketId) => {
    await updateDoc(doc(db, SUPPORT_TICKETS_COLLECTION, ticketId), { unread_for_customer: false });
};

/** إغلاق / إعادة فتح التذكرة من جهة العميل */
export const setTicketClosedByCustomer = async (ticketId, closed) => {
    await updateDoc(doc(db, SUPPORT_TICKETS_COLLECTION, ticketId), {
        status: closed ? 'closed' : 'open',
        updated_at: serverTimestamp(),
        ...(closed ? {} : { unread_for_staff: true }),
    });
};
