import React, { useEffect, useMemo, useState } from 'react';
import { useFinance } from '../../context/FinanceContext';
import { formatMXN, insumosActivos, stockBajo, valorInventario } from '../../lib/costeo';
import { InventarioPanel } from '../insumos/InventarioPanel';
import { RecetasPanel } from '../insumos/RecetasPanel';
import {
  AlertCircle,
  Boxes,
  CheckCircle2,
  ClipboardList,
  Loader2,
  Package,
  TrendingUp,
} from 'lucide-react';

export type SubTabCosteo = 'inventario' | 'recetas';

interface InsumosModuleProps {
  /** Sub-tab con el que abre (la pill "Recetas" entra directo a recetas). */
  subTabInicial?: SubTabCosteo;
}

/**
 * Módulo de costeo: Inventario de insumos + Recetas del menú.
 * Se monta tanto desde la pill "Insumos" como desde la pill "Recetas".
 */
export const InsumosModule: React.FC<InsumosModuleProps> = ({ subTabInicial = 'inventario' }) => {
  const {
    insumos,
    loadingInsumos,
    errorInsumos,
    recetas,
    loadingRecetas,
    errorRecetas,
  } = useFinance();

  const [subTab, setSubTab] = useState<SubTabCosteo>(subTabInicial);
  const [toast, setToast] = useState<{ mensaje: string; tipo: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  const notificar = (mensaje: string, tipo: 'success' | 'error' = 'success') =>
    setToast({ mensaje, tipo });

  const metricas = useMemo(() => {
    const activos = insumosActivos(insumos);
    return {
      totalActivos: activos.length,
      valorTotal: valorInventario(activos),
      stockBajo: activos.filter((i) => stockBajo(i)).length,
      categorias: new Set(activos.map((i) => i.categoria)).size,
    };
  }, [insumos]);

  const recetasActivas = recetas.length;
  const loading = loadingInsumos || loadingRecetas;

  return (
    <div className="w-full">
      {/* Hero oscuro con las 4 métricas del inventario */}
      <div className="w-full bg-[var(--bg)] text-[var(--text)] py-10 sm:py-14 px-4 sm:px-12 border-b border-[var(--border)]">
        <div className="max-w-[1200px] mx-auto">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)]">
              Costeo de insumos y recetas
            </span>
            {loading && (
              <span className="text-[12px] text-[#8e8e93] animate-pulse">
                • Sincronizando con Firestore...
              </span>
            )}
          </div>

          <h1 className="text-[30px] sm:text-[44px] font-semibold tracking-[-0.025em] leading-[1.08] mt-2 text-[var(--text)]">
            Costos reales del menú
          </h1>
          <p className="text-[16px] sm:text-[19px] text-[var(--text-secondary)] leading-relaxed mt-2 max-w-[680px]">
            Carga cómo compras cada insumo, define las recetas y el panel calcula el costo por
            unidad, el costo de cada producto y su margen en tiempo real.
          </p>

          {/* 4 métricas */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mt-7">
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[18px] p-4 sm:p-5">
              <div className="flex items-center justify-between text-[var(--text-secondary)]">
                <span className="text-[12px] font-medium uppercase tracking-wider">
                  Insumos activos
                </span>
                <Package className="w-4 h-4 text-[#2997ff]" />
              </div>
              <div className="text-[28px] font-semibold text-[var(--text)] tracking-tight mt-1">
                {metricas.totalActivos}
              </div>
              <span className="text-[12px] text-[#7a7a7a] mt-1 block">
                {recetasActivas} receta{recetasActivas === 1 ? '' : 's'} definida
                {recetasActivas === 1 ? '' : 's'}
              </span>
            </div>

            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[18px] p-4 sm:p-5">
              <div className="flex items-center justify-between text-[var(--text-secondary)]">
                <span className="text-[12px] font-medium uppercase tracking-wider">
                  Valor inventario
                </span>
                <TrendingUp className="w-4 h-4 text-[#34c759]" />
              </div>
              <div className="text-[28px] font-semibold text-[var(--text)] tracking-tight mt-1">
                {formatMXN(metricas.valorTotal)}
              </div>
              <span className="text-[12px] text-[#7a7a7a] mt-1 block">Σ stock × costo unitario</span>
            </div>

            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[18px] p-4 sm:p-5">
              <div className="flex items-center justify-between text-[var(--text-secondary)]">
                <span className="text-[12px] font-medium uppercase tracking-wider">Stock bajo</span>
                <AlertCircle
                  className={`w-4 h-4 ${metricas.stockBajo > 0 ? 'text-[#ff3b30]' : 'text-[#7a7a7a]'}`}
                />
              </div>
              <div className="mt-1 flex items-center space-x-2">
                <span className="text-[28px] font-semibold text-[var(--text)] tracking-tight">
                  {metricas.stockBajo}
                </span>
                {metricas.stockBajo > 0 && (
                  <span className="text-[12px] font-semibold px-2.5 py-1 rounded-full bg-[#ff3b30]/20 text-[#ff453a] border border-[#ff3b30]/40">
                    Revisar
                  </span>
                )}
              </div>
              <span className="text-[12px] text-[#7a7a7a] mt-1 block">
                Por debajo del stock mínimo
              </span>
            </div>

            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[18px] p-4 sm:p-5">
              <div className="flex items-center justify-between text-[var(--text-secondary)]">
                <span className="text-[12px] font-medium uppercase tracking-wider">Categorías</span>
                <Boxes className="w-4 h-4 text-[#2997ff]" />
              </div>
              <div className="text-[28px] font-semibold text-[var(--text)] tracking-tight mt-1">
                {metricas.categorias}
              </div>
              <span className="text-[12px] text-[#7a7a7a] mt-1 block">Distintas en uso</span>
            </div>
          </div>
        </div>
      </div>

      {/* Sub-tabs + contenido */}
      <div className="w-full py-8 px-4 sm:py-12 sm:px-12 bg-[#f5f5f7] border-b border-[#e0e0e0]">
        <div className="max-w-[1200px] mx-auto">
          <div className="flex items-center justify-between gap-3 mb-6">
            <div className="flex items-center bg-[var(--surface)] p-1 rounded-full border border-[var(--border)]">
              <button
                type="button"
                onClick={() => setSubTab('inventario')}
                aria-current={subTab === 'inventario' ? 'page' : undefined}
                className={`flex items-center space-x-1.5 px-4 min-h-[40px] text-[14px] rounded-full transition-all apple-pressable cursor-pointer ${
                  subTab === 'inventario'
                    ? 'bg-[var(--accent)] text-[var(--accent-ink)] font-semibold'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--surface-elevated)]'
                }`}
              >
                <Package className="w-3.5 h-3.5" />
                <span>Inventario</span>
              </button>
              <button
                type="button"
                onClick={() => setSubTab('recetas')}
                aria-current={subTab === 'recetas' ? 'page' : undefined}
                className={`flex items-center space-x-1.5 px-4 min-h-[40px] text-[14px] rounded-full transition-all apple-pressable cursor-pointer ${
                  subTab === 'recetas'
                    ? 'bg-[var(--accent)] text-[var(--accent-ink)] font-semibold'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--surface-elevated)]'
                }`}
              >
                <ClipboardList className="w-3.5 h-3.5" />
                <span>Recetas</span>
              </button>
            </div>

            {subTab === 'recetas' && (
              <span className="hidden sm:block text-[12px] text-[#8e8e93]">
                El costo se recalcula con los precios actuales de tus insumos
              </span>
            )}
          </div>

          {subTab === 'inventario' ? (
            <InventarioPanel
              insumos={insumos}
              loading={loadingInsumos}
              error={errorInsumos}
              notificar={notificar}
            />
          ) : (
            <RecetasPanel
              insumos={insumos}
              recetas={recetas}
              loading={loadingRecetas}
              error={errorRecetas}
              loadingInsumos={loadingInsumos}
              notificar={notificar}
            />
          )}
        </div>
      </div>

      {/* Toast del módulo */}
      {toast && (
        <div
          className={`fixed bottom-6 right-4 left-4 sm:left-auto sm:right-6 z-[60] flex items-center space-x-2.5 px-4 py-3 rounded-[14px] shadow-2xl text-[14px] text-white ${
            toast.tipo === 'success'
              ? 'bg-[#1d1d1f] border border-[#34c759]/60'
              : 'bg-[#1d1d1f] border border-[#ff3b30]/60'
          }`}
        >
          {toast.tipo === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-[#34c759] flex-shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-[#ff3b30] flex-shrink-0" />
          )}
          <span className="font-medium text-[13px]">{toast.mensaje}</span>
          {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-[#8e8e93]" />}
        </div>
      )}
    </div>
  );
};
