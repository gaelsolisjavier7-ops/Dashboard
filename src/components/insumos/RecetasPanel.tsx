import React, { useMemo, useState } from 'react';
import type { Insumo, Receta } from '../../types/finance';
import { calcularReceta, formatMXN } from '../../lib/costeo';
import { menuPorCategoria, precioVentaProducto } from '../../lib/products';
import { eliminarReceta } from '../../services/recetas';
import { RecetaModal } from './RecetaModal';
import {
  BARRA_MARGEN,
  CLASE_MARGEN,
  TEXTO_MARGEN,
} from './estilos';
import { ClipboardList, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react';

interface RecetasPanelProps {
  insumos: Insumo[];
  recetas: Receta[];
  loading: boolean;
  error: Error | null;
  loadingInsumos: boolean;
  notificar: (mensaje: string, tipo?: 'success' | 'error') => void;
}

/** Lista del menú agrupada por categoría con costo y margen reales por producto. */
export const RecetasPanel: React.FC<RecetasPanelProps> = ({
  insumos,
  recetas,
  loading,
  error,
  loadingInsumos,
  notificar,
}) => {
  const [productoAbierto, setProductoAbierto] = useState<string | null>(null);
  const [confirmandoId, setConfirmandoId] = useState<string | null>(null);
  const [borrandoId, setBorrandoId] = useState<string | null>(null);

  const activos = useMemo(() => insumos.filter((i) => i.activo !== false), [insumos]);
  const porProducto = useMemo(() => {
    const mapa = new Map<string, Receta>();
    for (const receta of recetas) mapa.set(receta.productoId, receta);
    return mapa;
  }, [recetas]);

  const grupos = useMemo(() => menuPorCategoria(), []);

  const handleEliminar = async (receta: Receta) => {
    setBorrandoId(receta.id);
    try {
      await eliminarReceta(receta.id);
      notificar(`Receta de ${receta.productoNombre} eliminada`);
      setConfirmandoId(null);
    } catch (err: unknown) {
      const e = err as { message?: string };
      console.error('Error al eliminar la receta:', err);
      notificar(e?.message || 'No se pudo eliminar la receta.', 'error');
    } finally {
      setBorrandoId(null);
    }
  };

  if (loading && recetas.length === 0 && loadingInsumos) {
    return (
      <div className="py-14 text-center apple-card bg-white">
        <Loader2 className="w-6 h-6 text-[#0066cc] animate-spin inline-block mb-3" />
        <p className="text-[15px] text-[#7a7a7a]">Cargando recetas desde Firestore...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-start space-x-2 p-4 rounded-[12px] bg-[#ff3b30]/5 border border-[#ff3b30]/20">
        <ClipboardList className="w-4 h-4 text-[#ff3b30] flex-shrink-0 mt-0.5" />
        <p className="text-[14px] text-[#ff3b30]">
          No se pudieron leer las recetas: {error.message}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {activos.length === 0 && (
        <div className="flex items-start space-x-2 p-4 rounded-[12px] bg-[#ff9500]/5 border border-[#ff9500]/25">
          <ClipboardList className="w-4 h-4 text-[#ff9500] flex-shrink-0 mt-0.5" />
          <p className="text-[13px] text-[#ff9500]">
            Todavía no hay insumos activos. Ve al sub-tab <strong>Inventario</strong> y carga los
            básicos (carne, pan, queso, tocino, papas) para que las recetas puedan costearse.
          </p>
        </div>
      )}

      {grupos.map((grupo) => (
        <div key={grupo.categoria}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[19px] font-semibold text-[#1d1d1f] tracking-tight">
              {grupo.nombre}
            </h3>
            <span className="text-[12px] text-[#8e8e93]">
              {grupo.productos.length} producto{grupo.productos.length === 1 ? '' : 's'}
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {grupo.productos.map((producto) => {
              const receta = porProducto.get(producto.id) ?? null;
              const precio = precioVentaProducto(producto.id, receta?.incluyePapas ?? false);
              const resumen = receta
                ? calcularReceta({
                    ingredientes: receta.ingredientes.map((ing) => ({
                      insumoId: ing.insumoId,
                      cantidad: ing.cantidad,
                    })),
                    insumos: activos,
                    incluyePapas: receta.incluyePapas,
                    precioVenta: precio,
                  })
                : null;
              const enConfirmacion = confirmandoId === receta?.id;

              return (
                <div
                  key={producto.id}
                  className={`apple-card bg-white flex flex-col justify-between ${
                    enConfirmacion ? 'border-[#ff3b30]/40' : ''
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h4 className="text-[17px] font-semibold text-[#1d1d1f] truncate">
                          {producto.nombre}
                        </h4>
                        <span className="text-[13px] text-[#7a7a7a]">
                          Precio de venta {formatMXN(precio)}
                          {receta?.incluyePapas && producto.precioConPapas != null && (
                            <span className="text-[#8e8e93]"> · con papas</span>
                          )}
                        </span>
                      </div>

                      {receta ? (
                        <span
                          className={`text-[12px] font-semibold px-2.5 py-1 rounded-full border whitespace-nowrap ${CLASE_MARGEN[resumen?.color ?? 'rojo']}`}
                        >
                          {resumen?.margenPct ?? 0}% margen
                        </span>
                      ) : (
                        <span className="text-[12px] font-semibold px-2.5 py-1 rounded-full bg-[#f5f5f7] text-[#7a7a7a] border border-[#e0e0e0] whitespace-nowrap">
                          Sin receta
                        </span>
                      )}
                    </div>

                    {receta && resumen ? (
                      <div className="mt-4 space-y-2 border-t border-[#f0f0f0] pt-3">
                        <div className="flex justify-between text-[14px]">
                          <span className="text-[#7a7a7a]">
                            Costo ({receta.ingredientes.length} ingrediente
                            {receta.ingredientes.length === 1 ? '' : 's'})
                          </span>
                          <span className="font-semibold text-[#1d1d1f]">
                            {formatMXN(resumen.costoTotal)}
                          </span>
                        </div>
                        <div className="flex justify-between text-[14px]">
                          <span className="text-[#7a7a7a]">Ganancia</span>
                          <span className={`font-semibold ${TEXTO_MARGEN[resumen.color]}`}>
                            {formatMXN(resumen.ganancia)}
                          </span>
                        </div>

                        <div className="h-2 rounded-full bg-[#e0e0e0] overflow-hidden">
                          <div
                            className={`h-full rounded-full ${BARRA_MARGEN[resumen.color]}`}
                            style={{
                              width: `${Math.max(0, Math.min(100, resumen.margenPct))}%`,
                            }}
                          />
                        </div>

                        {resumen.costoPapas > 0 && (
                          <p className="text-[11px] text-[#8e8e93]">
                            Incluye {formatMXN(resumen.costoPapas)} de papas (150 g)
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="mt-4 border-t border-[#f0f0f0] pt-3 text-[13px] text-[#7a7a7a]">
                        Define los ingredientes para conocer el costo real y el margen de este
                        producto.
                      </p>
                    )}
                  </div>

                  <div className="mt-4 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setProductoAbierto(producto.id)}
                      className={`flex-1 min-h-[44px] flex items-center justify-center space-x-2 rounded-full text-[14px] font-medium transition-colors cursor-pointer ${
                        receta
                          ? 'bg-[#f5f5f7] text-[#1d1d1f] hover:bg-[#1d1d1f] hover:text-white'
                          : 'apple-btn-primary'
                      }`}
                    >
                      {receta ? <Pencil className="w-3.5 h-3.5" /> : <Plus className="w-4 h-4" />}
                      <span>{receta ? 'Editar receta' : 'Definir receta'}</span>
                    </button>

                    {receta &&
                      (enConfirmacion ? (
                        <div className="flex items-center space-x-1.5">
                          <button
                            type="button"
                            onClick={() => handleEliminar(receta)}
                            disabled={borrandoId === receta.id}
                            title="Confirmar eliminación"
                            className="px-3 min-h-[44px] rounded-full bg-[#ff3b30] text-white text-[13px] font-semibold hover:bg-[#ff453a] transition-colors cursor-pointer disabled:opacity-60"
                          >
                            {borrandoId === receta.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              'Eliminar'
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmandoId(null)}
                            title="Cancelar"
                            className="p-2.5 rounded-full text-[#7a7a7a] hover:bg-[#f5f5f7] transition-colors cursor-pointer"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmandoId(receta.id)}
                          title="Eliminar receta"
                          className="p-2.5 min-h-[44px] rounded-full text-[#7a7a7a] hover:bg-[#fff0f0] hover:text-[#ff3b30] transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {productoAbierto && (
        <RecetaModal
          productoId={productoAbierto}
          receta={porProducto.get(productoAbierto) ?? null}
          insumos={insumos}
          onClose={() => setProductoAbierto(null)}
          onSaved={(mensaje) => {
            setProductoAbierto(null);
            notificar(mensaje);
          }}
        />
      )}
    </div>
  );
};
