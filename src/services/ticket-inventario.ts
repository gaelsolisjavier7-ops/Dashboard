/**
 * Puente entre el ticket escaneado y el inventario.
 *
 * `construirMovimientosTicket` es puro (lo usa la UI para la vista previa) y
 * `guardarTransaccionConStock` escribe TODO en un solo `writeBatch`: el gasto en
 * `transacciones` + el stock de cada insumo. Si algo falla, no se guarda nada.
 */

import { collection, doc, increment, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from './firebase';
import { COLECCION_INSUMOS, construirInsumo } from './insumos';
import type { InsumoFormData } from './insumos';
import { redondear, resolverConversion } from '../lib/costeo';
import type { UnidadCompra } from '../lib/costeo';
import {
  convertirCantidadAUnidadBase,
  normalizarUnidad,
  unidadBaseDeTicket,
} from '../lib/ticket';
import type { ProductoTicket } from '../lib/ticket';
import type { Insumo } from '../types/finance';

/** Valor del <select> para indicar "crear un insumo nuevo". */
export const VALOR_INSUMO_NUEVO = '__nuevo__';

export interface MovimientoStockTicket {
  /** Insumo existente al que se le suma stock. */
  insumoId?: string;
  /** Datos para crear el insumo (cuando no existe). */
  nuevoInsumo?: InsumoFormData;
  /** Cantidad ya convertida a la unidad base del insumo. */
  cantidadBase: number;
}

/** Cantidad de compra/unidad base de un insumo creado desde el ticket. */
export function datosCompraDesdeTicket(producto: ProductoTicket, proveedor?: string): InsumoFormData {
  const unidad = normalizarUnidad(producto.unidad);
  const cantidad = Number(producto.cantidad) > 0 ? Number(producto.cantidad) : 1;
  const precioUnitario = Number(producto.precioUnitario) > 0 ? Number(producto.precioUnitario) : 0;
  const precioCompra = redondear(precioUnitario * cantidad, 2);

  let unidadCompra: UnidadCompra = 'pza';
  let cantidadCompra = cantidad;

  if (unidad === 'kg') {
    unidadCompra = 'kg';
  } else if (unidad === 'g') {
    unidadCompra = 'kg';
    cantidadCompra = cantidad / 1000;
  } else if (unidad === 'l') {
    unidadCompra = 'litro';
  } else if (unidad === 'ml') {
    unidadCompra = 'litro';
    cantidadCompra = cantidad / 1000;
  }

  const { unidadBase } = resolverConversion(unidadCompra, null);
  const stockActual = convertirCantidadAUnidadBase(cantidad, unidad, unidadBase).cantidad;

  return {
    nombre: producto.nombre.trim() || 'Insumo sin nombre',
    categoria: 'Otros',
    unidadCompra,
    cantidadCompra,
    precioCompra,
    piezasPorPaquete: null,
    stockActual,
    stockMinimo: 0,
    proveedor: proveedor?.trim() || null,
    notas: 'Creado desde un ticket escaneado',
    activo: true,
  };
}

/**
 * Traduce los mapeos del modal a movimientos de stock:
 *  - insumo existente → se agrupa la cantidad (en su unidad base),
 *  - "+ Crear nuevo insumo" → se agrupa por nombre para no duplicar el doc.
 */
export function construirMovimientosTicket(
  productos: ProductoTicket[],
  mapeos: Record<number, string>,
  insumos: Insumo[],
  proveedor?: string
): MovimientoStockTicket[] {
  const existentes = new Map<string, number>();
  const nuevos = new Map<string, { datos: InsumoFormData; cantidadBase: number }>();

  (productos ?? []).forEach((producto, indice) => {
    const seleccion = mapeos[indice];
    if (!seleccion) return;

    if (seleccion === VALOR_INSUMO_NUEVO) {
      const datos = datosCompraDesdeTicket(producto, proveedor);
      const base = unidadBaseDeTicket(producto.unidad);
      const cantidadBase = convertirCantidadAUnidadBase(
        producto.cantidad,
        producto.unidad,
        base
      ).cantidad;
      const clave = datos.nombre.toLowerCase();
      const previo = nuevos.get(clave);
      if (previo) previo.cantidadBase += cantidadBase;
      else nuevos.set(clave, { datos, cantidadBase });
      return;
    }

    const insumo = insumos.find((item) => item.id === seleccion);
    if (!insumo) return;

    const cantidadBase = convertirCantidadAUnidadBase(
      producto.cantidad,
      producto.unidad,
      insumo.unidadBase
    ).cantidad;
    existentes.set(insumo.id, (existentes.get(insumo.id) ?? 0) + cantidadBase);
  });

  const movimientos: MovimientoStockTicket[] = [];
  existentes.forEach((cantidadBase, insumoId) => {
    movimientos.push({ insumoId, cantidadBase: redondear(cantidadBase, 4) });
  });
  nuevos.forEach(({ datos, cantidadBase }) => {
    movimientos.push({ nuevoInsumo: datos, cantidadBase: redondear(cantidadBase, 4) });
  });
  return movimientos;
}

/**
 * Guarda el gasto y suma el stock en un único batch atómico.
 *
 * `transaccion` ya viene normalizada (mismos campos que escribe
 * `FinanceContext.addTransaction`).
 */
export async function guardarTransaccionConStock(
  transaccion: Record<string, unknown>,
  movimientos: MovimientoStockTicket[]
): Promise<void> {
  const batch = writeBatch(db);

  const transaccionRef = doc(collection(db, 'transacciones'));
  batch.set(transaccionRef, { ...transaccion, createdAt: serverTimestamp() });

  for (const movimiento of movimientos) {
    if (movimiento.insumoId) {
      batch.update(doc(db, COLECCION_INSUMOS, movimiento.insumoId), {
        stockActual: increment(movimiento.cantidadBase),
        updatedAt: serverTimestamp(),
      });
      continue;
    }

    if (movimiento.nuevoInsumo) {
      const { stockAutocompletado: _ignorado, ...payload } = construirInsumo({
        ...movimiento.nuevoInsumo,
        stockActual: movimiento.cantidadBase,
      });
      batch.set(doc(collection(db, COLECCION_INSUMOS)), {
        ...payload,
        stockActual: redondear(movimiento.cantidadBase, 2),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  }

  await batch.commit();
}
