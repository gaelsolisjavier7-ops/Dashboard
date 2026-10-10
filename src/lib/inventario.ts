import type { InventarioAirPodsMetrics, MovimientoAirPods } from '../types/finance';

/**
 * Matemáticas del inventario de AirPods (funciones puras, sin React ni Firestore).
 *
 * Reglas de negocio:
 * - compra: entran unidades y sale dinero (inversión).
 * - venta:  salen unidades y entra dinero (ingreso); su costo se valora al
 *           precio promedio de compra, que es el criterio del negocio.
 */

/** Precio de compra al proveedor (AirPods 1.1 réplica). */
export const PRECIO_COMPRA_DEFAULT = 320;

/** Precio de venta sugerido al público (el rango real es $450–$600). */
export const PRECIO_VENTA_DEFAULT = 450;

/** Redondeo a centavos para evitar errores de coma flotante al guardar dinero. */
export function redondearMoneda(valor: number): number {
  return Math.round((Number(valor) || 0) * 100) / 100;
}

/** Total de un movimiento: cantidad × precio unitario, redondeado a centavos. */
export function calcularTotal(cantidad: number, precioUnitario: number): number {
  return redondearMoneda((Number(cantidad) || 0) * (Number(precioUnitario) || 0));
}

/** Costo unitario de referencia para proyectar márgenes (promedio o $320). */
export function costoUnitarioReferencia(precioPromedioCompra: number): number {
  return precioPromedioCompra > 0 ? precioPromedioCompra : PRECIO_COMPRA_DEFAULT;
}

/** Margen sobre precio de venta, como ratio 0..1. */
export function calcularMargen(precioVenta: number, costoUnitario: number): number {
  const precio = Number(precioVenta) || 0;
  if (precio <= 0) return 0;
  return (precio - (Number(costoUnitario) || 0)) / precio;
}

/** Métricas completas del inventario a partir de todos los movimientos. */
export function calcularMetricasAirPods(movimientos: MovimientoAirPods[]): InventarioAirPodsMetrics {
  let unidadesCompradas = 0;
  let unidadesVendidas = 0;
  let inversionTotal = 0;
  let ingresosTotales = 0;

  for (const mov of movimientos) {
    const cantidad = Number(mov.cantidad) || 0;
    const total = Number(mov.total) || 0;

    if (mov.tipo === 'venta') {
      unidadesVendidas += cantidad;
      ingresosTotales += total;
    } else {
      unidadesCompradas += cantidad;
      inversionTotal += total;
    }
  }

  const stockActual = unidadesCompradas - unidadesVendidas;

  const precioPromedioCompra = unidadesCompradas > 0 ? inversionTotal / unidadesCompradas : 0;
  const precioPromedioVenta = unidadesVendidas > 0 ? ingresosTotales / unidadesVendidas : 0;

  const capitalInmovilizado = stockActual * precioPromedioCompra;

  // Costo de lo vendido valorado al precio promedio de compra
  const gananciaAcumulada = ingresosTotales - unidadesVendidas * precioPromedioCompra;

  const margenPromedio = calcularMargen(precioPromedioVenta, precioPromedioCompra);

  return {
    stockActual,
    capitalInmovilizado: redondearMoneda(capitalInmovilizado),
    gananciaAcumulada: redondearMoneda(gananciaAcumulada),
    unidadesCompradas,
    unidadesVendidas,
    precioPromedioCompra: redondearMoneda(precioPromedioCompra),
    precioPromedioVenta: redondearMoneda(precioPromedioVenta),
    margenPromedio: Math.round(margenPromedio * 10000) / 10000,
    inversionTotal: redondearMoneda(inversionTotal),
    ingresosTotales: redondearMoneda(ingresosTotales),
  };
}
