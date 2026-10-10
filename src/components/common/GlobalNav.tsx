import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { LogIn, LogOut, CheckCircle2, AlertCircle, X, ChevronDown } from 'lucide-react';

interface GlobalNavProps {
  onOpenAuth: () => void;
  onOpenFirebaseConfig: () => void;
  currentTab: 'dashboard' | 'transactions' | 'cashflow';
  setCurrentTab: (tab: 'dashboard' | 'transactions' | 'cashflow') => void;
}

export const GlobalNav: React.FC<GlobalNavProps> = ({
  currentTab,
  setCurrentTab,
}) => {
  const { user, logout, signInWithGoogle, authError, clearAuthError } = useAuth();

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
    <header className="sticky top-0 z-50 w-full bg-[#000000] text-white select-none">
      <div className="mx-auto flex h-[44px] max-w-[1440px] items-center justify-between px-4 sm:px-8 text-[12px] font-normal tracking-[-0.12px]">
        {/* Left: Apple Logo & Brand */}
        <div className="flex items-center space-x-6">
          <div
            onClick={() => setCurrentTab('dashboard')}
            className="flex items-center space-x-2 cursor-pointer opacity-90 hover:opacity-100 transition-opacity"
          >
            <span className="text-[17px] leading-none"></span>
            <span className="font-semibold tracking-tight text-[13px] text-white">Finance</span>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center space-x-6 text-[#cccccc]">
            <button
              onClick={() => setCurrentTab('dashboard')}
              className={`transition-colors hover:text-white cursor-pointer ${
                currentTab === 'dashboard' ? 'text-white font-semibold' : ''
              }`}
            >
              Dashboard
            </button>
            <button
              onClick={() => setCurrentTab('cashflow')}
              className={`transition-colors hover:text-white cursor-pointer ${
                currentTab === 'cashflow' ? 'text-white font-semibold' : ''
              }`}
            >
              Flujo de Caja
            </button>
            <button
              onClick={() => setCurrentTab('transactions')}
              className={`transition-colors hover:text-white cursor-pointer ${
                currentTab === 'transactions' ? 'text-white font-semibold' : ''
              }`}
            >
              Transacciones
            </button>
          </nav>
        </div>

        {/* Right actions: Auth (único indicador de estado del header) */}
        <div className="flex items-center space-x-3 text-[12px]">
          {/* Auth Button: User Photo + Menu  or  "Iniciar Sesión" */}
          {user ? (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setShowUserMenu((prev) => !prev)}
                className="flex items-center space-x-1.5 px-2 py-1 rounded-[8px] hover:bg-[#272729] transition-colors cursor-pointer"
              >
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt="avatar"
                    className="w-6 h-6 rounded-full border border-[#444]"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-[#2997ff] flex items-center justify-center text-[11px] font-bold text-white">
                    {(user.displayName || user.email || '?')[0].toUpperCase()}
                  </div>
                )}
                <ChevronDown className="w-3 h-3 text-[#cccccc]" />
              </button>

              {/* Dropdown Menu */}
              {showUserMenu && (
                <div className="absolute right-0 top-10 w-56 bg-[#1d1d1f] border border-[#333] rounded-[14px] shadow-2xl p-2 animate-fade-in z-50">
                  {/* User info */}
                  <div className="px-3 py-2 border-b border-[#333]">
                    <p className="text-[13px] font-semibold text-white truncate">
                      {user.displayName || 'Usuario'}
                    </p>
                    <p className="text-[11px] text-[#7a7a7a] truncate">
                      {user.email}
                    </p>
                  </div>
                  {/* Cerrar Sesión */}
                  <button
                    onClick={handleLogout}
                    className="w-full mt-1 flex items-center space-x-2 px-3 py-2 rounded-[8px] text-[13px] text-[#ff453a] hover:bg-[#2a2a2c] transition-colors cursor-pointer"
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
              className="hidden sm:flex items-center space-x-1 px-2.5 py-1.5 rounded-[8px] text-[#cccccc] hover:text-white hover:bg-[#272729] transition-all cursor-pointer"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Iniciar Sesión</span>
            </button>
          )}
        </div>
      </div>

      {/* Floating Apple-Style Toast */}
      {toast && (
        <div
          className={`fixed top-14 right-6 z-50 flex items-center space-x-2.5 px-4 py-3 rounded-[14px] shadow-2xl text-[14px] transition-all animate-fade-in ${
            toast.type === 'success'
              ? 'bg-[#1d1d1f] text-white border border-[#34c759]/60 shadow-[0_10px_30px_rgba(52,199,89,0.2)]'
              : 'bg-[#1d1d1f] text-white border border-[#ff3b30]/60 shadow-[0_10px_30px_rgba(255,59,48,0.2)]'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-[#34c759] flex-shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-[#ff3b30] flex-shrink-0" />
          )}
          <span className="font-medium text-[13px]">{toast.message}</span>
          <button
            onClick={() => setToast(null)}
            className="ml-2 text-[#7a7a7a] hover:text-white cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </header>
  );
};
