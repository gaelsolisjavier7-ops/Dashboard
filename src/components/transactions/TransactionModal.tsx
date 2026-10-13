import React, { useState, useEffect, useMemo } from 'react';
import { useFinance } from '../../context/FinanceContext';
import { useAuth } from '../../context/AuthContext';
import { negocioDeSeccion, puedeVerNegocio } from '../../lib/roles';
import { MENU_DATA } from '../../lib/products';
import type { Transaction, EntityType, TransactionType, PaymentMethod } from '../../types/finance';
import { X } from 'lucide-react';

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingTransaction?: Transaction | null;
}

/** Atajos de monto: lo más importante para registrar en un toque. */
const MONTOS_RAPIDOS = [100, 150, 200, 250, 300, 400];

/** Nombre corto para los botones de producto: "Burger Especial" → "Especial". */
const nombreCorto = (nombre: string) =>
  nombre.replace(/^Burger\s+/i, '').replace(/^Hot Dog\s+/i, '');

/**
 * Suma un producto a la descripción llevando el conteo:
 * "1× Sencilla" → "2× Sencilla" → "2× Sencilla, 1× Papas".
 * Es sólo texto en el campo existente (sin campos nuevos en Firestore).
 */
function agregarItem(texto: string, nombre: string): string {
  const partes = texto
    .split(',')
    .map((parte) => parte.trim())
    .filter(Boolean);
  const indice = partes.findIndex(
    (parte) => parte.replace(/^\d+\s*×\s*/, '').trim().toLowerCase() === nombre.toLowerCase()
  );

  if (indice >= 0) {
    const cantidad = Number(/^(\d+)/.exec(partes[indice])?.[1] ?? 1) + 1;
    partes[indice] = `${cantidad}× ${nombre}`;
  } else {
    partes.push(`1× ${nombre}`);
  }
  return partes.join(', ');
}

