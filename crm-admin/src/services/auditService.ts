import { collection, getDocs, addDoc, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { AuditLog } from '../types';

export const logAction = async (action: string, userEmail: string, target?: string, details?: string) => {
  try {
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
