/**
 * Descuento de insumos al guardar un pedido del bot de Telegram.
 *
 * Mantiene la MISMA regla que `src/lib/inventario.ts` (el dashboard no puede
 * importarse desde `api/` porque Vercel transpila cada archivo sin bundlear).
 * Si cambias una regla, cambia la otra.
 */

import { buscarProducto } from './menu.js';

export interface ProductoVendido {
  productoId: string;
  cantidad: number;
}

export interface RecetaParaStock {
  productoId: string;
  activo?: boolean | null;
  ingredientes: { insumoId: string; cantidad: number }[];
}

export interface MovimientoStockVenta {
  insumoId: string;
  cantidad: number;
}

/** Producto tal como se guarda en `pedidos.productos`. */
export interface ProductoPedido {
  productoId?: string | null;
  nombre?: string | null;
  cantidad?: number | null;
}

function normalizarCantidad(valor: unknown): number {
  const numero = Number(valor);
  if (!Number.isFinite(numero) || numero < 1) return 1;
  return Math.trunc(numero);
}

/**
 * Líneas del pedido: usa el `productoId` guardado y, si el documento es viejo
 * y no lo tiene, cae al nombre canónico con el catálogo del bot.
 */
export function lineasDesdePedido(productos: unknown): ProductoVendido[] {
  if (!Array.isArray(productos)) return [];

  const agrupados = new Map<string, number>();
  for (const item of productos) {
    if (!item || typeof item !== 'object') continue;
    const registro = item as ProductoPedido;

    const productoId =
      String(registro.productoId ?? '').trim() || buscarProducto(registro.nombre)?.id || '';
    if (!productoId) continue;

    agrupados.set(productoId, (agrupados.get(productoId) ?? 0) + normalizarCantidad(registro.cantidad));
  }

  return Array.from(agrupados, ([productoId, cantidad]) => ({ productoId, cantidad }));
}

/**
 * Cruza las líneas vendidas con las recetas y devuelve cuánto descontar de
 * cada insumo (en su unidad base), agrupado por insumo.
 */
export function movimientosStockVenta(
  lineas: ProductoVendido[],
  recetas: RecetaParaStock[]
): MovimientoStockVenta[] {
  const totales = new Map<string, number>();

  for (const linea of lineas ?? []) {
    const receta = (recetas ?? []).find(
      (item) => item.productoId === linea.productoId && item.activo !== false
    );
    if (!receta) continue;

    for (const ingrediente of receta.ingredientes ?? []) {
      const insumoId = String(ingrediente.insumoId ?? '').trim();
      const cantidad = Number(ingrediente.cantidad) * normalizarCantidad(linea.cantidad);
      if (!insumoId || !(cantidad > 0)) continue;
      totales.set(insumoId, (totales.get(insumoId) ?? 0) + cantidad);
    }
  }

  return Array.from(totales, ([insumoId, cantidad]) => ({
    insumoId,
    cantidad: Math.round(cantidad * 10000) / 10000,
  }));
}
