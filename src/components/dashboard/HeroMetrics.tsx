import React, { useMemo } from 'react';
import { useFinance } from '../../context/FinanceContext';
import { isPedidoCancelado } from '../../lib/pedidos';
import { esPedidoDelBot } from '../../lib/ingresos';
import { formatMXN, promediosRecetas } from '../../lib/costeo';
import { parseFechaFirestore, rangoDePeriodo } from '../../lib/fechas';
import { ingresoPedidosWeb } from '../../lib/ingresos';
import { precioVentaProducto } from '../../lib/products';
import { TrendingUp, TrendingDown, DollarSign, Percent, ShoppingBag, ClipboardList } from 'lucide-react';

export const HeroMetrics: React.FC = () => {
  const {
    metrics,
    selectedEntity,
    pedidosDelPeriodo,
    webOrdersIncome,
    dateRange,
    labelPeriodo,
    netoPeriodoAnterior,
    loadingTransactions,
    insumos,
    recetas,
    transactions,
    pedidos,
  } = useFinance();

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      maximumFractionDigits: 0,
    }).format(val || 0);
  };

  // Pedidos web del periodo: sin cancelados y sin los del bot, que ya entran
  // por sus propias transacciones (misma regla que webOrdersIncome).
  const pedidosWebActivos = pedidosDelPeriodo.filter(
    (p) => !isPedidoCancelado(p) && !esPedidoDelBot(p)
  );
  const totalPedidosMonto = webOrdersIncome;

  // Los pedidos web se integran al Consolidado y a Hamburguesas
  const includeWebOrders = selectedEntity === 'all' || selectedEntity === 'hamburguesas';

  // Las ventas del inventario AirPods se integran al Consolidado y a AirPods
  const includeAirPodsSales = selectedEntity === 'all' || selectedEntity === 'airpods';

  // Costo y margen promedio según las recetas (sólo tiene sentido en hamburguesas)
  const promedioRecetas = useMemo(
    () =>
      promediosRecetas({
        recetas: recetas.map((r) => ({
          productoId: r.productoId,
          ingredientes: r.ingredientes.map((ing) => ({
            insumoId: ing.insumoId,
            cantidad: ing.cantidad,
          })),
          incluyePapas: r.incluyePapas,
        })),
        insumos: insumos.filter((i) => i.activo !== false),
        precioDe: precioVentaProducto,
      }),
    [recetas, insumos]
  );

  const mostrarRecetas = includeWebOrders && promedioRecetas.conReceta > 0;

  // Ventas de hoy y de ayer para el hero. Sólo lee datos que ya expone el
  // contexto y usa helpers puros de fechas (no toca lógica ni servicios).
  // Se excluyen los pedidos con origen 'whatsapp' porque el bot ya crea su
  // propia transacción de ingreso: contarlos aquí los duplicaría.
  const ventasPorDia = useMemo(() => {
    const calcular = (offset: number) => {
      const [inicio, fin] = rangoDePeriodo('day', offset);
      let total = 0;

      transactions.forEach((tx) => {
        const negocio = tx.negocio || tx.entity || 'personal';
        if (selectedEntity !== 'all' && negocio !== selectedEntity) return;
        const ms = parseFechaFirestore(tx.fecha || tx.date || '').ms;
        if (!Number.isFinite(ms) || ms < inicio || ms > fin) return;
        const tipo = (tx.tipo || tx.type || 'gasto').toLowerCase();
        if (tipo === 'ingreso' || tipo === 'income') total += Number(tx.monto ?? tx.amount ?? 0);
      });

      if (selectedEntity === 'all' || selectedEntity === 'hamburguesas') {
        total += ingresoPedidosWeb(pedidos, inicio, fin);
      }

      return total;
    };

    return { hoy: calcular(0), ayer: calcular(-1) };
  }, [transactions, pedidos, selectedEntity]);

  const ventasHoy = ventasPorDia.hoy;
  const ventasAyer = ventasPorDia.ayer;
  const tendenciaDia = useMemo(() => {
    if (ventasAyer <= 0 || ventasHoy === 0) return null;
    const delta = ventasHoy - ventasAyer;
    return { subio: delta >= 0, pct: (delta / ventasAyer) * 100 };
  }, [ventasHoy, ventasAyer]);

  // Comparación del dinero libre contra el mismo periodo con offset -1
  const comparacion = useMemo(() => {
    if (dateRange.filter === 'all' || !netoPeriodoAnterior) return null;

    const sinDatos = netoPeriodoAnterior.ingresos === 0 && netoPeriodoAnterior.gastos === 0;
    if (sinDatos) return { sinDatos: true as const };

    const delta = metrics.netFreeCash - netoPeriodoAnterior.neto;
    const pct =
      netoPeriodoAnterior.neto !== 0
        ? (delta / Math.abs(netoPeriodoAnterior.neto)) * 100
        : null;

    return { sinDatos: false as const, delta, pct, subio: delta >= 0 };
  }, [dateRange.filter, netoPeriodoAnterior, metrics.netFreeCash]);

  const fuentesDeIngreso = [
    'Ventas registradas',
    ...(includeWebOrders ? ['pedidos web del periodo'] : []),
    ...(includeAirPodsSales ? ['ventas de inventario AirPods'] : []),
  ].join(' + ');

  const getEntityTitle = () => {
    switch (selectedEntity) {
      case 'personal':
        return 'Finanzas Personales';
      case 'hamburguesas':
        return 'Negocio: Hamburguesas';
      case 'airpods':
        return 'Negocio: Reventa AirPods';
      default:
        return 'Visión Consolidada';
    }
  };

  const isPositiveCashFlow = metrics.netFreeCash >= 0;

  return (
    <div className="w-full">
      {/* Hero Showcase Banner: Dark Tile (Apple surface-tile-1 #272729) */}
      <div className="w-full bg-[#272729] text-white py-10 sm:py-20 px-4 sm:px-12 border-b border-[#333333]">
        <div className="max-w-[1200px] mx-auto flex flex-col md:flex-row md:flex-wrap items-start md:items-center justify-between gap-8">
          <div className="w-full min-w-0 md:w-auto">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-[14px] font-semibold tracking-wider uppercase text-[#2997ff]">
                {getEntityTitle()}
              </span>
              <span className="text-[12px] text-[#8e8e93]">·</span>
              <span className="text-[13px] font-medium text-[#cccccc]">{labelPeriodo}</span>
              {loadingTransactions && (
                <span className="text-[12px] text-[#8e8e93] animate-pulse">
                  • Sincronizando con Firestore...
                </span>
              )}
            </div>

            {/* Hero metric: VENTAS HOY (mono 60px + tendencia vs ayer) */}
            <span className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8e8e93] mt-5">
              Ventas hoy
            </span>
            <h1 className="num-hero text-[44px] sm:text-[56px] lg:text-[60px] font-semibold tracking-[-0.03em] leading-[1.02] mt-1 text-white break-words">
              {formatCurrency(ventasHoy)}
            </h1>
            {tendenciaDia ? (
              <p
                className="text-[13px] font-medium mt-1.5"
                style={{ color: tendenciaDia.subio ? 'var(--positive)' : 'var(--negative)' }}
              >
                {tendenciaDia.subio ? '↑' : '↓'} {tendenciaDia.subio ? '+' : '−'}
                {Math.abs(tendenciaDia.pct).toFixed(1)}% vs ayer
                <span className="text-[#8e8e93] font-normal"> · ayer {formatCurrency(ventasAyer)}</span>
              </p>
            ) : (
              <p className="text-[13px] text-[#8e8e93] mt-1.5">
                {ventasHoy === 0
                  ? 'Sin ventas registradas hoy'
                  : `Ayer ${formatCurrency(ventasAyer)} · sin base para comparar`}
              </p>
            )}
          </div>

          <div className="flex flex-col sm:flex-row md:flex-wrap gap-3 sm:gap-4 w-full md:w-auto">
            {/* Margen Card */}
            <div className="bg-[#1f1f21] border border-[#3a3a3c] rounded-[18px] p-4 sm:p-5 min-w-0 sm:min-w-[190px] w-full sm:w-auto">
              <span className="text-[12px] font-medium text-[#cccccc] uppercase tracking-wider block">
                Margen Libre
              </span>
              <div className="flex items-center space-x-2 mt-1">
                <span className="num-metric text-[28px] font-semibold text-white tracking-tight">
                  {metrics.savingsOrProfitMargin}%
                </span>
                <span
                  className={`text-[13px] px-2 py-0.5 rounded-full font-medium ${
                    metrics.savingsOrProfitMargin >= 25
                      ? 'bg-[#30d158]/20 text-[#30d158]'
                      : metrics.savingsOrProfitMargin > 0
                      ? 'bg-[#ff9f0a]/20 text-[#ff9f0a]'
                      : 'bg-[#7a7a7a]/20 text-[#cccccc]'
                  }`}
                >
                  {metrics.savingsOrProfitMargin >= 25
                    ? 'Saludable'
                    : metrics.savingsOrProfitMargin > 0
                    ? 'Atención'
                    : 'Sin datos'}
                </span>
              </div>
              <span className="text-[12px] text-[#7a7a7a] mt-1 block">
                De cada $100 ingresados
              </span>
            </div>

            {/* Pedidos Web en vivo */}
            <div className="bg-[#1f1f21] border border-[#3a3a3c] rounded-[18px] p-4 sm:p-5 min-w-0 sm:min-w-[190px] w-full sm:w-auto">
              <span className="text-[12px] font-medium text-[#cccccc] uppercase tracking-wider flex items-center justify-between">
                <span>Pedidos Web</span>
                <ShoppingBag className="w-3.5 h-3.5 text-[#2997ff]" />
              </span>
              <div className="flex items-center space-x-2 mt-1">
                <span className="num-metric text-[28px] font-semibold text-white tracking-tight">
                  {pedidosWebActivos.length}
                </span>
                <span className="text-[14px] text-[#34c759] font-medium">
                  {formatCurrency(totalPedidosMonto)}
                </span>
              </div>
              <span className="text-[12px] text-[#7a7a7a] mt-1 block">
                Colección 'pedidos' · {labelPeriodo}
              </span>
            </div>

            {/* Costo y margen promedio según las recetas (sólo si hay recetas) */}
            {mostrarRecetas && (
              <div className="bg-[#1f1f21] border border-[#3a3a3c] rounded-[18px] p-4 sm:p-5 min-w-0 sm:min-w-[190px] w-full sm:w-auto">
                <span className="text-[12px] font-medium text-[#cccccc] uppercase tracking-wider flex items-center justify-between">
                  <span>Costo por producto</span>
                  <ClipboardList className="w-3.5 h-3.5 text-[#34c759]" />
                </span>
                <div className="flex items-center space-x-2 mt-1">
                  <span className="num-metric text-[28px] font-semibold text-white tracking-tight">
                    {formatMXN(promedioRecetas.costoPromedio)}
                  </span>
                  <span
                    className={`text-[13px] px-2 py-0.5 rounded-full font-medium ${
                      promedioRecetas.margenPromedio >= 50
                        ? 'bg-[#30d158]/20 text-[#30d158]'
                        : promedioRecetas.margenPromedio >= 30
                        ? 'bg-[#ff9f0a]/20 text-[#ff9f0a]'
                        : 'bg-[#ff3b30]/20 text-[#ff453a]'
                    }`}
                  >
                    {promedioRecetas.margenPromedio}% margen
                  </span>
                </div>
                <span className="text-[12px] text-[#7a7a7a] mt-1 block">
                  Promedio de {promedioRecetas.conReceta} receta
                  {promedioRecetas.conReceta === 1 ? '' : 's'} · ganancia{' '}
                  {formatMXN(promedioRecetas.gananciaPromedio)}
                </span>
              </div>
            )}

            {/* Comparación contra el periodo anterior (mismo filtro, offset -1) */}
            {comparacion && (
              <div className="bg-[#1f1f21] border border-[#3a3a3c] rounded-[18px] p-4 sm:p-5 min-w-0 sm:min-w-[190px] w-full sm:w-auto">
                <span className="text-[12px] font-medium text-[#cccccc] uppercase tracking-wider block">
                  vs. periodo anterior
                </span>

                {comparacion.sinDatos ? (
                  <div className="text-[18px] font-semibold text-[#8e8e93] mt-1">
                    Sin datos previos
                  </div>
                ) : (
                  <div
                    className={`text-[26px] font-semibold tracking-tight mt-1 ${
                      comparacion.subio ? 'text-[#30d158]' : 'text-[#ff453a]'
                    }`}
                  >
                    {comparacion.delta >= 0 ? '+' : '−'}
                    {formatCurrency(Math.abs(comparacion.delta))}
                    {comparacion.pct !== null && (
                      <span className="text-[14px] font-medium ml-1.5">
                        ({comparacion.pct >= 0 ? '+' : ''}
                        {comparacion.pct.toFixed(0)}%)
                      </span>
                    )}
                  </div>
                )}

                <span className="text-[12px] text-[#7a7a7a] mt-1 block">
                  {comparacion.sinDatos
                    ? 'No hubo movimientos en el periodo anterior'
                    : `Periodo anterior: ${formatCurrency(netoPeriodoAnterior?.neto ?? 0)}`}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Grid of Key Financial Cards: Light Parchment Surface (#f5f5f7) */}
      <div className="w-full bg-[#f5f5f7] py-8 px-4 sm:py-12 sm:px-12 border-b border-[#e0e0e0]">
        <div className="max-w-[1200px] mx-auto grid grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-4">
          {/* Ingresos */}
          <div className="apple-card bg-white min-h-[100px] flex flex-col justify-between">
            <div className="flex items-start justify-between gap-2">
              <span className="text-[11px] sm:text-[12px] font-medium uppercase tracking-wider text-[#7a7a7a]">
                Ingresos
              </span>
              <TrendingUp className="w-5 h-5 text-[#34c759] flex-shrink-0" />
            </div>
            <div className="num-metric text-[19px] sm:text-[22px] font-semibold tracking-tight text-[#1d1d1f] mt-2">
              {formatCurrency(metrics.totalIncome)}
            </div>
            <p className="hidden lg:block text-[12px] text-[#7a7a7a] mt-2 border-t border-[#f0f0f0] pt-2">
              {fuentesDeIngreso}
            </p>
          </div>

          {/* Gastos */}
          <div className="apple-card bg-white min-h-[100px] flex flex-col justify-between">
            <div className="flex items-start justify-between gap-2">
              <span className="text-[11px] sm:text-[12px] font-medium uppercase tracking-wider text-[#7a7a7a]">
                Gastos
              </span>
              <TrendingDown className="w-5 h-5 text-[#ff3b30] flex-shrink-0" />
            </div>
            <div className="num-metric text-[19px] sm:text-[22px] font-semibold tracking-tight text-[#1d1d1f] mt-2">
              {formatCurrency(metrics.totalExpenses)}
            </div>
            <p className="hidden lg:block text-[12px] text-[#7a7a7a] mt-2 border-t border-[#f0f0f0] pt-2">
              Insumos, compras & costos fijos
            </p>
          </div>

          {/* Utilidad */}
          <div className="apple-card bg-white min-h-[100px] flex flex-col justify-between border-2 border-[#0066cc]/20">
            <div className="flex items-start justify-between gap-2">
              <span className="text-[11px] sm:text-[12px] font-medium uppercase tracking-wider text-[#0066cc]">
                Utilidad
              </span>
              <DollarSign className="w-5 h-5 text-[#0066cc] flex-shrink-0" />
            </div>
            <div
              className={`num-metric text-[19px] sm:text-[22px] font-semibold tracking-tight mt-2 ${
                isPositiveCashFlow ? 'text-[#34c759]' : 'text-[#ff3b30]'
              }`}
            >
              {formatCurrency(metrics.netFreeCash)}
            </div>
            <p className="hidden lg:block text-[12px] text-[#7a7a7a] mt-2 border-t border-[#f0f0f0] pt-2">
              Disponible para retiro o reinversión
            </p>
          </div>

          {/* Margen (ocupa la fila completa en móvil) */}
          <div className="apple-card bg-white min-h-[100px] flex flex-col justify-between col-span-3 lg:col-span-1">
            <div className="flex items-start justify-between gap-2">
              <span className="text-[11px] sm:text-[12px] font-medium uppercase tracking-wider text-[#7a7a7a]">
                Margen
              </span>
              <Percent className="w-5 h-5 text-[#1d1d1f] flex-shrink-0" />
            </div>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="num-metric text-[19px] sm:text-[22px] font-semibold tracking-tight text-[#1d1d1f]">
                {metrics.savingsOrProfitMargin}%
              </span>
              <span
                className={`text-[12px] px-2 py-0.5 rounded-full border ${
                  metrics.savingsOrProfitMargin >= 50
                    ? 'border-[#34c759]/30 text-[#34c759] bg-[#34c759]/10'
                    : metrics.savingsOrProfitMargin >= 30
                    ? 'border-[#ff9500]/30 text-[#ff9500] bg-[#ff9500]/10'
                    : 'border-[#ff3b30]/30 text-[#ff3b30] bg-[#ff3b30]/10'
                }`}
              >
                {metrics.savingsOrProfitMargin >= 50
                  ? 'Saludable'
                  : metrics.savingsOrProfitMargin >= 30
                  ? 'Atención'
                  : 'Bajo'}
              </span>
            </div>
            <p className="hidden lg:block text-[12px] text-[#7a7a7a] mt-2 border-t border-[#f0f0f0] pt-2">
              Porcentaje neto de retención
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
