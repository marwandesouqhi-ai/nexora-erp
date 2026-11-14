import { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '../api/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { supabase } from '../api/supabase';
import { isSupabaseBackend } from '../api/backend';
import { setActiveCompanyId } from './currentTenant';

const AuthContext = createContext();

/** Firebase: auth state + live users/{uid} document. */
function useFirebaseAuth(setUser, setLoading) {
    useEffect(() => {
        if (isSupabaseBackend) return undefined;
        let unsubscribeUserDoc = null;

        const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
            if (unsubscribeUserDoc) {
                unsubscribeUserDoc();
                unsubscribeUserDoc = null;
            }

            if (!currentUser) {
                setUser(null);
                setActiveCompanyId('');
                setLoading(false);
                return;
            }

            const userDocRef = doc(db, 'users', currentUser.uid);
            unsubscribeUserDoc = onSnapshot(userDocRef, (snap) => {
                const userData = snap.exists() ? snap.data() : {};
                setUser({ ...currentUser, ...userData });
                // Never reuse a stale company from localStorage for another account.
                setActiveCompanyId(userData.company_id || '');
                setLoading(false);
            }, () => {
                setUser(currentUser);
                setLoading(false);
            });
        });

        return () => {
            unsubscribeAuth();
            if (unsubscribeUserDoc) unsubscribeUserDoc();
        };
    }, [setUser, setLoading]);
}

/** Supabase: session + live public.profiles row (role, company_id, status...). */
function useSupabaseAuth(setUser, setLoading) {
    useEffect(() => {
        if (!isSupabaseBackend) return undefined;
        let cancelled = false;
        let channel = null;

        const stopProfileWatch = () => {
            if (channel) {
                supabase.removeChannel(channel);
                channel = null;
            }
        };

        const applyProfile = (authUser, profile) => {
            if (cancelled) return;
            // Keep `uid` so existing code that reads user.uid keeps working.
            setUser({ ...authUser, uid: authUser.id, ...(profile || {}) });
            setActiveCompanyId(profile?.company_id || '');
            setLoading(false);
        };

        const loadProfile = async (authUser) => {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', authUser.id)
                .maybeSingle();
            if (error) console.error('[auth] failed to load profile:', error.message);
            applyProfile(authUser, data);
        };

        const handleSession = (session) => {
            stopProfileWatch();
            const authUser = session?.user;
            if (!authUser) {
                if (cancelled) return;
                setUser(null);
                setActiveCompanyId('');
                setLoading(false);
                return;
            }
            void loadProfile(authUser);
            // Permission/status changes apply immediately, like the old onSnapshot.
            channel = supabase
                .channel(`profile:${authUser.id}`)
                .on(
                    'postgres_changes',
                    { event: '*', schema: 'public', table: 'profiles', filter: `id=eq.${authUser.id}` },
                    (payload) => applyProfile(authUser, payload.new)
                )
                .subscribe();
        };

        supabase.auth.getSession().then(({ data }) => handleSession(data.session));
        // Do not call other supabase methods synchronously inside this callback (deadlock risk).
        const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') return;
            setTimeout(() => handleSession(session), 0);
        });

        return () => {
            cancelled = true;
            sub.subscription.unsubscribe();
            stopProfileWatch();
        };
    }, [setUser, setLoading]);
}

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useFirebaseAuth(setUser, setLoading);
    useSupabaseAuth(setUser, setLoading);

    return (
        <AuthContext.Provider value={{ user, loading }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);
