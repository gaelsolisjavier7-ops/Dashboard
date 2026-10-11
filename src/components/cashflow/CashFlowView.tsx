import React, { useState } from 'react';
import { useFinance } from '../../context/FinanceContext';
import { BurgerVisual, AirPodsVisual } from '../common/ProductVisuals';
import {
  ArrowRight,
  Wallet,
  CheckCircle2,
} from 'lucide-react';

export const CashFlowView: React.FC = () => {
  const { metrics, transferProfitToPersonal, loadingTransactions } = useFinance();
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [transferTarget, setTransferTarget] = useState<'hamburguesas' | 'airpods'>('hamburguesas');
  const [transferAmount, setTransferAmount] = useState<number>(0);
  const [transferNote, setTransferNote] = useState<string>('');
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      maximumFractionDigits: 0,
    }).format(val || 0);
  };

  const burgerStats = metrics.entityBreakdown.hamburguesas;
  const airpodsStats = metrics.entityBreakdown.airpods;
  const personalStats = metrics.entityBreakdown.personal;

  const totalBusinessIncome = burgerStats.income + airpodsStats.income;
  const totalBusinessExpenses = burgerStats.expenses + airpodsStats.expenses;
  const totalBusinessFreeCash = burgerStats.freeCash + airpodsStats.freeCash;
  const totalBusinessMargin =
    totalBusinessIncome > 0
      ? Math.round((totalBusinessFreeCash / totalBusinessIncome) * 100 * 10) / 10
      : 0;

  const handleOpenTransfer = (entity: 'hamburguesas' | 'airpods', maxAmount: number) => {
    setTransferTarget(entity);
    setTransferAmount(Math.max(0, Math.round(maxAmount * 0.7))); // suggest 70% of free cash
    setTransferNote(`Retiro de utilidades mensual`);
    setTransferModalOpen(true);
  };

  const handleExecuteTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (transferAmount <= 0) return;
    await transferProfitToPersonal(transferTarget, transferAmount, transferNote);
    setTransferModalOpen(false);
    setSuccessToast(
      `¡Transferencia de ${formatCurrency(transferAmount)} a Finanzas Personales registrada con éxito en Firestore!`
    );
    setTimeout(() => setSuccessToast(null), 4000);
  };

  const burgerHasActivity = burgerStats.income > 0 || burgerStats.expenses > 0;
  const airpodsHasActivity = airpodsStats.income > 0 || airpodsStats.expenses > 0;

  return (
    <div className="w-full">
      {/* Toast Alert */}
      {successToast && (
        <div className="fixed bottom-24 left-4 right-4 sm:bottom-6 sm:left-auto sm:right-6 z-50 bg-[#1d1d1f] text-white px-5 py-3.5 rounded-full shadow-lg flex items-center justify-center sm:justify-start space-x-2 text-[13px] sm:text-[14px]">
          <CheckCircle2 className="w-4 h-4 text-[#34c759]" />
          <span>{successToast}</span>
        </div>
      )}

      {/* Hero Header: Product-tile-dark (#272729) */}
      <div className="w-full bg-[#272729] text-white py-10 px-4 sm:py-16 sm:px-12 border-b border-[#333333]">
        <div className="max-w-[1200px] mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
          <div className="w-full min-w-0 md:w-auto">
            <div className="inline-flex max-w-full items-center space-x-2 px-3 py-1 rounded-full bg-[#333333] text-[#2997ff] text-[12px] font-semibold tracking-wide uppercase mb-3">
              <Wallet className="w-3.5 h-3.5" />
              <span>Flujo de Caja Consolidado en Tiempo Real</span>
            </div>
            <h1 className="text-[34px] sm:text-[48px] font-semibold tracking-[-0.025em] leading-[1.08] text-white break-words">
              {formatCurrency(totalBusinessFreeCash)}
            </h1>
            <p className="text-[16px] sm:text-[17px] text-[#cccccc] font-normal leading-relaxed mt-2 max-w-[580px]">
              {totalBusinessIncome === 0 && totalBusinessExpenses === 0
                ? 'No hay movimientos registrados en Firestore aún. Todos los cálculos muestran $0.'
                : 'Efectivo libre generado por tus dos negocios (Hamburguesas y AirPods) después de cubrir insumos, lotes y costos operativos.'}
            </p>
          </div>

          {/* Business Summary Pill Card */}
          <div className="bg-[#1f1f21] border border-[#3a3a3c] rounded-[18px] p-5 sm:p-6 min-w-0 w-full sm:w-auto sm:min-w-[260px]">
            <span className="text-[12px] font-medium text-[#cccccc] uppercase tracking-wider block">
              Margen Libre de Negocios
            </span>
            <div className="text-[32px] font-semibold text-white tracking-tight mt-1">
              {totalBusinessMargin}%
            </div>
            <div className="text-[13px] text-[#7a7a7a] mt-2 space-y-1">
              <div className="flex justify-between">
                <span>Ventas Totales:</span>
                <span className="text-white font-medium">{formatCurrency(totalBusinessIncome)}</span>
              </div>
              <div className="flex justify-between">
                <span>Costos Totales:</span>
                <span className="text-[#ff3b30] font-medium">-{formatCurrency(totalBusinessExpenses)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Section 1: Business Waterfall Breakdowns (White canvas) */}
      <div className="w-full py-10 px-4 sm:py-16 sm:px-12 bg-white border-b border-[#e0e0e0]">
        <div className="max-w-[1200px] mx-auto">
          <div className="mb-6 sm:mb-10">
            <span className="text-[13px] font-semibold text-[#0066cc] uppercase tracking-wider">
              Análisis Unitario
            </span>
            <h2 className="text-[26px] sm:text-[38px] font-semibold text-[#1d1d1f] tracking-[-0.374px] mt-1">
              Flujo de Caja por Negocio
            </h2>
            <p className="text-[15px] sm:text-[17px] text-[#7a7a7a] max-w-[620px] mt-1">
              Visualiza paso a paso la resta de gastos para saber con exactitud cuánto dinero te queda limpio en cada emprendimiento.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
            {/* BUSINESS 1: HAMBURGUESAS */}
            <div className="apple-card bg-white border border-[#e0e0e0] flex flex-col justify-between">
              <div>
                <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#f0f0f0]">
                  <div className="flex items-center space-x-3">
                    <BurgerVisual className="w-12 h-12 sm:w-14 sm:h-14" />
                    <div>
                      <h3 className="text-[19px] sm:text-[21px] font-semibold text-[#1d1d1f]">
                        Negocio de Hamburguesas
                      </h3>
                      <span className="text-[13px] text-[#7a7a7a]">Venta en local & delivery</span>
                    </div>
                  </div>
                  <span
                    className={`text-[13px] font-semibold px-3 py-1 rounded-full ${
                      !burgerHasActivity
                        ? 'bg-[#f5f5f7] text-[#7a7a7a]'
                        : burgerStats.freeCash >= 0
                        ? 'bg-[#34c759]/10 text-[#34c759]'
                        : 'bg-[#ff3b30]/10 text-[#ff3b30]'
                    }`}
                  >
                    {!burgerHasActivity ? 'Sin datos' : `${burgerStats.margin}% Margen`}
                  </span>
                </div>

                {/* Waterfall steps */}
                <div className="mt-6 space-y-3">
                  <div className="flex items-center justify-between p-3 sm:p-3.5 rounded-[12px] bg-[#f5f5f7]">
                    <div className="flex items-center space-x-2 text-[#1d1d1f]">
                      <span className="w-5 h-5 rounded-full bg-[#0066cc] text-white flex items-center justify-center text-[12px] font-bold">
                        +
                      </span>
                      <span className="text-[14px] sm:text-[15px] font-semibold">Ventas Totales (Brutas)</span>
                    </div>
                    <span className="flex-shrink-0 whitespace-nowrap text-[16px] font-semibold text-[#1d1d1f]">
                      {formatCurrency(burgerStats.income)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-3 sm:p-3.5 rounded-[12px] bg-[#fafafc] border border-[#f0f0f0]">
                    <div className="flex items-center space-x-2 text-[#ff3b30]">
                      <span className="w-5 h-5 rounded-full bg-[#ff3b30] text-white flex items-center justify-center text-[12px] font-bold">
                        -
                      </span>
                      <span className="text-[14px] sm:text-[15px] font-medium text-[#1d1d1f]">
                        Gastos Operativos (Carne, Insumos, Sueldos)
                      </span>
                    </div>
                    <span className="flex-shrink-0 whitespace-nowrap text-[16px] font-semibold text-[#ff3b30]">
                      -{formatCurrency(burgerStats.expenses)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-3.5 sm:p-4 rounded-[14px] bg-[#0066cc]/5 border border-[#0066cc]/20 mt-4">
                    <div>
                      <span className="text-[12px] font-semibold uppercase tracking-wider text-[#0066cc] block">
                        Flujo de Caja Libre
                      </span>
                      <span className="text-[22px] font-semibold text-[#1d1d1f]">
                        {formatCurrency(burgerStats.freeCash)}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[12px] text-[#7a7a7a] block">Dinero limpio</span>
                      <span className="text-[14px] font-semibold text-[#34c759]">
                        {!burgerHasActivity
                          ? '$0 sin actividad'
                          : burgerStats.freeCash > 0
                          ? 'Excedente positivo'
                          : 'Déficit'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <button
                onClick={() => handleOpenTransfer('hamburguesas', burgerStats.freeCash)}
                disabled={burgerStats.freeCash <= 0}
                className="mt-6 w-full flex items-center justify-center space-x-2 apple-btn-primary py-3 text-[15px] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <span>Transferir Utilidad a Personal</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {/* BUSINESS 2: REVENTA AIRPODS */}
            <div className="apple-card bg-white border border-[#e0e0e0] flex flex-col justify-between">
              <div>
                <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#f0f0f0]">
                  <div className="flex items-center space-x-3">
                    <AirPodsVisual className="w-12 h-12 sm:w-14 sm:h-14" />
                    <div>
                      <h3 className="text-[19px] sm:text-[21px] font-semibold text-[#1d1d1f]">
                        Negocio de AirPods
                      </h3>
                      <span className="text-[13px] text-[#7a7a7a]">Reventa & E-commerce</span>
                    </div>
                  </div>
                  <span
                    className={`text-[13px] font-semibold px-3 py-1 rounded-full ${
                      !airpodsHasActivity
                        ? 'bg-[#f5f5f7] text-[#7a7a7a]'
                        : airpodsStats.freeCash >= 0
                        ? 'bg-[#34c759]/10 text-[#34c759]'
                        : 'bg-[#ff3b30]/10 text-[#ff3b30]'
                    }`}
                  >
                    {!airpodsHasActivity ? 'Sin datos' : `${airpodsStats.margin}% Margen`}
                  </span>
                </div>

                {/* Waterfall steps */}
                <div className="mt-6 space-y-3">
                  <div className="flex items-center justify-between p-3 sm:p-3.5 rounded-[12px] bg-[#f5f5f7]">
                    <div className="flex items-center space-x-2 text-[#1d1d1f]">
                      <span className="w-5 h-5 rounded-full bg-[#0066cc] text-white flex items-center justify-center text-[12px] font-bold">
                        +
                      </span>
                      <span className="text-[14px] sm:text-[15px] font-semibold">Ventas AirPods Pro / Max</span>
                    </div>
                    <span className="flex-shrink-0 whitespace-nowrap text-[16px] font-semibold text-[#1d1d1f]">
                      {formatCurrency(airpodsStats.income)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-3 sm:p-3.5 rounded-[12px] bg-[#fafafc] border border-[#f0f0f0]">
                    <div className="flex items-center space-x-2 text-[#ff3b30]">
                      <span className="w-5 h-5 rounded-full bg-[#ff3b30] text-white flex items-center justify-center text-[12px] font-bold">
                        -
                      </span>
                      <span className="text-[14px] sm:text-[15px] font-medium text-[#1d1d1f]">
                        Compra de Lote & Envíos (Stock)
                      </span>
                    </div>
                    <span className="flex-shrink-0 whitespace-nowrap text-[16px] font-semibold text-[#ff3b30]">
                      -{formatCurrency(airpodsStats.expenses)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-3.5 sm:p-4 rounded-[14px] bg-[#0066cc]/5 border border-[#0066cc]/20 mt-4">
                    <div>
                      <span className="text-[12px] font-semibold uppercase tracking-wider text-[#0066cc] block">
                        Flujo de Caja Libre
                      </span>
                      <span className="text-[22px] font-semibold text-[#1d1d1f]">
                        {formatCurrency(airpodsStats.freeCash)}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[12px] text-[#7a7a7a] block">Dinero limpio</span>
                      <span className="text-[14px] font-semibold text-[#34c759]">
                        {!airpodsHasActivity
                          ? '$0 sin actividad'
                          : airpodsStats.freeCash > 0
                          ? 'Excedente positivo'
                          : 'Déficit'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <button
                onClick={() => handleOpenTransfer('airpods', airpodsStats.freeCash)}
                disabled={airpodsStats.freeCash <= 0}
                className="mt-6 w-full flex items-center justify-center space-x-2 apple-btn-primary py-3 text-[15px] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <span>Transferir Utilidad a Personal</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Section 2: Personal Connection (Parchment Surface #f5f5f7) */}
      <div className="w-full py-10 px-4 sm:py-16 sm:px-12 bg-[#f5f5f7] border-b border-[#e0e0e0]">
        <div className="max-w-[1200px] mx-auto">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-6 mb-6 sm:mb-8">
            <div>
              <span className="text-[13px] font-semibold text-[#0066cc] uppercase tracking-wider">
                Impacto en Vida Real
              </span>
              <h2 className="text-[24px] sm:text-[34px] font-semibold text-[#1d1d1f] tracking-[-0.374px] mt-1">
                ¿Cómo alimentan tus negocios tus Finanzas Personales?
              </h2>
            </div>
            <div className="apple-btn-secondary px-4 py-2 self-start cursor-default">
              <span>Ahorro Libre: {formatCurrency(personalStats.freeCash)}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
            <div className="apple-card bg-white">
              <span className="text-[13px] font-semibold text-[#7a7a7a] uppercase tracking-wide">
                Ingresos Personales Totales
              </span>
              <div className="text-[26px] font-semibold text-[#1d1d1f] mt-2">
                {formatCurrency(personalStats.income)}
              </div>
              <p className="text-[13px] text-[#7a7a7a] mt-2">
                Incluye dividendos retirados de Hamburguesas y AirPods + sueldo propio.
              </p>
            </div>

            <div className="apple-card bg-white">
              <span className="text-[13px] font-semibold text-[#7a7a7a] uppercase tracking-wide">
                Gastos Personales (Vivienda & Vida)
              </span>
              <div className="text-[26px] font-semibold text-[#ff3b30] mt-2">
                -{formatCurrency(personalStats.expenses)}
              </div>
              <p className="text-[13px] text-[#7a7a7a] mt-2">
                Renta, despensa, transporte, suscripciones y estilo de vida.
              </p>
            </div>

            <div className="apple-card bg-white border-2 border-[#34c759]/30">
              <span className="text-[13px] font-semibold text-[#34c759] uppercase tracking-wide">
                Superávit / Dinero en Bolsillo
              </span>
              <div className="text-[26px] font-semibold text-[#1d1d1f] mt-2">
                {formatCurrency(personalStats.freeCash)}
              </div>
              <p className="text-[13px] text-[#7a7a7a] mt-2">
                {personalStats.freeCash > 0
                  ? 'Dinero 100% libre para ahorro o inversión patrimonial.'
                  : personalStats.freeCash < 0
                  ? 'Atención: tus gastos de vida superaron tus ingresos retirados.'
                  : '$0 saldo actual registrado en Firestore.'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Transfer Modal */}
      {transferModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-[24px] max-w-[460px] w-full p-6 sm:p-8 border border-[#e0e0e0] shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-[20px] sm:text-[22px] font-semibold text-[#1d1d1f] tracking-tight">
              Transferir Flujo Libre a Personal
            </h3>
            <p className="text-[14px] text-[#7a7a7a] mt-1">
              Pasa las utilidades netas generadas por tu negocio de{' '}
              <span className="font-semibold text-[#1d1d1f]">
                {transferTarget === 'hamburguesas' ? 'Hamburguesas' : 'AirPods'}
              </span>{' '}
              hacia tu cuenta de Finanzas Personales.
            </p>

            <form onSubmit={handleExecuteTransfer} className="mt-6 space-y-4">
              <div>
                <label className="block text-[13px] font-semibold text-[#1d1d1f] mb-1.5">
                  Monto a retirar ($ MXN)
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={transferAmount || ''}
                  onChange={(e) => setTransferAmount(Number(e.target.value))}
                  className="w-full text-[18px] sm:text-[20px] font-semibold px-4 py-3 rounded-[12px] bg-[#f5f5f7] border border-[#e0e0e0] focus:border-[#0071e3] outline-none"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-[13px] font-semibold text-[#1d1d1f] mb-1.5">
                  Concepto / Nota
                </label>
                <input
                  type="text"
                  value={transferNote}
                  onChange={(e) => setTransferNote(e.target.value)}
                  className="w-full text-[14px] px-4 py-3 rounded-[12px] bg-[#f5f5f7] border border-[#e0e0e0] focus:border-[#0071e3] outline-none"
                  placeholder="Ej. Retiro de quincena"
                />
              </div>

              <div className="pt-4 flex flex-col gap-3 sm:gap-0 sm:flex-row sm:items-center sm:justify-end sm:space-x-3">
                <button
                  type="button"
                  onClick={() => setTransferModalOpen(false)}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-full text-[15px] text-[#1d1d1f] hover:bg-[#f5f5f7] transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="apple-btn-primary w-full sm:w-auto px-6 py-2.5 text-[15px] cursor-pointer"
                >
                  Confirmar Retiro
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
