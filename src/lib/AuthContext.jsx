import { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '../api/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { setActiveCompanyId } from './currentTenant';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let unsubscribeUserDoc = null;

        // مراقب حالة المستخدم (هل هو مسجل دخول أم لا)
        const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
            // إلغاء الاشتراك في مستند المستخدم القديم (لو موجود) قبل ما نبدأ واحد جديد
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

            // جلب مستند المستخدم من Firestore (فيه role وباقي البيانات الإضافية)
            // ومتابعته بشكل حي عشان أي تغيير في الصلاحية ينعكس فورًا
            const userDocRef = doc(db, 'users', currentUser.uid);
            unsubscribeUserDoc = onSnapshot(userDocRef, (snap) => {
                const userData = snap.exists() ? snap.data() : {};
                const mergedUser = {
                    ...currentUser,
                    ...userData,
                };
                setUser(mergedUser);
                if (userData.company_id) {
                    setActiveCompanyId(userData.company_id);
                } else {
                    // Prevent a stale company stored in localStorage from being
                    // reused by a different or unprovisioned signed-in account.
                    setActiveCompanyId('');
                }
                setLoading(false);
            }, () => {
                // لو حصل خطأ في جلب المستند، على الأقل نكمل ببيانات تسجيل الدخول الأساسية
                setUser(currentUser);
                setLoading(false);
            });
        });

        return () => {
            unsubscribeAuth();
            if (unsubscribeUserDoc) unsubscribeUserDoc();
        };
    }, []);

    return (
        <AuthContext.Provider value={{ user, loading }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);
