import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
} from 'firebase/auth';
import type { User } from 'firebase/auth';
import { auth } from '../services/firebase';

// ── Solo este correo puede acceder ──
const ALLOWED_EMAIL = 'gaelsolisjavier7@gmail.com';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  authError: string | null;
  clearAuthError: () => void;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  // Escuchar cambios de sesión
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        // Si el usuario existente no es el correo permitido, cerramos sesión
        if (currentUser.email !== ALLOWED_EMAIL) {
          signOut(auth);
          setUser(null);
        } else {
          setUser(currentUser);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    setAuthError(null);
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const loggedUser = result.user;

      if (loggedUser.email !== ALLOWED_EMAIL) {
        // Correo no autorizado → cerrar sesión inmediatamente
        await signOut(auth);
        setUser(null);
        setAuthError('Acceso denegado. Solo el correo autorizado puede iniciar sesión.');
        return;
      }

      setUser(loggedUser);
    } catch (err: unknown) {
      const error = err as { message?: string; code?: string };
      // Ignorar si el usuario cerró el popup
      if (error.code === 'auth/popup-closed-by-user') return;
      setAuthError(error.message || 'Error al iniciar sesión con Google.');
    }
  };

  const logout = async () => {
    await signOut(auth);
    setUser(null);
  };

  const clearAuthError = () => setAuthError(null);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        authError,
        clearAuthError,
        signInWithGoogle,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};
