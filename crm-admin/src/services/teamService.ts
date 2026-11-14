import { collection, getDocs } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../lib/firebase';
import { getSupabase } from '../lib/supabase';
import { isSupabaseBackend } from '../lib/backend';
import type { TeamMember, UserRole } from '../types';

const NOT_READY = 'إدارة فريق المنصة غير متاحة بعد على Supabase (يحتاج Edge Function: platform-admin).';

export const getTeamMembers = async (): Promise<TeamMember[]> => {
  if (isSupabaseBackend) {
    const { data, error } = await getSupabase().from('platform_staff').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []) as TeamMember[];
  }
  const querySnapshot = await getDocs(collection(db, 'platform_staff'));
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as TeamMember[];
};

export const addTeamMember = async (email: string, name: string, role: UserRole) => {
  if (isSupabaseBackend) throw new Error(NOT_READY);
  const provision = httpsCallable<
    { email: string; name: string; role: UserRole },
    { passwordResetLink: string }
  >(functions, 'provisionPlatformStaff');
  const result = await provision({ email, name, role });
  return result.data.passwordResetLink;
};

export const updateTeamMemberRole = async (memberId: string, role: UserRole) => {
  if (isSupabaseBackend) throw new Error(NOT_READY);
  const update = httpsCallable<{ userId: string; role: UserRole }, void>(functions, 'updatePlatformStaff');
  await update({ userId: memberId, role });
};

export const deleteTeamMember = async (memberId: string) => {
  if (isSupabaseBackend) throw new Error(NOT_READY);
  // Staff identities are retained for auditability; this disables the account
  // instead of deleting a document that could be needed in an investigation.
  const suspend = httpsCallable<{ userId: string }, void>(functions, 'suspendPlatformStaff');
  await suspend({ userId: memberId });
};
