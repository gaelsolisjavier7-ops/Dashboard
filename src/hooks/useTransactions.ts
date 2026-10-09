import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../services/firebase';
import type { Transaccion } from '../types/finance';

export function useTransactions() {
  const [transacciones, setTransacciones] = useState<Transaccion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setLoading(true);
    const colRef = collection(db, 'transacciones');
    // Escuchar la colección transacciones en tiempo real
    const q = query(colRef);

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items: Transaccion[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();

          // Normalizar fecha si viene como Firestore Timestamp o string
          let fechaStr = '';
          if (data.fecha?.toDate) {
            fechaStr = data.fecha.toDate().toISOString().split('T')[0];
          } else if (typeof data.fecha === 'string') {
            fechaStr = data.fecha;
          } else if (data.date) {
            fechaStr = data.date;
          } else {
            fechaStr = new Date().toISOString().split('T')[0];
          }

          // Normalizar tipo ('ingreso' | 'gasto')
          const rawTipo = (data.tipo || data.type || 'gasto').toLowerCase();
          const tipo: 'ingreso' | 'gasto' =
            rawTipo === 'income' || rawTipo === 'ingreso' ? 'ingreso' : 'gasto';

          // Normalizar negocio ('personal' | 'hamburguesas' | 'airpods')
          const rawNegocio = (data.negocio || data.entity || 'personal').toLowerCase();
          const negocio =
            rawNegocio === 'hamburguesas' || rawNegocio === 'airpods' ? rawNegocio : 'personal';

          const monto = Number(data.monto ?? data.amount ?? 0);
          const descripcion = String(data.descripcion ?? data.title ?? '');
          const categoria = String(data.categoria ?? data.category ?? 'General');

          return {
            id: docSnap.id,
            fecha: fechaStr,
            tipo,
            categoria,
            monto,
            descripcion,
            negocio,
            // Campos de compatibilidad
            title: descripcion,
            amount: monto,
            type: tipo,
            entity: negocio,
            category: categoria,
            date: fechaStr,
            notes: data.notes || '',
            paymentMethod: data.paymentMethod || data.metodoPago || 'transferencia',
          };
        });

        // Ordenar por fecha descendente
        items.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

        setTransacciones(items);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('Error al escuchar colección transacciones en Firestore:', err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  return { transacciones, loading, error };
}
