import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { connectFunctionsEmulator, getFunctions } from 'firebase/functions';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';

const appCheckDebugToken = import.meta.env.VITE_FIREBASE_APPCHECK_DEBUG_TOKEN;
if (import.meta.env.DEV && appCheckDebugToken) {
    globalThis.FIREBASE_APPCHECK_DEBUG_TOKEN = appCheckDebugToken === 'true' ? true : appCheckDebugToken;
}

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
    appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || '',
};

const requiredKeys = ['apiKey', 'authDomain', 'projectId', 'appId'];
const missingKeys = requiredKeys.filter((k) => !firebaseConfig[k]);
export const firebaseConfigValid = missingKeys.length === 0;

if (!firebaseConfigValid) {
    console.warn('Firebase configuration is incomplete. Missing keys:', missingKeys);
    console.warn('Make sure to set the VITE_FIREBASE_* env vars in a local .env file.');
}

const app = initializeApp(firebaseConfig);
const appCheckSiteKey = import.meta.env.VITE_FIREBASE_APPCHECK_SITE_KEY || '';
const appCheckEnabled = import.meta.env.VITE_FIREBASE_APPCHECK_ENABLED === 'true'
    || (import.meta.env.PROD && Boolean(appCheckSiteKey));
const canInitializeAppCheck = appCheckEnabled
    && appCheckSiteKey
    && typeof window !== 'undefined'
    && typeof document !== 'undefined';
export const appCheck = canInitializeAppCheck
    ? initializeAppCheck(app, {
        provider: new ReCaptchaEnterpriseProvider(appCheckSiteKey),
        isTokenAutoRefreshEnabled: true,
    })
    : null;

if (appCheckEnabled && !appCheckSiteKey) {
    console.warn(
        '[firebase] App Check is not configured. Set VITE_FIREBASE_APPCHECK_SITE_KEY before using Firebase AI Logic.'
    );
}

const functions = getFunctions(app);
if (import.meta.env.DEV && import.meta.env.VITE_USE_FUNCTIONS_EMULATOR === 'true') {
    connectFunctionsEmulator(functions, 'localhost', 5001);
    console.info('[firebase] Using local Functions emulator at localhost:5001');
}

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export { firebaseConfig, functions };
export default app;