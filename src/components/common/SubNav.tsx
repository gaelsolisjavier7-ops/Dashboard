import React from 'react';
import type { DateFilter, SeccionId, TabId } from '../../types/finance';
import { DATE_FILTER_OPTIONS } from '../../lib/fechas';
import { useFinance } from '../../context/FinanceContext';
import { useAuth } from '../../context/AuthContext';
import { SECCION_LABEL, seccionesDisponibles, tabsDisponibles } from '../../lib/roles';
import {
  Boxes,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Plus,
  User,
  Utensils,
  Headphones,
  Layers,
} from 'lucide-react';

interface SubNavProps {
  onOpenNewTransaction: () => void;
  currentTab: TabId;
  setCurrentTab: (tab: TabId) => void;
}

/** Etiquetas cortas para el conmutador de pestañas de tablet. */
const TAB_CORTO: Record<TabId, string> = {
  dashboard: 'Dash',
  cashflow: 'Flujo',
  transactions: 'Lista',
};

/** Icono de cada sección (las visibles dependen del rol). */
const ICONO_SECCION: Record<SeccionId, React.ReactNode> = {
  all: <Layers className="w-3.5 h-3.5" />,
  personal: <User className="w-3.5 h-3.5" />,
  hamburguesas: <Utensils className="w-3.5 h-3.5" />,
  airpods: <Headphones className="w-3.5 h-3.5" />,
  insumos: <Boxes className="w-3.5 h-3.5" />,
  recetas: <ClipboardList className="w-3.5 h-3.5" />,
};

