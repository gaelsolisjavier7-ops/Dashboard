import React, { createContext, useContext, useEffect, useState } from 'react';
import { GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { auth } from '../services/firebase';
import { useUsuario } from '../hooks/useUsuario';
import { isEmailAllowed } from '../lib/roles';
import type { Rol } from '../lib/roles';
import type { UsuarioPerfil } from '../types/finance';

const MENSAJE_ACCESO_DENEGADO = 'Acceso denegado. Este panel es privado.';

interface AuthContextType {
  user: User | null;
  usuarioPerfil: UsuarioPerfil | null;
  /** null ⇒ sin sesión, correo fuera de la whitelist o cuenta sin activar. */
  rol: Rol | null;
  loading: boolean;
  authError: string | null;
  /** Error de lectura de `usuarios/{email}` (reglas, red...). */
  perfilError: Error | null;
  clearAuthError: () => void;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // useUsuario escucha onAuthStateChanged y lee usuarios/{email}.
  // Su `loading` ya cubre toda la cadena (sesión + perfil).
  const { usuarioAuth, usuarioPerfil, rol, loading, error: errorPerfil } = useUsuario();

  const [authError, setAuthError] = useState<string | null>(null);

  // Guardia de whitelist: cualquier correo no autorizado cierra sesión al instante
  useEffect(() => {
    if (!usuarioAuth) return;
    if (isEmailAllowed(usuarioAuth.email)) return;

    console.warn('[permisos] Correo no autorizado, cerrando sesión:', usuarioAuth.email);
    setAuthError(MENSAJE_ACCESO_DENEGADO);
    signOut(auth).catch((err) => console.error('[permisos] signOut falló:', err));
  }, [usuarioAuth]);

  // Errores de lectura del perfil (p. ej. reglas de `usuarios`) hacia la UI
  useEffect(() => {
    if (errorPerfil) {
      setAuthError((prev) => prev ?? 'No se pudo verificar tu perfil. Revisa tu conexión.');
    }
  }, [errorPerfil]);

  const signInWithGoogle = async () => {
    setAuthError(null);
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const loggedUser = result.user;

      if (!isEmailAllowed(loggedUser.email)) {
        // Correo no autorizado → cerrar sesión inmediatamente
        console.warn('[permisos] Intento de acceso con correo no autorizado:', loggedUser.email);
        setAuthError(MENSAJE_ACCESO_DENEGADO);
        await signOut(auth);
        return;
      }
    } catch (err: unknown) {
      const error = err as { message?: string; code?: string };
      // Ignorar si el usuario cerró el popup
      if (error.code === 'auth/popup-closed-by-user') return;
      setAuthError(error.message || 'Error al iniciar sesión con Google.');
    }
  };

  const logout = async () => {
    await signOut(auth);
    setAuthError(null);
  };

  const clearAuthError = () => setAuthError(null);

  return (
    <AuthContext.Provider
      value={{
        user: usuarioAuth,
        usuarioPerfil,
        rol,
        loading,
        authError,
        perfilError: errorPerfil,
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
