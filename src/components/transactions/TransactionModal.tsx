import React, { useState, useEffect } from 'react';
import { useFinance } from '../../context/FinanceContext';
import type { Transaction, EntityType, TransactionType, PaymentMethod } from '../../types/finance';
import { X } from 'lucide-react';

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingTransaction?: Transaction | null;
}

export const TransactionModal: React.FC<TransactionModalProps> = ({
  isOpen,
  onClose,
  editingTransaction,
}) => {
  const { categories, addTransaction, updateTransaction, selectedEntity } = useFinance();

  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState<number | ''>('');
  const [type, setType] = useState<TransactionType>('gasto');
  const [entity, setEntity] = useState<EntityType>('hamburguesas');
  const [category, setCategory] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('transferencia');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Available categories for selected entity and type
  const availableCategories = categories.filter(
    (c) => (c.entity === entity || c.entity === 'all') && c.type === type
  );

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
      setType('gasto');
      const defaultEnt = selectedEntity !== 'all' ? selectedEntity : 'hamburguesas';
      setEntity(defaultEnt);
      setDate(new Date().toISOString().split('T')[0]);
      setPaymentMethod('transferencia');
      setNotes('');
    }
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
      <div className="bg-[#ffffff] rounded-[24px] max-w-[540px] w-full p-6 sm:p-8 border border-[#e0e0e0] shadow-2xl relative max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#f0f0f0]">
          <div>
            <h3 className="text-[22px] font-semibold text-[#1d1d1f] tracking-[-0.28px]">
              {editingTransaction ? 'Editar Movimiento' : 'Registrar Ingreso o Gasto'}
            </h3>
            <p className="text-[13px] text-[#7a7a7a] mt-0.5">
              Personal, Hamburguesas o reventa de AirPods
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#f5f5f7] hover:bg-[#e0e0e0] flex items-center justify-center text-[#1d1d1f] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          {/* 1. Type Switcher: Income vs Expense (Apple style segment) */}
          <div>
            <label className="block text-[13px] font-semibold text-[#1d1d1f] mb-2">
              Tipo de Movimiento
            </label>
            <div className="grid grid-cols-2 gap-2 bg-[#f5f5f7] p-1 rounded-full border border-[#e0e0e0]">
              <button
                type="button"
                onClick={() => setType('gasto')}
                className={`py-2 text-[14px] rounded-full font-medium transition-all cursor-pointer ${
                  type === 'gasto'
                    ? 'bg-[#ffffff] text-[#ff3b30] shadow-sm font-semibold'
                    : 'text-[#7a7a7a] hover:text-[#1d1d1f]'
                }`}
              >
                Gasto / Salida
              </button>
              <button
                type="button"
                onClick={() => setType('ingreso')}
                className={`py-2 text-[14px] rounded-full font-medium transition-all cursor-pointer ${
                  type === 'ingreso'
                    ? 'bg-[#ffffff] text-[#0066cc] shadow-sm font-semibold'
                    : 'text-[#7a7a7a] hover:text-[#1d1d1f]'
                }`}
              >
                Ingreso / Entrada
              </button>
            </div>
          </div>

          {/* 2. Entity Selector */}
          <div>
            <label className="block text-[13px] font-semibold text-[#1d1d1f] mb-2">
              Cuenta o Negocio
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'hamburguesas', label: 'Hamburguesas' },
                { id: 'airpods', label: 'AirPods' },
                { id: 'personal', label: 'Personal' },
              ].map((ent) => (
                <button
                  key={ent.id}
                  type="button"
                  onClick={() => setEntity(ent.id as EntityType)}
                  className={`py-2 px-3 text-[13px] rounded-full border text-center transition-all ${
                    entity === ent.id
                      ? 'border-[#0071e3] bg-[#0066cc]/5 text-[#0066cc] font-semibold'
                      : 'border-[#e0e0e0] bg-white text-[#1d1d1f] hover:bg-[#f5f5f7]'
                  }`}
                >
                  {ent.label}
                </button>
              ))}
            </div>
          </div>

          {/* 3. Title / Concept */}
          <div>
            <label className="block text-[13px] font-semibold text-[#1d1d1f] mb-1.5">
              Concepto / Descripción
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej. Compra de carne molida, Venta 2 AirPods Pro..."
              className="w-full text-[15px] px-4 py-2.5 rounded-[12px] bg-[#f5f5f7] border border-[#e0e0e0] focus:border-[#0071e3] focus:bg-white outline-none transition-all"
            />
          </div>

          {/* 4. Amount ($ MXN) */}
          <div>
            <label className="block text-[13px] font-semibold text-[#1d1d1f] mb-1.5">
              Monto ($ MXN)
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[18px] text-[#7a7a7a] font-semibold">
                $
              </span>
              <input
                type="number"
                step="any"
                min="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="0.00"
                className="w-full text-[20px] font-semibold pl-9 pr-4 py-2.5 rounded-[12px] bg-[#f5f5f7] border border-[#e0e0e0] focus:border-[#0071e3] focus:bg-white outline-none transition-all"
              />
            </div>
          </div>

          {/* 5. Category (Contextual) & Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[13px] font-semibold text-[#1d1d1f] mb-1.5">
                Categoría
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full text-[14px] px-3.5 py-2.5 rounded-[12px] bg-[#f5f5f7] border border-[#e0e0e0] focus:border-[#0071e3] focus:bg-white outline-none transition-all cursor-pointer"
              >
                {availableCategories.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
                {availableCategories.length === 0 && (
                  <option value="General">General</option>
                )}
              </select>
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#1d1d1f] mb-1.5">
                Fecha
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full text-[14px] px-3.5 py-2.5 rounded-[12px] bg-[#f5f5f7] border border-[#e0e0e0] focus:border-[#0071e3] focus:bg-white outline-none transition-all"
              />
            </div>
          </div>

          {/* 6. Payment Method */}
          <div>
            <label className="block text-[13px] font-semibold text-[#1d1d1f] mb-1.5">
              Método de Pago
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'transferencia', label: 'Transferencia' },
                { id: 'efectivo', label: 'Efectivo' },
                { id: 'tarjeta', label: 'Tarjeta' },
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setPaymentMethod(m.id as PaymentMethod)}
                  className={`py-2 text-[13px] rounded-full border text-center transition-all ${
                    paymentMethod === m.id
                      ? 'border-[#1d1d1f] bg-[#1d1d1f] text-white font-medium'
                      : 'border-[#e0e0e0] bg-[#f5f5f7] text-[#1d1d1f] hover:bg-[#e0e0e0]'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* 7. Notes (Optional) */}
          <div>
            <label className="block text-[13px] font-semibold text-[#1d1d1f] mb-1.5">
              Notas adicionales (opcional)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Detalles de cliente, proveedor, factura o referencia..."
              className="w-full text-[14px] px-3.5 py-2.5 rounded-[12px] bg-[#f5f5f7] border border-[#e0e0e0] focus:border-[#0071e3] focus:bg-white outline-none transition-all resize-none"
            />
          </div>

          {/* Actions */}
          <div className="pt-4 flex items-center justify-end space-x-3 border-t border-[#f0f0f0]">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-full text-[15px] text-[#1d1d1f] hover:bg-[#f5f5f7] transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="apple-btn-primary px-7 py-2.5 text-[15px] disabled:opacity-50"
            >
              {submitting ? 'Guardando...' : editingTransaction ? 'Guardar Cambios' : 'Registrar Movimiento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
