import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { supabase } from '../lib/supabase';
import { isSupabaseBackend } from '../lib/backend';

/** Current staff member's email, or 'System' for automated actions. */
export const getCurrentUserEmail = async (): Promise<string> => {
  if (isSupabaseBackend && supabase) {
    const { data } = await supabase.auth.getUser();
    return data.user?.email || 'System';
  }
  return auth.currentUser?.email || 'System';
};

/** Re-verifies the current password, then sets a new one. Throws `Error` with `code` on bad password. */
export const changePassword = async (email: string, currentPassword: string, newPassword: string): Promise<void> => {
  if (isSupabaseBackend && supabase) {
    const { error: verifyError } = await supabase.auth.signInWithPassword({ email, password: currentPassword });
    if (verifyError) {
      const err = new Error(verifyError.message) as Error & { code?: string };
      err.code = 'auth/wrong-password';
      throw err;
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
    return;
  }
  const user = auth.currentUser;
  if (!user) throw new Error('No signed-in user');
  await reauthenticateWithCredential(user, EmailAuthProvider.credential(email, currentPassword));
  await updatePassword(user, newPassword);
};
