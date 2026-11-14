import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { callFunction } from '../lib/functions';
import { getSupabase } from '../lib/supabase';
import { isSupabaseBackend } from '../lib/backend';
import type { TeamMember, UserRole } from '../types';

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
  const result = await callFunction<{ email: string; name: string; role: UserRole }, { passwordResetLink: string }>('provisionPlatformStaff', { email, name, role });
  return result.passwordResetLink;
};

export const updateTeamMemberRole = async (memberId: string, role: UserRole) => {
  await callFunction('updatePlatformStaff', { userId: memberId, role });
};

export const deleteTeamMember = async (memberId: string) => {
  // Staff identities are retained for auditability; this disables the account
  // instead of deleting a document that could be needed in an investigation.
  await callFunction('suspendPlatformStaff', { userId: memberId });
};
