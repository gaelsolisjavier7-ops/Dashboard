import { initializeApp, getApps, getApp } from 'firebase/app';
import type { FirebaseApp } from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import type { User, Auth } from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
} from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import type { Transaction, FirebaseConfigState } from '../types/finance';

const STORAGE_KEY_FIREBASE_CONFIG = 'apple_finance_custom_firebase_config';

export function getStoredFirebaseConfig(): FirebaseConfigState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_FIREBASE_CONFIG);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Error reading custom firebase config from localStorage', e);
  }

  // Check Vite env variables
  const envApiKey = import.meta.env.VITE_FIREBASE_API_KEY;
  const envProjectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;

  if (envApiKey && envProjectId) {
    return {
      apiKey: envApiKey,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || `${envProjectId}.firebaseapp.com`,
      projectId: envProjectId,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || `${envProjectId}.appspot.com`,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
      appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
    };
  }

  return null;
}

export function saveStoredFirebaseConfig(config: FirebaseConfigState | null) {
  if (!config) {
    localStorage.removeItem(STORAGE_KEY_FIREBASE_CONFIG);
  } else {
    localStorage.setItem(STORAGE_KEY_FIREBASE_CONFIG, JSON.stringify(config));
  }
}

let firebaseApp: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let firestoreInstance: Firestore | null = null;

export function initFirebase() {
  const config = getStoredFirebaseConfig();
  if (!config || !config.apiKey || !config.projectId) {
    return { app: null, auth: null, db: null, isConfigured: false };
  }

  try {
    if (!getApps().length) {
      firebaseApp = initializeApp(config);
    } else {
      firebaseApp = getApp();
    }
    authInstance = getAuth(firebaseApp);
    firestoreInstance = getFirestore(firebaseApp);
    return {
      app: firebaseApp,
      auth: authInstance,
      db: firestoreInstance,
      isConfigured: true,
    };
  } catch (error) {
    console.error('Failed to initialize Firebase with provided config:', error);
    return { app: null, auth: null, db: null, isConfigured: false, error };
  }
}

// Initial setup
const { isConfigured } = initFirebase();
export const isFirebaseActive = isConfigured;

export const auth = authInstance;
export const db = firestoreInstance;

// Auth wrappers
export const authService = {
  isConfigured: () => Boolean(authInstance),
  onAuthStateChange: (callback: (user: User | null) => void) => {
    if (!authInstance) {
      callback(null);
      return () => {};
    }
    return onAuthStateChanged(authInstance, callback);
  },
  signInWithEmail: (email: string, pass: string) => {
    if (!authInstance) throw new Error('Firebase no está configurado');
    return signInWithEmailAndPassword(authInstance, email, pass);
  },
  signUpWithEmail: (email: string, pass: string) => {
    if (!authInstance) throw new Error('Firebase no está configurado');
    return createUserWithEmailAndPassword(authInstance, email, pass);
  },
  signInWithGoogle: () => {
    if (!authInstance) throw new Error('Firebase no está configurado');
    const provider = new GoogleAuthProvider();
    return signInWithPopup(authInstance, provider);
  },
  logout: () => {
    if (!authInstance) return Promise.resolve();
    return signOut(authInstance);
  },
};

// Firestore transaction syncing
export const firestoreService = {
  subscribeTransactions: (
    userId: string,
    callback: (transactions: Transaction[]) => void,
    onError?: (err: Error) => void
  ) => {
    if (!firestoreInstance) return () => {};

    const colRef = collection(firestoreInstance, `users/${userId}/transactions`);
    const q = query(colRef, orderBy('date', 'desc'));

    return onSnapshot(
      q,
      (snapshot) => {
        const items: Transaction[] = [];
        snapshot.forEach((docSnapshot) => {
          items.push({ ...(docSnapshot.data() as Transaction), id: docSnapshot.id });
        });
        callback(items);
      },
      (err) => {
        console.error('Error listening to transactions:', err);
        if (onError) onError(err);
      }
    );
  },

  saveTransaction: async (userId: string, tx: Transaction) => {
    if (!firestoreInstance) return;
    const docRef = doc(firestoreInstance, `users/${userId}/transactions`, tx.id);
    await setDoc(docRef, tx, { merge: true });
  },

  deleteTransaction: async (userId: string, txId: string) => {
    if (!firestoreInstance) return;
    const docRef = doc(firestoreInstance, `users/${userId}/transactions`, txId);
    await deleteDoc(docRef);
  },
};
