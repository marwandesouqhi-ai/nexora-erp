import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { User } from 'firebase/auth';
import { onAuthStateChanged, signOut as firebaseSignOut, signInWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import type { UserRole } from '../types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isPlatformAdmin: boolean;
  isPlatformStaff: boolean;
  userRole: UserRole | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [isPlatformStaff, setIsPlatformStaff] = useState(false);
  const [userRole, setUserRole] = useState<UserRole | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const userDoc = await getDoc(doc(db, 'platform_staff', currentUser.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            const role = data.role as UserRole;
            const active = data.status !== 'suspended' && data.is_active !== false;
            const validRole: UserRole[] = ['platform_admin', 'billing_admin', 'support_agent'];
            setUserRole(active && validRole.includes(role) ? role : null);
            setIsPlatformStaff(active && validRole.includes(role));
            setIsPlatformAdmin(active && role === 'platform_admin');
          } else {
             setUserRole(null);
             setIsPlatformStaff(false);
             setIsPlatformAdmin(false);
          }
        } catch (error) {
          console.error("Error fetching user role", error);
        }
      } else {
        setIsPlatformAdmin(false);
        setIsPlatformStaff(false);
        setUserRole(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const login = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const logout = async () => {
    await firebaseSignOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, loading, isPlatformAdmin, isPlatformStaff, userRole, login, logout }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
