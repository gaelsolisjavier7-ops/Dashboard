import React, { useMemo, useState } from 'react';
import type { Insumo, Receta } from '../../types/finance';
import {
  PORCION_PAPAS_G,
  calcularReceta,
  costoIngrediente,
  formatCostoUnitario,
  formatMXN,
  insumoPapas,
} from '../../lib/costeo';
import { getProducto, precioVentaProducto } from '../../lib/products';
import { actualizarReceta, crearReceta } from '../../services/recetas';
import { IconoCategoria } from './IconoCategoria';
import {
  BARRA_MARGEN,
  CLASE_MARGEN,
  ETIQUETA_CLASE,
  INPUT_CLASE,
  INPUT_NUM_CLASE,
  OVERLAY_MODAL,
  PANEL_MODAL,
  TEXTO_MARGEN,
  etiquetaUnidad,
} from './estilos';
import { AlertCircle, Loader2, Plus, Search, Trash2, X } from 'lucide-react';

interface RecetaModalProps {
  productoId: string;
  receta?: Receta | null;
  insumos: Insumo[];
  onClose: () => void;
  onSaved: (mensaje: string) => void;
}

interface Linea {
  insumoId: string;
  cantidad: string;
}

/**
 * Editor de receta con costeo en vivo.
 * Los costos se recalculan SIEMPRE con el `costoUnidadBase` ACTUAL del insumo;
 * los snapshots sólo se guardan al persistir (histórico).
 */