export const SubNav: React.FC<SubNavProps> = ({
  onOpenNewTransaction,
  currentTab,
  setCurrentTab,
}) => {
  const {
    selectedEntity,
    setSelectedEntity,
    dateRange,
    labelPeriodo,
    setFilter,
    prevPeriod,
    nextPeriod,
    irAHoy,
  } = useFinance();
  const { rol } = useAuth();

  const getSectionTitle = () => {
    switch (currentTab) {
      case 'dashboard':
        return selectedEntity === 'airpods' ? 'Inventario AirPods' : 'Resumen Financiero';
      case 'cashflow':
        return 'Flujo de Caja Libre';
      case 'transactions':
        return 'Libro de Movimientos';
      default:
        return 'Finanzas';
    }
  };

  // Pills según rol: el socio sólo ve Hamburguesas, Insumos y Recetas
  const entities: { id: SeccionId; label: string; icon: React.ReactNode }[] =
    seccionesDisponibles(rol).map((id) => ({
      id,
      label: SECCION_LABEL[id],
      icon: ICONO_SECCION[id],
    }));

  return (
    <div className="sticky top-[44px] z-40 w-full apple-frosted border-b border-[rgba(0,0,0,0.08)] select-none">
      <div className="mx-auto flex h-auto sm:min-h-[52px] max-w-[1440px] flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 sm:px-8 py-2 sm:py-1.5">
        {/* Left: Section Title */}
        <div className="flex items-center space-x-3 sm:space-x-6 min-w-0 flex-1 sm:flex-none">
          <h2 className="text-[20px] sm:text-[21px] font-semibold text-[#1d1d1f] tracking-[-0.28px] truncate min-w-0">
            {getSectionTitle()}
          </h2>

          {/* Quick tab switch: solo en tablet (en móvil vive en la bottom nav) */}
          <div className="hidden sm:flex md:hidden items-center space-x-1 text-[13px] flex-shrink-0">
            {tabsDisponibles(rol).map((tab) => (
              <button
                key={tab}
                onClick={() => setCurrentTab(tab)}
                className={`px-2 py-1 rounded-full ${
                  currentTab === tab ? 'bg-[#1d1d1f] text-white font-semibold' : 'text-[#7a7a7a]'
                }`}
              >
                {TAB_CORTO[tab]}
              </button>
            ))}
          </div>
        </div>

        {/* Center: Entity Selector Pills (solo escritorio) */}
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

        {/* Right: Date filter + Primary Action (en móvil el botón es un FAB flotante
            que vive en App.tsx: aquí no puede ir porque el backdrop-filter del
            SubNav lo convertiría en containing block de position:fixed) */}
        <div className="flex items-center space-x-2 xl:space-x-3 flex-shrink-0 ml-auto">
          {/* Selector de periodo: Día | Semana | Mes | Trimestre | Año | Todo */}
          <select
            value={dateRange.filter}
            onChange={(e) => setFilter(e.target.value as DateFilter)}
            aria-label="Periodo"
            className="text-[12px] sm:text-[13px] bg-[#ffffff] border border-[#e0e0e0] text-[#1d1d1f] rounded-full px-2.5 sm:px-3 py-1.5 outline-none focus:border-[#0071e3] transition-colors cursor-pointer flex-shrink-0"
          >
            {DATE_FILTER_OPTIONS.map((opcion) => (
              <option key={opcion.id} value={opcion.id}>
                {opcion.label}
              </option>
            ))}
          </select>

          {/* Navegación < etiqueta > + Hoy: inline a partir de lg */}
          <div className="hidden lg:flex items-center space-x-1.5 xl:space-x-2">
            {dateRange.filter !== 'all' && (
              <>
                <div className="flex items-center bg-[#ffffff] border border-[#e0e0e0] rounded-full flex-shrink-0">
                  <button
                    type="button"
                    onClick={prevPeriod}
                    aria-label="Periodo anterior"
                    title="Periodo anterior"
                    className="px-2 py-1.5 rounded-l-full text-[#1d1d1f] hover:bg-[#f5f5f7] transition-colors cursor-pointer"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <span className="px-1.5 min-w-[92px] max-w-[150px] xl:min-w-[124px] xl:max-w-[190px] truncate text-center text-[12px] xl:text-[13px] font-medium text-[#1d1d1f]">
                    {labelPeriodo}
                  </span>
                  <button
                    type="button"
                    onClick={nextPeriod}
                    disabled={dateRange.offset === 0}
                    aria-label="Periodo siguiente"
                    title="Periodo siguiente"
                    className="px-2 py-1.5 rounded-r-full text-[#1d1d1f] hover:bg-[#f5f5f7] transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {dateRange.offset !== 0 && (
                  <button
                    type="button"
                    onClick={irAHoy}
                    className="px-3 py-1.5 rounded-full text-[12px] font-semibold bg-[#0066cc] text-white hover:bg-[#0071e3] transition-colors cursor-pointer flex-shrink-0"
                  >
                    Hoy
                  </button>
                )}
              </>
            )}
          </div>

          {/* Primary Action Button (Signature Apple Action Blue pill) — ≥640px.
              El wrapper controla la visibilidad porque .apple-btn-primary define
              display:inline-flex fuera de @layer y ganaría a la utilidad `hidden`. */}
          <div className="hidden sm:block">
            <button
              onClick={onOpenNewTransaction}
              className="apple-btn-primary text-[13px] xl:text-[14px] py-1.5 px-3 xl:px-4 h-[34px] font-normal"
            >
              <Plus className="w-4 h-4" />
              <span>Nuevo Registro</span>
            </button>
          </div>
        </div>
      </div>

      {/* Móvil/tablet: navegación de periodo en su propia fila (no cabe en la primera) */}
      {dateRange.filter !== 'all' && (
        <div className="lg:hidden flex items-center gap-2 px-4 py-2 bg-white border-t border-[rgba(0,0,0,0.06)] overflow-x-auto no-scrollbar">
          <div className="flex items-center bg-[#f5f5f7] border border-[#e0e0e0] rounded-full flex-shrink-0">
            <button
              type="button"
              onClick={prevPeriod}
              aria-label="Periodo anterior"
              title="Periodo anterior"
              className="px-2.5 py-1.5 text-[#1d1d1f] cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-1 text-[13px] font-medium text-[#1d1d1f] whitespace-nowrap">
              {labelPeriodo}
            </span>
            <button
              type="button"
              onClick={nextPeriod}
              disabled={dateRange.offset === 0}
              aria-label="Periodo siguiente"
              title="Periodo siguiente"
              className="px-2.5 py-1.5 text-[#1d1d1f] cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {dateRange.offset !== 0 && (
            <button
              type="button"
              onClick={irAHoy}
              className="px-3 py-1.5 rounded-full text-[12px] font-semibold bg-[#0066cc] text-white flex-shrink-0 cursor-pointer"
            >
              Hoy
            </button>
          )}
        </div>
      )}

      {/* Mobile/Tablet Sub-row for Entity Selector: carrusel con snap + scroll táctil */}
      <div className="relative lg:hidden">
        <div className="flex items-center justify-start gap-2 overflow-x-auto px-4 py-2 pr-8 bg-[#f5f5f7] border-t border-[rgba(0,0,0,0.04)] no-scrollbar snap-x snap-mandatory">
          {entities.map((item) => {
            const isSelected = selectedEntity === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setSelectedEntity(item.id)}
                className={`flex items-center space-x-1.5 px-3 py-1 text-[12px] whitespace-nowrap rounded-full transition-all apple-pressable flex-shrink-0 snap-start ${
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

        {/* Gradiente que insinúa que hay más pills hacia la derecha (no captura clicks) */}
        <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-[#f5f5f7] to-transparent" />
      </div>
    </div>
  );
};
