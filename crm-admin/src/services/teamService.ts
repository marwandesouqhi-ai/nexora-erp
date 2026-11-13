import { collection, getDocs } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../lib/firebase';
import type { TeamMember, UserRole } from '../types';

export const getTeamMembers = async (): Promise<TeamMember[]> => {
  const querySnapshot = await getDocs(collection(db, 'platform_staff'));
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as TeamMember[];
};

export const addTeamMember = async (email: string, name: string, role: UserRole) => {
  const provision = httpsCallable<
    { email: string; name: string; role: UserRole },
    { passwordResetLink: string }
  >(functions, 'provisionPlatformStaff');
  const result = await provision({ email, name, role });
  return result.data.passwordResetLink;
};

export const updateTeamMemberRole = async (memberId: string, role: UserRole) => {
  const update = httpsCallable<{ userId: string; role: UserRole }, void>(functions, 'updatePlatformStaff');
  await update({ userId: memberId, role });
};

export const deleteTeamMember = async (memberId: string) => {
  // Staff identities are retained for auditability; this disables the account
  // instead of deleting a document that could be needed in an investigation.
  const suspend = httpsCallable<{ userId: string }, void>(functions, 'suspendPlatformStaff');
  await suspend({ userId: memberId });
};