export const RecetaModal: React.FC<RecetaModalProps> = ({
  productoId,
  receta = null,
  insumos,
  onClose,
  onSaved,
}) => {
  const producto = getProducto(productoId);
  const activos = useMemo(() => insumos.filter((i) => i.activo !== false), [insumos]);

  const [lineas, setLineas] = useState<Linea[]>(() =>
    (receta?.ingredientes ?? []).map((ing) => ({
      insumoId: ing.insumoId,
      cantidad: String(ing.cantidad),
    }))
  );
  const [incluyePapas, setIncluyePapas] = useState(receta?.incluyePapas ?? false);
  const [buscadorAbierto, setBuscadorAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const precioVenta = precioVentaProducto(productoId, incluyePapas);
  const papas = insumoPapas(activos);

  const resumen = useMemo(
    () =>
      calcularReceta({
        ingredientes: lineas
          .map((l) => ({ insumoId: l.insumoId, cantidad: Number(l.cantidad) || 0 }))
          .filter((l) => l.insumoId),
        insumos: activos,
        incluyePapas,
        precioVenta,
      }),
    [lineas, activos, incluyePapas, precioVenta]
  );

  const candidatos = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    const yaUsados = new Set(lineas.map((l) => l.insumoId));
    return activos
      .filter((i) => !yaUsados.has(i.id))
      .filter((i) => (texto ? i.nombre.toLowerCase().includes(texto) : true))
      .slice(0, 8);
  }, [activos, busqueda, lineas]);

  const agregar = (insumoId: string) => {
    setLineas((prev) => [...prev, { insumoId, cantidad: '' }]);
    setBusqueda('');
    setBuscadorAbierto(false);
  };

  const quitar = (insumoId: string) => setLineas((prev) => prev.filter((l) => l.insumoId !== insumoId));

  const cambiarCantidad = (insumoId: string, cantidad: string) =>
    setLineas((prev) => prev.map((l) => (l.insumoId === insumoId ? { ...l, cantidad } : l)));

  const guardar = async (event: React.FormEvent) => {
    event.preventDefault();
    setGuardando(true);
    setError(null);

    const datos = {
      productoId,
      productoNombre: producto?.nombre ?? productoId,
      ingredientes: lineas
        .map((l) => ({ insumoId: l.insumoId, cantidad: Number(l.cantidad) || 0 }))
        .filter((l) => l.insumoId && l.cantidad > 0),
      incluyePapas,
      insumos: activos,
    };

    try {
      if (receta) {
        await actualizarReceta(receta.id, datos);
        onSaved(`Receta de ${datos.productoNombre} actualizada`);
      } else {
        await crearReceta(datos);
        onSaved(`Receta de ${datos.productoNombre} guardada`);
      }
    } catch (err: unknown) {
      const e = err as { message?: string };
      console.error('Error al guardar la receta:', err);
      setError(e?.message || 'No se pudo guardar la receta en Firestore.');
      setGuardando(false);
    }
  };

  return (
    <div className={OVERLAY_MODAL}>
      <div className={`${PANEL_MODAL} max-w-[640px] p-5 sm:p-7`}>
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-[21px] sm:text-[23px] font-semibold text-[#1d1d1f] tracking-tight">
              {producto?.nombre ?? productoId}
            </h3>
            <p className="text-[13px] text-[#7a7a7a] mt-1">
              Precio de venta{' '}
              <span className="font-semibold text-[#1d1d1f]">{formatMXN(precioVenta)}</span>
              {incluyePapas && producto?.precioConPapas != null && (
                <span className="text-[#8e8e93]"> (con papas)</span>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            title="Cerrar"
            className="p-2 rounded-full text-[#7a7a7a] hover:bg-[#f5f5f7] hover:text-[#1d1d1f] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={guardar} className="mt-5">
          {/* Ingredientes */}
          <label className={ETIQUETA_CLASE}>Ingredientes</label>
          <div className="space-y-2">
            {lineas.length === 0 && (
              <p className="text-[13px] text-[#8e8e93] py-3 text-center rounded-[12px] bg-[#f5f5f7]">
                Sin ingredientes todavía. Agrega el primero con el buscador de abajo.
              </p>
            )}

            {lineas.map((linea) => {
              const insumo = activos.find((i) => i.id === linea.insumoId);
              const cantidadNum = Number(linea.cantidad) || 0;
              const costo = costoIngrediente(insumo, cantidadNum);
              return (
                <div
                  key={linea.insumoId}
                  className="grid grid-cols-12 gap-2 sm:gap-3 items-center p-2.5 rounded-[12px] bg-[#f5f5f7] border border-[#e0e0e0]"
                >
                  <div className="col-span-12 sm:col-span-5 flex items-center space-x-2 min-w-0">
                    <IconoCategoria
                      categoria={insumo?.categoria ?? 'Otros'}
                      className="w-6 h-6 rounded-full bg-white flex items-center justify-center flex-shrink-0"
                    />
                    <div className="min-w-0">
                      <span className="text-[14px] font-medium text-[#1d1d1f] block truncate">
                        {insumo?.nombre ?? 'Insumo eliminado'}
                      </span>
                      <span className="text-[11px] text-[#8e8e93]">
                        {formatCostoUnitario(insumo?.costoUnidadBase ?? 0)} /{' '}
                        {etiquetaUnidad(insumo?.unidadBase)}
                      </span>
                    </div>
                  </div>

                  <div className="col-span-6 sm:col-span-3 flex items-center space-x-1.5">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={linea.cantidad}
                      onChange={(e) => cambiarCantidad(linea.insumoId, e.target.value)}
                      placeholder="0"
                      className={`${INPUT_NUM_CLASE} py-2 text-center`}
                    />
                    <span className="text-[12px] text-[#7a7a7a] w-8 text-center flex-shrink-0">
                      {etiquetaUnidad(insumo?.unidadBase)}
                    </span>
                  </div>

                  <div className="col-span-5 sm:col-span-3 text-right">
                    <span className="text-[15px] font-semibold text-[#1d1d1f]">
                      {formatMXN(costo)}
                    </span>
                  </div>

                  <div className="col-span-1 flex justify-end">
                    <button
                      type="button"
                      onClick={() => quitar(linea.insumoId)}
                      title="Quitar ingrediente"
                      className="p-2 rounded-full text-[#7a7a7a] hover:bg-[#fff0f0] hover:text-[#ff3b30] transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Selector buscable */}
          {buscadorAbierto ? (
            <div className="mt-3 rounded-[14px] border border-[#e0e0e0] bg-white p-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8e8e93]" />
                <input
                  autoFocus
                  type="text"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscar insumo..."
                  className={`${INPUT_CLASE} pl-9`}
                />
              </div>
              <div className="mt-2 space-y-1 max-h-[220px] overflow-y-auto">
                {candidatos.length === 0 ? (
                  <p className="text-[13px] text-[#8e8e93] py-3 text-center">
                    {activos.length === 0
                      ? 'Todavía no hay insumos. Créalos en el sub-tab Inventario.'
                      : 'Ningún insumo coincide.'}
                  </p>
                ) : (
                  candidatos.map((insumo) => (
                    <button
                      key={insumo.id}
                      type="button"
                      onClick={() => agregar(insumo.id)}
                      className="w-full flex items-center justify-between px-3 py-2.5 rounded-[10px] hover:bg-[#f5f5f7] transition-colors cursor-pointer text-left"
                    >
                      <span className="flex items-center space-x-2 min-w-0">
                        <IconoCategoria
                          categoria={insumo.categoria}
                          className="w-6 h-6 rounded-full bg-[#f5f5f7] flex items-center justify-center flex-shrink-0"
                        />
                        <span className="text-[14px] text-[#1d1d1f] truncate">{insumo.nombre}</span>
                      </span>
                      <span className="text-[12px] text-[#8e8e93] whitespace-nowrap pl-2">
                        {formatCostoUnitario(insumo.costoUnidadBase)} /{' '}
                        {etiquetaUnidad(insumo.unidadBase)}
                      </span>
                    </button>
                  ))
                )}
              </div>
              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setBuscadorAbierto(false)}
                  className="text-[13px] text-[#7a7a7a] hover:text-[#1d1d1f] px-2 py-1 cursor-pointer"
                >
                  Cerrar buscador
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setBuscadorAbierto(true)}
              className="mt-3 w-full min-h-[44px] flex items-center justify-center space-x-2 rounded-[12px] border border-dashed border-[#b0b0b5] text-[14px] text-[#0066cc] hover:bg-[#f5f5f7] transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Agregar ingrediente</span>
            </button>
          )}

          {/* Switch incluye papas */}
          <button
            type="button"
            onClick={() => setIncluyePapas((prev) => !prev)}
            className={`mt-4 w-full flex items-center justify-between p-3.5 rounded-[14px] border transition-colors cursor-pointer ${
              incluyePapas
                ? 'bg-[#0066cc]/5 border-[#0066cc]/30'
                : 'bg-[#f5f5f7] border-[#e0e0e0]'
            }`}
          >
            <span className="text-left">
              <span className="text-[14px] font-medium text-[#1d1d1f] block">
                Incluye papas ({PORCION_PAPAS_G} g)
              </span>
              <span className="text-[12px] text-[#7a7a7a]">
                {papas
                  ? `Suma ${formatMXN(costoIngrediente(papas, PORCION_PAPAS_G))} de "${papas.nombre}"`
                  : 'No hay insumo de categoría "Papas": el switch no sumará nada'}
              </span>
            </span>
            <span
              className={`w-12 h-7 rounded-full flex items-center transition-colors flex-shrink-0 ${
                incluyePapas ? 'bg-[#0066cc]' : 'bg-[#d2d2d7]'
              }`}
            >
              <span
                className={`w-5 h-5 rounded-full bg-[var(--accent-ink)] shadow transition-transform mx-1 ${
                  incluyePapas ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </span>
          </button>

          {error && (
            <div className="mt-4 flex items-start space-x-2 p-3.5 rounded-[12px] bg-[#ff3b30]/5 border border-[#ff3b30]/20">
              <AlertCircle className="w-4 h-4 text-[#ff3b30] flex-shrink-0 mt-0.5" />
              <p className="text-[13px] text-[#ff3b30]">{error}</p>
            </div>
          )}

          {/* Resumen en vivo (sticky) */}
          <div className="sticky bottom-0 -mx-5 sm:-mx-7 mt-4 bg-white border-t border-[#e0e0e0] px-5 sm:px-7 pt-4 pb-4">
            <div className="rounded-[14px] bg-[#f5f5f7] border border-[#e0e0e0] p-4">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-secondary)] block">
                    Costo total
                  </span>
                  <span className="text-[20px] font-semibold text-[#1d1d1f] tracking-tight">
                    {formatMXN(resumen.costoTotal)}
                  </span>
                  {resumen.costoPapas > 0 && (
                    <span className="text-[11px] text-[#8e8e93] block">
                      incl. {formatMXN(resumen.costoPapas)} de papas
                    </span>
                  )}
                </div>
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-secondary)] block">
                    Ganancia
                  </span>
                  <span className={`text-[20px] font-semibold tracking-tight ${TEXTO_MARGEN[resumen.color]}`}>
                    {formatMXN(resumen.ganancia)}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-secondary)] block">
                    Margen
                  </span>
                  <span
                    className={`inline-flex px-2.5 py-1 rounded-full border text-[15px] font-semibold ${CLASE_MARGEN[resumen.color]}`}
                  >
                    {resumen.margenPct}%
                  </span>
                </div>
              </div>

              {/* Barra visual de margen */}
              <div className="mt-3 h-2 rounded-full bg-[#e0e0e0] overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${BARRA_MARGEN[resumen.color]}`}
                  style={{ width: `${Math.max(0, Math.min(100, resumen.margenPct))}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] text-[#8e8e93] mt-1">
                <span>Precio de venta {formatMXN(precioVenta)}</span>
                <span>0 % · 30 % · 50 % · 100 %</span>
              </div>
            </div>

            {resumen.margenPct < 30 && (
              <div className="mt-3 flex items-start space-x-2 p-3 rounded-[12px] bg-[#ff9500]/5 border border-[#ff9500]/25">
                <AlertCircle className="w-4 h-4 text-[#ff9500] flex-shrink-0 mt-0.5" />
                <p className="text-[13px] text-[#ff9500]">
                  El margen es bajo. Considera ajustar el precio o buscar un insumo más barato.
                </p>
              </div>
            )}

            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end sm:space-x-3 sm:gap-0">
              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-auto min-h-[44px] px-5 rounded-full text-[15px] text-[#1d1d1f] hover:bg-[#f5f5f7] transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={guardando || lineas.length === 0}
                className="apple-btn-primary w-full sm:w-auto min-h-[44px] text-[15px] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                {guardando ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Guardando...</span>
                  </>
                ) : (
                  <span>{receta ? 'Guardar cambios' : 'Guardar receta'}</span>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

