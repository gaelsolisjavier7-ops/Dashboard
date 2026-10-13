/**
 * Agregación de ingresos del dashboard.
 *
 * Regla clave (evita el doble conteo): los pedidos del bot de Telegram escriben
 * su documento en `pedidos` **y** sus transacciones de ingreso en
 * `transacciones`. El dashboard suma las dos fuentes, así que los pedidos con
 * `origen: 'whatsapp'` NO deben volver a sumarse como ingreso de pedidos.
 *
 * Archivo SIN imports (sólo interfaces propias) para poder testearlo con Node,
 * igual que `lib/costeo.ts`, `lib/fechas.ts` y `lib/products.ts`.
 */

/** Forma mínima de un pedido para el cálculo de ingresos. */
export interface PedidoParaIngreso {
  origen?: string | null;
  estado?: string | null;
  total?: number | null;
  fechaMs?: number | null;
}

/** El bot de Telegram ya crea sus propias transacciones de ingreso. */
export function esPedidoDelBot(pedido: PedidoParaIngreso | null | undefined): boolean {
  return String(pedido?.origen ?? '').trim().toLowerCase() === 'whatsapp';
}

/** Un pedido cancelado no representa dinero cobrado. */
export function esPedidoCancelado(pedido: PedidoParaIngreso | null | undefined): boolean {
  return String(pedido?.estado ?? '').trim().toLowerCase().startsWith('cancel');
}

/**
 * ¿Este pedido aporta ingreso directo al dashboard?
 * Sí cuando no está cancelado y no viene del bot (cuyo ingreso ya está en
 * `transacciones`).
 */
export function pedidoSumaComoIngreso(pedido: PedidoParaIngreso | null | undefined): boolean {
  if (!pedido) return false;
  if (esPedidoCancelado(pedido)) return false;
  if (esPedidoDelBot(pedido)) return false;
  return true;
}

/** ¿El pedido cae dentro del rango [inicio, fin] en ms? */
function enRango(pedido: PedidoParaIngreso, inicio: number, fin: number): boolean {
  const ms = Number(pedido.fechaMs);
  if (!Number.isFinite(ms)) return false;
  return ms >= inicio && ms <= fin;
}

/** Suma el total de los pedidos que aportan ingreso (web, no cancelados, no bot). */
export function ingresoPedidosWeb(
  pedidos: PedidoParaIngreso[],
  inicio: number,
  fin: number
): number {
  return pedidos.reduce((acc, pedido) => {
    if (!pedidoSumaComoIngreso(pedido) || !enRango(pedido, inicio, fin)) return acc;
    return acc + (Number(pedido.total) || 0);
  }, 0);
}

/** Cantidad de pedidos web (no bot, no cancelados) dentro del rango. */
export function contarPedidosWeb(
  pedidos: PedidoParaIngreso[],
  inicio: number,
  fin: number
): number {
  return pedidos.filter(
    (pedido) => pedidoSumaComoIngreso(pedido) && enRango(pedido, inicio, fin)
  ).length;
}

export interface TransaccionParaIngreso {
  tipo?: string | null;
  type?: string | null;
  monto?: number | null;
  amount?: number | null;
}

/** Suma los ingresos de una lista de transacciones (ya filtradas por periodo). */
export function ingresoTransacciones(transacciones: TransaccionParaIngreso[]): number {
  return transacciones.reduce((acc, tx) => {
    const tipo = String(tx.tipo ?? tx.type ?? 'gasto').toLowerCase();
    if (tipo !== 'ingreso' && tipo !== 'income') return acc;
    return acc + (Number(tx.monto ?? tx.amount ?? 0) || 0);
  }, 0);
}

/**
 * Ingreso total del dashboard para un periodo: transacciones + pedidos web.
 * Es la aritmética que usa FinanceContext (y la que duplicaba los pedidos del
 * bot antes de excluirlos aquí).
 */
export function ingresoTotalDelDashboard(
  transacciones: TransaccionParaIngreso[],
  pedidos: PedidoParaIngreso[],
  inicio: number,
  fin: number
): number {
  return ingresoTransacciones(transacciones) + ingresoPedidosWeb(pedidos, inicio, fin);
}
