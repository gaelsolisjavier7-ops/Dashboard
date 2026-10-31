import React, { useMemo, useState } from 'react';
import { Loader2, MinusCircle, PlusCircle, X } from 'lucide-react';
import type { Insumo } from '../../types/finance';
import { redondear, stockAmigable } from '../../lib/costeo';
import { ajustarStockInsumo } from '../../services/insumos';
import { ETIQUETA_CLASE, INPUT_NUM_CLASE, OVERLAY_MODAL, PANEL_MODAL } from './estilos';

export type ModoAjuste = 'compra' | 'merma';

interface AjusteStockModalProps {
  insumo: Insumo;
  modo: ModoAjuste;
  onClose: () => void;
  onSaved: (mensaje: string, tipo?: 'success' | 'error') => void;
}

interface UnidadCaptura {
  etiqueta: string;
  factor: number;
  paso: number;
  ayuda: string;
}

/**
 * La cocina piensa en kg / L / piezas, no en gramos. Este modal pide la
 * cantidad en la unidad fácil y la convierte a la unidad base al guardar.
 */
function unidadDeCaptura(unidadBase: string): UnidadCaptura {
  if (unidadBase === 'g') {
    return { etiqueta: 'kg', factor: 1000, paso: 0.01, ayuda: '5 = 5 kg · 0.2 = 200 g' };
  }
  if (unidadBase === 'ml') {
    return { etiqueta: 'L', factor: 1000, paso: 0.01, ayuda: '1.5 = 1.5 L · 0.2 = 200 ml' };
  }
  return { etiqueta: 'piezas', factor: 1, paso: 1, ayuda: 'Ej. 2' };
}

/** Mini-modal de compra rápida (+) o merma (−) desde una tarjeta. */
export const AjusteStockModal: React.FC<AjusteStockModalProps> = ({
  insumo,
  modo,
  onClose,
  onSaved,
}) => {
  const esCompra = modo === 'compra';
  const unidad = useMemo(() => unidadDeCaptura(insumo.unidadBase), [insumo.unidadBase]);
  const [cantidad, setCantidad] = useState(esCompra ? (unidad.paso < 1 ? '0.5' : '1') : '');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cantidadNum = Number(String(cantidad).replace(',', '.')) || 0;
  const cantidadBase = redondear(cantidadNum * unidad.factor, 4);
  const actual = Number(insumo.stockActual) || 0;
  const resultante = redondear(esCompra ? actual + cantidadBase : actual - cantidadBase, 4);
  const stockHoy = stockAmigable(insumo);
  const stockDespues = stockAmigable({ ...insumo, stockActual: resultante });

  const excede = !esCompra && cantidadBase > actual;
  const puedeGuardar = cantidadNum > 0 && !excede && !guardando;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!puedeGuardar) return;

    setGuardando(true);
    setError(null);
    try {
      await ajustarStockInsumo(insumo.id, esCompra ? cantidadBase : -cantidadBase);
      const etiquetaCantidad =
        cantidadNum === 1 ? unidad.etiqueta.replace(/s$/, '') : unidad.etiqueta;
      onSaved(
        `${esCompra ? 'Compraste' : 'Ajustaste'} ${cantidadNum.toLocaleString('es-MX')} ${
          etiquetaCantidad
        } de ${insumo.nombre}`
      );
      onClose();
    } catch (err: unknown) {
      const e = err as { message?: string };
      console.error('Error al ajustar el stock:', err);
      setError(e?.message || 'No se pudo guardar el movimiento.');
      setGuardando(false);
    }
  };

  return (
    <div className={OVERLAY_MODAL} role="presentation">
      <div className={`${PANEL_MODAL} max-w-[440px] p-5 sm:p-6`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span
              className={`w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 ${
                esCompra ? 'bg-[#34c759]/15 text-[#34c759]' : 'bg-[#ff9500]/15 text-[#ff9500]'
              }`}
            >
              {esCompra ? <PlusCircle className="w-5 h-5" /> : <MinusCircle className="w-5 h-5" />}
            </span>
            <div>
              <h3 className="text-[20px] font-semibold text-[#1d1d1f] tracking-tight">
                {esCompra ? 'Compré más' : 'Ajustar / Merma'}
              </h3>
              <p className="text-[13px] text-[#7a7a7a] mt-0.5">{insumo.nombre}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            title="Cerrar"
            aria-label="Cerrar"
            className="p-2 rounded-full text-[#7a7a7a] hover:bg-[#f5f5f7] hover:text-[#1d1d1f] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div className="rounded-[14px] bg-[#f5f5f7] border border-[#e0e0e0] px-4 py-3 flex items-center justify-between">
            <span className="text-[13px] text-[#7a7a7a]">Tienes ahora</span>
            <span className="text-[15px] font-semibold text-[#1d1d1f]">
              {stockHoy.valor} {stockHoy.unidad}
            </span>
          </div>

          <div>
            <label className={ETIQUETA_CLASE} htmlFor="ajuste-cantidad">
              {esCompra
                ? `¿Cuántos ${unidad.etiqueta} compraste?`
                : `¿Cuánto se perdió o se usó? (${unidad.etiqueta})`}
            </label>
            <div className="flex items-center gap-2">
              <input
                id="ajuste-cantidad"
                type="number"
                min="0"
                step={unidad.paso}
                inputMode="decimal"
                value={cantidad}
                onChange={(e) => setCantidad(e.target.value)}
                className={`${INPUT_NUM_CLASE} text-[20px]`}
                placeholder="0"
                autoFocus
              />
              <span className="text-[15px] font-semibold text-[#7a7a7a] min-w-[52px]">
                {unidad.etiqueta}
              </span>
            </div>
            <p className="text-[11px] text-[#8e8e93] mt-1">{unidad.ayuda}</p>
          </div>

          <div
            className={`rounded-[14px] border px-4 py-3 flex items-center justify-between ${
              excede
                ? 'bg-[#ff3b30]/10 border-[#ff3b30]/40'
                : 'bg-[#34c759]/10 border-[#34c759]/30'
            }`}
          >
            <span className="text-[13px] text-[#7a7a7a]">
              {excede ? 'No hay tanto stock' : 'Quedará en'}
            </span>
            <span
              className={`text-[15px] font-semibold ${
                excede ? 'text-[#ff3b30]' : 'text-[#1d1d1f]'
              }`}
            >
              {excede ? `${stockHoy.valor} ${stockHoy.unidad}` : `${stockDespues.valor} ${stockDespues.unidad}`}
            </span>
          </div>

          {error && (
            <div className="p-3 rounded-[12px] bg-[#ff3b30]/10 border border-[#ff3b30]/30">
              <p className="text-[13px] text-[#ff453a]">{error}</p>
            </div>
          )}

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] px-5 rounded-full text-[15px] text-[#1d1d1f] hover:bg-[#f5f5f7] transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!puedeGuardar}
              className="apple-btn-primary min-h-[44px] text-[15px] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              {guardando ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Guardando...</span>
                </>
              ) : (
                <span>{esCompra ? 'Sumar al stock' : 'Restar del stock'}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
