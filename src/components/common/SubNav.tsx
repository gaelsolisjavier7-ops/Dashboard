import React from 'react';
import type { EntityType } from '../../types/finance';
import { useFinance } from '../../context/FinanceContext';
import { Plus, User, Utensils, Headphones, Layers } from 'lucide-react';

interface SubNavProps {
  onOpenNewTransaction: () => void;
  currentTab: 'dashboard' | 'transactions' | 'cashflow';
  setCurrentTab: (tab: 'dashboard' | 'transactions' | 'cashflow') => void;
}

export const SubNav: React.FC<SubNavProps> = ({
  onOpenNewTransaction,
  currentTab,
  setCurrentTab,
}) => {
  const { selectedEntity, setSelectedEntity, dateFilter, setDateFilter } = useFinance();

  const getSectionTitle = () => {
    switch (currentTab) {
      case 'dashboard':
        return 'Resumen Financiero';
      case 'cashflow':
        return 'Flujo de Caja Libre';
      case 'transactions':
        return 'Libro de Movimientos';
      default:
        return 'Finanzas';
    }
  };

  const entities: { id: EntityType | 'all'; label: string; icon: React.ReactNode }[] = [
    { id: 'all', label: 'Consolidado', icon: <Layers className="w-3.5 h-3.5" /> },
    { id: 'personal', label: 'Personal', icon: <User className="w-3.5 h-3.5" /> },
    { id: 'hamburguesas', label: 'Hamburguesas', icon: <Utensils className="w-3.5 h-3.5" /> },
    { id: 'airpods', label: 'AirPods', icon: <Headphones className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="sticky top-[44px] z-40 w-full apple-frosted border-b border-[rgba(0,0,0,0.08)] select-none">
      <div className="mx-auto flex h-[52px] max-w-[1440px] items-center justify-between px-4 sm:px-8">
        {/* Left: Section Title */}
        <div className="flex items-center space-x-6">
          <h2 className="text-[19px] sm:text-[21px] font-semibold text-[#1d1d1f] tracking-[-0.28px] whitespace-nowrap">
            {getSectionTitle()}
          </h2>

          {/* Quick tab switch on small screens */}
          <div className="flex md:hidden items-center space-x-1 text-[13px]">
            <button
              onClick={() => setCurrentTab('dashboard')}
              className={`px-2 py-1 rounded-full ${currentTab === 'dashboard' ? 'bg-[#1d1d1f] text-white font-semibold' : 'text-[#7a7a7a]'}`}
            >
              Dash
            </button>
            <button
              onClick={() => setCurrentTab('cashflow')}
              className={`px-2 py-1 rounded-full ${currentTab === 'cashflow' ? 'bg-[#1d1d1f] text-white font-semibold' : 'text-[#7a7a7a]'}`}
            >
              Flujo
            </button>
            <button
              onClick={() => setCurrentTab('transactions')}
              className={`px-2 py-1 rounded-full ${currentTab === 'transactions' ? 'bg-[#1d1d1f] text-white font-semibold' : 'text-[#7a7a7a]'}`}
            >
              Lista
            </button>
          </div>
        </div>

        {/* Center: Entity Selector Pills */}
        <div className="hidden lg:flex items-center bg-[#ffffff] p-1 rounded-full border border-[#e0e0e0]">
          {entities.map((item) => {
            const isSelected = selectedEntity === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setSelectedEntity(item.id)}
                className={`flex items-center space-x-1.5 px-3.5 py-1 text-[13px] rounded-full transition-all apple-pressable ${
                  isSelected
                    ? 'bg-[#1d1d1f] text-white font-semibold'
                    : 'text-[#1d1d1f] hover:bg-[#f5f5f7]'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Right: Date filter + Primary Action Pill */}
        <div className="flex items-center space-x-3">
          {/* Period selector */}
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value as 'month' | 'quarter' | 'all')}
            className="text-[13px] bg-[#ffffff] border border-[#e0e0e0] text-[#1d1d1f] rounded-full px-3 py-1.5 outline-none focus:border-[#0071e3] transition-colors cursor-pointer"
          >
            <option value="month">Este Mes</option>
            <option value="quarter">Trimestre</option>
            <option value="all">Todo el tiempo</option>
          </select>

          {/* Primary Action Button (Signature Apple Action Blue pill) */}
          <button
            onClick={onOpenNewTransaction}
            className="apple-btn-primary text-[14px] py-1.5 px-4 h-[34px] font-normal"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Nuevo Registro</span>
          </button>
        </div>
      </div>

      {/* Mobile/Tablet Sub-row for Entity Selector */}
      <div className="lg:hidden flex items-center justify-start overflow-x-auto space-x-2 px-4 py-2 bg-[#f5f5f7] border-t border-[rgba(0,0,0,0.04)] no-scrollbar">
        {entities.map((item) => {
          const isSelected = selectedEntity === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setSelectedEntity(item.id)}
              className={`flex items-center space-x-1.5 px-3 py-1 text-[12px] whitespace-nowrap rounded-full transition-all apple-pressable ${
                isSelected
                  ? 'bg-[#1d1d1f] text-white font-semibold'
                  : 'bg-[#ffffff] text-[#1d1d1f] border border-[#e0e0e0]'
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
