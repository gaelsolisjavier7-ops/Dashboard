import { useState, useEffect } from 'react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '../services/firebase';
import type { Pedido } from '../types/finance';

export function usePedidos() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setLoading(true);
    const colRef = collection(db, 'pedidos');
    const q = query(colRef);

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items: Pedido[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();

          let fechaStr = '';
          if (data.fecha?.toDate) {
            fechaStr = data.fecha.toDate().toISOString().split('T')[0];
          } else if (typeof data.fecha === 'string') {
            fechaStr = data.fecha;
          } else {
            fechaStr = new Date().toISOString().split('T')[0];
          }

          return {
            id: docSnap.id,
            fecha: fechaStr,
            total: Number(data.total ?? 0),
            productos: data.productos ?? [],
            cliente: data.cliente ?? 'Cliente',
            estado: data.estado ?? 'pendiente',
          };
        });

        // Ordenar por fecha descendente
        items.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

        setPedidos(items);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('Error al escuchar colección pedidos en Firestore:', err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  return { pedidos, loading, error };
}
