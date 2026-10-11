import { useEffect, useState } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../services/firebase';
import { COLECCION_RECETAS, normalizarReceta } from '../services/recetas';
import type { Receta } from '../types/finance';

export interface UseRecetasOptions {
  enabled?: boolean;
}

/**
 * Recetas en tiempo real. El costo guardado es un snapshot histórico: los
 * componentes recalculan el costo y el margen con los costos ACTUALES de los
 * insumos (ver `lib/costeo.ts`).
 */
export function useRecetas({ enabled = true }: UseRecetasOptions = {}) {
  const [recetas, setRecetas] = useState<Receta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!enabled) {
      setRecetas([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    const q = query(collection(db, COLECCION_RECETAS), orderBy('productoNombre'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items = snapshot.docs.map((docSnap) =>
          normalizarReceta(docSnap.id, docSnap.data() as Record<string, unknown>)
        );
        setRecetas(items);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('Error al escuchar la colección recetas en Firestore:', err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [enabled]);

  return { recetas, loading, error };
}
