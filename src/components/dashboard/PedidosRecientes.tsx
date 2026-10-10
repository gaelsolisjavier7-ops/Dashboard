import React, { useEffect, useState } from 'react';
import { useFinance } from '../../context/FinanceContext';
import type { Pedido } from '../../types/finance';
import {
  ESTADOS_PEDIDO,
  formatFechaPedido,
  getEstadoConfig,
  normalizeEstado,
} from '../../lib/pedidos';
import type { EstadoPedido } from '../../lib/pedidos';
import { AlertCircle, CheckCircle2, ChevronDown, Loader2, ShoppingBag } from 'lucide-react';

const MAX_PEDIDOS = 10;

/** Clases de color del badge por estado (naranja / verde / rojo). */
const ESTADO_BADGE_CLASS: Record<EstadoPedido, string> = {
  pendiente: 'bg-[#ff9500]/10 text-[#ff9500] border-[#ff9500]/30',
  entregado: 'bg-[#34c759]/10 text-[#34c759] border-[#34c759]/30',
  cancelado: 'bg-[#ff3b30]/10 text-[#ff3b30] border-[#ff3b30]/30',
};

export const PedidosRecientes: React.FC = () => {
  const { pedidos, loadingPedidos, errorPedidos, updatePedidoEstado } = useFinance();

  const [openId, setOpenId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(
    null
  );

  useEffect(() => {
    if (!feedback) return;
    const timer = setTimeout(() => setFeedback(null), 4000);
    return () => clearTimeout(timer);
  }, [feedback]);

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      maximumFractionDigits: 0,
    }).format(val || 0);

  // Los pedidos ya vienen ordenados por fecha descendente desde el hook
  const recientes = pedidos.slice(0, MAX_PEDIDOS);

  const handleChange = async (pedido: Pedido, nuevoEstado: EstadoPedido) => {
    setOpenId(null);
    if (normalizeEstado(pedido.estado) === nuevoEstado) return;

    setSavingId(pedido.id);
    try {
      await updatePedidoEstado(pedido.id, nuevoEstado, pedido.estado);
      setFeedback({
        message: `Pedido de ${pedido.cliente} → ${getEstadoConfig(nuevoEstado).label}`,
        type: 'success',
      });
    } catch (err: unknown) {
      const e = err as { message?: string };
      console.error('Error al actualizar el estado del pedido:', err);
      setFeedback({
        message: e?.message || 'No se pudo actualizar el estado en Firestore.',
        type: 'error',
      });
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="w-full py-12 px-6 sm:px-12 bg-[#f5f5f7] border-b border-[#e0e0e0]">
      <div className="max-w-[1200px] mx-auto">
        <div className="apple-card bg-white">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-[#f0f0f0]">
            <div>
              <div className="flex items-center space-x-2">
                <ShoppingBag className="w-4 h-4 text-[#2997ff]" />
                <h3 className="text-[21px] font-semibold tracking-[-0.28px] text-[#1d1d1f]">
                  Pedidos Web Recientes
                </h3>
              </div>
              <p className="text-[14px] text-[#7a7a7a] mt-0.5">
                Últimos {Math.min(MAX_PEDIDOS, recientes.length) || MAX_PEDIDOS} pedidos de la
                colección 'pedidos'. Cambia el estado directamente desde aquí.
              </p>
            </div>

            <span className="text-[13px] text-[#7a7a7a] bg-[#f5f5f7] rounded-full px-3 py-1.5 self-start sm:self-auto whitespace-nowrap">
              {pedidos.length} pedido{pedidos.length === 1 ? '' : 's'} en total
            </span>
          </div>

          {/* Estados de carga / error / vacío */}
          {loadingPedidos && pedidos.length === 0 ? (
            <div className="py-14 text-center">
              <Loader2 className="w-6 h-6 text-[#0066cc] animate-spin inline-block mb-3" />
              <p className="text-[15px] text-[#7a7a7a]">Cargando pedidos desde Firestore...</p>
            </div>
          ) : errorPedidos ? (
            <div className="mt-5 flex items-start space-x-2 p-4 rounded-[12px] bg-[#ff3b30]/5 border border-[#ff3b30]/20">
              <AlertCircle className="w-4 h-4 text-[#ff3b30] flex-shrink-0 mt-0.5" />
              <p className="text-[14px] text-[#ff3b30]">
                No se pudieron leer los pedidos: {errorPedidos.message}
              </p>
            </div>
          ) : recientes.length === 0 ? (
            <div className="py-14 text-center px-4">
              <p className="text-[17px] font-semibold text-[#1d1d1f]">Aún no hay pedidos web</p>
              <p className="text-[14px] text-[#7a7a7a] mt-1 max-w-[420px] mx-auto">
                Cuando tu página de hamburguesas registre un pedido en la colección 'pedidos',
                aparecerá aquí automáticamente.
              </p>
            </div>
          ) : (
            <div className="mt-2">
              {/* Encabezado de columnas (solo escritorio) */}
              <div className="hidden sm:grid grid-cols-12 gap-4 px-4 py-2.5 text-[12px] font-semibold uppercase tracking-wide text-[#7a7a7a]">
                <span className="col-span-3">Fecha</span>
                <span className="col-span-4">Cliente</span>
                <span className="col-span-3">Estado</span>
                <span className="col-span-2 text-right">Total</span>
              </div>

              {recientes.map((pedido) => {
                const estadoConfig = getEstadoConfig(pedido.estado);
                const cancelado = estadoConfig.value === 'cancelado';
                const isSaving = savingId === pedido.id;
                const isOpen = openId === pedido.id;

                return (
                  <div
                    key={pedido.id}
                    className="grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-4 items-center px-4 py-3.5 border-t border-[#f5f5f7] hover:bg-[#fafafc] transition-colors"
                  >
                    {/* Fecha */}
                    <div className="sm:col-span-3 flex items-center justify-between sm:justify-start gap-2">
                      <span className="sm:hidden text-[12px] font-semibold uppercase tracking-wide text-[#7a7a7a]">
                        Fecha
                      </span>
                      <span
                        className={`text-[14px] ${cancelado ? 'text-[#8e8e93]' : 'text-[#1d1d1f]'}`}
                      >
                        {formatFechaPedido(pedido.fechaMs, pedido.tieneHora)}
                      </span>
                    </div>

                    {/* Cliente */}
                    <div className="sm:col-span-4 flex items-center justify-between sm:justify-start gap-2 min-w-0">
                      <span className="sm:hidden text-[12px] font-semibold uppercase tracking-wide text-[#7a7a7a]">
                        Cliente
                      </span>
                      <span
                        className={`text-[15px] font-medium truncate ${
                          cancelado ? 'text-[#8e8e93]' : 'text-[#1d1d1f]'
                        }`}
                      >
                        {pedido.cliente}
                      </span>
                    </div>

                    {/* Estado: badge con dropdown */}
                    <div className="sm:col-span-3 flex items-center justify-between sm:justify-start gap-2">
                      <span className="sm:hidden text-[12px] font-semibold uppercase tracking-wide text-[#7a7a7a]">
                        Estado
                      </span>

                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setOpenId(isOpen ? null : pedido.id)}
                          disabled={isSaving}
                          aria-haspopup="listbox"
                          aria-expanded={isOpen}
                          className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full border text-[13px] font-semibold transition-all apple-pressable cursor-pointer disabled:opacity-60 disabled:cursor-wait ${
                            ESTADO_BADGE_CLASS[estadoConfig.value]
                          }`}
                        >
                          {isSaving ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <span
                              className="w-1.5 h-1.5 rounded-full"
                              style={{ backgroundColor: estadoConfig.color }}
                            />
                          )}
                          <span>{estadoConfig.label}</span>
                          <ChevronDown
                            className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                          />
                        </button>

                        {isOpen && (
                          <>
                            {/* Capa para cerrar al hacer click fuera */}
                            <div
                              className="fixed inset-0 z-20"
                              onClick={() => setOpenId(null)}
                              aria-hidden="true"
                            />
                            <div
                              role="listbox"
                              className="absolute left-0 top-9 z-30 w-40 bg-white border border-[#e0e0e0] rounded-[14px] shadow-xl p-1.5 animate-fade-in"
                            >
                              {ESTADOS_PEDIDO.map((opcion) => {
                                const activo = opcion.value === estadoConfig.value;
                                return (
                                  <button
                                    key={opcion.value}
                                    type="button"
                                    role="option"
                                    aria-selected={activo}
                                    onClick={() => handleChange(pedido, opcion.value)}
                                    className={`w-full flex items-center space-x-2 px-3 py-2 rounded-[9px] text-[13px] text-left transition-colors cursor-pointer ${
                                      activo
                                        ? 'bg-[#f5f5f7] font-semibold text-[#1d1d1f]'
                                        : 'text-[#1d1d1f] hover:bg-[#f5f5f7]'
                                    }`}
                                  >
                                    <span
                                      className="w-2 h-2 rounded-full flex-shrink-0"
                                      style={{ backgroundColor: opcion.color }}
                                    />
                                    <span className="flex-1">{opcion.label}</span>
                                    {activo && <CheckCircle2 className="w-3.5 h-3.5 text-[#7a7a7a]" />}
                                  </button>
                                );
                              })}
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Total */}
                    <div className="sm:col-span-2 flex items-center justify-between sm:justify-end gap-2">
                      <span className="sm:hidden text-[12px] font-semibold uppercase tracking-wide text-[#7a7a7a]">
                        Total
                      </span>
                      <span
                        className={`text-[16px] font-semibold tracking-tight ${
                          cancelado ? 'text-[#8e8e93] line-through' : 'text-[#1d1d1f]'
                        }`}
                      >
                        {formatCurrency(pedido.total)}
                      </span>
                    </div>
                  </div>
                );
              })}

              <p className="text-[12px] text-[#8e8e93] pt-4">
                Los pedidos cancelados se muestran pero no se suman a los ingresos.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Toast de confirmación / error */}
      {feedback && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center space-x-2.5 px-4 py-3 rounded-[14px] shadow-2xl text-[14px] text-white animate-fade-in ${
            feedback.type === 'success'
              ? 'bg-[#1d1d1f] border border-[#34c759]/60'
              : 'bg-[#1d1d1f] border border-[#ff3b30]/60'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-[#34c759] flex-shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-[#ff3b30] flex-shrink-0" />
          )}
          <span className="font-medium text-[13px]">{feedback.message}</span>
        </div>
      )}
    </div>
  );
};
