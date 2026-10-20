import React, { useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useFinance } from '../../context/FinanceContext';
import { ROL_LABEL, SECCION_LABEL, SECCIONES_ORDEN, TAB_LABEL, puedeVerSeccion, tabsDisponibles } from '../../lib/roles';
import type { SeccionId, TabId } from '../../lib/roles';
import { stockBajo } from '../../lib/costeo';
import {
  AlertCircle,
  Boxes,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  LayoutDashboard,
  Receipt,
  Utensils,
} from 'lucide-react';

interface SidebarProps {
  currentTab: TabId;
  setCurrentTab: (tab: TabId) => void;
  seccion: SeccionId;
  setSeccion: (seccion: SeccionId) => void;
}

const ICONO_TAB: Record<TabId, React.ReactNode> = {
  dashboard: <LayoutDashboard className="w-5 h-5" />,
  transactions: <Receipt className="w-5 h-5" />,
};

const ICONO_SECCION: Record<SeccionId, React.ReactNode> = {
  hamburguesas: <Utensils className="w-5 h-5" />,
  insumos: <Boxes className="w-5 h-5" />,
  recetas: <ClipboardList className="w-5 h-5" />,
};

const formatoCantidad = (valor: number) =>
  new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0 }).format(valor || 0);

/**
 * Sidebar de escritorio (FASE 3 del rediseño). Visible sólo en `lg` (≥1024px):
 * reemplaza al menú del header y a la BottomNav, que quedan para tablet/móvil.
 *
 * No toca permisos: los items salen de `tabsDisponibles`/`puedeVerSeccion`, las
 * mismas funciones que usa App para proteger las vistas.
 */
export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  setCurrentTab,
  seccion,
  setSeccion,
}) => {
  const { rol, usuarioPerfil, user } = useAuth();
  const { insumos } = useFinance();
  const [colapsado, setColapsado] = useState(false);

  const tabs = useMemo(() => tabsDisponibles(rol), [rol]);

  // Secciones visibles para el rol, en el orden canónico de la app.
  const secciones = useMemo(
    () => SECCIONES_ORDEN.filter((item) => puedeVerSeccion(rol, item)),
    [rol]
  );

  const criticos = useMemo(
    () => insumos.filter((insumo) => stockBajo(insumo)).slice(0, 4),
    [insumos]
  );

  const nombre = (usuarioPerfil?.nombre ?? user?.displayName ?? 'Usuario') as string;
  const iniciales = nombre
    .split(' ')
    .map((parte) => parte.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const irATab = (tab: TabId, irASeccion?: SeccionId) => {
    if (irASeccion) setSeccion(irASeccion);
    setCurrentTab(tab);
  };

  const itemClase = (activo: boolean) =>
    `w-full flex items-center gap-3 min-h-[48px] px-3 rounded-[10px] border transition-colors cursor-pointer ${
      activo
        ? 'bg-white/10 border-white/10 text-[var(--text)] font-semibold [&>span:first-child]:text-[var(--accent)]'
        : 'border-transparent text-[var(--text-secondary)] hover:bg-white/5 hover:text-[var(--text)]'
    }`;

  return (
    <aside
      className={`hidden lg:flex flex-col flex-shrink-0 sticky top-0 h-screen bg-transparent border-r border-white/5 backdrop-blur-md transition-[width] duration-200 ${
        colapsado ? 'w-[72px]' : 'w-[240px]'
      }`}
    >
      {/* Header: logo + marca + toggle */}
      <div className="flex items-center gap-2 px-3 h-[60px] border-b border-white/5 flex-shrink-0">
        <img
          src="/entre3-logo.png"
          alt="ENTRE 3"
          className="w-8 h-8 rounded-full object-cover flex-shrink-0"
        />
        {!colapsado && (
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold text-[var(--text)] truncate">
              ENTRE 3
            </span>
            <span className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)]">
              Finanzas
            </span>
          </span>
        )}
        <button
          type="button"
          onClick={() => setColapsado((previo) => !previo)}
          aria-label={colapsado ? 'Expandir menú' : 'Colapsar menú'}
          title={colapsado ? 'Expandir menú' : 'Colapsar menú'}
          className="p-1.5 rounded-[8px] text-[var(--text-secondary)] hover:bg-white/5 hover:text-[var(--text)] transition-colors cursor-pointer flex-shrink-0"
        >
          {colapsado ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Navegación */}
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        {tabs.map((tab) => {
          const activo = currentTab === tab;
          return (
            <button
              key={tab}
              type="button"
              onClick={() => irATab(tab)}
              title={TAB_LABEL[tab]}
              className={itemClase(activo)}
            >
              <span className="flex-shrink-0">{ICONO_TAB[tab]}</span>
              {!colapsado && <span className="text-[14px] truncate">{TAB_LABEL[tab]}</span>}
            </button>
          );
        })}

        {secciones.length > 0 && (
          <div className="my-2 border-t border-white/5" role="separator" />
        )}

        {secciones.map((item) => {
          const activo = currentTab === 'dashboard' && seccion === item;
          return (
            <button
              key={item}
              type="button"
              onClick={() => irATab('dashboard', item)}
              title={SECCION_LABEL[item]}
              className={itemClase(activo)}
            >
              <span className="flex-shrink-0">{ICONO_SECCION[item]}</span>
              {!colapsado && <span className="text-[14px] truncate">{SECCION_LABEL[item]}</span>}
            </button>
          );
        })}

        {/* Insumos críticos (stock por debajo del mínimo) */}
        {!colapsado && criticos.length > 0 && (
          <div className="mt-4 px-3">
            <span className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-secondary)] mb-2">
              Insumos críticos
            </span>
            <div className="space-y-1.5">
              {criticos.map((insumo) => (
                <button
                  key={insumo.id}
                  type="button"
                  onClick={() => irATab('dashboard', 'insumos')}
                  className="w-full text-left px-2.5 py-2 rounded-[10px] border transition-colors cursor-pointer"
                  style={{
                    borderColor: 'color-mix(in srgb, var(--pending) 40%, transparent)',
                    backgroundColor: 'color-mix(in srgb, var(--pending) 10%, transparent)',
                  }}
                  title={`${insumo.nombre}: ${formatoCantidad(insumo.stockActual)} / mínimo ${formatoCantidad(insumo.stockMinimo)}`}
                >
                  <span className="flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--pending)' }} />
                    <span className="text-[12px] font-medium text-[var(--text)] truncate">
                      {insumo.nombre}
                    </span>
                  </span>
                  <span className="block text-[11px] text-[var(--text-secondary)] pl-5">
                    {formatoCantidad(insumo.stockActual)} de {formatoCantidad(insumo.stockMinimo)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </nav>

      {/* Footer: usuario */}
      <div className="flex-shrink-0 border-t border-white/5 p-3">
        <div className="flex items-center gap-2.5">
          {user?.photoURL ? (
            <img
              src={user.photoURL}
              alt={nombre}
              className="w-8 h-8 rounded-full object-cover flex-shrink-0"
            />
          ) : (
            <span
              className="w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold flex-shrink-0"
              style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-ink)' }}
            >
              {iniciales}
            </span>
          )}
          {!colapsado && (
            <span className="min-w-0">
              <span className="block text-[14px] font-semibold text-[var(--text)] truncate">
                {nombre}
              </span>
              <span className="block text-[12px] text-[var(--text-secondary)] truncate">
                {rol ? ROL_LABEL[rol] : 'Sin rol'}
              </span>
            </span>
          )}
        </div>
      </div>
    </aside>
  );
};
