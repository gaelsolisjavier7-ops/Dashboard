import { useCallback, useEffect, useState } from 'react';
import { collection, doc, onSnapshot, query, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import type { Pedido } from '../types/finance';
import { estadoParaEscribir, parseFechaPedido } from '../lib/pedidos';
import type { EstadoPedido } from '../lib/pedidos';

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

          // Fecha con hora (Timestamp de Firestore, ISO, epoch o texto)
          const { ms, hasTime } = parseFechaPedido(data.fecha ?? data.createdAt ?? data.fechaPedido);

          return {
            id: docSnap.id,
            fecha: new Date(ms).toISOString(),
            fechaMs: ms,
            tieneHora: hasTime,
            total: Number(data.total ?? data.monto ?? 0),
            subtotal: data.subtotal != null ? Number(data.subtotal) : undefined,
            productos: data.productos ?? [],
            cliente: (typeof data.cliente === 'object' && data.cliente !== null
  ? data.cliente.nombre
  : data.cliente) ?? data.nombre ?? 'Cliente',
clienteTelefono: (typeof data.cliente === 'object' && data.cliente !== null
  ? data.cliente.telefono
  : undefined) ?? data.telefono ?? null,
clienteDireccion: (typeof data.cliente === 'object' && data.cliente !== null
  ? data.cliente.direccion
  : undefined) ?? data.direccion ?? null,
  estado: String(data.estado ?? 'pendiente'),  
  modalidad: data.modalidad ?? '',
  origen: data.origen ?? '',
          };
        });

        // Más recientes primero (por fecha/hora real, no solo por día)
        items.sort((a, b) => b.fechaMs - a.fechaMs);

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

  /**
   * Actualiza el campo `estado` del pedido en Firestore.
   * El cambio se refleja en la UI automáticamente vía onSnapshot.
   */
  const updateEstado = useCallback(
    async (id: string, nuevoEstado: EstadoPedido, estadoActual?: string) => {
      await updateDoc(doc(db, 'pedidos', id), {
        estado: estadoParaEscribir(nuevoEstado, estadoActual),
      });
    },
    []
  );

  return { pedidos, loading, error, updateEstado };
}
