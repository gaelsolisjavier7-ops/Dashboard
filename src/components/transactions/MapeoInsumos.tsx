import React from 'react';
import { AlertCircle, Check, Package, Plus } from 'lucide-react';
import { formatMXN } from '../../lib/costeo';
import {
  convertirCantidadAUnidadBase,
  normalizarUnidad,
  unidadBaseDeTicket,
} from '../../lib/ticket';
import type { ProductoTicket } from '../../lib/ticket';
import type { Insumo } from '../../types/finance';
import { VALOR_INSUMO_NUEVO } from '../../services/ticket-inventario';

export interface MapeoInsumosProps {
  productos: ProductoTicket[];
  insumos: Insumo[];
  /** índice del producto → id de insumo, VALOR_INSUMO_NUEVO o '' (ignorar). */
  mapeos: Record<number, string>;
  onCambiar: (indice: number, valor: string) => void;
}

const ETIQUETA_UNIDAD: Record<string, string> = {
  kg: 'kg',
  g: 'g',
  l: 'L',
  ml: 'ml',
  pza: 'pza',
  paquete: 'paquete',
  otro: 'u',
};

const formateador = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 2 });

const formatearCantidad = (valor: number) => formateador.format(Number(valor) || 0);

/** "2 kg", "500 g", "3 pza" */
function formatearProductoTicket(producto: ProductoTicket): string {
  const unidad = ETIQUETA_UNIDAD[normalizarUnidad(producto.unidad)] ?? 'u';
  return `${formatearCantidad(producto.cantidad)} ${unidad}`;
}

/**
 * Sección "Insumos detectados": una fila por producto del ticket con un
 * <select> para mapearlo a un insumo existente o crear uno nuevo.
 */
export const MapeoInsumos: React.FC<MapeoInsumosProps> = ({
  productos,
  insumos,
  mapeos,
  onCambiar,
}) => {
  if (productos.length === 0) return null;

  const mapeados = productos.filter((_, indice) => Boolean(mapeos[indice])).length;

  return (
    <div className="mt-3 rounded-[14px] border border-white/10 bg-white/[0.04] p-3">
      <div className="flex items-center gap-2">
        <Package className="w-[18px] h-[18px] flex-shrink-0" style={{ color: 'var(--accent)' }} />
        <h4 className="text-[14px] font-semibold text-[var(--text)]">Insumos detectados</h4>
        <span className="ml-auto text-[11px] px-2 py-0.5 rounded-full border border-white/10 bg-white/5 text-[var(--text-secondary)]">
          {mapeados}/{productos.length}
        </span>
      </div>
      <p className="text-[11px] text-[var(--text-secondary)] mt-1 mb-2.5">
        Vincula cada producto del ticket con tu inventario para sumar el stock.
      </p>

      <div className="space-y-2">
        {productos.map((producto, indice) => {
          const seleccion = mapeos[indice] ?? '';
          const insumo = insumos.find((item) => item.id === seleccion);
          const creando = seleccion === VALOR_INSUMO_NUEVO;
          const unidadBase = insumo?.unidadBase ?? unidadBaseDeTicket(producto.unidad);
          const conversion = convertirCantidadAUnidadBase(
            producto.cantidad,
            producto.unidad,
            unidadBase
          );

          return (
            <div
              key={`${producto.nombre}-${indice}`}
              className="rounded-[10px] border border-white/10 bg-black/20 p-2.5"
            >
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-[var(--text)] break-words leading-snug">
                    {producto.nombre}
                  </p>
                  <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                    {formatearProductoTicket(producto)}
                    {producto.precioUnitario > 0 && ` · ${formatMXN(producto.precioUnitario)} c/u`}
                  </p>
                </div>
                {insumo && (
                  <span
                    className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full flex-shrink-0"
                    style={{
                      backgroundColor: 'color-mix(in srgb, var(--positive) 14%, transparent)',
                      color: 'var(--positive)',
                    }}
                  >
                    <Check className="w-3 h-3" />+{formatearCantidad(conversion.cantidad)}{' '}
                    {ETIQUETA_UNIDAD[normalizarUnidad(unidadBase)] ?? unidadBase}
                  </span>
                )}
              </div>

              <select
                value={seleccion}
                onChange={(evento) => onCambiar(indice, evento.target.value)}
                aria-label={`Insumo para ${producto.nombre}`}
                className="mt-2 w-full min-h-[40px] px-3 rounded-[9px] bg-white/5 border border-white/10 text-[13px] text-[var(--text)] focus:border-[var(--accent)] outline-none transition-colors cursor-pointer"
              >
                <option value="">No actualizar stock</option>
                {insumos.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.nombre}
                  </option>
                ))}
                <option value={VALOR_INSUMO_NUEVO}>+ Crear nuevo insumo</option>
              </select>

              {insumo && (
                <p className="text-[11px] text-[var(--text-secondary)] mt-1.5">
                  {formatearCantidad(insumo.stockActual)}{' '}
                  {ETIQUETA_UNIDAD[normalizarUnidad(insumo.unidadBase)] ?? insumo.unidadBase} en
                  stock →{' '}
                  <span className="font-semibold text-[var(--text)]">
                    {formatearCantidad(insumo.stockActual + conversion.cantidad)}{' '}
                    {ETIQUETA_UNIDAD[normalizarUnidad(insumo.unidadBase)] ?? insumo.unidadBase}
                  </span>
                </p>
              )}

              {creando && (
                <p
                  className="text-[11px] mt-1.5 inline-flex items-start gap-1.5"
                  style={{ color: 'var(--accent)' }}
                >
                  <Plus className="w-3.5 h-3.5 mt-px flex-shrink-0" />
                  <span>
                    Se creará “{producto.nombre}” con{' '}
                    {formatearCantidad(conversion.cantidad)}{' '}
                    {ETIQUETA_UNIDAD[normalizarUnidad(unidadBase)] ?? unidadBase} de stock inicial.
                  </span>
                </p>
              )}

              {seleccion && !conversion.compatible && (
                <p
                  className="text-[11px] mt-1.5 inline-flex items-start gap-1.5"
                  style={{ color: 'var(--pending)' }}
                >
                  <AlertCircle className="w-3.5 h-3.5 mt-px flex-shrink-0" />
                  <span>
                    La unidad del ticket no coincide con la del insumo: se sumarán{' '}
                    {formatearCantidad(conversion.cantidad)}{' '}
                    {ETIQUETA_UNIDAD[normalizarUnidad(unidadBase)] ?? unidadBase} tal cual.
                  </span>
                </p>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-[11px] text-[var(--text-muted)] mt-2">
        {mapeados === 0
          ? 'Sin insumos vinculados: no se modificará el inventario.'
          : `${mapeados} insumo${mapeados === 1 ? '' : 's'} se actualizará${mapeados === 1 ? '' : 'n'} al guardar.`}
      </p>
    </div>
  );
};
