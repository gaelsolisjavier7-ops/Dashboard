import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import type {
  Transaction,
  CategoryItem,
  DateFilter,
  EntityType,
  CashFlowMetrics,
  InventarioAirPodsMetrics,
  MovimientoAirPods,
  Pedido,
  SeccionId,
} from '../types/finance';
import { DEFAULT_CATEGORIES } from '../lib/initialData';
import { isPedidoCancelado, pedidoEnPeriodo } from '../lib/pedidos';
import { estaEnPeriodo } from '../lib/fechas';
import { filtrarTransaccionesPorRol, puedeVerSeccion, seccionInicial } from '../lib/roles';
import type { EstadoPedido } from '../lib/pedidos';
import { useAuth } from './AuthContext';
import { useTransactions } from '../hooks/useTransactions';
import { usePedidos } from '../hooks/usePedidos';
import { useAirPods } from '../hooks/useAirPods';
import { eliminarMovimiento, registrarMovimiento } from '../services/airpods';
import type { NuevoMovimientoAirPods } from '../services/airpods';
import { collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';

interface FinanceContextType {
  /** Transacciones YA filtradas por rol (el socio sólo recibe hamburguesas). */
  transactions: Transaction[];
  pedidos: Pedido[];
  /** Pedidos web que caen dentro del periodo seleccionado (month | quarter | all). */
  pedidosDelPeriodo: Pedido[];
  /** Suma de pedidos web del periodo, excluyendo los cancelados. */
  webOrdersIncome: number;
  loadingTransactions: boolean;
  loadingPedidos: boolean;
  errorTransactions: Error | null;
  errorPedidos: Error | null;
  categories: CategoryItem[];
  selectedEntity: SeccionId;
  setSelectedEntity: (entity: SeccionId) => void;
  dateFilter: DateFilter;
  setDateFilter: (filter: DateFilter) => void;
  filteredTransactions: Transaction[];
  metrics: CashFlowMetrics;
  categoryExpenses: { name: string; amount: number; color: string; count: number }[];
  addTransaction: (data: Partial<Transaction>) => Promise<void>;
  updateTransaction: (tx: Transaction) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  updatePedidoEstado: (id: string, estado: EstadoPedido, estadoActual?: string) => Promise<void>;
  /* Inventario AirPods */
  movimientosAirPods: MovimientoAirPods[];
  loadingAirPods: boolean;
  errorAirPods: Error | null;
  airPodsMetrics: InventarioAirPodsMetrics;
  registrarMovimientoAirPods: (data: NuevoMovimientoAirPods) => Promise<void>;
  eliminarMovimientoAirPods: (id: string) => Promise<void>;
  transferProfitToPersonal: (
    fromEntity: 'hamburguesas' | 'airpods',
    amount: number,
    notes?: string
  ) => Promise<void>;
  exportDataJSON: () => string;
  importDataJSON: (jsonStr: string) => Promise<boolean>;
}

const FinanceContext = createContext<FinanceContextType | undefined>(undefined);

export const FinanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Rol del usuario (este provider sólo se monta con sesión y rol válidos)
  const { rol } = useAuth();

  const { transacciones, loading: loadingTransactions, error: errorTransactions } = useTransactions();
  const {
    pedidos,
    loading: loadingPedidos,
    error: errorPedidos,
    updateEstado: updateEstadoPedido,
  } = usePedidos();

  // Inventario AirPods: movimientos + métricas (stock, capital, ganancia).
  // Sólo se suscribe el super_admin: las reglas de Firestore niegan esa
  // colección al socio, así que no tiene sentido abrir el listener.
  const airPods = useAirPods({ enabled: rol === 'super_admin' });
  const {
    movimientos: movimientosAirPods,
    loading: loadingAirPods,
    error: errorAirPods,
  } = airPods;
  const airPodsMetrics: InventarioAirPodsMetrics = airPods;

  const [selectedEntity, setSelectedEntity] = useState<SeccionId>('all');
  const [dateFilter, setDateFilter] = useState<DateFilter>('month');
  const [categories] = useState<CategoryItem[]>(DEFAULT_CATEGORIES);

  // Capa 1 de permisos: el socio sólo puede ver movimientos de hamburguesas.
  // Todo lo que se calcula después (métricas, gráficas, listas, export) parte
  // de esta lista ya filtrada, así que ningún total ajeno llega al frontend.
  const transaccionesVisibles = useMemo(
    () => filtrarTransaccionesPorRol(rol, transacciones),
    [transacciones, rol]
  );

  // Si el rol no puede ver la sección seleccionada, se redirige a la suya
  useEffect(() => {
    if (!rol) return;
    if (!puedeVerSeccion(rol, selectedEntity)) {
      setSelectedEntity(seccionInicial(rol));
    }
  }, [rol, selectedEntity]);

  // Filtro de transacciones por entidad y fecha
  const filteredTransactions = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-indexado

    return transaccionesVisibles.filter((tx) => {
      // Filtro por entidad / negocio
      const txNegocio = tx.negocio || tx.entity || 'personal';
      if (selectedEntity !== 'all' && txNegocio !== selectedEntity) {
        return false;
      }

      // Filtro por fecha
      if (dateFilter === 'all') return true;

      const dateStr = tx.fecha || tx.date || '';
      if (!dateStr) return true;

      const txDate = new Date(dateStr);
      if (isNaN(txDate.getTime())) return true;

      const txYear = txDate.getFullYear();
      const txMonth = txDate.getMonth();

      if (dateFilter === 'month') {
        return txYear === currentYear && txMonth === currentMonth;
      }

      if (dateFilter === 'quarter') {
        const currentQuarter = Math.floor(currentMonth / 3);
        const txQuarter = Math.floor(txMonth / 3);
        return txYear === currentYear && currentQuarter === txQuarter;
      }

      return true;
    });
  }, [transacciones, selectedEntity, dateFilter]);

  // Pedidos web dentro del periodo seleccionado (mismo filtro que las transacciones)
  const pedidosDelPeriodo = useMemo(
    () => pedidos.filter((pedido) => pedidoEnPeriodo(pedido, dateFilter)),
    [pedidos, dateFilter]
  );

  // Ingreso real generado por la web: excluye pedidos cancelados
  const webOrdersIncome = useMemo(
    () =>
      pedidosDelPeriodo.reduce(
        (acc, pedido) => (isPedidoCancelado(pedido) ? acc : acc + (Number(pedido.total) || 0)),
        0
      ),
    [pedidosDelPeriodo]
  );

  // Los pedidos web pertenecen al negocio de hamburguesas: se suman al
  // Consolidado y al tab de Hamburguesas, nunca a Personal ni AirPods.
  const includesWebOrders = selectedEntity === 'all' || selectedEntity === 'hamburguesas';

  // Ventas de AirPods del periodo: son ingresos del negocio de reventa.
  // Se respeta el mismo filtro de periodo que las transacciones y los pedidos.
  const airPodsSalesIncome = useMemo(
    () =>
      airPods.movimientos.reduce(
        (acc, mov) =>
          mov.tipo === 'venta' && estaEnPeriodo(mov.fechaMs, dateFilter)
            ? acc + (Number(mov.total) || 0)
            : acc,
        0
      ),
    [airPods.movimientos, dateFilter]
  );

  const includesAirPodsSales = selectedEntity === 'all' || selectedEntity === 'airpods';

  // Métricas financieras calculadas en tiempo real
  // Si Firestore está vacío, todo da 0 automáticamente sin errores ni mocks
  const metrics: CashFlowMetrics = useMemo(() => {
    let totalIncome = 0;
    let totalExpenses = 0;

    const breakdown: CashFlowMetrics['entityBreakdown'] = {
      hamburguesas: { income: 0, expenses: 0, freeCash: 0, margin: 0 },
      airpods: { income: 0, expenses: 0, freeCash: 0, margin: 0 },
      personal: { income: 0, expenses: 0, freeCash: 0, margin: 0 },
    };

    filteredTransactions.forEach((tx) => {
      const ent = (tx.negocio || tx.entity || 'personal') as EntityType;
      const monto = Number(tx.monto ?? tx.amount ?? 0);
      const tipo = (tx.tipo || tx.type || 'gasto').toLowerCase();
      const isIngreso = tipo === 'ingreso' || tipo === 'income';

      if (isIngreso) {
        totalIncome += monto;
        if (breakdown[ent]) breakdown[ent].income += monto;
      } else {
        totalExpenses += monto;
        if (breakdown[ent]) breakdown[ent].expenses += monto;
      }
    });

    // Cambio 1: integrar los pedidos web a los ingresos principales
    if (includesWebOrders && webOrdersIncome > 0) {
      totalIncome += webOrdersIncome;
      breakdown.hamburguesas.income += webOrdersIncome;
    }

    // Módulo de inventario: las ventas de AirPods también son ingresos
    if (includesAirPodsSales && airPodsSalesIncome > 0) {
      totalIncome += airPodsSalesIncome;
      breakdown.airpods.income += airPodsSalesIncome;
    }

    // Calcular margen y flujo libre para cada entidad
    (['hamburguesas', 'airpods', 'personal'] as EntityType[]).forEach((ent) => {
      const inc = breakdown[ent].income;
      const exp = breakdown[ent].expenses;
      const free = inc - exp;
      const margin = inc > 0 ? (free / inc) * 100 : 0;
      breakdown[ent].freeCash = free;
      breakdown[ent].margin = Math.round(margin * 10) / 10;
    });

    const netFreeCash = totalIncome - totalExpenses;
    const savingsOrProfitMargin =
      totalIncome > 0
        ? Math.round(((totalIncome - totalExpenses) / totalIncome) * 100 * 10) / 10
        : 0;

    return {
      totalIncome,
      totalExpenses,
      netFreeCash,
      savingsOrProfitMargin,
      entityBreakdown: breakdown,
    };
  }, [
    filteredTransactions,
    includesWebOrders,
    webOrdersIncome,
    includesAirPodsSales,
    airPodsSalesIncome,
  ]);

  // Gastos por categoría para gráficos
  const categoryExpenses = useMemo(() => {
    const map = new Map<string, { amount: number; count: number; color?: string }>();

    filteredTransactions
      .filter((t) => {
        const tipo = (t.tipo || t.type || 'gasto').toLowerCase();
        return tipo === 'gasto' || tipo === 'expense';
      })
      .forEach((tx) => {
        const catName = tx.categoria || tx.category || 'General';
        const monto = Number(tx.monto ?? tx.amount ?? 0);
        const catInfo = categories.find((c) => c.name === catName);
        const prev = map.get(catName) || {
          amount: 0,
          count: 0,
          color: catInfo?.color || '#0066cc',
        };

        map.set(catName, {
          amount: prev.amount + monto,
          count: prev.count + 1,
          color: prev.color,
        });
      });

    return Array.from(map.entries())
      .map(([name, data]) => ({
        name,
        amount: data.amount,
        color: data.color || '#0066cc',
        count: data.count,
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [filteredTransactions, categories]);

  // Guardar nueva transacción en Firestore (colección 'transacciones')
  const addTransaction = async (data: Partial<Transaction>) => {
    const fecha = data.fecha || data.date || new Date().toISOString().split('T')[0];
    const rawTipo = (data.tipo || data.type || 'gasto').toLowerCase();
    const tipo = rawTipo === 'ingreso' || rawTipo === 'income' ? 'ingreso' : 'gasto';
    const categoria = data.categoria || data.category || 'General';
    const monto = Number(data.monto ?? data.amount ?? 0);
    const descripcion = data.descripcion || data.title || 'Sin concepto';
    const negocio = (data.negocio || data.entity || 'personal') as EntityType;

    await addDoc(collection(db, 'transacciones'), {
      fecha,
      tipo,
      categoria,
      monto,
      descripcion,
      negocio,
      createdAt: serverTimestamp(),
      paymentMethod: data.paymentMethod || 'transferencia',
      notes: data.notes || '',
    });
  };

  // Actualizar transacción en Firestore
  const updateTransaction = async (tx: Transaction) => {
    const docRef = doc(db, 'transacciones', tx.id);
    const fecha = tx.fecha || tx.date || new Date().toISOString().split('T')[0];
    const rawTipo = (tx.tipo || tx.type || 'gasto').toLowerCase();
    const tipo = rawTipo === 'ingreso' || rawTipo === 'income' ? 'ingreso' : 'gasto';
    const categoria = tx.categoria || tx.category || 'General';
    const monto = Number(tx.monto ?? tx.amount ?? 0);
    const descripcion = tx.descripcion || tx.title || 'Sin concepto';
    const negocio = (tx.negocio || tx.entity || 'personal') as EntityType;

    await updateDoc(docRef, {
      fecha,
      tipo,
      categoria,
      monto,
      descripcion,
      negocio,
      updatedAt: serverTimestamp(),
      paymentMethod: tx.paymentMethod || 'transferencia',
      notes: tx.notes || '',
    });
  };

  // Eliminar transacción en Firestore
  const deleteTransaction = async (id: string) => {
    const docRef = doc(db, 'transacciones', id);
    await deleteDoc(docRef);
  };

  // Cambio 2: actualizar el estado de un pedido web en Firestore (`updateDoc`)
  const updatePedidoEstado = async (id: string, estado: EstadoPedido, estadoActual?: string) => {
    await updateEstadoPedido(id, estado, estadoActual);
  };

  // Módulo de inventario AirPods: altas y bajas en `inventario_airpods`
  const registrarMovimientoAirPods = async (data: NuevoMovimientoAirPods) => {
    await registrarMovimiento(data);
  };

  const eliminarMovimientoAirPods = async (id: string) => {
    await eliminarMovimiento(id);
  };

  // Transferencia de utilidad entre negocio y finanzas personales
  const transferProfitToPersonal = async (
    fromEntity: 'hamburguesas' | 'airpods',
    amount: number,
    notes?: string
  ) => {
    const today = new Date().toISOString().split('T')[0];
    const entityName = fromEntity === 'hamburguesas' ? 'Hamburguesas' : 'AirPods';

    // 1. Salida/Gasto del negocio
    await addDoc(collection(db, 'transacciones'), {
      fecha: today,
      tipo: 'gasto',
      categoria: 'Sueldos & Ayudantes',
      monto: amount,
      descripcion: `Retiro de utilidad a Personal (${entityName})`,
      negocio: fromEntity,
      notes: notes || 'Transferencia de ganancias libres hacia finanzas personales',
      paymentMethod: 'transferencia',
      createdAt: serverTimestamp(),
    });

    // 2. Entrada/Ingreso en Personal
    await addDoc(collection(db, 'transacciones'), {
      fecha: today,
      tipo: 'ingreso',
      categoria: 'Retiro de Utilidades Negocios',
      monto: amount,
      descripcion: `Ingreso de Utilidad de Negocio (${entityName})`,
      negocio: 'personal',
      notes: notes || `Fondos recibidos del flujo libre generado por ${entityName}`,
      paymentMethod: 'transferencia',
      createdAt: serverTimestamp(),
    });
  };

  const exportDataJSON = () => {
    return JSON.stringify(
      { transacciones: transaccionesVisibles, pedidos, movimientosAirPods, exportedAt: new Date().toISOString() },
      null,
      2
    );
  };

  const importDataJSON = async (jsonStr: string) => {
    try {
      const parsed = JSON.parse(jsonStr);
      const list = parsed.transacciones || parsed.transactions;
      if (Array.isArray(list)) {
        for (const item of list) {
          await addDoc(collection(db, 'transacciones'), {
            fecha: item.fecha || item.date || new Date().toISOString().split('T')[0],
            tipo: item.tipo || item.type || 'gasto',
            categoria: item.categoria || item.category || 'General',
            monto: Number(item.monto ?? item.amount ?? 0),
            descripcion: item.descripcion || item.title || 'Movimiento importado',
            negocio: item.negocio || item.entity || 'personal',
            createdAt: serverTimestamp(),
          });
        }
        return true;
      }
    } catch (e) {
      console.error('Error importando datos a Firestore:', e);
    }
    return false;
  };

  return (
    <FinanceContext.Provider
      value={{
        transactions: transaccionesVisibles,
        pedidos,
        pedidosDelPeriodo,
        webOrdersIncome,
        loadingTransactions,
        loadingPedidos,
        errorTransactions,
        errorPedidos,
        categories,
        selectedEntity,
        setSelectedEntity,
        dateFilter,
        setDateFilter,
        filteredTransactions,
        metrics,
        categoryExpenses,
        addTransaction,
        updateTransaction,
        deleteTransaction,
        updatePedidoEstado,
        movimientosAirPods,
        loadingAirPods,
        errorAirPods,
        airPodsMetrics,
        registrarMovimientoAirPods,
        eliminarMovimientoAirPods,
        transferProfitToPersonal,
        exportDataJSON,
        importDataJSON,
      }}
    >
      {children}
    </FinanceContext.Provider>
  );
};

export const useFinance = () => {
  const ctx = useContext(FinanceContext);
  if (!ctx) throw new Error('useFinance debe ser usado dentro de FinanceProvider');
  return ctx;
};
