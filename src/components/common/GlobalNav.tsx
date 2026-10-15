import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { ROL_LABEL, TAB_LABEL, tabsDisponibles } from '../../lib/roles';
import type { TabId } from '../../lib/roles';
import { LogIn, LogOut, CheckCircle2, AlertCircle, X, ChevronDown } from 'lucide-react';

interface GlobalNavProps {
  onOpenAuth: () => void;
  onOpenFirebaseConfig: () => void;
  currentTab: TabId;
  setCurrentTab: (tab: TabId) => void;
}

export const GlobalNav: React.FC<GlobalNavProps> = ({
  currentTab,
  setCurrentTab,
}) => {
  const { user, rol, logout, signInWithGoogle, authError, clearAuthError } = useAuth();

  const tabsVisibles = tabsDisponibles(rol);

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Mostrar toast de error de auth ("Acceso denegado")
  useEffect(() => {
    if (authError) {
      setToast({ message: authError, type: 'error' });
      clearAuthError();
      const timer = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [authError, clearAuthError]);

  // Cerrar menú de usuario al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSignIn = async () => {
    await signInWithGoogle();
  };

  const handleLogout = async () => {
    setShowUserMenu(false);
    await logout();
    setToast({ message: 'Sesión cerrada correctamente.', type: 'success' });
    setTimeout(() => setToast(null), 3000);
  };

  return (
    <header className="apple-frosted sticky top-0 z-50 w-full text-[var(--text)] select-none">
      <div className="mx-auto flex h-[44px] max-w-[1440px] items-center justify-between px-4 sm:px-8 text-[12px] font-normal tracking-[-0.12px]">
        {/* Left: ENTRE 3 logo & Brand */}
        <div className="flex items-center space-x-4 sm:space-x-6">
          <div
            onClick={() => setCurrentTab('dashboard')}
            className="flex items-center space-x-2 sm:space-x-2.5 cursor-pointer opacity-95 hover:opacity-100 transition-opacity"
          >
            <img
              src="/entre3-logo.png"
              alt="ENTRE 3"
              className="w-7 h-7 sm:w-9 sm:h-9 rounded-full object-cover flex-shrink-0"
            />
            <span className="flex items-baseline space-x-1.5">
              <span className="font-semibold tracking-tight text-[14px] sm:text-[15px] text-[var(--text)]">
                ENTRE 3
              </span>
              <span className="hidden sm:inline text-[12px] text-[var(--text-secondary)] font-normal">
                Finance
              </span>
            </span>
          </div>

          {/* Navigation Links (filtradas por rol) */}
          {/* En lg+ la navegación vive en el Sidebar, así que este menú se oculta */}
          <nav className="hidden md:flex lg:hidden items-center space-x-6 text-[14px] text-[var(--text-secondary)]">
            {tabsVisibles.map((tab) => (
              <button
                key={tab}
                onClick={() => setCurrentTab(tab)}
                className={`transition-colors hover:text-[var(--text)] cursor-pointer ${
                  currentTab === tab ? 'text-[var(--accent)] font-semibold' : ''
                }`}
              >
                {TAB_LABEL[tab]}
              </button>
            ))}
          </nav>
        </div>

        {/* Right actions: Auth (único indicador de estado del header) */}
        <div className="flex items-center space-x-3 text-[12px]">
          {/* Auth Button: User Photo + Menu  or  "Iniciar Sesión" */}
          {user ? (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setShowUserMenu((prev) => !prev)}
                className="flex items-center space-x-1.5 px-2 py-1 rounded-[8px] hover:bg-[var(--surface)] transition-colors cursor-pointer"
              >
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt="avatar"
                    className="w-6 h-6 rounded-full border border-[#444]"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-[var(--accent)] flex items-center justify-center text-[11px] font-bold text-[var(--accent-ink)]">
                    {(user.displayName || user.email || '?')[0].toUpperCase()}
                  </div>
                )}
                <ChevronDown className="w-3 h-3 text-[var(--text-secondary)]" />
              </button>

              {/* Dropdown Menu */}
              {showUserMenu && (
                <div className="absolute right-0 top-10 w-56 bg-[var(--surface)] border border-[var(--border)] rounded-[14px] p-2 animate-fade-in z-50">
                  {/* User info */}
                  <div className="px-3 py-2 border-b border-[var(--border-soft)]">
                    <p className="text-[13px] font-semibold text-[var(--text)] truncate">
                      {user.displayName || 'Usuario'}
                    </p>
                    <p className="text-[11px] text-[var(--text-secondary)] truncate">
                      {user.email}
                    </p>
                    {rol && (
                      <p className="text-[11px] text-[var(--accent)] font-medium mt-1">
                        {ROL_LABEL[rol]}
                      </p>
                    )}
                  </div>
                  {/* Cerrar Sesión */}
                  <button
                    onClick={handleLogout}
                    className="w-full mt-1 flex items-center space-x-2 px-3 py-2 rounded-[8px] text-[13px] text-[var(--negative)] hover:bg-[var(--surface-elevated)] transition-colors cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Cerrar Sesión</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={handleSignIn}
              className="flex items-center space-x-1 px-2.5 py-1.5 rounded-[8px] text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-[var(--surface)] transition-all cursor-pointer"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Iniciar Sesión</span>
            </button>
          )}
        </div>
      </div>

      {/* Floating Apple-Style Toast */}
      {toast && (
        <div
          className={`fixed top-14 left-4 right-4 sm:left-auto sm:right-6 z-50 flex items-center space-x-2.5 px-4 py-3 rounded-[14px] shadow-2xl text-[14px] transition-all animate-fade-in ${
            toast.type === 'success'
              ? 'bg-[var(--surface)] text-[var(--text)] border border-[color-mix(in_srgb,var(--positive)_60%,transparent)] shadow-[0_10px_30px_color-mix(in_srgb,var(--positive)_20%,transparent)]'
              : 'bg-[var(--surface)] text-[var(--text)] border border-[color-mix(in_srgb,var(--negative)_60%,transparent)] shadow-[0_10px_30px_color-mix(in_srgb,var(--negative)_20%,transparent)]'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-[var(--positive)] flex-shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-[var(--negative)] flex-shrink-0" />
          )}
          <span className="font-medium text-[13px]">{toast.message}</span>
          <button
            onClick={() => setToast(null)}
            className="ml-2 text-[var(--text-secondary)] hover:text-[var(--text)] cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </header>
  );
};
