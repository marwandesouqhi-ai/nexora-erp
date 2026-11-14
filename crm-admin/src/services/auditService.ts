import { collection, getDocs, addDoc, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { getSupabase } from '../lib/supabase';
import { isSupabaseBackend } from '../lib/backend';
import type { AuditLog } from '../types';

export const logAction = async (action: string, userEmail: string, target?: string, details?: string) => {
  try {
    if (isSupabaseBackend) {
      // Written server-side by platform-admin (it records the actor and e-mail itself).
      const { error } = await getSupabase().functions.invoke('platform-admin', {
        body: { action: 'log_action', event: action, target: target ?? '', details: details ?? '' },
      });
      if (error) throw error;
      return;
    }
    const logData: AuditLog = {
      action,
      userEmail,
      target,
      details,
      timestamp: new Date().toISOString()
    };
    // CRM audit records are platform-only; they never share ERP audit logs.
    await addDoc(collection(db, 'platform_audit_logs'), logData);
  } catch (error) {
    console.error("Failed to log action", error);
  }
};

export const getAuditLogs = async (maxLogs: number = 50): Promise<AuditLog[]> => {
  try {
    if (isSupabaseBackend) {
      const { data, error } = await getSupabase()
        .from('platform_audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(maxLogs);
      if (error) throw error;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (data || []).map((row: any) => ({
        id: String(row.id),
        action: row.action,
        userEmail: row.metadata?.actor_email ?? row.metadata?.userEmail ?? '',
        target: row.target ?? undefined,
        details: row.metadata?.details ?? undefined,
        timestamp: row.created_at,
      }));
    }
    const q = query(
      collection(db, 'platform_audit_logs'),
      orderBy('timestamp', 'desc'),
      limit(maxLogs)
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as AuditLog[];
  } catch (error) {
    console.error("Failed to get audit logs", error);
    return [];
  }
};
