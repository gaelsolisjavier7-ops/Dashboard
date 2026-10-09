// src/services/firebase.ts
import { initializeApp, getApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyCYmj4iaPU-Ku6edzajvJXJtnX0qSSqTO4",
  authDomain: "entre3-finanzas.firebaseapp.com",
  projectId: "entre3-finanzas",
  storageBucket: "entre3-finanzas.firebasestorage.app",
  messagingSenderId: "352611680426",
  appId: "1:352611680426:web:1c3e851d14f2d542da10d3",
  measurementId: "G-YGKY8DHETD"
};

// Inicialización singleton (evita duplicados en hot reload)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);
const auth = getAuth(app);

export { db, auth };