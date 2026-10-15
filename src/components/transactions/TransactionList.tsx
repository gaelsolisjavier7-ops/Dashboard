import React, { useMemo, useState } from 'react';
import { useFinance } from '../../context/FinanceContext';
import { useAuth } from '../../context/AuthContext';
import { puedeVerNegocio } from '../../lib/roles';
import { formatFechaRelativa, parseFechaFirestore } from '../../lib/fechas';
import type { Transaction, EntityType, TransactionType } from '../../types/finance';
import {
  ArrowDownRight,
  ArrowUpRight,
  Download,
  Edit2,
  Plus,
  Search,
  Trash2,
  Upload,
} from 'lucide-react';

interface TransactionListProps {
  onOpenNewTransaction: () => void;
  onEditTransaction: (tx: Transaction) => void;
}

const MESES_CORTOS = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];

/** Filtros de período → chips. Se apoyan en el dateRange del contexto. */
type ChipPeriodo = 'hoy' | 'ayer' | 'semana' | 'mes' | 'todo';

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
    selectedEntity,
    setSelectedEntity,
    dateRange,
    setFilter,
    setOffset,
    irAHoy,
    labelPeriodo,
  } = useFinance();
  const { rol } = useAuth();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<TransactionType | 'all'>('all');

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      maximumFractionDigits: 0,
    }).format(val || 0);

  const negociosDisponibles = useMemo(
    () =>
      [
        { id: 'all' as const, label: 'Todos' },
        { id: 'hamburguesas' as EntityType, label: 'Hamburguesas' },
        { id: 'airpods' as EntityType, label: 'AirPods' },
        { id: 'personal' as EntityType, label: 'Personal' },
      ].filter((negocio) => negocio.id === 'all' || puedeVerNegocio(rol, negocio.id)),
    [rol]
  );

  const chipPeriodoActivo: ChipPeriodo =
    dateRange.filter === 'all'
      ? 'todo'
      : dateRange.filter === 'week'
      ? 'semana'
      : dateRange.filter === 'month'
      ? 'mes'
      : dateRange.offset === -1
      ? 'ayer'
      : 'hoy';

  const irAPeriodo = (chip: ChipPeriodo) => {
    if (chip === 'hoy') {
      irAHoy();
      return;
    }
    if (chip === 'ayer') {
      setFilter('day');
      setOffset(-1);
      return;
    }
    if (chip === 'semana') {
      setFilter('week');
      return;
    }
    if (chip === 'mes') {
      setFilter('month');
      return;
    }
    setFilter('all');
  };

  // Filtrado local (búsqueda + tipo). El período y el negocio ya vienen
  // filtrados desde el contexto.
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

  /** Agrupa por día (más reciente primero) con su subtotal. */
  const grupos = useMemo(() => {
    const mapa = new Map<number, Transaction[]>();

    displayedTransactions.forEach((tx) => {
      const ms = parseFechaFirestore(tx.fecha || tx.date).ms;
      const clave = new Date(ms).setHours(0, 0, 0, 0);
      const lista = mapa.get(clave) ?? [];
      lista.push(tx);
      mapa.set(clave, lista);
    });

    return Array.from(mapa.entries())
      .sort((a, b) => b[0] - a[0])
      .map(([clave, items]) => {
        const neto = items.reduce((acc, tx) => {
          const tipo = (tx.tipo || tx.type || 'gasto').toLowerCase();
          const esIngreso = tipo === 'ingreso' || tipo === 'income';
          const monto = Number(tx.monto ?? tx.amount ?? 0);
          return esIngreso ? acc + monto : acc - monto;
        }, 0);
        return { clave, items, neto };
      });
  }, [displayedTransactions]);

  const totalesPeriodo = useMemo(() => {
    return filteredTransactions.reduce(
      (acc, tx) => {
        const tipo = (tx.tipo || tx.type || 'gasto').toLowerCase();
        const esIngreso = tipo === 'ingreso' || tipo === 'income';
        const monto = Number(tx.monto ?? tx.amount ?? 0);
        if (esIngreso) acc.ingresos += monto;
        else acc.gastos += monto;
        return acc;
      },
      { ingresos: 0, gastos: 0 }
    );
  }, [filteredTransactions]);

  const etiquetaDia = (clave: number) => {
    const fecha = new Date(clave);
    const dia = `${fecha.getDate()} ${MESES_CORTOS[fecha.getMonth()]}`;
    const relativo = formatFechaRelativa(clave, false);
    if (relativo === 'hoy') return `HOY · ${dia}`;
    if (relativo === 'ayer') return `AYER · ${dia}`;
    return dia;
  };

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

  const chipClase = (activo: boolean) =>
    `px-3.5 min-h-[36px] rounded-full border text-[13px] transition-colors cursor-pointer whitespace-nowrap ${
      activo
        ? 'font-semibold'
        : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:text-[var(--text)]'
    }`;
  const chipEstilo = (activo: boolean) =>
    activo
      ? {
          backgroundColor: 'var(--accent)',
          borderColor: 'var(--accent)',
          color: 'var(--accent-ink)',
        }
      : undefined;

  /* Control segmentado (Fase 3): contenedor --surface, activo --accent, 32px */
  const segmentoClase = (activo: boolean) =>
    `h-8 px-4 rounded-[8px] text-[13px] whitespace-nowrap transition-colors cursor-pointer ${
      activo ? 'font-semibold' : 'text-[var(--text-secondary)] hover:text-[var(--text)]'
    }`;
  const segmentoEstilo = (activo: boolean) =>
    activo ? { backgroundColor: 'var(--accent)', color: 'var(--accent-ink)' } : undefined;

  return (
    <div className="w-full py-6 px-4 sm:py-10 sm:px-12 bg-[var(--bg)]">
      <div className="max-w-[1200px] mx-auto">
        {/* Header: título + CTA (en móvil manda el FAB) */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-[28px] font-semibold tracking-[-0.02em] text-[var(--text)]">
              Transacciones
            </h1>
            <p className="text-[13px] text-[var(--text-secondary)] mt-1">
              Historial de movimientos
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenNewTransaction}
            className="apple-btn-primary hidden lg:inline-flex min-h-[40px] text-[15px] cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo Registro</span>
          </button>
        </div>

        {/* Filtros de período: control segmentado 40px */}
        <div className="flex items-center gap-1 p-1 rounded-[10px] bg-[var(--surface)] border border-[var(--border)] overflow-x-auto no-scrollbar mt-5 w-fit max-w-full">
          {(
            [
              ['hoy', 'Hoy'],
              ['ayer', 'Ayer'],
              ['semana', 'Esta semana'],
              ['mes', 'Este mes'],
              ['todo', 'Todo el tiempo'],
            ] as [ChipPeriodo, string][]
          ).map(([chip, label]) => {
            const activo = chipPeriodoActivo === chip;
            return (
              <button
                key={chip}
                type="button"
                onClick={() => irAPeriodo(chip)}
                style={segmentoEstilo(activo)}
                className={segmentoClase(activo)}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Filtros de negocio */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar mt-2.5">
          {negociosDisponibles.map((negocio) => {
            const activo = selectedEntity === negocio.id;
            return (
              <button
                key={negocio.id}
                type="button"
                onClick={() => setSelectedEntity(negocio.id)}
                style={chipEstilo(activo)}
                className={chipClase(activo)}
              >
                {negocio.label}
              </button>
            );
          })}
        </div>

        {/* Búsqueda + tipo */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mt-5 pb-5 border-b border-[var(--border-soft)]">
          <div className="relative flex-1 max-w-[420px]">
            <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por concepto, categoría o notas..."
              className="w-full min-h-[44px] pl-11 pr-4 rounded-full bg-[var(--surface)] border border-[var(--border)] focus:border-[var(--accent)] placeholder:text-[var(--text-tertiary)] text-[var(--text)] outline-none text-[15px] transition-all"
            />
          </div>

          <div className="flex items-center gap-1 bg-[var(--surface)] p-1 rounded-[10px] border border-[var(--border)] self-start">
            {(
              [
                ['all', `Todos (${filteredTransactions.length})`],
                ['ingreso', 'Ingresos'],
                ['gasto', 'Gastos'],
              ] as [TransactionType | 'all', string][]
            ).map(([tipo, label]) => (
              <button
                key={tipo}
                type="button"
                onClick={() => setFilterType(tipo)}
                className={`h-8 px-3 rounded-[8px] text-[13px] transition-colors apple-pressable cursor-pointer ${
                  filterType === tipo
                    ? 'font-semibold'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text)]'
                }`}
                style={
                  filterType === tipo
                    ? { backgroundColor: 'var(--accent)', color: 'var(--accent-ink)' }
                    : undefined
                }
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Lista agrupada por día */}
        {loadingTransactions ? (
          <div className="apple-card text-center py-16 px-4 mt-6">
            <span className="w-6 h-6 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin inline-block mb-3" />
            <p className="text-[15px] text-[var(--text-secondary)]">
              Cargando transacciones desde Firestore...
            </p>
          </div>
        ) : displayedTransactions.length === 0 ? (
          <div className="apple-card text-center py-16 px-4 mt-6">
            <p className="text-[17px] font-semibold text-[var(--text)]">
              Sin movimientos en este período
            </p>
            <p className="text-[14px] text-[var(--text-secondary)] mt-1 max-w-[420px] mx-auto">
              Prueba con otro rango de fechas o registra un movimiento: también puedes escribirlo
              por Telegram y aparecerá aquí solo.
            </p>
            <button
              type="button"
              onClick={onOpenNewTransaction}
              className="apple-btn-primary mt-5 text-[14px] py-2 px-5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Registrar movimiento</span>
            </button>
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            {grupos.map((grupo) => (
              <section key={grupo.clave}>
                {/* Encabezado del día: pegajoso en escritorio */}
                <div className="sticky max-lg:static top-[96px] z-10 flex items-center justify-between gap-3 py-2 px-1 bg-[var(--bg)] border-b border-[var(--border)]">
                  <span className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--text-secondary)]">
                    {etiquetaDia(grupo.clave)}
                  </span>
                  <span
                    className={`num-list num-strong text-[13px] ${
                      grupo.neto >= 0 ? 'text-[var(--positive)]' : 'text-[var(--negative)]'
                    }`}
                  >
                    {grupo.neto >= 0 ? '+' : '−'}
                    {formatCurrency(Math.abs(grupo.neto))}
                  </span>
                </div>

                <div className="space-y-2 mt-2">
                  {grupo.items.map((tx) => {
                    const rawTipo = (tx.tipo || tx.type || 'gasto').toLowerCase();
                    const isIncome = rawTipo === 'ingreso' || rawTipo === 'income';
                    const titulo = tx.descripcion || tx.title || 'Sin concepto';
                    const monto = Number(tx.monto ?? tx.amount ?? 0);
                    const categoria = tx.categoria || tx.category || 'General';
                    const metodo = tx.paymentMethod || '';
                    const ms = parseFechaFirestore(tx.fecha || tx.date).ms;
                    const cuando = formatFechaRelativa(ms, true);

                    return (
                      <div
                        key={tx.id}
                        className="group flex min-h-[72px] items-center gap-3 px-4 py-3 rounded-[12px] border border-[var(--border)] bg-[var(--surface)] hover:border-[var(--control)] transition-colors"
                      >
                        {/* Dirección */}
                        <span
                          className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                          style={{
                            backgroundColor: isIncome
                              ? 'color-mix(in srgb, var(--positive) 15%, transparent)'
                              : 'color-mix(in srgb, var(--negative) 15%, transparent)',
                            color: isIncome ? 'var(--positive)' : 'var(--negative)',
                          }}
                        >
                          {isIncome ? (
                            <ArrowUpRight className="w-4 h-4" />
                          ) : (
                            <ArrowDownRight className="w-4 h-4" />
                          )}
                        </span>

                        {/* Descripción + metadata */}
                        <div className="min-w-0 flex-1">
                          <p className="text-[15px] font-semibold text-[var(--text)] truncate">
                            {titulo}
                          </p>
                          <p className="text-[13px] text-[var(--text-secondary)] truncate">
                            {categoria}
                            {metodo ? ` · ${metodo}` : ''} · {cuando}
                          </p>
                        </div>

                        {/* Monto */}
                        <span
                          className="num-list num-strong text-[20px] flex-shrink-0"
                          style={{ color: isIncome ? 'var(--positive)' : 'var(--negative)' }}
                        >
                          {isIncome ? '+' : '−'}
                          {formatCurrency(monto)}
                        </span>

                        {/* Acciones: al hover en escritorio, siempre visibles en táctil */}
                        <span className="flex items-center gap-0.5 flex-shrink-0 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={() => onEditTransaction(tx)}
                            title="Editar"
                            aria-label={`Editar ${titulo}`}
                            className="p-2.5 rounded-full text-[var(--text-secondary)] hover:bg-[var(--surface)] hover:text-[var(--text)] transition-colors cursor-pointer"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(`¿Eliminar "${titulo}"?`)) {
                                deleteTransaction(tx.id);
                              }
                            }}
                            title="Eliminar"
                            aria-label={`Eliminar ${titulo}`}
                            className="p-2.5 rounded-full text-[var(--text-secondary)] hover:bg-[#fff0f0] hover:text-[#ff3b30] transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}

            {/* Total del período */}
            <div
              className="apple-card bg-[var(--surface)]"
              style={{ borderTopWidth: 2, borderTopColor: 'var(--accent)' }}
            >
              <span className="block text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--text-secondary)]">
                Total del período
              </span>
              <div className="grid grid-cols-3 gap-3 mt-3">
                <div>
                  <span className="block text-[12px] text-[var(--text-secondary)]">Ingresos</span>
                  <span className="num-list num-strong text-[20px] text-[var(--positive)]">
                    {formatCurrency(totalesPeriodo.ingresos)}
                  </span>
                </div>
                <div>
                  <span className="block text-[12px] text-[var(--text-secondary)]">Gastos</span>
                  <span className="num-list num-strong text-[20px] text-[var(--negative)]">
                    {formatCurrency(totalesPeriodo.gastos)}
                  </span>
                </div>
                <div>
                  <span className="block text-[12px] text-[var(--text-secondary)]">Neto</span>
                  <span className="num-list num-bold text-[24px] text-[var(--text)]">
                    {formatCurrency(totalesPeriodo.ingresos - totalesPeriodo.gastos)}
                  </span>
                </div>
              </div>
              <p className="text-[12px] text-[var(--text-secondary)] mt-3">
                {labelPeriodo} · {filteredTransactions.length} movimiento
                {filteredTransactions.length === 1 ? '' : 's'}
              </p>
            </div>
          </div>
        )}

        {/* Utilidades: exportar / importar */}
        <div className="mt-12 pt-6 border-t border-[var(--border-soft)] flex flex-wrap items-center justify-between gap-4 text-[13px] text-[var(--text-secondary)]">
          <div className="flex items-center space-x-4">
            <button
              onClick={handleExport}
              className="flex items-center space-x-1 hover:text-[var(--text)] transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Exportar JSON desde Firestore</span>
            </button>

            <label className="flex items-center space-x-1 hover:text-[var(--text)] transition-colors cursor-pointer">
              <Upload className="w-3.5 h-3.5" />
              <span>Importar a Firestore</span>
              <input type="file" accept=".json" onChange={handleImport} className="hidden" />
            </label>
          </div>

          <span className="text-[12px] text-[var(--text-tertiary)]">
            Sincronización en tiempo real con Firestore activada
          </span>
        </div>
      </div>
    </div>
  );
};
