import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import type {
  Transaction,
  CategoryItem,
  DateFilter,
  FinanceMetrics,
  Insumo,
  Pedido,
  Receta,
  SeccionId,
  DateRange,
} from '../types/finance';
import { DEFAULT_CATEGORIES } from '../lib/initialData';
import { pedidoEnPeriodo } from '../lib/pedidos';
import { ingresoPedidosWeb } from '../lib/ingresos';
import {
  DATE_FILTERS,
  formatPeriodoLabel,
  parseFechaFirestore,
  rangoDePeriodo,
} from '../lib/fechas';
import { filtrarTransaccionesPorRol, puedeVerSeccion, seccionInicial } from '../lib/roles';
import type { EstadoPedido } from '../lib/pedidos';
import { useAuth } from './AuthContext';
import { useTransactions } from '../hooks/useTransactions';
import { usePedidos } from '../hooks/usePedidos';
import { useInsumos } from '../hooks/useInsumos';
import { useRecetas } from '../hooks/useRecetas';
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  increment,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { MENU_DATA } from '../lib/products';
import { movimientosStockVenta, resolverLineasVenta } from '../lib/inventario';

interface FinanceContextType {
  /** Transacciones YA filtradas por rol (sólo hamburguesas). */
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
  /** Sección activa del dashboard (Hamburguesas, Insumos o Recetas). */
  selectedSection: SeccionId;
  setSelectedSection: (section: SeccionId) => void;
  /** Periodo activo (día/semana/mes/trimestre/año/todo) + desplazamiento. */
  dateRange: DateRange;
  /** Etiqueta legible del periodo: "Hoy (12 Oct)", "Octubre 2026"... */
  labelPeriodo: string;
  setFilter: (filter: DateFilter) => void;
  setOffset: (offset: number) => void;
  prevPeriod: () => void;
  nextPeriod: () => void;
  irAHoy: () => void;
  /** Ingresos/gastos/neto del mismo periodo con offset -1 (null si filter === 'all'). */
  netoPeriodoAnterior: { ingresos: number; gastos: number; neto: number } | null;
  filteredTransactions: Transaction[];
  metrics: FinanceMetrics;
  categoryExpenses: { name: string; amount: number; color: string; count: number }[];
  addTransaction: (data: Partial<Transaction>) => Promise<void>;
  updateTransaction: (tx: Transaction) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  updatePedidoEstado: (id: string, estado: EstadoPedido, estadoActual?: string) => Promise<void>;
  /* Insumos y Recetas (módulo de costeo) */
  insumos: Insumo[];
  loadingInsumos: boolean;
  errorInsumos: Error | null;
  recetas: Receta[];
  loadingRecetas: boolean;
  errorRecetas: Error | null;
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

  // Módulo de costeo: insumos y recetas los lee todo el dashboard
  // (HeroMetrics y el propio módulo), así que se suscriben una sola vez aquí.
  const {
    insumos,
    loading: loadingInsumos,
    error: errorInsumos,
  } = useInsumos();
  const {
    recetas,
    loading: loadingRecetas,
    error: errorRecetas,
  } = useRecetas();

  const [selectedSection, setSelectedSection] = useState<SeccionId>('hamburguesas');
  const [dateRange, setDateRange] = useState<DateRange>(leerDateRangeGuardado);
  const [categories] = useState<CategoryItem[]>(DEFAULT_CATEGORIES);

  // Capa 1 de permisos: sólo se muestran movimientos del negocio de
  // hamburguesas. Todo lo que se calcula después (métricas, gráficas, listas,
  // export) parte de esta lista ya filtrada.
  const transaccionesVisibles = useMemo(
    () => filtrarTransaccionesPorRol(rol, transacciones),
    [transacciones, rol]
  );

  // Si el rol no puede ver la sección seleccionada, se redirige a la suya.
  useEffect(() => {
    if (!rol) return;
    if (!puedeVerSeccion(rol, selectedSection)) {
      setSelectedSection(seccionInicial(rol));
    }
  }, [rol, selectedSection]);

  // Persistencia del periodo elegido (clave entre3_dateRange)
  useEffect(() => {
    guardarDateRange(dateRange);
  }, [dateRange]);

  // API de navegación por periodos
  const setFilter = (filter: DateFilter) => setDateRange({ filter, offset: 0 });
  const setOffset = (offset: number) =>
    setDateRange((prev) => ({ ...prev, offset: Math.min(0, Math.trunc(Number(offset)) || 0) }));
  const prevPeriod = () => setDateRange((prev) => ({ ...prev, offset: prev.offset - 1 }));
  const nextPeriod = () =>
    setDateRange((prev) => ({ ...prev, offset: Math.min(0, prev.offset + 1) }));
  const irAHoy = () => setDateRange({ filter: 'day', offset: 0 });

