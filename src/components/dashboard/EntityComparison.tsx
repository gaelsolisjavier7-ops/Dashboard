import React from 'react';
import { useFinance } from '../../context/FinanceContext';
import type { EntityType } from '../../types/finance';
import { BurgerVisual, AirPodsVisual, AppleCardVisual } from '../common/ProductVisuals';
import { ArrowRight, Utensils, Headphones, User } from 'lucide-react';

export const EntityComparison: React.FC = () => {
  const { metrics, setSelectedEntity } = useFinance();

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      maximumFractionDigits: 0,
    }).format(val || 0);
  };

  const entitiesData: {
    key: EntityType;
    name: string;
    subtitle: string;
    icon: React.ReactNode;
    visual: React.ReactNode;
    stats: { income: number; expenses: number; freeCash: number; margin: number };
  }[] = [
    {
      key: 'hamburguesas',
      name: 'Smash Burgers',
      subtitle: 'Comida & Delivery',
      icon: <Utensils className="w-4 h-4 text-[#ff9500]" />,
      visual: <BurgerVisual className="w-32 h-32" />,
      stats: metrics.entityBreakdown.hamburguesas,
    },
    {
      key: 'airpods',
      name: 'Reventa AirPods',
      subtitle: 'Tecnología & E-commerce',
      icon: <Headphones className="w-4 h-4 text-[#0066cc]" />,
      visual: <AirPodsVisual className="w-32 h-32" />,
      stats: metrics.entityBreakdown.airpods,
    },
    {
      key: 'personal',
      name: 'Finanzas Personales',
      subtitle: 'Gastos de vida & Ahorro',
      icon: <User className="w-4 h-4 text-[#34c759]" />,
      visual: <AppleCardVisual className="w-40 h-28" />,
      stats: metrics.entityBreakdown.personal,
    },
  ];

  return (
    <div className="w-full py-8 px-4 sm:py-12 sm:px-12 bg-[#ffffff]">
      <div className="max-w-[1200px] mx-auto">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-6 sm:mb-8">
          <div>
            <span className="text-[13px] font-semibold text-[#0066cc] uppercase tracking-wider">
              Ecosistema Financiero
            </span>
            <h2 className="text-[24px] sm:text-[34px] font-semibold text-[#1d1d1f] tracking-[-0.374px] mt-1">
              Rendimiento por Unidad de Negocio
            </h2>
          </div>
          <p className="text-[15px] text-[#7a7a7a] max-w-[420px] mt-2 md:mt-0">
            Compara cuánto dinero libre genera cada negocio en tiempo real desde Firestore.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
          {entitiesData.map((item) => {
            const hasActivity = item.stats.income > 0 || item.stats.expenses > 0;
            const isProfitable = item.stats.freeCash > 0;

            return (
              <div
                key={item.key}
                className="apple-card bg-[#ffffff] border border-[#e0e0e0] flex flex-col justify-between hover:border-[#b0b0b5] transition-all group"
              >
                <div>
                  {/* Visual Header */}
                  <div className="h-[140px] bg-[#f5f5f7] rounded-[12px] flex items-center justify-center p-4 relative overflow-hidden">
                    {item.visual}
                  </div>

                  {/* Title & Badge */}
                  <div className="flex items-center justify-between mt-5">
                    <div>
                      <div className="flex items-center space-x-1.5">
                        {item.icon}
                        <h4 className="text-[19px] font-semibold text-[#1d1d1f] tracking-tight">
                          {item.name}
                        </h4>
                      </div>
                      <span className="text-[13px] text-[#7a7a7a]">{item.subtitle}</span>
                    </div>

                    <span
                      className={`text-[12px] font-semibold px-2.5 py-1 rounded-full ${
                        !hasActivity
                          ? 'bg-[#f5f5f7] text-[#7a7a7a]'
                          : isProfitable
                          ? 'bg-[#34c759]/10 text-[#34c759]'
                          : 'bg-[#ff3b30]/10 text-[#ff3b30]'
                      }`}
                    >
                      {!hasActivity ? '$0 saldo' : `${item.stats.margin}% libre`}
                    </span>
                  </div>

                  {/* Breakdown Numbers */}
                  <div className="mt-5 space-y-2 border-t border-[#f0f0f0] pt-4">
                    <div className="flex justify-between text-[14px]">
                      <span className="text-[#7a7a7a]">Ingresos brutos</span>
                      <span className="font-semibold text-[#1d1d1f]">
                        {formatCurrency(item.stats.income)}
                      </span>
                    </div>
                    <div className="flex justify-between text-[14px]">
                      <span className="text-[#7a7a7a]">Gastos operativos</span>
                      <span className="font-semibold text-[#ff3b30]">
                        -{formatCurrency(item.stats.expenses)}
                      </span>
                    </div>
                    <div className="flex justify-between text-[16px] pt-2 border-t border-dashed border-[#e0e0e0]">
                      <span className="font-semibold text-[#1d1d1f]">
                        {item.key === 'personal' ? 'Superávit Neto' : 'Efectivo Libre'}
                      </span>
                      <span
                        className={`font-semibold ${
                          !hasActivity
                            ? 'text-[#1d1d1f]'
                            : isProfitable
                            ? 'text-[#0066cc]'
                            : 'text-[#ff3b30]'
                        }`}
                      >
                        {formatCurrency(item.stats.freeCash)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Action Link */}
                <button
                  onClick={() => setSelectedEntity(item.key)}
                  className="mt-6 w-full flex items-center justify-center space-x-2 py-2.5 px-4 rounded-full bg-[#f5f5f7] hover:bg-[#1d1d1f] text-[#1d1d1f] hover:text-white transition-all text-[14px] font-medium apple-pressable cursor-pointer"
                >
                  <span>Filtrar {item.name}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
