import { addDoc, collection, deleteDoc, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import {
  calcularReceta,
  construirIngredientesSnapshot,
  redondear,
} from '../lib/costeo';
import type { IngredienteInput, InsumoParaCosto } from '../lib/costeo';
import { nombreProducto, precioVentaProducto } from '../lib/products';
import type { Receta } from '../types/finance';

/** Servicio de escritura de la colección `recetas` (una receta por producto). */
export const COLECCION_RECETAS = 'recetas';

export interface RecetaFormData {
  productoId: string;
  productoNombre?: string;
  ingredientes: IngredienteInput[];
  incluyePapas: boolean;
  /** Insumos actuales para calcular snapshots y el costo total */
  insumos: InsumoParaCosto[];
}

/** Payload de la receta con los snapshots del momento de guardar. */
export function construirReceta(data: RecetaFormData) {
  const ingredientes = construirIngredientesSnapshot(data.ingredientes, data.insumos);
  const resumen = calcularReceta({
    ingredientes: data.ingredientes,
    insumos: data.insumos,
    incluyePapas: data.incluyePapas,
    precioVenta: precioVentaProducto(data.productoId, data.incluyePapas),
  });

  return {
    productoId: data.productoId,
    productoNombre: data.productoNombre ?? nombreProducto(data.productoId),
    ingredientes,
    // costoTotal guardado = ingredientes + papas (snapshot del momento)
    costoTotal: redondear(resumen.costoIngredientes + resumen.costoPapas, 2),
    incluyePapas: data.incluyePapas === true,
    activo: true,
  };
}

export async function crearReceta(data: RecetaFormData): Promise<string> {
  if (!data.productoId) throw new Error('Falta el producto de la receta.');
  const ref = await addDoc(collection(db, COLECCION_RECETAS), {
    ...construirReceta(data),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function actualizarReceta(id: string, data: RecetaFormData): Promise<void> {
  if (!data.productoId) throw new Error('Falta el producto de la receta.');
  await updateDoc(doc(db, COLECCION_RECETAS, id), {
    ...construirReceta(data),
    updatedAt: serverTimestamp(),
  });
}

export async function eliminarReceta(id: string): Promise<void> {
  await deleteDoc(doc(db, COLECCION_RECETAS, id));
}

/** Normaliza un documento de Firestore al tipo Receta de la UI. */
export function normalizarReceta(id: string, data: Record<string, unknown>): Receta {
  const ingredientesRaw = Array.isArray(data.ingredientes) ? data.ingredientes : [];

  return {
    id,
    productoId: String(data.productoId ?? ''),
    productoNombre: String(data.productoNombre ?? data.productoId ?? 'Producto'),
    ingredientes: ingredientesRaw.map((item) => {
      const ing = (item ?? {}) as Record<string, unknown>;
      return {
        insumoId: String(ing.insumoId ?? ''),
        insumoNombre: String(ing.insumoNombre ?? 'Insumo'),
        cantidad: Number(ing.cantidad ?? 0),
        costoUnitarioSnapshot: Number(ing.costoUnitarioSnapshot ?? 0),
        costoTotal: Number(ing.costoTotal ?? 0),
      };
    }),
    costoTotal: Number(data.costoTotal ?? 0),
    incluyePapas: data.incluyePapas === true,
    activo: data.activo !== false,
  };
}