  const labelPeriodo = formatPeriodoLabel(dateRange.filter, dateRange.offset);

  // Filtro de transacciones por periodo (el negocio ya viene filtrado por rol).
  const filteredTransactions = useMemo(() => {
    const [inicio, fin] = rangoDePeriodo(dateRange.filter, dateRange.offset);

    return transaccionesVisibles.filter((tx) => {
      if (dateRange.filter === 'all') return true;

      const dateStr = tx.fecha || tx.date || '';
      if (!dateStr) return true;

      // parseFechaFirestore interpreta "YYYY-MM-DD" como medianoche LOCAL:
      // con new Date() caería en el día anterior (UTC-6) y el filtro por día fallaría.
      const ms = parseFechaFirestore(dateStr).ms;
      if (!Number.isFinite(ms)) return true;

      return ms >= inicio && ms <= fin;
    });
  }, [transaccionesVisibles, dateRange]);

  // Pedidos web dentro del periodo seleccionado (mismo filtro que las transacciones)
  const pedidosDelPeriodo = useMemo(
    () => pedidos.filter((pedido) => pedidoEnPeriodo(pedido, dateRange.filter, dateRange.offset)),
    [pedidos, dateRange]
  );

  // Ingreso real generado por los pedidos de la web.
  //
  // OJO (fix del doble conteo): los pedidos del bot de Telegram escriben su
  // documento en 'pedidos' **y** sus transacciones de ingreso en
  // 'transacciones'. Como el dashboard suma las dos fuentes, aquí se excluyen
  // los pedidos con origen 'whatsapp' (junto con los cancelados) para no
  // contar el mismo dinero dos veces.
  const webOrdersIncome = useMemo(() => {
    const [inicio, fin] = rangoDePeriodo(dateRange.filter, dateRange.offset);
    return ingresoPedidosWeb(pedidos, inicio, fin);
  }, [pedidos, dateRange]);

  // Métricas del MISMO periodo desplazado a offset -1, para comparar en el hero.
  const netoPeriodoAnterior = useMemo(() => {
    if (dateRange.filter === 'all') return null;

    const [inicio, fin] = rangoDePeriodo(dateRange.filter, dateRange.offset - 1);
    let ingresos = 0;
    let gastos = 0;

    transaccionesVisibles.forEach((tx) => {
      const ms = parseFechaFirestore(tx.fecha || tx.date || '').ms;
      if (!Number.isFinite(ms) || ms < inicio || ms > fin) return;

      const monto = Number(tx.monto ?? tx.amount ?? 0);
      const tipo = (tx.tipo || tx.type || 'gasto').toLowerCase();
      if (tipo === 'ingreso' || tipo === 'income') ingresos += monto;
      else gastos += monto;
    });

    // Misma regla que el periodo actual: sin los pedidos del bot.
    ingresos += ingresoPedidosWeb(pedidos, inicio, fin);

    return { ingresos, gastos, neto: ingresos - gastos };
  }, [transaccionesVisibles, pedidos, dateRange]);

