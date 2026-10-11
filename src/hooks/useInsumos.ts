import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../services/firebase';
import { COLECCION_INSUMOS, normalizarInsumo } from '../services/insumos';
import type { Insumo } from '../types/finance';
import { insumosActivos, stockBajo, valorInventario } from '../lib/costeo';

export interface UseInsumosOptions {
  enabled?: boolean;
}

/**
 * Insumos en tiempo real (ordenados por nombre) + métricas del inventario:
 * total activos, valor del inventario, stock bajo y categorías distintas.
 */
export function useInsumos({ enabled = true }: UseInsumosOptions = {}) {
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!enabled) {
      setInsumos([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    const q = query(collection(db, COLECCION_INSUMOS), orderBy('nombre'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items = snapshot.docs.map((docSnap) =>
          normalizarInsumo(docSnap.id, docSnap.data() as Record<string, unknown>)
        );
        setInsumos(items);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('Error al escuchar la colección insumos en Firestore:', err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [enabled]);

  const metricas = useMemo(() => {
    const activos = insumosActivos(insumos);
    return {
      totalActivos: activos.length,
      valorTotal: valorInventario(activos),
      stockBajo: activos.filter((i) => stockBajo(i)).length,
      categorias: new Set(activos.map((i) => i.categoria)).size,
    };
  }, [insumos]);

  return { insumos, loading, error, metricas };
}
