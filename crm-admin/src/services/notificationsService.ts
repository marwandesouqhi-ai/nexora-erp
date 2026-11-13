import { collection, getDocs, doc, updateDoc, addDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Notification, UserRole } from '../types';

export const getNotifications = async (userEmail: string, userRole: UserRole): Promise<Notification[]> => {
  try {
    const q = query(collection(db, 'platform_notifications'), orderBy('created_at', 'desc'));
    const querySnapshot = await getDocs(q);
    const allNotifs = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Notification[];

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
  const notifRef = doc(db, 'platform_notifications', notifId);
  await updateDoc(notifRef, { read: true });
};
