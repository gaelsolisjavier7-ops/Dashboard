import React from 'react';
import { LayoutDashboard, Wallet, List } from 'lucide-react';

type AppTab = 'dashboard' | 'transactions' | 'cashflow';

interface BottomNavProps {
  currentTab: AppTab;
  setCurrentTab: (tab: AppTab) => void;
}

const TABS: { id: AppTab; label: string; icon: React.ReactNode }[] = [
  { id: 'dashboard', label: 'Dash', icon: <LayoutDashboard className="w-5 h-5" /> },
  { id: 'cashflow', label: 'Flujo', icon: <Wallet className="w-5 h-5" /> },
  { id: 'transactions', label: 'Lista', icon: <List className="w-5 h-5" /> },
];

/**
 * Navegación inferior estilo app nativa (solo móvil, <640px).
 * En pantallas `sm` y superiores se usa el header de siempre y esta barra
 * desaparece por completo.
 */
export const BottomNav: React.FC<BottomNavProps> = ({ currentTab, setCurrentTab }) => {
  return (
    <nav
      aria-label="Navegación principal"
      className="sm:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-[#e0e0e0] flex justify-around pt-2 bottom-nav-safe select-none"
    >
      {TABS.map((tab) => {
        const activo = currentTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => setCurrentTab(tab.id)}
            aria-current={activo ? 'page' : undefined}
            className={`flex flex-col items-center justify-center space-y-0.5 px-5 py-1 rounded-[12px] transition-colors cursor-pointer ${
              activo ? 'text-[#0066cc]' : 'text-[#7a7a7a]'
            }`}
          >
            {tab.icon}
            <span className={`text-[10px] ${activo ? 'font-semibold' : 'font-medium'}`}>
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
};
