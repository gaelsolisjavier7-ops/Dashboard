import React, { useMemo, useState } from 'react';
import { useFinance } from '../../context/FinanceContext';
import { normalizeEstado } from '../../lib/pedidos';
import { Bell, ChevronRight } from 'lucide-react';

const formatoMXN = (valor: number) =>
  new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    maximumFractionDigits: 0,
  }).format(valor || 0);

/**
 * Banda de alerta para pedidos nuevos del bot de Telegram (FASE 2 del rediseño).
 *
 * - Sólo aparece si hay pedidos con `origen: 'whatsapp'` y estado pendiente.
 * - Al tocarla hace scroll suave a "Pedidos recientes" y resalta las filas
 *   pendientes (clase `.alerta-pendientes`, ver src/index.css).
 * - No usa estado global ni toca la lógica de pedidos: lee lo que ya expone
 *   FinanceContext y mueve el scroll del DOM.
 */
export const AlertaPedidosBot: React.FC = () => {
  const { pedidos } = useFinance();
  // "Ahora" se calcula una sola vez al montar (evita Date.now() en render)
  const [ahoraMs] = useState(() => Date.now());

  const pendientes = useMemo(
    () =>
      pedidos.filter(
        (pedido) =>
          String(pedido.origen ?? '').toLowerCase() === 'whatsapp' &&
          normalizeEstado(pedido.estado) === 'pendiente'
      ),
    [pedidos]
  );

  if (pendientes.length === 0) return null;

  const ultimo = pendientes[0];
  const minutos = Math.max(0, Math.round((ahoraMs - (ultimo.fechaMs || ahoraMs)) / 60000));
  const hace = minutos < 60 ? `hace ${minutos} min` : `hace ${Math.round(minutos / 60)} h`;
  const direccion = ultimo.clienteDireccion ? `${ultimo.clienteDireccion} · ` : '';

  const irAPedidos = () => {
    const seccion = document.getElementById('pedidos-recientes');
    if (!seccion) return;
    seccion.scrollIntoView({ behavior: 'smooth', block: 'start' });
    seccion.classList.add('alerta-pendientes');
    window.setTimeout(() => seccion.classList.remove('alerta-pendientes'), 2600);
  };

  return (
    <div className="w-full px-4 sm:px-12 pt-4 bg-transparent">
      <button
        type="button"
        onClick={irAPedidos}
        aria-label={`Revisar ${pendientes.length} pedidos nuevos del bot`}
        className="w-full max-w-[1200px] mx-auto flex items-center gap-3 text-left rounded-[12px] px-4 py-3 border border-amber-500/20 border-l-[3px] border-l-amber-400 bg-amber-500/10 backdrop-blur-md transition-transform apple-pressable cursor-pointer"
      >
        <span className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 bg-amber-500/20">
          <Bell className="w-5 h-5 text-amber-300" strokeWidth={1.5} />
        </span>

        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold text-white">
            {pendientes.length} {pendientes.length === 1 ? 'pedido nuevo' : 'pedidos nuevos'} del bot
          </span>
          <span className="block text-[13px] truncate text-white/60">
            Último: {direccion}
            {formatoMXN(ultimo.total)} · {hace}
          </span>
        </span>

        <span className="flex items-center gap-1 text-[13px] font-semibold flex-shrink-0 text-amber-300">
          Revisar
          <ChevronRight className="w-4 h-4" strokeWidth={1.5} />
        </span>
      </button>
    </div>
  );
};
