import React, { useEffect, useState } from 'react';
import { useFinance } from '../../context/FinanceContext';
import type { MovimientoAirPods, TipoMovimientoAirPods } from '../../types/finance';
import {
  PRECIO_COMPRA_DEFAULT,
  PRECIO_VENTA_DEFAULT,
  calcularMargen,
  calcularTotal,
  costoUnitarioReferencia,
  redondearMoneda,
} from '../../lib/inventario';
import { formatFechaRelativa } from '../../lib/fechas';
import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  Layers,
  Loader2,
  Percent,
  Plus,
  Trash2,
  TrendingUp,
  Wallet,
  X,
} from 'lucide-react';

const MAX_MOVIMIENTOS = 20;

/** Badge de tipo de movimiento: verde = compra, azul = venta. */
const BADGE_TIPO: Record<TipoMovimientoAirPods, string> = {
  compra: 'bg-[#34c759]/10 text-[#34c759] border-[#34c759]/30',
  venta: 'bg-[#0066cc]/10 text-[#0066cc] border-[#0066cc]/30',
};

const formatCurrency = (val: number, decimales = 0) =>
  new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    maximumFractionDigits: decimales,
    minimumFractionDigits: decimales,
  }).format(Number(val) || 0);

/* ───────────────────────── Modal de compra / venta ───────────────────────── */

interface MovimientoModalProps {
  tipo: TipoMovimientoAirPods;
  stockActual: number;
  precioPromedioCompra: number;
  onClose: () => void;
  onSaved: (mensaje: string) => void;
}

