import React from 'react';
import { useFinance } from '../../context/FinanceContext';
import { TrendingUp, TrendingDown, DollarSign, Percent, ShoppingBag } from 'lucide-react';

export const HeroMetrics: React.FC = () => {
  const { metrics, selectedEntity, pedidos, loadingTransactions } = useFinance();

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      maximumFractionDigits: 0,
    }).format(val || 0);
  };

  const totalPedidosMonto = pedidos.reduce((acc, p) => acc + (Number(p.total) || 0), 0);

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
      <div className="w-full bg-[#272729] text-white py-14 sm:py-20 px-6 sm:px-12 border-b border-[#333333]">
        <div className="max-w-[1200px] mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[14px] font-semibold tracking-wider uppercase text-[#2997ff]">
                {getEntityTitle()}
              </span>
              {loadingTransactions && (
                <span className="text-[12px] text-[#8e8e93] animate-pulse">
                  • Sincronizando con Firestore...
                </span>
              )}
            </div>

            <h1 className="text-[34px] sm:text-[48px] lg:text-[56px] font-semibold tracking-[-0.025em] leading-[1.08] mt-2 text-white">
              {formatCurrency(metrics.netFreeCash)}
            </h1>
            <p className="text-[17px] sm:text-[19px] text-[#cccccc] font-normal leading-relaxed mt-2 max-w-[550px]">
              {metrics.netFreeCash === 0 && metrics.totalIncome === 0
                ? 'Sin movimientos registrados en Firestore. Todas las métricas en $0.'
                : isPositiveCashFlow
                ? 'Dinero libre generado tras deducir todos los costos operativos y gastos.'
                : 'Déficit operativo: los gastos superan los ingresos en el periodo seleccionado.'}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
            {/* Margen Card */}
            <div className="bg-[#1f1f21] border border-[#3a3a3c] rounded-[18px] p-5 min-w-[190px]">
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
            <div className="bg-[#1f1f21] border border-[#3a3a3c] rounded-[18px] p-5 min-w-[190px]">
              <span className="text-[12px] font-medium text-[#cccccc] uppercase tracking-wider flex items-center justify-between">
                <span>Pedidos Web</span>
                <ShoppingBag className="w-3.5 h-3.5 text-[#2997ff]" />
              </span>
              <div className="flex items-center space-x-2 mt-1">
                <span className="text-[28px] font-semibold text-white tracking-tight">
                  {pedidos.length}
                </span>
                <span className="text-[14px] text-[#34c759] font-medium">
                  {formatCurrency(totalPedidosMonto)}
                </span>
              </div>
              <span className="text-[12px] text-[#7a7a7a] mt-1 block">
                Colección 'pedidos'
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Grid of Key Financial Cards: Light Parchment Surface (#f5f5f7) */}
      <div className="w-full bg-[#f5f5f7] py-12 px-6 sm:px-12 border-b border-[#e0e0e0]">
        <div className="max-w-[1200px] mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
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
              Ventas y entradas registradas
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
