import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import { isEmailAllowed, normalizarEmail, rolDesdeDocumento } from '../lib/roles';
import type { Rol } from '../lib/roles';
import type { UsuarioPerfil } from '../types/finance';

/**
 * Sesión + perfil de permisos del usuario.
 *
 * 1. Escucha `onAuthStateChanged` para saber quién ha iniciado sesión.
 * 2. Con el correo, lee el documento `usuarios/{email}` (docId = email exacto
 *    normalizado a minúsculas) y resuelve el rol.
 *
 * Reglas de la app:
 * - correo fuera de la whitelist → `rol = null` y AuthContext cierra la sesión.
 * - correo en la whitelist pero sin documento en `usuarios` → `rol = null`
 *   (el gate muestra "Tu cuenta está pendiente de activación").
 * - documento sin un rol reconocible → también `rol = null` (falla cerrado).
 *
 * `loading` sólo es false cuando ya sabemos (a) si hay sesión y (b) —si la hay—
 * el contenido de su documento de permisos. Así el portero nunca muestra la
 * pantalla equivocada ni se queda colgado.
 */
export function useUsuario() {
  const [usuarioAuth, setUsuarioAuth] = useState<User | null>(null);
  const [authResuelto, setAuthResuelto] = useState(false);
  const [usuarioPerfil, setUsuarioPerfil] = useState<UsuarioPerfil | null>(null);
  const [perfilResuelto, setPerfilResuelto] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const email = normalizarEmail(usuarioAuth?.email);

  // 1) Sesión de Firebase Auth
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      (user) => {
        setUsuarioAuth(user);
        setAuthResuelto(true);
        // Con cada cambio de sesión el perfil debe volver a resolverse
        setPerfilResuelto(false);
      },
      (err) => {
        console.error('[permisos] onAuthStateChanged falló:', err);
        setError(err);
        setAuthResuelto(true);
        setPerfilResuelto(true);
      }
    );
    return () => unsubscribe();
  }, []);

  // 2) Perfil en `usuarios/{email}`
  useEffect(() => {
    // Todavía no sabemos si hay sesión: no se decide nada
    if (!authResuelto) return;

    // Sin sesión, o con un correo fuera de la whitelist: no hay perfil que leer
    if (!email || !isEmailAllowed(email)) {
      setUsuarioPerfil(null);
      setError(null);
      setPerfilResuelto(true);
      return;
    }

    setPerfilResuelto(false);
    const ref = doc(db, 'usuarios', email);

    const unsubscribe = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          setUsuarioPerfil(null);
          setError(null);
          setPerfilResuelto(true);
          return;
        }

        const datos = (snap.data() ?? {}) as Record<string, unknown>;
        const rol = rolDesdeDocumento(datos);

        if (!rol) {
          console.warn(
            `[permisos] El documento usuarios/${email} existe pero no tiene un rol reconocido. ` +
              'Se espera un campo rol/role con "super_admin" o "admin_hamburguesas".',
            datos
          );
        }

        setUsuarioPerfil({
          id: snap.id,
          email,
          nombre: (datos.nombre as string) ?? (datos.displayName as string) ?? null,
          rol,
          datos,
        });
        setError(null);
        setPerfilResuelto(true);
      },
      (err) => {
        console.error(`[permisos] No se pudo leer usuarios/${email}:`, err);
        setError(err);
        setUsuarioPerfil(null);
        setPerfilResuelto(true);
      }
    );

    return () => unsubscribe();
  }, [email, authResuelto]);

  const rol: Rol | null = usuarioPerfil?.rol ?? null;

  return {
    usuarioAuth,
    usuarioPerfil,
    rol,
    loading: !authResuelto || !perfilResuelto,
    error,
  };
}
