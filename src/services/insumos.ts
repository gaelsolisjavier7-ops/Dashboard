import { addDoc, collection, deleteDoc, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import {
  calcularCostoUnidadBase,
  redondear,
  resolverConversion,
  unidadesBaseDeCompra,
} from '../lib/costeo';
import type { UnidadCompra } from '../lib/costeo';
import type { Insumo } from '../types/finance';

/** Servicio de escritura de la colección `insumos`. */
export const COLECCION_INSUMOS = 'insumos';

export interface InsumoFormData {
  nombre: string;
  categoria: string;
  unidadCompra: UnidadCompra;
  cantidadCompra: number;
  precioCompra: number;
  /** Obligatorio cuando unidadCompra === 'paquete' */
  piezasPorPaquete?: number | null;
  /** Si viene vacío se asume la compra completa */
  stockActual?: number | string | null;
  stockMinimo?: number | string | null;
  proveedor?: string | null;
  notas?: string | null;
  activo?: boolean;
}

function textoOpcional(valor?: string | null): string | null {
  const limpio = String(valor ?? '').trim();
  return limpio.length > 0 ? limpio : null;
}

/** Insumo normalizado. `stockVacio` indica si el usuario dejó el stock inicial en blanco. */
export interface InsumoConstruido {
  nombre: string;
  categoria: string;
  unidadCompra: UnidadCompra;
  cantidadCompra: number;
  precioCompra: number;
  piezasPorPaquete: number | null;
  unidadBase: string;
  factorConversion: number;
  costoUnidadBase: number;
  stockActual: number;
  stockMinimo: number;
  proveedor: string | null;
  notas: string | null;
  activo: boolean;
  /** true ⇒ el stock se autocompletó con el total de la compra */
  stockAutocompletado: boolean;
}

/**
 * Normaliza el formulario y aplica la regla de conversión:
 *   costoUnidadBase = precioCompra / (cantidadCompra × factorConversion)
 *
 * Decisión (ambigüedad del prompt): si el usuario deja el stock inicial vacío,
 * se asume el total de la compra (5 kg a $450 ⇒ 5000 g). Es lo más simple que
 * funciona: acabas de comprar ese insumo, así que lo tienes en existencia.
 */
export function construirInsumo(data: InsumoFormData): InsumoConstruido {
  const { unidadBase, factorConversion } = resolverConversion(data.unidadCompra, data.piezasPorPaquete);
  const cantidadCompra = Number(data.cantidadCompra) || 0;
  const precioCompra = Number(data.precioCompra) || 0;
  const compraCompleta = unidadesBaseDeCompra(cantidadCompra, factorConversion);

  const stockTexto =
    data.stockActual === null || data.stockActual === undefined
      ? ''
      : String(data.stockActual).trim();
  const stockVacio = stockTexto === '';
  const stockActual = stockVacio ? compraCompleta : Number(stockTexto) || 0;

  return {
    nombre: String(data.nombre ?? '').trim(),
    categoria: String(data.categoria ?? 'Otros'),
    unidadCompra: data.unidadCompra,
    cantidadCompra,
    precioCompra,
    piezasPorPaquete:
      data.unidadCompra === 'paquete' && Number(data.piezasPorPaquete) > 0
        ? Number(data.piezasPorPaquete)
        : null,
    unidadBase,
    factorConversion,
    costoUnidadBase: calcularCostoUnidadBase(precioCompra, cantidadCompra, factorConversion),
    stockActual: redondear(stockActual, 2),
    stockMinimo: Number(data.stockMinimo) || 0,
    proveedor: textoOpcional(data.proveedor),
    notas: textoOpcional(data.notas),
    activo: data.activo !== false,
    stockAutocompletado: stockVacio && compraCompleta > 0,
  };
}

function validar(data: InsumoFormData): void {
  if (!String(data.nombre ?? '').trim()) throw new Error('El nombre del insumo es obligatorio.');
  if (!(Number(data.cantidadCompra) > 0)) throw new Error('La cantidad de compra debe ser mayor a 0.');
  if (!(Number(data.precioCompra) >= 0)) throw new Error('El precio de compra no puede ser negativo.');
  if (data.unidadCompra === 'paquete' && !(Number(data.piezasPorPaquete) > 0)) {
    throw new Error('Indica cuántas piezas trae el paquete.');
  }
}

/** Crea un insumo y devuelve su id. */
export async function crearInsumo(data: InsumoFormData): Promise<string> {
  validar(data);
  const { stockAutocompletado: _ignorado, ...payload } = construirInsumo(data);
  const ref = await addDoc(collection(db, COLECCION_INSUMOS), {
    ...payload,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

/** Actualiza un insumo existente (recalcula costo y stock). */
export async function actualizarInsumo(id: string, data: InsumoFormData): Promise<void> {
  validar(data);
  const { stockAutocompletado: _ignorado, ...payload } = construirInsumo(data);
  await updateDoc(doc(db, COLECCION_INSUMOS, id), {
    ...payload,
    updatedAt: serverTimestamp(),
  });
}

export async function eliminarInsumo(id: string): Promise<void> {
  await deleteDoc(doc(db, COLECCION_INSUMOS, id));
}

/** Normaliza un documento de Firestore al tipo Insumo de la UI. */
export function normalizarInsumo(id: string, data: Record<string, unknown>): Insumo {
  const unidadCompra = (String(data.unidadCompra ?? 'kg') as UnidadCompra) || 'kg';
  const piezasPorPaquete = data.piezasPorPaquete != null ? Number(data.piezasPorPaquete) : null;
  const conversion = resolverConversion(unidadCompra, piezasPorPaquete);
  const cantidadCompra = Number(data.cantidadCompra ?? 0);
  const precioCompra = Number(data.precioCompra ?? 0);

  return {
    id,
    nombre: String(data.nombre ?? 'Sin nombre'),
    categoria: String(data.categoria ?? 'Otros'),
    unidadCompra,
    cantidadCompra,
    precioCompra,
    piezasPorPaquete,
    unidadBase: (String(data.unidadBase ?? conversion.unidadBase) as Insumo['unidadBase']) || conversion.unidadBase,
    factorConversion: Number(data.factorConversion ?? conversion.factorConversion) || conversion.factorConversion,
    costoUnidadBase:
      data.costoUnidadBase != null
        ? Number(data.costoUnidadBase)
        : calcularCostoUnidadBase(precioCompra, cantidadCompra, conversion.factorConversion),
    stockActual: Number(data.stockActual ?? 0),
    stockMinimo: Number(data.stockMinimo ?? 0),
    proveedor: (data.proveedor as string) ?? null,
    notas: (data.notas as string) ?? null,
    activo: data.activo !== false,
  };
}
