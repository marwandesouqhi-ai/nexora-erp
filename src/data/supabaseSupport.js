import { getSupabase } from '@/api/supabase';
import { getActiveCompanyId } from '@/lib/currentTenant';

/**
 * Supabase implementation of the ERP-side support tickets
 * (tables support_tickets / support_messages, bucket support-attachments).
 * Counters, unread flags and status transitions are maintained by DB triggers,
 * so the client only inserts messages and flips read/closed flags.
 */

const BUCKET = 'support-attachments';
const SIGNED_URL_TTL = 60 * 60; // seconds

/** Attachments are stored as { name, path, content_type, size }; add short-lived signed URLs for the UI. */
async function withSignedUrls(messages) {
    const paths = [...new Set(messages.flatMap((m) => (m.attachments || []).map((a) => a.path)).filter(Boolean))];
    if (!paths.length) return messages;
    const { data, error } = await getSupabase().storage.from(BUCKET).createSignedUrls(paths, SIGNED_URL_TTL);
    if (error) {
        console.error('[support] could not sign attachment URLs:', error.message);
        return messages;
    }
    const urlByPath = Object.fromEntries((data || []).map((d) => [d.path, d.signedUrl]));
    return messages.map((m) => ({
        ...m,
        attachments: (m.attachments || []).map((a) => ({ ...a, url: urlByPath[a.path] || '' })),
    }));
}

/** Live list: initial fetch + refetch on every change (Realtime only signals, RLS decides what is visible). */
function liveQuery(channelName, table, filter, fetchRows, onData, onError) {
    const sb = getSupabase();
    let active = true;
    const refresh = async () => {
        try {
            const rows = await fetchRows();
            if (active) onData(rows);
        } catch (err) {
            if (active) onError?.(err);
        }
    };
    const channel = sb
        .channel(channelName)
        .on('postgres_changes', { event: '*', schema: 'public', table, ...(filter ? { filter } : {}) }, () => { void refresh(); })
        .subscribe();
    void refresh();
    return () => {
        active = false;
        sb.removeChannel(channel);
    };
}

export function subscribeCompanyTicketsSb(onData, onError) {
    const companyId = getActiveCompanyId();
    const sb = getSupabase();
    return liveQuery(
        `tickets:${companyId}`,
        'support_tickets',
        `company_id=eq.${companyId}`,
        async () => {
            const { data, error } = await sb.from('support_tickets').select('*')
                .eq('company_id', companyId).order('last_message_at', { ascending: false });
            if (error) throw error;
            return data || [];
        },
        onData,
        onError
    );
}

export function subscribeTicketMessagesSb(ticketId, onData, onError) {
    const sb = getSupabase();
    return liveQuery(
        `ticket-messages:${ticketId}`,
        'support_messages',
        `ticket_id=eq.${ticketId}`,
        async () => {
            const { data, error } = await sb.from('support_messages').select('*')
                .eq('ticket_id', ticketId).eq('internal', false).order('created_at', { ascending: true });
            if (error) throw error;
            return withSignedUrls(data || []);
        },
        onData,
        onError
    );
}

/** Uploads to {company_id}/{ticket_id}/{file}; returns the attachment descriptors stored in the message. */
export async function uploadTicketAttachmentsSb(companyId, ticketId, files, safeName) {
    const bucket = getSupabase().storage.from(BUCKET);
    return Promise.all(
        files.map(async (file, i) => {
            const path = `${companyId}/${ticketId}/${Date.now()}_${i}_${safeName(file.name)}`;
            const { error } = await bucket.upload(path, file, { contentType: file.type, upsert: false });
            if (error) throw error;
            return { name: file.name, path, content_type: file.type, size: file.size };
        })
    );
}

export async function createTicketSb({ companyId, companyName, subject, category, priority, author }) {
    const { data, error } = await getSupabase().from('support_tickets').insert({
        company_id: companyId,
        company_name: companyName || '',
        subject,
        category,
        priority,
        status: 'open',
        created_by: author,
    }).select('id').single();
    if (error) throw error;
    return data.id;
}

export async function addCustomerMessageSb({ ticketId, companyId, body, author, attachments }) {
    const { error } = await getSupabase().from('support_messages').insert({
        ticket_id: ticketId,
        company_id: companyId,
        body,
        author,
        author_side: 'customer',
        internal: false,
        attachments,
    });
    if (error) throw error;
}

export async function updateTicketSb(ticketId, patch) {
    const { error } = await getSupabase().from('support_tickets').update(patch).eq('id', ticketId);
    if (error) throw error;
}

export async function currentAuthUserSb() {
    const { data } = await getSupabase().auth.getUser();
    return data?.user ? { uid: data.user.id, email: data.user.email || '' } : { uid: '', email: '' };
}
