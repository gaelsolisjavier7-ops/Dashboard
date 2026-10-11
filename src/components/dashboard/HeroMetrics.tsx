import React, { useMemo } from 'react';
import { useFinance } from '../../context/FinanceContext';
import { DATE_FILTER_LABEL, isPedidoCancelado } from '../../lib/pedidos';
import { formatMXN, promediosRecetas } from '../../lib/costeo';
import { precioVentaProducto } from '../../lib/products';
import { TrendingUp, TrendingDown, DollarSign, Percent, ShoppingBag, ClipboardList } from 'lucide-react';

export const HeroMetrics: React.FC = () => {
  const {
    metrics,
    selectedEntity,
    pedidosDelPeriodo,
    webOrdersIncome,
    dateFilter,
    loadingTransactions,
    insumos,
    recetas,
  } = useFinance();

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      maximumFractionDigits: 0,
    }).format(val || 0);
  };

  // Pedidos web del periodo (los cancelados no cuentan como ingreso)
  const pedidosWebActivos = pedidosDelPeriodo.filter((p) => !isPedidoCancelado(p));
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
        <div className="max-w-[1200px] mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
          <div className="w-full min-w-0 md:w-auto">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-[14px] font-semibold tracking-wider uppercase text-[#2997ff]">
                {getEntityTitle()}
              </span>
              {loadingTransactions && (
                <span className="text-[12px] text-[#8e8e93] animate-pulse">
                  • Sincronizando con Firestore...
                </span>
              )}
            </div>

            <h1 className="text-[34px] sm:text-[48px] lg:text-[56px] font-semibold tracking-[-0.025em] leading-[1.08] mt-2 text-white break-words">
              {formatCurrency(metrics.netFreeCash)}
            </h1>
            <p className="text-[16px] sm:text-[19px] text-[#cccccc] font-normal leading-relaxed mt-2 max-w-[550px]">
              {metrics.netFreeCash === 0 && metrics.totalIncome === 0
                ? 'Sin movimientos registrados en Firestore. Todas las métricas en $0.'
                : isPositiveCashFlow
                ? 'Dinero libre generado tras deducir todos los costos operativos y gastos.'
                : 'Déficit operativo: los gastos superan los ingresos en el periodo seleccionado.'}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 w-full md:w-auto">
            {/* Margen Card */}
            <div className="bg-[#1f1f21] border border-[#3a3a3c] rounded-[18px] p-4 sm:p-5 min-w-0 sm:min-w-[190px] w-full sm:w-auto">
              <span className="text-[12px] font-medium text-[#cccccc] uppercase tracking-wider block">
                Margen Libre
              </span>
              <div className="flex items-center space-x-2 mt-1">
                <span className="text-[28px] font-semibold text-white tracking-tight">
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
                <span className="text-[28px] font-semibold text-white tracking-tight">
                  {pedidosWebActivos.length}
                </span>
                <span className="text-[14px] text-[#34c759] font-medium">
                  {formatCurrency(totalPedidosMonto)}
                </span>
              </div>
              <span className="text-[12px] text-[#7a7a7a] mt-1 block">
                Colección 'pedidos' · {DATE_FILTER_LABEL[dateFilter]}
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
                  <span className="text-[28px] font-semibold text-white tracking-tight">
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
          </div>
        </div>
      </div>

      {/* Grid of Key Financial Cards: Light Parchment Surface (#f5f5f7) */}
      <div className="w-full bg-[#f5f5f7] py-8 px-4 sm:py-12 sm:px-12 border-b border-[#e0e0e0]">
        <div className="max-w-[1200px] mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {/* Card 1: Ingresos Brutos */}
          <div className="apple-card bg-white flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-[#7a7a7a]">
                <span className="text-[13px] font-semibold tracking-wide uppercase">
                  Ingresos Brutos
                </span>
                <div className="w-8 h-8 rounded-full bg-[#f5f5f7] flex items-center justify-center text-[#0066cc]">
                  <TrendingUp className="w-4 h-4" />
                </div>
              </div>
              <div className="text-[28px] font-semibold tracking-tight text-[#1d1d1f] mt-3">
                {formatCurrency(metrics.totalIncome)}
              </div>
            </div>
            <p className="text-[13px] text-[#7a7a7a] mt-4 border-t border-[#f0f0f0] pt-3">
              {fuentesDeIngreso}
            </p>
          </div>

          {/* Card 2: Gastos Totales */}
          <div className="apple-card bg-white flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-[#7a7a7a]">
                <span className="text-[13px] font-semibold tracking-wide uppercase">
                  Gastos Totales
                </span>
                <div className="w-8 h-8 rounded-full bg-[#f5f5f7] flex items-center justify-center text-[#ff3b30]">
                  <TrendingDown className="w-4 h-4" />
                </div>
              </div>
              <div className="text-[28px] font-semibold tracking-tight text-[#1d1d1f] mt-3">
                {formatCurrency(metrics.totalExpenses)}
              </div>
            </div>
            <p className="text-[13px] text-[#7a7a7a] mt-4 border-t border-[#f0f0f0] pt-3">
              Insumos, compras & costos fijos
            </p>
          </div>

          {/* Card 3: Efectivo Libre */}
          <div className="apple-card bg-white flex flex-col justify-between border-2 border-[#0066cc]/20">
            <div>
              <div className="flex items-center justify-between text-[#7a7a7a]">
                <span className="text-[13px] font-semibold tracking-wide uppercase text-[#0066cc]">
                  Utilidad / Flujo Libre
                </span>
                <div className="w-8 h-8 rounded-full bg-[#0066cc]/10 flex items-center justify-center text-[#0066cc]">
                  <DollarSign className="w-4 h-4" />
                </div>
              </div>
              <div
                className={`text-[28px] font-semibold tracking-tight mt-3 ${
                  isPositiveCashFlow ? 'text-[#1d1d1f]' : 'text-[#ff3b30]'
                }`}
              >
                {formatCurrency(metrics.netFreeCash)}
              </div>
            </div>
            <p className="text-[13px] text-[#7a7a7a] mt-4 border-t border-[#f0f0f0] pt-3">
              Disponible para retiro o reinversión
            </p>
          </div>

          {/* Card 4: Retorno / Margen Operativo */}
          <div className="apple-card bg-white flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-[#7a7a7a]">
                <span className="text-[13px] font-semibold tracking-wide uppercase">
                  Eficiencia / Margen
                </span>
                <div className="w-8 h-8 rounded-full bg-[#f5f5f7] flex items-center justify-center text-[#1d1d1f]">
                  <Percent className="w-4 h-4" />
                </div>
              </div>
              <div className="text-[28px] font-semibold tracking-tight text-[#1d1d1f] mt-3">
                {metrics.savingsOrProfitMargin}%
              </div>
            </div>
            <p className="text-[13px] text-[#7a7a7a] mt-4 border-t border-[#f0f0f0] pt-3">
              Porcentaje neto de retención
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
