import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { AlertCircle, Hourglass, Loader2, LogIn, LogOut, ShieldCheck } from 'lucide-react';

/**
 * Pantallas de acceso (punto 9 del sistema de permisos):
 *  - PantallaCargando  : validando sesión y perfil
 *  - PantallaLogin     : no autenticado → botón de Google centrado
 *  - PantallaPendiente : autenticado y en whitelist, pero sin rol en `usuarios`
 */

/** Toast rojo flotante para "Acceso denegado" y demás avisos de permisos. */
export const ToastAcceso: React.FC<{ mensaje: string }> = ({ mensaje }) => (
  <div className="fixed top-6 left-4 right-4 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 z-[60] flex items-center justify-center space-x-2.5 px-4 py-3 rounded-[14px] shadow-2xl text-[14px] bg-[#1d1d1f] text-white border border-[#ff3b30]/60">
    <AlertCircle className="w-4 h-4 text-[#ff3b30] flex-shrink-0" />
    <span className="font-medium text-[13px]">{mensaje}</span>
  </div>
);

export const PantallaCargando: React.FC = () => (
  <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#f5f5f7] px-6">
    <img
      src="/entre3-logo.png"
      alt="ENTRE 3"
      className="w-16 h-16 rounded-full object-cover mb-5"
    />
    <Loader2 className="w-6 h-6 text-[#0066cc] animate-spin" />
    <p className="text-[15px] text-[#7a7a7a] mt-3">Verificando permisos...</p>
  </div>
);

export const PantallaLogin: React.FC = () => {
  const { signInWithGoogle, authError } = useAuth();

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#f5f5f7] px-4 py-10">
      {authError && <ToastAcceso mensaje={authError} />}

      <div className="w-full max-w-[420px] bg-white rounded-[24px] border border-[#e0e0e0] p-7 sm:p-9 text-center">
        <img
          src="/entre3-logo.png"
          alt="ENTRE 3"
          className="w-20 h-20 rounded-full object-cover mx-auto"
        />
        <h1 className="text-[26px] sm:text-[28px] font-semibold text-[#1d1d1f] tracking-tight mt-4">
          ENTRE 3
        </h1>
        <p className="text-[15px] text-[#7a7a7a] mt-1">
          Panel financiero privado. Inicia sesión con tu cuenta autorizada.
        </p>

        <button
          type="button"
          onClick={() => signInWithGoogle()}
          className="apple-btn-primary w-full mt-7 py-3 text-[16px] cursor-pointer"
        >
          <LogIn className="w-4 h-4" />
          <span>Continuar con Google</span>
        </button>

        <div className="flex items-start space-x-2 mt-6 text-left rounded-[12px] bg-[#f5f5f7] p-3.5">
          <ShieldCheck className="w-4 h-4 text-[#7a7a7a] flex-shrink-0 mt-0.5" />
          <p className="text-[12px] text-[#7a7a7a]">
            Solo dos cuentas tienen acceso. Si entras con un correo distinto, la sesión se cierra
            automáticamente.
          </p>
        </div>
      </div>
    </div>
  );
};

export const PantallaPendiente: React.FC = () => {
  const { logout, user, perfilError } = useAuth();

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#f5f5f7] px-4 py-10">
      <div className="w-full max-w-[460px] bg-white rounded-[24px] border border-[#e0e0e0] p-7 sm:p-9 text-center">
        <div className="w-14 h-14 rounded-full bg-[#ff9500]/10 flex items-center justify-center mx-auto">
          <Hourglass className="w-7 h-7 text-[#ff9500]" />
        </div>
        <h1 className="text-[24px] font-semibold text-[#1d1d1f] tracking-tight mt-4">
          Tu cuenta está pendiente de activación
        </h1>
        <p className="text-[15px] text-[#7a7a7a] mt-2">
          Contacta al administrador para que habilite tu acceso a{' '}
          <span className="font-medium text-[#1d1d1f]">{user?.email}</span>.
        </p>

        {perfilError && (
          <div className="flex items-start space-x-2 mt-5 text-left rounded-[12px] bg-[#ff3b30]/5 border border-[#ff3b30]/20 p-3.5">
            <AlertCircle className="w-4 h-4 text-[#ff3b30] flex-shrink-0 mt-0.5" />
            <p className="text-[12px] text-[#ff3b30]">
              No se pudo leer tu perfil en Firestore ({perfilError.message}). Revisa las reglas de
              la colección `usuarios`.
            </p>
          </div>
        )}

        <button
          type="button"
          onClick={() => logout()}
          className="apple-btn-secondary w-full mt-7 py-3 text-[15px] cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>Cerrar sesión</span>
        </button>
      </div>
    </div>
  );
};

export const PantallaSinAcceso: React.FC<{ detalle?: string }> = ({ detalle }) => (
  <div className="w-full py-16 px-4 sm:px-12 bg-white">
    <div className="max-w-[560px] mx-auto apple-card bg-white text-center">
      <div className="w-14 h-14 rounded-full bg-[#ff3b30]/10 flex items-center justify-center mx-auto">
        <AlertCircle className="w-7 h-7 text-[#ff3b30]" />
      </div>
      <h2 className="text-[21px] font-semibold text-[#1d1d1f] mt-4">
        No tienes acceso a esta sección
      </h2>
      <p className="text-[14px] text-[#7a7a7a] mt-2">
        {detalle ?? 'Tu rol no permite ver esta parte del panel. Pide acceso al administrador.'}
      </p>
    </div>
  </div>
);
