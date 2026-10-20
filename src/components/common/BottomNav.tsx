import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { tabsDisponibles } from '../../lib/roles';
import type { TabId } from '../../lib/roles';
import { LayoutDashboard, List } from 'lucide-react';

interface BottomNavProps {
  currentTab: TabId;
  setCurrentTab: (tab: TabId) => void;
}

/** Icono y etiqueta corta de cada pestaña. */
const TAB_CONFIG: Record<TabId, { label: string; icon: React.ReactNode }> = {
  dashboard: { label: 'Dash', icon: <LayoutDashboard className="w-5 h-5" /> },
  transactions: { label: 'Lista', icon: <List className="w-5 h-5" /> },
};

/**
 * Navegación inferior estilo app nativa (solo móvil, <640px).
 * Las pestañas visibles dependen del rol.
 * En pantallas `sm` y superiores desaparece por completo.
 */
export const BottomNav: React.FC<BottomNavProps> = ({ currentTab, setCurrentTab }) => {
  const { rol } = useAuth();
  const tabs = tabsDisponibles(rol);

  return (
    <nav
      aria-label="Navegación principal"
      className="sm:hidden fixed bottom-0 left-0 right-0 z-30 bg-[#09080a]/80 backdrop-blur-xl border-t border-white/10 flex justify-around pt-2 bottom-nav-safe select-none"
    >
      {tabs.map((tab) => {
        const activo = currentTab === tab;
        return (
          <button
            key={tab}
            type="button"
            onClick={() => setCurrentTab(tab)}
            aria-current={activo ? 'page' : undefined}
            className={`flex flex-col items-center justify-center space-y-0.5 px-5 py-1 rounded-[12px] border transition-colors cursor-pointer ${
              activo
                ? 'text-[var(--text)] bg-white/10 border-white/10'
                : 'text-[var(--text-secondary)] border-transparent'
            }`}
          >
            {TAB_CONFIG[tab].icon}
            <span className={`text-[10px] ${activo ? 'font-semibold' : 'font-medium'}`}>
              {TAB_CONFIG[tab].label}
            </span>
          </button>
        );
      })}
    </nav>
  );
};
