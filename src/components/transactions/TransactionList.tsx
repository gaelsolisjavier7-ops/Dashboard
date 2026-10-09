import React, { useState, useMemo } from 'react';
import { useFinance } from '../../context/FinanceContext';
import type { Transaction, EntityType, TransactionType } from '../../types/finance';
import {
  Search,
  Plus,
  Trash2,
  Edit2,
  Download,
  Upload,
  Utensils,
  Headphones,
  User,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';

interface TransactionListProps {
  onOpenNewTransaction: () => void;
  onEditTransaction: (tx: Transaction) => void;
}

export const TransactionList: React.FC<TransactionListProps> = ({
  onOpenNewTransaction,
  onEditTransaction,
}) => {
  const {
    filteredTransactions,
    deleteTransaction,
    loadingTransactions,
    exportDataJSON,
    importDataJSON,
  } = useFinance();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<TransactionType | 'all'>('all');

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      maximumFractionDigits: 0,
    }).format(val);
  };

  const entityIcon = (ent: EntityType) => {
    switch (ent) {
      case 'hamburguesas':
        return <Utensils className="w-3.5 h-3.5 text-[#ff9500]" />;
      case 'airpods':
        return <Headphones className="w-3.5 h-3.5 text-[#0066cc]" />;
      case 'personal':
        return <User className="w-3.5 h-3.5 text-[#34c759]" />;
    }
  };

  const entityLabel = (ent: EntityType) => {
    switch (ent) {
      case 'hamburguesas':
        return 'Hamburguesas';
      case 'airpods':
        return 'AirPods';
      case 'personal':
        return 'Personal';
    }
  };

  // Filtrado de transacciones
  const displayedTransactions = useMemo(() => {
    return filteredTransactions.filter((tx) => {
      const tipo = (tx.tipo || tx.type || 'gasto').toLowerCase();
      const isIngreso = tipo === 'ingreso' || tipo === 'income';

      if (filterType === 'ingreso' && !isIngreso) return false;
      if (filterType === 'gasto' && isIngreso) return false;

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const title = (tx.descripcion || tx.title || '').toLowerCase();
        const cat = (tx.categoria || tx.category || '').toLowerCase();
        const notes = (tx.notes || '').toLowerCase();
        if (!title.includes(query) && !cat.includes(query) && !notes.includes(query)) {
          return false;
        }
      }
      return true;
    });
  }, [filteredTransactions, filterType, searchQuery]);

  const handleExport = () => {
    const dataStr = exportDataJSON();
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `finanzas-apple-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      const success = await importDataJSON(content);
      if (success) {
        alert('¡Datos importados exitosamente a Firestore!');
      } else {
        alert('Error: El archivo no tiene el formato JSON válido.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="w-full py-10 px-6 sm:px-12 bg-[#ffffff]">
      <div className="max-w-[1200px] mx-auto">
        {/* Controls & Search Toolbar */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 pb-6 border-b border-[#f0f0f0]">
          {/* Apple Search Input */}
          <div className="relative flex-1 max-w-[480px]">
            <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-[#7a7a7a]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por concepto, categoría o notas..."
              className="w-full h-[44px] pl-11 pr-4 rounded-full bg-[#f5f5f7] border border-[#e0e0e0] focus:border-[#0071e3] focus:bg-white outline-none text-[15px] transition-all"
            />
          </div>

          {/* Type Filter Buttons & Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center bg-[#f5f5f7] p-1 rounded-full border border-[#e0e0e0]">
              <button
                onClick={() => setFilterType('all')}
                className={`px-3 py-1 rounded-full text-[13px] transition-all apple-pressable cursor-pointer ${
                  filterType === 'all'
                    ? 'bg-[#1d1d1f] text-white font-medium'
                    : 'text-[#1d1d1f] hover:bg-[#eaeaea]'
                }`}
              >
                Todos ({filteredTransactions.length})
              </button>
              <button
                onClick={() => setFilterType('ingreso')}
                className={`px-3 py-1 rounded-full text-[13px] transition-all apple-pressable cursor-pointer ${
                  filterType === 'ingreso'
                    ? 'bg-[#0066cc] text-white font-medium'
                    : 'text-[#1d1d1f] hover:bg-[#eaeaea]'
                }`}
              >
                Ingresos
              </button>
              <button
                onClick={() => setFilterType('gasto')}
                className={`px-3 py-1 rounded-full text-[13px] transition-all apple-pressable cursor-pointer ${
                  filterType === 'gasto'
                    ? 'bg-[#ff3b30] text-white font-medium'
                    : 'text-[#1d1d1f] hover:bg-[#eaeaea]'
                }`}
              >
                Gastos
              </button>
            </div>

            {/* Quick Add CTA */}
            <button
              onClick={onOpenNewTransaction}
              className="apple-btn-primary h-[38px] px-4 text-[14px] cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Registrar</span>
            </button>
          </div>
        </div>

        {/* Transactions Table / Card Stack */}
        <div className="mt-6">
          {loadingTransactions ? (
            <div className="apple-card bg-[#fafafc] text-center py-16 px-4">
              <span className="w-6 h-6 border-2 border-[#0066cc] border-t-transparent rounded-full animate-spin inline-block mb-3" />
              <p className="text-[15px] text-[#7a7a7a]">Cargando transacciones desde Firestore...</p>
            </div>
          ) : displayedTransactions.length === 0 ? (
            <div className="apple-card bg-[#fafafc] text-center py-16 px-4">
              <p className="text-[17px] text-[#1d1d1f] font-semibold">
                No hay movimientos registrados
              </p>
              <p className="text-[14px] text-[#7a7a7a] mt-1 max-w-[380px] mx-auto">
                Tu base de datos en Firestore está vacía. Registra tu primera transacción con el botón azul para comenzar.
              </p>
              <button
                onClick={onOpenNewTransaction}
                className="apple-btn-primary mt-5 text-[14px] py-2 px-5 cursor-pointer"
              >
                <Plus className="w-4 h-4 mr-1" />
                <span>Crear Primera Transacción</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {displayedTransactions.map((tx) => {
                const rawTipo = (tx.tipo || tx.type || 'gasto').toLowerCase();
                const isIncome = rawTipo === 'ingreso' || rawTipo === 'income';
                const titulo = tx.descripcion || tx.title || 'Sin concepto';
                const monto = Number(tx.monto ?? tx.amount ?? 0);
                const entidad = (tx.negocio || tx.entity || 'personal') as EntityType;
                const categoria = tx.categoria || tx.category || 'General';
                const fecha = tx.fecha || tx.date || '';

                return (
                  <div
                    key={tx.id}
                    className="apple-card bg-white p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:border-[#b0b0b5] transition-all"
                  >
                    {/* Left: Icon & Description */}
                    <div className="flex items-start sm:items-center space-x-3.5 min-w-0">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                          isIncome
                            ? 'bg-[#34c759]/10 text-[#34c759]'
                            : 'bg-[#ff3b30]/10 text-[#ff3b30]'
                        }`}
                      >
                        {isIncome ? (
                          <ArrowUpRight className="w-5 h-5" />
                        ) : (
                          <ArrowDownRight className="w-5 h-5" />
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center space-x-2">
                          <h4 className="text-[16px] font-semibold text-[#1d1d1f] truncate">
                            {titulo}
                          </h4>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 mt-1 text-[12px] text-[#7a7a7a]">
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-[#f5f5f7] text-[#1d1d1f] font-medium">
                            {entityIcon(entidad)}
                            <span>{entityLabel(entidad)}</span>
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-[#f5f5f7]">
                            {categoria}
                          </span>
                          {fecha && <span>• {fecha}</span>}
                          {tx.paymentMethod && <span className="capitalize">• {tx.paymentMethod}</span>}
                        </div>
                        {tx.notes && (
                          <p className="text-[13px] text-[#8e8e93] mt-1 italic truncate max-w-[420px]">
                            {tx.notes}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Right: Amount & Actions */}
                    <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto space-x-4 border-t sm:border-t-0 pt-2 sm:pt-0 border-[#f0f0f0]">
                      <div className="text-left sm:text-right">
                        <span
                          className={`text-[19px] sm:text-[21px] font-semibold tracking-tight ${
                            isIncome ? 'text-[#0066cc]' : 'text-[#1d1d1f]'
                          }`}
                        >
                          {isIncome ? '+' : '-'}
                          {formatCurrency(monto)}
                        </span>
                        <span className="text-[11px] text-[#7a7a7a] block uppercase font-medium">
                          {isIncome ? 'Ingreso' : 'Gasto'}
                        </span>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center space-x-1">
                        <button
                          onClick={() => onEditTransaction(tx)}
                          title="Editar"
                          className="p-2 rounded-full hover:bg-[#f5f5f7] text-[#7a7a7a] hover:text-[#1d1d1f] transition-colors cursor-pointer"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`¿Eliminar "${titulo}"?`)) {
                              deleteTransaction(tx.id);
                            }
                          }}
                          title="Eliminar"
                          className="p-2 rounded-full hover:bg-[#fff0f0] text-[#7a7a7a] hover:text-[#ff3b30] transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Bottom Utility Bar: Backup, Export (Apple fine-print style) */}
        <div className="mt-12 pt-6 border-t border-[#f0f0f0] flex flex-wrap items-center justify-between gap-4 text-[13px] text-[#7a7a7a]">
          <div className="flex items-center space-x-4">
            <button
              onClick={handleExport}
              className="flex items-center space-x-1 hover:text-[#1d1d1f] transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Exportar JSON desde Firestore</span>
            </button>

            <label className="flex items-center space-x-1 hover:text-[#1d1d1f] transition-colors cursor-pointer">
              <Upload className="w-3.5 h-3.5" />
              <span>Importar a Firestore</span>
              <input
                type="file"
                accept=".json"
                onChange={handleImport}
                className="hidden"
              />
            </label>
          </div>

          <span className="text-[12px] text-[#8e8e93]">
            Sincronización en tiempo real con Firestore activada
          </span>
        </div>
      </div>
    </div>
  );
};