const MovimientoModal: React.FC<MovimientoModalProps> = ({
  tipo,
  stockActual,
  precioPromedioCompra,
  onClose,
  onSaved,
}) => {
  const { registrarMovimientoAirPods } = useFinance();

  const esVenta = tipo === 'venta';
  const costoReferencia = costoUnitarioReferencia(precioPromedioCompra);

  const [cantidad, setCantidad] = useState(esVenta ? '1' : '10');
  const [precioUnitario, setPrecioUnitario] = useState(
    esVenta ? String(PRECIO_VENTA_DEFAULT) : String(PRECIO_COMPRA_DEFAULT)
  );
  const [cliente, setCliente] = useState('');
  const [notas, setNotas] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cantidadNum = Number(cantidad) || 0;
  const precioNum = Number(precioUnitario) || 0;
  const total = calcularTotal(cantidadNum, precioNum);

  const excedeStock = esVenta && cantidadNum > stockActual;
  const gananciaProyectada = redondearMoneda(cantidadNum * (precioNum - costoReferencia));
  const margenProyectado = calcularMargen(precioNum, costoReferencia) * 100;

  const puedeGuardar = cantidadNum > 0 && precioNum > 0 && !excedeStock && !saving;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cantidadNum <= 0) {
      setError('La cantidad debe ser mayor a 0.');
      return;
    }
    if (precioNum <= 0) {
      setError('El precio unitario debe ser mayor a 0.');
      return;
    }
    if (excedeStock) {
      setError(
        `No puedes vender ${cantidadNum} unidad(es): solo tienes ${stockActual} en stock.`
      );
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await registrarMovimientoAirPods({
        tipo,
        cantidad: cantidadNum,
        precio_unitario: precioNum,
        cliente: esVenta ? cliente : null,
        notas,
      });
      onSaved(
        esVenta
          ? `Venta registrada: ${cantidadNum} unidad(es) por ${formatCurrency(total)}.`
          : `Compra registrada: ${cantidadNum} unidad(es) por ${formatCurrency(total)}.`
      );
    } catch (err: unknown) {
      const e2 = err as { message?: string };
      console.error('Error al registrar el movimiento de inventario:', err);
      setError(e2?.message || 'No se pudo guardar el movimiento en Firestore.');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-[24px] max-w-[520px] w-full px-5 pt-5 pb-0 sm:p-7 border border-[#e0e0e0] shadow-2xl max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center space-x-2">
              {esVenta ? (
                <ArrowDownRight className="w-4 h-4 text-[#0066cc]" />
              ) : (
                <ArrowUpRight className="w-4 h-4 text-[#34c759]" />
              )}
              <h3 className="text-[20px] sm:text-[22px] font-semibold text-[#1d1d1f] tracking-tight">
                {esVenta ? 'Registrar Venta' : 'Registrar Compra'}
              </h3>
            </div>
            <p className="text-[14px] text-[#7a7a7a] mt-1">
              {esVenta
                ? 'Salida de inventario. Los AirPods vendidos se descuentan del stock.'
                : 'Entrada de inventario. Suma unidades y capital inmovilizado.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full text-[#7a7a7a] hover:bg-[#f5f5f7] hover:text-[#1d1d1f] transition-colors cursor-pointer"
            title="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Cantidad */}
            <div>
              <label className="block text-[13px] font-semibold text-[#1d1d1f] mb-1.5">
                Cantidad (unidades)
              </label>
              <input
                type="number"
                min="1"
                step="1"
                required
                value={cantidad}
                onChange={(e) => setCantidad(e.target.value)}
                className="w-full text-[18px] font-semibold px-4 py-3 rounded-[12px] bg-[#f5f5f7] border border-[#e0e0e0] focus:border-[#0071e3] focus:bg-white outline-none transition-colors"
                placeholder="0"
              />
            </div>

            {/* Precio unitario */}
            <div>
              <label className="block text-[13px] font-semibold text-[#1d1d1f] mb-1.5">
                Precio unitario ($ MXN)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                required
                value={precioUnitario}
                onChange={(e) => setPrecioUnitario(e.target.value)}
                className="w-full text-[18px] font-semibold px-4 py-3 rounded-[12px] bg-[#f5f5f7] border border-[#e0e0e0] focus:border-[#0071e3] focus:bg-white outline-none transition-colors"
                placeholder="0.00"
              />
            </div>
          </div>

          {/* Cliente (solo ventas) */}
          {esVenta && (
            <div>
              <label className="block text-[13px] font-semibold text-[#1d1d1f] mb-1.5">
                Cliente <span className="text-[#7a7a7a] font-normal">(opcional)</span>
              </label>
              <input
                type="text"
                value={cliente}
                onChange={(e) => setCliente(e.target.value)}
                className="w-full text-[15px] px-4 py-3 rounded-[12px] bg-[#f5f5f7] border border-[#e0e0e0] focus:border-[#0071e3] focus:bg-white outline-none transition-colors"
                placeholder="Ej. Luis Hernández"
              />
            </div>
          )}

          {/* Notas */}
          <div>
            <label className="block text-[13px] font-semibold text-[#1d1d1f] mb-1.5">
              Notas <span className="text-[#7a7a7a] font-normal">(opcional)</span>
            </label>
            <input
              type="text"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              className="w-full text-[15px] px-4 py-3 rounded-[12px] bg-[#f5f5f7] border border-[#e0e0e0] focus:border-[#0071e3] focus:bg-white outline-none transition-colors"
              placeholder={esVenta ? 'Ej. Pago en efectivo, entrega en mano' : 'Ej. Lote de 10 al proveedor'}
            />
          </div>

          {/* Resumen calculado */}
          <div className="rounded-[14px] bg-[#f5f5f7] border border-[#e0e0e0] p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[14px] text-[#7a7a7a]">
                {esVenta ? 'Total a cobrar' : 'Total a invertir'}
              </span>
              <span className="text-[20px] font-semibold text-[#1d1d1f] tracking-tight">
                {formatCurrency(total)}
              </span>
            </div>

            {esVenta && (
              <>
                <div className="flex items-center justify-between text-[13px]">
                  <span className="text-[#7a7a7a]">
                    Costo de referencia ({formatCurrency(costoReferencia, 2)}/ud)
                  </span>
                  <span className="font-medium text-[#1d1d1f]">
                    {formatCurrency(redondearMoneda(cantidadNum * costoReferencia))}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[13px]">
                  <span className="text-[#7a7a7a]">Ganancia proyectada</span>
                  <span
                    className={`font-semibold ${
                      gananciaProyectada >= 0 ? 'text-[#34c759]' : 'text-[#ff3b30]'
                    }`}
                  >
                    {formatCurrency(gananciaProyectada)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[13px]">
                  <span className="text-[#7a7a7a]">Margen proyectado</span>
                  <span className="font-semibold text-[#1d1d1f]">
                    {(Number.isFinite(margenProyectado) ? margenProyectado : 0).toFixed(1)}%
                  </span>
                </div>
                <div className="flex items-center justify-between text-[13px] pt-2 border-t border-dashed border-[#e0e0e0]">
                  <span className="text-[#7a7a7a]">Stock disponible</span>
                  <span
                    className={`font-semibold ${
                      excedeStock ? 'text-[#ff3b30]' : 'text-[#1d1d1f]'
                    }`}
                  >
                    {stockActual} unidad(es)
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Errores de validación */}
          {error && (
            <div className="flex items-start space-x-2 p-3.5 rounded-[12px] bg-[#ff3b30]/5 border border-[#ff3b30]/20">
              <AlertCircle className="w-4 h-4 text-[#ff3b30] flex-shrink-0 mt-0.5" />
              <p className="text-[13px] text-[#ff3b30]">{error}</p>
            </div>
          )}

          {excedeStock && !error && (
            <div className="flex items-start space-x-2 p-3.5 rounded-[12px] bg-[#ff9500]/5 border border-[#ff9500]/25">
              <AlertCircle className="w-4 h-4 text-[#ff9500] flex-shrink-0 mt-0.5" />
              <p className="text-[13px] text-[#ff9500]">
                No puedes vender más de lo que tienes en stock ({stockActual} unidad(es)).
              </p>
            </div>
          )}

          <div className="sticky bottom-0 -mx-5 sm:static sm:mx-0 bg-white pt-3 flex flex-col gap-3 pb-5 sm:gap-0 sm:pb-0 sm:flex-row sm:items-center sm:justify-end sm:space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-5 py-2.5 rounded-full text-[15px] text-[#1d1d1f] hover:bg-[#f5f5f7] transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!puedeGuardar}
              className="apple-btn-primary w-full sm:w-auto px-6 py-2.5 text-[15px] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Guardando...</span>
                </>
              ) : (
                <span>{esVenta ? 'Confirmar Venta' : 'Confirmar Compra'}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ───────────────────────────── Módulo completo ───────────────────────────── */

export const AirPodsModule: React.FC = () => {
  const {
    movimientosAirPods,
    loadingAirPods,
    errorAirPods,
    airPodsMetrics,
    eliminarMovimientoAirPods,
  } = useFinance();

  const [modalTipo, setModalTipo] = useState<TipoMovimientoAirPods | null>(null);
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(
    null
  );
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!feedback) return;
    const timer = setTimeout(() => setFeedback(null), 4000);
    return () => clearTimeout(timer);
  }, [feedback]);

  const {
    stockActual,
    capitalInmovilizado,
    gananciaAcumulada,
    unidadesCompradas,
    unidadesVendidas,
    precioPromedioCompra,
    precioPromedioVenta,
    margenPromedio,
    inversionTotal,
    ingresosTotales,
  } = airPodsMetrics;

  const ultimos = movimientosAirPods.slice(0, MAX_MOVIMIENTOS);
  const margenPct = (Number.isFinite(margenPromedio) ? margenPromedio : 0) * 100;

  const handleEliminar = async (mov: MovimientoAirPods) => {
    setDeletingId(mov.id);
    try {
      await eliminarMovimientoAirPods(mov.id);
      setFeedback({
        message: `Movimiento de ${mov.cantidad} unidad(es) eliminado del inventario.`,
        type: 'success',
      });
      setConfirmId(null);
    } catch (err: unknown) {
      const e2 = err as { message?: string };
      console.error('Error al eliminar el movimiento de inventario:', err);
      setFeedback({
        message: e2?.message || 'No se pudo eliminar el movimiento en Firestore.',
        type: 'error',
      });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="w-full">
      {/* Hero: título + acciones */}
      <div className="w-full bg-[#272729] text-white py-10 sm:py-16 px-4 sm:px-12 border-b border-[#333333]">
        <div className="max-w-[1200px] mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)]">
                Negocio: Reventa AirPods
              </span>
              {loadingAirPods && (
                <span className="text-[12px] text-[#8e8e93] animate-pulse">
                  • Sincronizando con Firestore...
                </span>
              )}
            </div>

            <h1 className="text-[34px] sm:text-[44px] lg:text-[52px] font-semibold tracking-[-0.025em] leading-[1.08] mt-2 text-white">
              Inventario AirPods 1.1
            </h1>
            <p className="text-[17px] sm:text-[19px] text-[#cccccc] font-normal leading-relaxed mt-2 max-w-[620px]">
              Compras al proveedor, ventas al público y stock en tiempo real desde la colección
              'inventario_airpods'.
            </p>

            {stockActual < 0 && (
              <div className="mt-4 inline-flex items-start space-x-2 px-3.5 py-2 rounded-[12px] bg-[#ff3b30]/15 border border-[#ff3b30]/40">
                <AlertCircle className="w-4 h-4 text-[#ff453a] flex-shrink-0 mt-0.5" />
                <span className="text-[13px] text-[#ff9f9a]">
                  Stock negativo ({stockActual}): hay más ventas registradas que compras. Registra
                  la compra que falta.
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
            <div className="bg-[#1f1f21] border border-[#3a3a3c] rounded-[18px] p-4 sm:p-5 min-w-0 sm:min-w-[190px] w-full sm:w-auto">
              <span className="text-[12px] font-medium text-[#cccccc] uppercase tracking-wider block">
                Movimientos
              </span>
              <div className="text-[28px] font-semibold text-white tracking-tight mt-1">
                {movimientosAirPods.length}
              </div>
              <span className="text-[12px] text-[#7a7a7a] mt-1 block">
                {unidadesCompradas} compradas · {unidadesVendidas} vendidas
              </span>
            </div>

            <div className="flex flex-col justify-center gap-3">
              <button
                type="button"
                onClick={() => setModalTipo('compra')}
                className="apple-btn-secondary h-[42px] px-5 text-[15px] cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Registrar Compra</span>
              </button>
              <button
                type="button"
                onClick={() => setModalTipo('venta')}
                className="apple-btn-primary h-[42px] px-5 text-[15px] cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Registrar Venta</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 4 métricas grandes */}
      <div className="w-full bg-[#f5f5f7] py-8 px-4 sm:py-12 sm:px-12 border-b border-[#e0e0e0]">
        <div className="max-w-[1200px] mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Stock actual */}
          <div className="apple-card bg-white flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-[#7a7a7a]">
                <span className="text-[13px] font-semibold tracking-wide uppercase">
                  Stock Actual
                </span>
                <div className="w-8 h-8 rounded-full bg-[#f5f5f7] flex items-center justify-center text-[#0066cc]">
                  <Layers className="w-4 h-4" />
                </div>
              </div>
              <div
                className={`text-[28px] font-semibold tracking-tight mt-3 ${
                  stockActual < 0 ? 'text-[#ff3b30]' : 'text-[#1d1d1f]'
                }`}
              >
                {stockActual}
              </div>
            </div>
            <p className="text-[13px] text-[#7a7a7a] mt-4 border-t border-[#f0f0f0] pt-3">
              Unidades disponibles ({unidadesCompradas} compradas · {unidadesVendidas} vendidas)
            </p>
          </div>

          {/* Capital inmovilizado */}
          <div className="apple-card bg-white flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-[#7a7a7a]">
                <span className="text-[13px] font-semibold tracking-wide uppercase">
                  Capital Inmovilizado
                </span>
                <div className="w-8 h-8 rounded-full bg-[#f5f5f7] flex items-center justify-center text-[#0066cc]">
                  <Wallet className="w-4 h-4" />
                </div>
              </div>
              <div className="text-[28px] font-semibold tracking-tight text-[#1d1d1f] mt-3">
                {formatCurrency(capitalInmovilizado)}
              </div>
            </div>
            <p className="text-[13px] text-[#7a7a7a] mt-4 border-t border-[#f0f0f0] pt-3">
              Costo prom. {formatCurrency(precioPromedioCompra, 2)}/ud · invertido{' '}
              {formatCurrency(inversionTotal)}
            </p>
          </div>

          {/* Ganancia acumulada */}
          <div className="apple-card bg-white flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-[#7a7a7a]">
                <span className="text-[13px] font-semibold tracking-wide uppercase">
                  Ganancia Acumulada
                </span>
                <div className="w-8 h-8 rounded-full bg-[#f5f5f7] flex items-center justify-center text-[#34c759]">
                  <TrendingUp className="w-4 h-4" />
                </div>
              </div>
              <div
                className={`text-[28px] font-semibold tracking-tight mt-3 ${
                  gananciaAcumulada < 0 ? 'text-[#ff3b30]' : 'text-[#1d1d1f]'
                }`}
              >
                {formatCurrency(gananciaAcumulada)}
              </div>
            </div>
            <p className="text-[13px] text-[#7a7a7a] mt-4 border-t border-[#f0f0f0] pt-3">
              Cobrado {formatCurrency(ingresosTotales)} − costo de lo vendido
            </p>
          </div>

          {/* Margen */}
          <div className="apple-card bg-white flex flex-col justify-between border-2 border-[#0066cc]/20">
            <div>
              <div className="flex items-center justify-between text-[#7a7a7a]">
                <span className="text-[13px] font-semibold tracking-wide uppercase text-[#0066cc]">
                  Margen Promedio
                </span>
                <div className="w-8 h-8 rounded-full bg-[#0066cc]/10 flex items-center justify-center text-[#0066cc]">
                  <Percent className="w-4 h-4" />
                </div>
              </div>
              <div className="text-[28px] font-semibold tracking-tight text-[#1d1d1f] mt-3">
                {margenPct.toFixed(1)}%
              </div>
            </div>
            <p className="text-[13px] text-[#7a7a7a] mt-4 border-t border-[#f0f0f0] pt-3">
              Venta prom. {formatCurrency(precioPromedioVenta, 2)} · compra prom.{' '}
              {formatCurrency(precioPromedioCompra, 2)}
            </p>
          </div>
        </div>
      </div>

      {/* Tabla de movimientos */}
      <div className="w-full py-8 px-4 sm:py-12 sm:px-12 bg-white border-b border-[#e0e0e0]">
        <div className="max-w-[1200px] mx-auto">
          <div className="apple-card bg-white">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-[#f0f0f0]">
              <div>
                <h3 className="text-[21px] font-semibold tracking-[-0.28px] text-[#1d1d1f]">
                  Últimos Movimientos
                </h3>
                <p className="text-[14px] text-[#7a7a7a] mt-0.5">
                  Los {Math.min(MAX_MOVIMIENTOS, ultimos.length) || MAX_MOVIMIENTOS} más recientes de
                  la colección 'inventario_airpods'.
                </p>
              </div>
              <span className="text-[13px] text-[#7a7a7a] bg-[#f5f5f7] rounded-full px-3 py-1.5 self-start sm:self-auto whitespace-nowrap">
                {movimientosAirPods.length} movimiento
                {movimientosAirPods.length === 1 ? '' : 's'}
              </span>
            </div>

            {loadingAirPods && movimientosAirPods.length === 0 ? (
              <div className="py-14 text-center">
                <Loader2 className="w-6 h-6 text-[#0066cc] animate-spin inline-block mb-3" />
                <p className="text-[15px] text-[#7a7a7a]">
                  Cargando inventario desde Firestore...
                </p>
              </div>
            ) : errorAirPods ? (
              <div className="mt-5 flex items-start space-x-2 p-4 rounded-[12px] bg-[#ff3b30]/5 border border-[#ff3b30]/20">
                <AlertCircle className="w-4 h-4 text-[#ff3b30] flex-shrink-0 mt-0.5" />
                <p className="text-[14px] text-[#ff3b30]">
                  No se pudo leer el inventario: {errorAirPods.message}
                </p>
              </div>
            ) : ultimos.length === 0 ? (
              <div className="py-14 text-center px-4">
                <p className="text-[17px] font-semibold text-[#1d1d1f]">
                  Todavía no hay movimientos
                </p>
                <p className="text-[14px] text-[#7a7a7a] mt-1 max-w-[460px] mx-auto">
                  Registra tu primera compra (ej. 10 unidades a $320) para ver el stock y el capital
                  inmovilizado en tiempo real.
                </p>
                <button
                  type="button"
                  onClick={() => setModalTipo('compra')}
                  className="apple-btn-primary mt-5 text-[14px] py-2 px-5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Registrar Primera Compra</span>
                </button>
              </div>
            ) : (
              <>
                {/* Encabezado (solo escritorio) */}
                <div className="hidden sm:grid grid-cols-12 gap-3 px-4 py-2.5 text-[12px] font-semibold uppercase tracking-wide text-[#7a7a7a]">
                  <span className="col-span-3">Fecha</span>
                  <span className="col-span-2">Tipo</span>
                  <span className="col-span-2 text-center">Cantidad</span>
                  <span className="col-span-2 text-right">P. unitario</span>
                  <span className="col-span-2 text-right">Total</span>
                  <span className="col-span-1 text-right">Acción</span>
                </div>

                <div className="max-h-[560px] overflow-y-auto">
                  {ultimos.map((mov) => {
                    const esVenta = mov.tipo === 'venta';
                    const enConfirmacion = confirmId === mov.id;
                    const borrando = deletingId === mov.id;

                    return (
                      <div
                        key={mov.id}
                        className={`grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-3 items-center px-4 py-3.5 border-t border-[#f5f5f7] transition-colors ${
                          enConfirmacion ? 'bg-[#fff5f5]' : 'hover:bg-[#fafafc]'
                        }`}
                      >
                        {/* Fecha + detalle */}
                        <div className="sm:col-span-3 flex items-center justify-between sm:justify-start gap-3 min-w-0">
                          <span className="sm:hidden text-[12px] font-semibold uppercase tracking-wide text-[#7a7a7a]">
                            Fecha
                          </span>
                          <div className="min-w-0 text-right sm:text-left">
                            <span className="text-[14px] text-[#1d1d1f] block truncate">
                              {formatFechaRelativa(mov.fechaMs, mov.tieneHora)}
                            </span>
                            {(mov.cliente || mov.notas) && (
                              <span className="text-[12px] text-[#8e8e93] block truncate">
                                {mov.cliente ? mov.cliente : mov.notas}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Tipo */}
                        <div className="sm:col-span-2 flex items-center justify-between sm:justify-start gap-2">
                          <span className="sm:hidden text-[12px] font-semibold uppercase tracking-wide text-[#7a7a7a]">
                            Tipo
                          </span>
                          <span
                            className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full border text-[12px] font-semibold ${
                              BADGE_TIPO[mov.tipo]
                            }`}
                          >
                            {esVenta ? (
                              <ArrowDownRight className="w-3 h-3" />
                            ) : (
                              <ArrowUpRight className="w-3 h-3" />
                            )}
                            <span>{esVenta ? 'Venta' : 'Compra'}</span>
                          </span>
                        </div>

                        {/* Cantidad */}
                        <div className="sm:col-span-2 flex items-center justify-between sm:justify-center gap-2">
                          <span className="sm:hidden text-[12px] font-semibold uppercase tracking-wide text-[#7a7a7a]">
                            Cantidad
                          </span>
                          <span className="text-[15px] font-semibold text-[#1d1d1f]">
                            {esVenta ? '−' : '+'}
                            {mov.cantidad}
                          </span>
                        </div>

                        {/* Precio unitario */}
                        <div className="sm:col-span-2 flex items-center justify-between sm:justify-end gap-2">
                          <span className="sm:hidden text-[12px] font-semibold uppercase tracking-wide text-[#7a7a7a]">
                            P. unitario
                          </span>
                          <span className="text-[14px] text-[#1d1d1f]">
                            {formatCurrency(mov.precio_unitario, 2)}
                          </span>
                        </div>

                        {/* Total */}
                        <div className="sm:col-span-2 flex items-center justify-between sm:justify-end gap-2">
                          <span className="sm:hidden text-[12px] font-semibold uppercase tracking-wide text-[#7a7a7a]">
                            Total
                          </span>
                          <span
                            className={`text-[15px] font-semibold tracking-tight ${
                              esVenta ? 'text-[#0066cc]' : 'text-[#1d1d1f]'
                            }`}
                          >
                            {formatCurrency(mov.total)}
                          </span>
                        </div>

                        {/* Acciones: eliminar con confirmación */}
                        <div className="sm:col-span-1 flex items-center justify-between sm:justify-end gap-2">
                          <span className="sm:hidden text-[12px] font-semibold uppercase tracking-wide text-[#7a7a7a]">
                            Acción
                          </span>
                          {enConfirmacion ? (
                            <div className="flex items-center space-x-1">
                              <button
                                type="button"
                                onClick={() => handleEliminar(mov)}
                                disabled={borrando}
                                title="Confirmar eliminación"
                                className="p-1.5 rounded-full bg-[#ff3b30] text-white hover:bg-[#ff453a] transition-colors cursor-pointer disabled:opacity-60"
                              >
                                {borrando ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmId(null)}
                                title="Cancelar"
                                className="p-1.5 rounded-full text-[#7a7a7a] hover:bg-[#f5f5f7] hover:text-[#1d1d1f] transition-colors cursor-pointer"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmId(mov.id)}
                              title="Eliminar movimiento"
                              className="p-2 rounded-full hover:bg-[#fff0f0] text-[#7a7a7a] hover:text-[#ff3b30] transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <p className="text-[12px] text-[#8e8e93] pt-4">
                  Eliminar un movimiento recalcula automáticamente stock, capital y ganancia. Las
                  ventas del periodo también alimentan los ingresos del Consolidado.
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Modales */}
      {modalTipo && (
        <MovimientoModal
          tipo={modalTipo}
          stockActual={stockActual}
          precioPromedioCompra={precioPromedioCompra}
          onClose={() => setModalTipo(null)}
          onSaved={(mensaje) => {
            setModalTipo(null);
            setFeedback({ message: mensaje, type: 'success' });
          }}
        />
      )}

      {/* Toast */}
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