  // Métricas financieras del negocio de hamburguesas en tiempo real.
  // Si Firestore está vacío, todo da 0 automáticamente sin errores ni mocks.
  const metrics: FinanceMetrics = useMemo(() => {
    let totalIncome = 0;
    let totalExpenses = 0;

    filteredTransactions.forEach((tx) => {
      const monto = Number(tx.monto ?? tx.amount ?? 0);
      const tipo = (tx.tipo || tx.type || 'gasto').toLowerCase();
      const isIngreso = tipo === 'ingreso' || tipo === 'income';

      if (isIngreso) totalIncome += monto;
      else totalExpenses += monto;
    });

    // Los pedidos web son ingresos del negocio de hamburguesas.
    if (webOrdersIncome > 0) totalIncome += webOrdersIncome;

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
    };
  }, [filteredTransactions, webOrdersIncome]);

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

  // Guardar nueva transacción en Firestore (colección 'transacciones').
  // Fase 2: todas las transacciones pertenecen a hamburguesas.
  const addTransaction = async (data: Partial<Transaction>) => {
    const fecha = data.fecha || data.date || new Date().toISOString().split('T')[0];
    const rawTipo = (data.tipo || data.type || 'gasto').toLowerCase();
    const tipo = rawTipo === 'ingreso' || rawTipo === 'income' ? 'ingreso' : 'gasto';
    const categoria = data.categoria || data.category || 'General';
    const monto = Number(data.monto ?? data.amount ?? 0);
    const descripcion = data.descripcion || data.title || 'Sin concepto';

    // Venta → recetas: se resuelve la línea vendida (productos explícitos, un
    // productoId único o el texto de la descripción) y se acumulan los insumos.
    const lineas =
      tipo === 'ingreso'
        ? resolverLineasVenta(
            {
              tipo,
              productos: data.productos,
              productoId: data.productoId,
              cantidad: data.cantidad,
              descripcion,
            },
            MENU_DATA
          )
        : [];
    const movimientos = movimientosStockVenta(lineas, recetas);
    const insumosExistentes = new Set(insumos.map((insumo) => insumo.id));

    // La transacción y el descuento de stock van juntos o no se guarda nada.
    const batch = writeBatch(db);
    const transaccionRef = doc(collection(db, 'transacciones'));
    batch.set(transaccionRef, {
      fecha,
      tipo,
      categoria,
      monto,
      descripcion,
      negocio: 'hamburguesas',
      createdAt: serverTimestamp(),
      paymentMethod: data.paymentMethod || 'transferencia',
      notes: data.notes || '',
      ...(lineas.length > 0 ? { productos: lineas } : {}),
    });

    for (const movimiento of movimientos) {
      // Recetas huérfanas: si el insumo ya no existe, no se rompe la venta.
      if (!insumosExistentes.has(movimiento.insumoId)) continue;
      batch.update(doc(db, 'insumos', movimiento.insumoId), {
        stockActual: increment(-movimiento.cantidad),
        updatedAt: serverTimestamp(),
      });
    }

    await batch.commit();
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

    await updateDoc(docRef, {
      fecha,
      tipo,
      categoria,
      monto,
      descripcion,
      negocio: 'hamburguesas',
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

  // Actualizar el estado de un pedido web en Firestore (`updateDoc`)
  const updatePedidoEstado = async (id: string, estado: EstadoPedido, estadoActual?: string) => {
    await updateEstadoPedido(id, estado, estadoActual);
  };

  const exportDataJSON = () => {
    return JSON.stringify(
      { transacciones: transaccionesVisibles, pedidos, exportedAt: new Date().toISOString() },
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
            negocio: 'hamburguesas',
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
        selectedSection,
        setSelectedSection,
        dateRange,
        labelPeriodo,
        setFilter,
        setOffset,
        prevPeriod,
        nextPeriod,
        irAHoy,
        netoPeriodoAnterior,
        filteredTransactions,
        metrics,
        categoryExpenses,
        addTransaction,
        updateTransaction,
        deleteTransaction,
        updatePedidoEstado,
        insumos,
        loadingInsumos,
        errorInsumos,
        recetas,
        loadingRecetas,
        errorRecetas,
        exportDataJSON,
        importDataJSON,
      }}
    >
      {children}
    </FinanceContext.Provider>
  );
};

/* ────────────────── persistencia del periodo (localStorage) ────────────────── */

const CLAVE_DATE_RANGE = 'entre3_dateRange';
const DATE_RANGE_DEFECTO: DateRange = { filter: 'month', offset: 0 };

function leerDateRangeGuardado(): DateRange {
  try {
    const raw = localStorage.getItem(CLAVE_DATE_RANGE);
    if (!raw) return DATE_RANGE_DEFECTO;
    const parsed = JSON.parse(raw) as Partial<DateRange>;
    const filter =
      parsed?.filter && DATE_FILTERS.includes(parsed.filter as DateFilter)
        ? (parsed.filter as DateFilter)
        : DATE_RANGE_DEFECTO.filter;
    const offset = Number.isFinite(Number(parsed?.offset))
      ? Math.min(0, Math.trunc(Number(parsed?.offset)))
      : 0;
    return { filter, offset };
  } catch (err) {
    console.warn('[periodo] No se pudo leer dateRange guardado:', err);
    return DATE_RANGE_DEFECTO;
  }
}

function guardarDateRange(dateRange: DateRange): void {
  try {
    localStorage.setItem(CLAVE_DATE_RANGE, JSON.stringify(dateRange));
  } catch (err) {
    console.warn('[periodo] No se pudo guardar dateRange:', err);
  }
}

export const useFinance = () => {
  const ctx = useContext(FinanceContext);
  if (!ctx) throw new Error('useFinance debe ser usado dentro de FinanceProvider');
  return ctx;
};
