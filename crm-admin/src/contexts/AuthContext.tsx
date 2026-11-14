import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { onAuthStateChanged, signOut as firebaseSignOut, signInWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { supabase } from '../lib/supabase';
import { isSupabaseBackend } from '../lib/backend';
import type { UserRole } from '../types';

/** Backend-neutral signed-in user (Firebase User and Supabase User both fit). */
export interface AuthUser {
  uid: string;
  email: string | null;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  isPlatformAdmin: boolean;
  isPlatformStaff: boolean;
  userRole: UserRole | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const VALID_ROLES: UserRole[] = ['platform_admin', 'billing_admin', 'support_agent'];

interface StaffRow {
  role?: string;
  status?: string;
  is_active?: boolean;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [isPlatformStaff, setIsPlatformStaff] = useState(false);
  const [userRole, setUserRole] = useState<UserRole | null>(null);

  useEffect(() => {
    const applyStaff = (data: StaffRow | null | undefined) => {
      const role = data?.role as UserRole | undefined;
      const active = !!data && data.status !== 'suspended' && data.is_active !== false;
      const valid = active && !!role && VALID_ROLES.includes(role);
      setUserRole(valid ? role! : null);
      setIsPlatformStaff(valid);
      setIsPlatformAdmin(valid && role === 'platform_admin');
    };
    const clearStaff = () => applyStaff(null);

    if (isSupabaseBackend && supabase) {
      const sb = supabase;
      let cancelled = false;
      const handleSession = async (session: { user: { id: string; email?: string | null } } | null) => {
        if (cancelled) return;
        if (!session) {
          setUser(null);
          clearStaff();
          setLoading(false);
          return;
        }
        setUser({ uid: session.user.id, email: session.user.email ?? null });
        try {
          const { data, error } = await sb
            .from('platform_staff')
            .select('role,status,is_active')
            .eq('id', session.user.id)
            .maybeSingle();
          if (error) throw error;
          if (!cancelled) applyStaff(data);
        } catch (error) {
          console.error('Error fetching user role', error);
          if (!cancelled) clearStaff();
        }
        if (!cancelled) setLoading(false);
      };

      void sb.auth.getSession().then(({ data }) => handleSession(data.session));
      const { data: sub } = sb.auth.onAuthStateChange((event, session) => {
        if (event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') return;
        // Defer: calling supabase inside this callback synchronously can deadlock.
        setTimeout(() => void handleSession(session), 0);
      });
      return () => {
        cancelled = true;
        sub.subscription.unsubscribe();
      };
    }

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser ? { uid: currentUser.uid, email: currentUser.email } : null);
      if (currentUser) {
        try {
          const userDoc = await getDoc(doc(db, 'platform_staff', currentUser.uid));
          applyStaff(userDoc.exists() ? (userDoc.data() as StaffRow) : null);
        } catch (error) {
          console.error('Error fetching user role', error);
        }
      } else {
        clearStaff();
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const login = async (email: string, password: string) => {
    if (isSupabaseBackend && supabase) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      return;
    }
    await signInWithEmailAndPassword(auth, email, password);
  };

  const logout = async () => {
    if (isSupabaseBackend && supabase) {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      return;
    }
    await firebaseSignOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, loading, isPlatformAdmin, isPlatformStaff, userRole, login, logout }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
