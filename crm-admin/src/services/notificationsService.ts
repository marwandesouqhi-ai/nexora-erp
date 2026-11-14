import { collection, getDocs, doc, updateDoc, addDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { getSupabase } from '../lib/supabase';
import { isSupabaseBackend } from '../lib/backend';
import type { Notification, UserRole } from '../types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const toNotification = (row: any): Notification => ({
  id: row.id,
  title: row.title,
  message: row.message,
  targetRole: row.target_role ?? undefined,
  targetUser: row.target_user ?? undefined,
  read: Boolean(row.read),
  created_at: row.created_at,
});

export const getNotifications = async (userEmail: string, userRole: UserRole): Promise<Notification[]> => {
  try {
    let allNotifs: Notification[];
    if (isSupabaseBackend) {
      const { data, error } = await getSupabase().from('platform_notifications').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      allNotifs = (data || []).map(toNotification);
    } else {
      const q = query(collection(db, 'platform_notifications'), orderBy('created_at', 'desc'));
      const querySnapshot = await getDocs(q);
      allNotifs = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Notification[];
    }

    // Filter notifications meant for this user or their role or 'all'
    return allNotifs.filter(n =>
      n.targetRole === 'all' ||
      n.targetRole === userRole ||
      n.targetUser === userEmail
    );
  } catch (error) {
    console.error("Error fetching notifications", error);
    return [];
  }
};

export const createNotification = async (title: string, message: string, targetRole: UserRole | 'all' = 'all', targetUser?: string) => {
  if (isSupabaseBackend) {
    const { error } = await getSupabase().from('platform_notifications').insert({
      title,
      message,
      target_role: targetRole,
      target_user: targetUser || null,
      read: false,
    });
    if (error) throw error;
    return;
  }
  const newNotif = {
    title,
    message,
    targetRole,
    targetUser: targetUser || null,
    read: false,
    created_at: new Date().toISOString()
  };
  await addDoc(collection(db, 'platform_notifications'), newNotif);
};

export const markNotificationRead = async (notifId: string) => {
  if (isSupabaseBackend) {
    const { error } = await getSupabase().from('platform_notifications').update({ read: true }).eq('id', notifId);
    if (error) throw error;
    return;
  }
  const notifRef = doc(db, 'platform_notifications', notifId);
  await updateDoc(notifRef, { read: true });
};