export const TransactionModal: React.FC<TransactionModalProps> = ({
  isOpen,
  onClose,
  editingTransaction,
}) => {
  const { categories, addTransaction, updateTransaction, selectedEntity } = useFinance();
  const { rol } = useAuth();

  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState<number | ''>('');
  // Por defecto "Pedido" (ingreso): el 90% de los registros manuales son ventas
  const [type, setType] = useState<TransactionType>('ingreso');
  const [entity, setEntity] = useState<EntityType>('hamburguesas');
  const [category, setCategory] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('transferencia');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [hotDogsAbiertos, setHotDogsAbiertos] = useState(false);

  // Available categories for selected entity and type
  const availableCategories = categories.filter(
    (c) => (c.entity === entity || c.entity === 'all') && c.type === type
  );

  // Chips de negocio filtrados por rol (usa el helper de permisos existente)
  const negociosDisponibles = useMemo(
    () =>
      [
        { id: 'hamburguesas' as EntityType, label: 'Hamburguesas' },
        { id: 'airpods' as EntityType, label: 'AirPods' },
        { id: 'personal' as EntityType, label: 'Personal' },
      ].filter((negocio) => puedeVerNegocio(rol, negocio.id)),
    [rol]
  );

  // Productos rápidos del menú (sólo para hamburguesas)
  const productosPrincipales = useMemo(
    () => MENU_DATA.filter((p) => p.categoria === 'burgers' || p.categoria === 'extras'),
    []
  );
  const hotDogs = useMemo(() => MENU_DATA.filter((p) => p.categoria === 'hotdogs'), []);

  // Initialize form when editing or opening
  useEffect(() => {
    if (editingTransaction) {
      setTitle(editingTransaction.descripcion || editingTransaction.title || '');
      setAmount(editingTransaction.monto ?? editingTransaction.amount ?? '');
      setType(editingTransaction.tipo === 'ingreso' ? 'ingreso' : 'gasto');
      setEntity(editingTransaction.negocio || editingTransaction.entity || 'hamburguesas');
      setCategory(editingTransaction.categoria || editingTransaction.category || '');
      setDate(editingTransaction.fecha || editingTransaction.date || new Date().toISOString().split('T')[0]);
      setPaymentMethod(editingTransaction.paymentMethod || 'transferencia');
      setNotes(editingTransaction.notes || '');
    } else {
      setTitle('');
      setAmount('');
      setType('ingreso');
      // La sección activa puede ser Insumos/Recetas/Consolidado: en ese caso el
      // movimiento se registra por defecto en hamburguesas.
      const defaultEnt: EntityType = negocioDeSeccion(selectedEntity) ?? 'hamburguesas';
      setEntity(defaultEnt);
      setDate(new Date().toISOString().split('T')[0]);
      setPaymentMethod('transferencia');
      setNotes('');
    }
    setHotDogsAbiertos(false);
  }, [editingTransaction, isOpen, selectedEntity]);

  // Update category when available categories change
  useEffect(() => {
    if (availableCategories.length > 0 && !availableCategories.find((c) => c.name === category)) {
      setCategory(availableCategories[0].name);
    }
  }, [entity, type, availableCategories, category]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !amount || Number(amount) <= 0) return;

    setSubmitting(true);
    try {
      const payload = {
        fecha: date,
        tipo: type,
        categoria: category || availableCategories[0]?.name || 'General',
        monto: Number(amount),
        descripcion: title.trim(),
        negocio: entity,
        title: title.trim(),
        amount: Number(amount),
        type,
        entity,
        category: category || availableCategories[0]?.name || 'General',
        date,
        paymentMethod,
        notes: notes.trim(),
      };

      if (editingTransaction) {
        await updateTransaction({
          ...editingTransaction,
          ...payload,
        });
      } else {
        await addTransaction(payload);
      }
      onClose();
    } catch (err) {
      console.error('Error guardando transacción:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const montoNumero = Number(amount) || 0;
  const montoTexto = new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(montoNumero);
  // Mismo criterio que handleSubmit (descripción + monto > 0)
  const puedeGuardar = title.trim() !== '' && montoNumero > 0 && !submitting;

  const agregarProducto = (nombre: string, precio: number) => {
    setAmount(montoNumero + precio);
    setTitle((previo) => agregarItem(previo, nombreCorto(nombre)));
  };

  const inputClase =
    'w-full text-[15px] min-h-[48px] px-3.5 rounded-[12px] bg-[var(--surface-inset)] border border-[var(--border)] text-[var(--text)] focus:border-[var(--accent)] outline-none transition-colors';
  const labelClase =
    'block text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-secondary)] mb-2';

  return (
    <div className="fixed inset-0 z-50 flex items-stretch sm:items-center justify-center bg-black/70 backdrop-blur-md sm:p-4">
      <div className="w-full sm:max-w-[520px] h-full sm:h-auto sm:max-h-[92vh] bg-[var(--surface)] sm:rounded-[24px] border-0 sm:border sm:border-[var(--border)] flex flex-col overflow-hidden">
        {/* Header (sticky en móvil: va fijo arriba del panel flex) */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-[var(--border)] flex-shrink-0">
          <h3 className="text-[20px] font-semibold tracking-[-0.28px] text-[var(--text)]">
            {editingTransaction ? 'Editar Registro' : 'Nuevo Registro'}
          </h3>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="w-9 h-9 rounded-full bg-[var(--surface-elevated)] hover:bg-[var(--border)] flex items-center justify-center text-[var(--text)] transition-colors cursor-pointer flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
            {/* 1. Tipo: Pedido (ingreso) vs Gasto */}
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'ingreso' as TransactionType, label: '🛒 Pedido' },
                { id: 'gasto' as TransactionType, label: '💸 Gasto' },
              ].map((opcion) => {
                const activo = type === opcion.id;
                return (
                  <button
                    key={opcion.id}
                    type="button"
                    onClick={() => setType(opcion.id)}
                    style={
                      activo
                        ? { backgroundColor: 'var(--accent)', color: 'var(--accent-ink)' }
                        : undefined
                    }
                    className={`min-h-[48px] rounded-[12px] text-[15px] font-semibold transition-colors cursor-pointer border ${
                      activo
                        ? 'border-transparent'
                        : 'bg-[var(--surface-elevated)] border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text)]'
                    }`}
                  >
                    {opcion.label}
                  </button>
                );
              })}
            </div>

            {/* 2. Unidad de negocio (filtrada por rol) */}
            <div>
              <label className={labelClase}>Unidad de negocio</label>
              <div className="flex gap-2 overflow-x-auto no-scrollbar">
                {negociosDisponibles.map((negocio) => {
                  const activo = entity === negocio.id;
                  return (
                    <button
                      key={negocio.id}
                      type="button"
                      onClick={() => setEntity(negocio.id)}
                      style={
                        activo
                          ? {
                              borderColor: 'var(--accent)',
                              color: 'var(--accent)',
                              backgroundColor: 'color-mix(in srgb, var(--accent) 12%, transparent)',
                            }
                          : undefined
                      }
                      className={`flex-1 min-w-[104px] min-h-[48px] px-3 rounded-full border text-[13px] text-center transition-colors cursor-pointer ${
                        activo
                          ? 'font-semibold'
                          : 'border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--text-secondary)] hover:text-[var(--text)]'
                      }`}
                    >
                      {negocio.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3. Monto grande */}
            <div>
              <label className={`${labelClase} text-center`}>Monto total</label>
              <input
                type="number"
                step="any"
                min="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="$0.00"
                className="num-input num-hero w-full bg-transparent text-center text-[44px] leading-tight text-[var(--text)] outline-none border-0 border-b border-[var(--border)] focus:border-[var(--accent)] pb-2 transition-colors"
              />
            </div>

            {/* 4. Montos rápidos */}
            <div className="grid grid-cols-3 gap-2">
              {MONTOS_RAPIDOS.map((monto) => (
                <button
                  key={monto}
                  type="button"
                  onClick={() => setAmount(monto)}
                  style={
                    montoNumero === monto
                      ? {
                          borderColor: 'var(--accent)',
                          color: 'var(--accent)',
                          backgroundColor: 'color-mix(in srgb, var(--accent) 12%, transparent)',
                        }
                      : undefined
                  }
                  className={`num-list min-h-[44px] rounded-[12px] border text-[16px] font-medium transition-colors cursor-pointer ${
                    montoNumero === monto
                      ? 'font-semibold'
                      : 'border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--text)] hover:border-[var(--accent)]'
                  }`}
                >
                  ${monto}
                </button>
              ))}
            </div>

            {/* 5. Productos rápidos (sólo hamburguesas) */}
            {entity === 'hamburguesas' && (
              <div>
                <label className={labelClase}>Productos rápidos</label>
                <div className="grid grid-cols-2 gap-2">
                  {productosPrincipales.map((producto) => (
                    <button
                      key={producto.id}
                      type="button"
                      onClick={() => agregarProducto(producto.nombre, producto.precio)}
                      className="min-h-[44px] px-3 rounded-[12px] border border-[var(--border)] bg-[var(--surface-elevated)] text-[13px] text-[var(--text)] hover:border-[var(--accent)] transition-colors cursor-pointer flex items-center justify-between gap-2"
                    >
                      <span className="truncate">
                        {producto.categoria === 'extras' ? '🍟' : '🍔'} {nombreCorto(producto.nombre)}
                      </span>
                      <span className="num-list text-[13px] text-[var(--text-secondary)] flex-shrink-0">
                        ${producto.precio}
                      </span>
                    </button>
                  ))}

                  {/* Hot dogs: un toque despliega la lista */}
                  <button
                    type="button"
                    onClick={() => setHotDogsAbiertos((previo) => !previo)}
                    aria-expanded={hotDogsAbiertos}
                    className="min-h-[44px] px-3 col-span-2 rounded-[12px] border border-dashed border-[var(--border)] text-[13px] text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors cursor-pointer"
                  >
                    🌭 Hot Dogs {hotDogsAbiertos ? '▴' : '▾'}
                  </button>

                  {hotDogsAbiertos &&
                    hotDogs.map((producto) => (
                      <button
                        key={producto.id}
                        type="button"
                        onClick={() => agregarProducto(producto.nombre, producto.precio)}
                        className="min-h-[44px] px-3 rounded-[12px] border border-[var(--border)] bg-[var(--surface-elevated)] text-[13px] text-[var(--text)] hover:border-[var(--accent)] transition-colors cursor-pointer flex items-center justify-between gap-2"
                      >
                        <span className="truncate">🌭 {nombreCorto(producto.nombre)}</span>
                        <span className="num-list text-[13px] text-[var(--text-secondary)] flex-shrink-0">
                          ${producto.precio}
                        </span>
                      </button>
                    ))}
                </div>
                <p className="text-[11px] text-[var(--text-muted)] mt-2">
                  Tocar un producto suma su precio al monto y lo agrega a la descripción.
                </p>
              </div>
            )}

            {/* 6. Descripción / items */}
            <div>
              <label className={labelClase}>Descripción / items</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej: 2× Sencilla + Papas"
                className={inputClase}
              />
            </div>

            {/* 7. Categoría */}
            <div>
              <label className={labelClase}>Categoría</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className={`${inputClase} cursor-pointer`}>
                {availableCategories.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
                {availableCategories.length === 0 && <option value="General">General</option>}
              </select>
            </div>

            {/* 8. Método de pago */}
            <div>
              <label className={labelClase}>Método de pago</label>
              <div className="flex gap-2 overflow-x-auto no-scrollbar">
                {[
                  { id: 'transferencia' as PaymentMethod, label: 'Transferencia' },
                  { id: 'efectivo' as PaymentMethod, label: 'Efectivo' },
                  { id: 'tarjeta' as PaymentMethod, label: 'Tarjeta' },
                ].map((metodo) => {
                  const activo = paymentMethod === metodo.id;
                  return (
                    <button
                      key={metodo.id}
                      type="button"
                      onClick={() => setPaymentMethod(metodo.id)}
                      style={
                        activo
                          ? {
                              borderColor: 'var(--accent)',
                              color: 'var(--accent)',
                              backgroundColor: 'color-mix(in srgb, var(--accent) 12%, transparent)',
                            }
                          : undefined
                      }
                      className={`flex-1 min-w-[104px] min-h-[48px] px-3 rounded-full border text-[13px] text-center transition-colors cursor-pointer ${
                        activo
                          ? 'font-semibold'
                          : 'border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--text-secondary)] hover:text-[var(--text)]'
                      }`}
                    >
                      {metodo.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 9. Fecha */}
            <div>
              <label className={labelClase}>Fecha</label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={`${inputClase} cursor-pointer`}
              />
            </div>

            {/* 10. Notas (campo existente, se mantiene) */}
            <div>
              <label className={labelClase}>Notas (opcional)</label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Cliente, proveedor, factura o referencia..."
                className={`${inputClase} resize-none py-3`}
              />
            </div>
          </div>

          {/* Footer sticky con el botón Guardar */}
          <div className="flex-shrink-0 border-t border-[var(--border)] bg-[var(--surface)] px-5 py-4">
            <button
              type="submit"
              disabled={!puedeGuardar}
              style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-ink)' }}
              className="w-full h-14 rounded-full text-[16px] font-bold transition-opacity disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              {submitting ? 'Guardando...' : `Guardar ${montoTexto}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
