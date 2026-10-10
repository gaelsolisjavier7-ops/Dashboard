import { addDoc, collection, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import type { TipoMovimientoAirPods } from '../types/finance';
import { calcularTotal } from '../lib/inventario';

/**
 * Servicio de escritura de la colección `inventario_airpods`.
 * La lectura en tiempo real la hace `useAirPods()`.
 */

export const COLECCION_INVENTARIO_AIRPODS = 'inventario_airpods';

export interface NuevoMovimientoAirPods {
  tipo: TipoMovimientoAirPods;
  cantidad: number;
  precio_unitario: number;
  notas?: string | null;
  cliente?: string | null;
}

/** Limpia texto opcional: '' se guarda como null (como define el esquema). */
function textoOpcional(valor?: string | null): string | null {
  const limpio = String(valor ?? '').trim();
  return limpio.length > 0 ? limpio : null;
}

/**
 * Registra una compra o venta en `inventario_airpods` y devuelve el id creado.
 * `fecha` y `createdAt` se escriben con serverTimestamp() para que el orden sea
 * confiable (el reloj del cliente no manda).
 */
export async function registrarMovimiento(data: NuevoMovimientoAirPods): Promise<string> {
  const cantidad = Number(data.cantidad) || 0;
  const precioUnitario = Number(data.precio_unitario) || 0;

  if (cantidad <= 0) throw new Error('La cantidad debe ser mayor a 0.');
  if (precioUnitario < 0) throw new Error('El precio unitario no puede ser negativo.');

  const docRef = await addDoc(collection(db, COLECCION_INVENTARIO_AIRPODS), {
    tipo: data.tipo === 'venta' ? 'venta' : 'compra',
    cantidad,
    precio_unitario: precioUnitario,
    total: calcularTotal(cantidad, precioUnitario),
    fecha: serverTimestamp(),
    notas: textoOpcional(data.notas),
    cliente: data.tipo === 'venta' ? textoOpcional(data.cliente) : null,
    createdAt: serverTimestamp(),
  });

  return docRef.id;
}

/** Elimina un movimiento (compra o venta) del inventario. */
export async function eliminarMovimiento(id: string): Promise<void> {
  if (!id) throw new Error('Falta el id del movimiento.');
  await deleteDoc(doc(db, COLECCION_INVENTARIO_AIRPODS, id));
}
