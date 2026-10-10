import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../services/firebase';
import { COLECCION_INVENTARIO_AIRPODS } from '../services/airpods';
import type { MovimientoAirPods } from '../types/finance';
import { calcularMetricasAirPods } from '../lib/inventario';
import { parseFechaFirestore } from '../lib/fechas';

/**
 * Inventario de AirPods en tiempo real.
 *
 * Devuelve los movimientos (más recientes primero) y las métricas del negocio:
 * stock, capital inmovilizado, ganancia acumulada y precios/márgenes promedio.
 */
export function useAirPods() {
  const [movimientos, setMovimientos] = useState<MovimientoAirPods[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setLoading(true);

    // Ordenado por fecha descendente desde Firestore
    const q = query(collection(db, COLECCION_INVENTARIO_AIRPODS), orderBy('fecha', 'desc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items: MovimientoAirPods[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();

          // Mientras el serverTimestamp() local aún no se resuelve, `fecha` puede
          // llegar en null; se usa createdAt y, en último caso, la hora actual.
          const { ms } = parseFechaFirestore(data.fecha ?? data.createdAt);

          const cantidad = Number(data.cantidad ?? 0);
          const precioUnitario = Number(data.precio_unitario ?? data.precioUnitario ?? 0);
          const createdAtMs = data.createdAt ? parseFechaFirestore(data.createdAt).ms : null;

          return {
            id: docSnap.id,
            tipo: String(data.tipo ?? '').toLowerCase() === 'venta' ? 'venta' : 'compra',
            cantidad,
            precio_unitario: precioUnitario,
            // Se respeta el total guardado; si faltara, se recalcula
            total: Number(data.total ?? cantidad * precioUnitario),
            fecha: new Date(ms).toISOString(),
            fechaMs: ms,
            // El esquema siempre guarda un Timestamp en `fecha`
            tieneHora: true,
            notas: data.notas ?? null,
            cliente: data.cliente ?? null,
            createdAtMs,
          };
        });

        // La query ya viene ordenada; esto solo estabiliza los empates
        items.sort((a, b) => b.fechaMs - a.fechaMs);

        setMovimientos(items);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('Error al escuchar colección inventario_airpods en Firestore:', err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const metrics = useMemo(() => calcularMetricasAirPods(movimientos), [movimientos]);

  return {
    movimientos,
    loading,
    error,
    stockActual: metrics.stockActual,
    capitalInmovilizado: metrics.capitalInmovilizado,
    gananciaAcumulada: metrics.gananciaAcumulada,
    unidadesVendidas: metrics.unidadesVendidas,
    precioPromedioCompra: metrics.precioPromedioCompra,
    precioPromedioVenta: metrics.precioPromedioVenta,
    margenPromedio: metrics.margenPromedio,
    unidadesCompradas: metrics.unidadesCompradas,
    inversionTotal: metrics.inversionTotal,
    ingresosTotales: metrics.ingresosTotales,
  };
}
