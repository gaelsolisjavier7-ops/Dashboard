import type { DateFilter, Pedido } from '../types/finance';
import { estaEnPeriodo, parseFechaFirestore } from './fechas';

/**
 * Utilidades para los pedidos de la colección `pedidos` de Firestore.
 *
 * Las funciones de fecha viven ahora en `lib/fechas.ts` (compartidas con el
 * inventario) y se re-exportan aquí con sus nombres históricos para no romper
 * los imports existentes.
 */

export {
  DATE_FILTER_LABEL,
  formatFechaRelativa as formatFechaPedido,
  parseFechaFirestore as parseFechaPedido,
} from './fechas';

export type EstadoPedido = 'pendiente' | 'entregado' | 'cancelado';

export interface EstadoPedidoConfig {
  value: EstadoPedido;
  label: string;
  color: string;
}

export const ESTADOS_PEDIDO: EstadoPedidoConfig[] = [
  { value: 'pendiente', label: 'Pendiente', color: '#ff9500' },
  { value: 'entregado', label: 'Entregado', color: '#34c759' },
  { value: 'cancelado', label: 'Cancelado', color: '#ff3b30' },
];

/** Normaliza cualquier valor de `estado` que venga de Firestore. */
export function normalizeEstado(raw: unknown): EstadoPedido {
  const value = String(raw ?? '')
    .trim()
    .toLowerCase();

  if (value.startsWith('entreg') || value === 'completado' || value === 'completed' || value === 'delivered') {
    return 'entregado';
  }
  if (value.startsWith('cancel') || value === 'canceled') {
    return 'cancelado';
  }
  return 'pendiente';
}

/** Devuelve la configuración (label + color) del estado de un pedido. */
export function getEstadoConfig(raw: unknown): EstadoPedidoConfig {
  const normalized = normalizeEstado(raw);
  return ESTADOS_PEDIDO.find((estado) => estado.value === normalized) ?? ESTADOS_PEDIDO[0];
}

/** Un pedido cancelado no representa dinero cobrado. */
export function isPedidoCancelado(pedido: Pick<Pedido, 'estado'>): boolean {
  return normalizeEstado(pedido.estado) === 'cancelado';
}

/**
 * Conserva la convención de mayúsculas del documento original al escribir:
 * si en Firestore el estado está como "Pendiente", escribimos "Entregado".
 */
export function estadoParaEscribir(nuevo: EstadoPedido, estadoActual?: string): string {
  const actual = String(estadoActual ?? '').trim();
  if (/^[A-ZÁÉÍÓÚÑ]/.test(actual)) {
    return nuevo.charAt(0).toUpperCase() + nuevo.slice(1);
  }
  return nuevo;
}

/** ¿El pedido cae dentro del periodo seleccionado en el dashboard? */
export function pedidoEnPeriodo(pedido: Pedido, filter: DateFilter, ahora: Date = new Date()): boolean {
  if (filter === 'all') return true;

  const ms = Number.isFinite(pedido.fechaMs) ? pedido.fechaMs : parseFechaFirestore(pedido.fecha).ms;
  return estaEnPeriodo(ms, filter, ahora);
}
