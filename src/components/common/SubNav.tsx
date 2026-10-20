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
  Utensils,
} from 'lucide-react';

interface SubNavProps {
  onOpenNewTransaction: () => void;
  currentTab: TabId;
  setCurrentTab: (tab: TabId) => void;
}

/** Etiquetas cortas para el conmutador de pestañas de tablet. */
const TAB_CORTO: Record<TabId, string> = {
  dashboard: 'Dash',
  transactions: 'Lista',
};

/** Icono de cada sección (las visibles dependen del rol). */
const ICONO_SECCION: Record<SeccionId, React.ReactNode> = {
  hamburguesas: <Utensils className="w-3.5 h-3.5" />,
  insumos: <Boxes className="w-3.5 h-3.5" />,
  recetas: <ClipboardList className="w-3.5 h-3.5" />,
};

export const SubNav: React.FC<SubNavProps> = ({
  onOpenNewTransaction,
  currentTab,
  setCurrentTab,
}) => {
  const {
    selectedSection,
    setSelectedSection,
    dateRange,
    labelPeriodo,
    setFilter,
    prevPeriod,
    nextPeriod,
    irAHoy,
  } = useFinance();
  const { rol } = useAuth();

  const getSectionTitle = () => {
    if (currentTab === 'transactions') return 'Libro de Movimientos';
    return SECCION_LABEL[selectedSection] ?? 'Hamburguesas';
  };

  // Pills según rol: Hamburguesas, Insumos y Recetas.
  const entities: { id: SeccionId; label: string; icon: React.ReactNode }[] =
    seccionesDisponibles(rol).map((id) => ({
      id,
      label: SECCION_LABEL[id],
      icon: ICONO_SECCION[id],
    }));

  return (
    <div className="sticky top-[44px] z-40 w-full apple-frosted border-b border-[var(--border-soft)] select-none">
      <div className="mx-auto flex h-auto sm:min-h-[52px] max-w-[1440px] flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 sm:px-8 py-2 sm:py-1.5">
        {/* Left: Section Title */}
        <div className="flex items-center space-x-3 sm:space-x-6 min-w-0 flex-1 sm:flex-none">
          <h2 className="text-[20px] sm:text-[21px] font-semibold text-[var(--text)] tracking-[-0.28px] truncate min-w-0">
            {getSectionTitle()}
          </h2>

          {/* Quick tab switch: solo en tablet (en móvil vive en la bottom nav) */}
          <div className="hidden sm:flex md:hidden items-center space-x-1 text-[13px] flex-shrink-0">
            {tabsDisponibles(rol).map((tab) => (
              <button
                key={tab}
                onClick={() => setCurrentTab(tab)}
                className={`px-2 py-1 rounded-full transition-colors cursor-pointer ${
                  currentTab === tab
                    ? 'text-[var(--accent)] font-semibold'
                    : 'text-[var(--text-secondary)]'
                }`}
              >
                {TAB_CORTO[tab]}
              </button>
            ))}
          </div>
        </div>

        {/* Center: Entity Selector Pills (solo escritorio) */}
        <div className="hidden lg:flex items-center gap-2">
          {entities.map((item) => {
            const isSelected = selectedSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setSelectedSection(item.id)}
                className={`flex items-center gap-2 h-[36px] px-4 text-[13px] rounded-full transition-all apple-pressable cursor-pointer ${
                  isSelected
                    ? 'bg-[var(--accent)] text-[var(--accent-ink)] font-semibold border border-transparent'
                    : 'bg-[var(--surface)] border border-[var(--border)] text-[var(--text-secondary)] font-medium hover:text-[var(--text)]'
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
            className="text-[12px] sm:text-[13px] bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] rounded-full px-2.5 sm:px-3 py-1.5 outline-none focus:border-[var(--accent)] transition-colors cursor-pointer flex-shrink-0"
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
                <div className="flex items-center bg-[var(--surface)] border border-[var(--border)] rounded-full flex-shrink-0">
                  <button
                    type="button"
                    onClick={prevPeriod}
                    aria-label="Periodo anterior"
                    title="Periodo anterior"
                    className="px-2 py-1.5 rounded-l-full text-[var(--text)] hover:bg-[var(--surface-elevated)] transition-colors cursor-pointer"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <span className="px-1.5 min-w-[92px] max-w-[150px] xl:min-w-[124px] xl:max-w-[190px] truncate text-center text-[12px] xl:text-[13px] font-medium text-[var(--text)]">
                    {labelPeriodo}
                  </span>
                  <button
                    type="button"
                    onClick={nextPeriod}
                    disabled={dateRange.offset === 0}
                    aria-label="Periodo siguiente"
                    title="Periodo siguiente"
                    className="px-2 py-1.5 rounded-r-full text-[var(--text)] hover:bg-[var(--surface-elevated)] transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {dateRange.offset !== 0 && (
                  <button
                    type="button"
                    onClick={irAHoy}
                    className="px-3 py-1.5 rounded-full text-[12px] font-semibold bg-[var(--accent)] text-[var(--accent-ink)] hover:bg-[var(--accent-hover)] transition-colors cursor-pointer flex-shrink-0"
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
        <div className="lg:hidden flex items-center gap-2 px-4 py-2 bg-[var(--bg)] border-t border-[var(--border-soft)] overflow-x-auto no-scrollbar">
          <div className="flex items-center bg-[var(--surface)] border border-[var(--border)] rounded-full flex-shrink-0">
            <button
              type="button"
              onClick={prevPeriod}
              aria-label="Periodo anterior"
              title="Periodo anterior"
              className="px-2.5 py-1.5 text-[var(--text)] cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-1 text-[13px] font-medium text-[var(--text)] whitespace-nowrap">
              {labelPeriodo}
            </span>
            <button
              type="button"
              onClick={nextPeriod}
              disabled={dateRange.offset === 0}
              aria-label="Periodo siguiente"
              title="Periodo siguiente"
              className="px-2.5 py-1.5 text-[var(--text)] cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {dateRange.offset !== 0 && (
            <button
              type="button"
              onClick={irAHoy}
              className="px-3 py-1.5 rounded-full text-[12px] font-semibold bg-[var(--accent)] text-[var(--accent-ink)] flex-shrink-0 cursor-pointer"
            >
              Hoy
            </button>
          )}
        </div>
      )}

      {/* Mobile/Tablet Sub-row for Entity Selector: carrusel con snap + scroll táctil */}
      <div className="relative lg:hidden">
        <div className="flex items-center justify-start gap-2 overflow-x-auto px-4 py-2 pr-8 bg-[var(--bg)] border-t border-[var(--border-soft)] no-scrollbar snap-x snap-mandatory">
          {entities.map((item) => {
            const isSelected = selectedSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setSelectedSection(item.id)}
                className={`flex items-center gap-2 h-[36px] px-4 text-[13px] whitespace-nowrap rounded-full transition-all apple-pressable flex-shrink-0 snap-start border cursor-pointer ${
                  isSelected
                    ? 'bg-[var(--accent)] text-[var(--accent-ink)] font-semibold border-transparent'
                    : 'bg-[var(--surface)] border-[var(--border)] text-[var(--text-secondary)] font-medium'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Gradiente que insinúa que hay más pills hacia la derecha (no captura clicks) */}
        <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-[var(--bg)] to-transparent" />
      </div>
    </div>
  );
};
