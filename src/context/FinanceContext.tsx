import React, { createContext, useContext, useState, useMemo } from 'react';
import type {
  Transaction,
  CategoryItem,
  EntityType,
  CashFlowMetrics,
  Pedido,
} from '../types/finance';
import { DEFAULT_CATEGORIES } from '../lib/initialData';
import { useTransactions } from '../hooks/useTransactions';
import { usePedidos } from '../hooks/usePedidos';
import { collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';

interface FinanceContextType {
  transactions: Transaction[];
  pedidos: Pedido[];
  loadingTransactions: boolean;
  loadingPedidos: boolean;
  errorTransactions: Error | null;
  errorPedidos: Error | null;
  categories: CategoryItem[];
  selectedEntity: EntityType | 'all';
  setSelectedEntity: (entity: EntityType | 'all') => void;
  dateFilter: 'month' | 'quarter' | 'all';
  setDateFilter: (filter: 'month' | 'quarter' | 'all') => void;
  filteredTransactions: Transaction[];
  metrics: CashFlowMetrics;
  categoryExpenses: { name: string; amount: number; color: string; count: number }[];
  addTransaction: (data: Partial<Transaction>) => Promise<void>;
  updateTransaction: (tx: Transaction) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
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
  const { transacciones, loading: loadingTransactions, error: errorTransactions } = useTransactions();
  const { pedidos, loading: loadingPedidos, error: errorPedidos } = usePedidos();

  const [selectedEntity, setSelectedEntity] = useState<EntityType | 'all'>('all');
  const [dateFilter, setDateFilter] = useState<'month' | 'quarter' | 'all'>('month');
  const [categories] = useState<CategoryItem[]>(DEFAULT_CATEGORIES);

  // Filtro de transacciones por entidad y fecha
  const filteredTransactions = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-indexado

    return transacciones.filter((tx) => {
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
  }, [filteredTransactions]);

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
    return JSON.stringify({ transacciones, pedidos, exportedAt: new Date().toISOString() }, null, 2);
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
        transactions: transacciones,
        pedidos,
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
