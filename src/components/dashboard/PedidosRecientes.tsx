import React, { useEffect, useState } from 'react';
import { useFinance } from '../../context/FinanceContext';
import {
  ESTADOS_PEDIDO,
  formatFechaPedido,
  getEstadoConfig,
  normalizeEstado,
} from '../../lib/pedidos';
import type { EstadoPedido } from '../../lib/pedidos';
import type { Pedido } from '../../types/finance';
import { AlertCircle, CheckCircle2, ChevronDown, Loader2, ShoppingBag } from 'lucide-react';

/** Máximo de pedidos que se guardan/consultan en la lista. */
const MAX_PEDIDOS = 10;
/** En móvil sólo se ven 3 filas; en escritorio 5 (el resto con "Ver todos"). */
const MAX_MOVIL = 3;
const MAX_ESCRITORIO = 5;

const ESTADO_BADGE_CLASS: Record<EstadoPedido, string> = {
  pendiente: 'bg-[#ff9500]/10 text-[#ff9500] border-[#ff9500]/30',
  entregado: 'bg-[#34c759]/10 text-[#34c759] border-[#34c759]/30',
  cancelado: 'bg-[#ff3b30]/10 text-[#ff3b30] border-[#ff3b30]/30',
};

export const PedidosRecientes: React.FC = () => {
  const { pedidos, pedidosDelPeriodo, labelPeriodo, loadingPedidos, errorPedidos, updatePedidoEstado } =
    useFinance();

  const [openId, setOpenId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [mostrarTodos, setMostrarTodos] = useState(false);
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

  // Los pedidos ya vienen ordenados por fecha descendente desde el hook;
  // pedidosDelPeriodo respeta el periodo activo (día/semana/mes/trimestre/año).
  const recientes = pedidosDelPeriodo.slice(0, mostrarTodos ? MAX_PEDIDOS : MAX_ESCRITORIO);
  const listos = pedidosDelPeriodo.filter((p) => normalizeEstado(p.estado) === 'entregado').length;
  const pendientes = pedidosDelPeriodo.filter((p) => normalizeEstado(p.estado) === 'pendiente').length;

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
    <div
      id="pedidos-recientes"
      className="w-full py-6 px-4 sm:py-12 sm:px-12 bg-transparent border-b border-white/5 transition-[outline] duration-300"
    >
      <div className="max-w-[1200px] mx-auto">
        <div className="apple-card bg-white">
          {/* Header: título + contadores + ver todos */}
          <div className="flex items-center justify-between gap-3 pb-4 border-b border-[#f0f0f0]">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-[#2997ff] flex-shrink-0" />
                <h3 className="text-[17px] font-semibold tracking-[-0.2px] text-[#1d1d1f] truncate">
                  PEDIDOS DE HOY
                </h3>
                <span className="num-list text-[12px] px-2 py-0.5 rounded-full bg-[#34c759]/10 text-[#34c759] border border-[#34c759]/30 flex-shrink-0">
                  {listos} listos
                </span>
              </div>
              <p className="text-[12px] text-[#7a7a7a] mt-1 truncate">
                {labelPeriodo} · {pedidosDelPeriodo.length} en el periodo
                {pendientes > 0 ? ` · ${pendientes} pendiente${pendientes === 1 ? '' : 's'}` : ''}
              </p>
            </div>

            {(pedidosDelPeriodo.length > MAX_MOVIL || mostrarTodos) && (
              <button
                type="button"
                onClick={() => setMostrarTodos((prev) => !prev)}
                className="text-[13px] font-medium text-[#0066cc] hover:underline flex-shrink-0 cursor-pointer"
              >
                {mostrarTodos ? 'Ver menos' : 'Ver todos →'}
              </button>
            )}
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
              <p className="text-[17px] font-semibold text-[#1d1d1f]">
                {pedidos.length === 0 ? 'Aún no hay pedidos web' : `Sin pedidos en ${labelPeriodo}`}
              </p>
              <p className="text-[14px] text-[#7a7a7a] mt-1 max-w-[420px] mx-auto">
                Cuando tu página de hamburguesas registre un pedido en la colección 'pedidos',
                aparecerá aquí automáticamente.
              </p>
            </div>
          ) : (
            <div>
              {recientes.map((pedido, indice) => {
                const estadoConfig = getEstadoConfig(pedido.estado);
                const cancelado = estadoConfig.value === 'cancelado';
                const esPendiente = estadoConfig.value === 'pendiente';
                const isSaving = savingId === pedido.id;
                const isOpen = openId === pedido.id;

                return (
                  <div
                    key={pedido.id}
                    data-pendiente={esPendiente}
                    className={`flex items-center gap-3 px-1 py-3 border-b border-[#f5f5f7] transition-colors ${
                      indice >= MAX_MOVIL && !mostrarTodos ? 'hidden sm:flex' : 'flex'
                    }`}
                  >
                    {/* Hora relativa */}
                    <span className="w-16 flex-shrink-0 text-[12px] text-[#8e8e93]">
                      {formatFechaPedido(pedido.fechaMs, pedido.tieneHora)}
                    </span>

                    {/* Cliente + dirección */}
                    <div className="min-w-0 flex-1">
                      <p
                        className={`text-[15px] font-semibold truncate ${
                          cancelado ? 'text-[#8e8e93] line-through' : 'text-[#1d1d1f]'
                        }`}
                      >
                        {pedido.cliente}
                      </p>
                      <p className="text-[12px] text-[#7a7a7a] truncate">
                        {pedido.clienteDireccion || (pedido.modalidad === 'pickup' ? 'Para recoger' : 'Sin dirección')}
                      </p>
                    </div>

                    {/* Estado: badge con dropdown */}
                    <div className="relative flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => setOpenId(isOpen ? null : pedido.id)}
                        disabled={isSaving}
                        aria-haspopup="listbox"
                        aria-expanded={isOpen}
                        className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full border text-[12px] font-semibold transition-all apple-pressable cursor-pointer disabled:opacity-60 disabled:cursor-wait ${
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
                        <span className="hidden sm:inline">{estadoConfig.label}</span>
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
                            className="absolute right-0 top-9 z-30 w-40 bg-white border border-[#e0e0e0] rounded-[14px] p-1.5 animate-fade-in"
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

                    {/* Monto */}
                    <span
                      className={`num-list text-[20px] font-medium w-[74px] sm:w-[92px] text-right flex-shrink-0 ${
                        cancelado ? 'text-[#8e8e93] line-through' : 'text-[#34c759]'
                      }`}
                    >
                      {formatCurrency(pedido.total)}
                    </span>
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
          className={`fixed bottom-6 right-6 z-50 flex items-center space-x-2.5 px-4 py-3 rounded-[14px] text-[14px] text-white animate-fade-in ${
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
