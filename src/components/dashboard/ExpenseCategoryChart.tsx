import React, { useState } from 'react';
import { useFinance } from '../../context/FinanceContext';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { PieChart as PieIcon, BarChart3 } from 'lucide-react';

// Apple signature palette for category visualization
const APPLE_CHART_COLORS = [
  '#0066cc', // Action Blue
  '#2997ff', // Sky Blue
  '#ff3b30', // Apple Red
  '#ff9500', // Apple Orange
  '#34c759', // Apple Green
  '#af52de', // Apple Purple
  '#5856d6', // Apple Indigo
  '#ff2d55', // Apple Pink
  '#ffcc00', // Apple Yellow
  '#8e8e93', // Apple Neutral Gray
];

export const ExpenseCategoryChart: React.FC = () => {
  const { categoryExpenses, metrics } = useFinance();
  const [viewMode, setViewMode] = useState<'donut' | 'bars'>('donut');

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      maximumFractionDigits: 0,
    }).format(val);
  };

  const chartData = categoryExpenses.map((cat, index) => ({
    name: cat.name,
    value: cat.amount,
    count: cat.count,
    color: cat.color || APPLE_CHART_COLORS[index % APPLE_CHART_COLORS.length],
  }));

  const totalExpenseAmount = metrics.totalExpenses || 1;

  if (categoryExpenses.length === 0) {
    return (
      <div className="apple-card bg-white p-8 text-center text-[#7a7a7a]">
        <p className="text-[17px]">No hay gastos registrados en el periodo seleccionado.</p>
        <p className="text-[14px] mt-1 text-[#8e8e93]">
          Usa el botón "+ Nuevo Registro" para añadir tu primer gasto.
        </p>
      </div>
    );
  }

  return (
    <div className="apple-card bg-white">
      {/* Card Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-[#f0f0f0] gap-4">
        <div>
          <h3 className="text-[21px] font-semibold tracking-[-0.28px] text-[#1d1d1f]">
            Gastos por Categoría
          </h3>
          <p className="text-[14px] text-[#7a7a7a] mt-0.5">
            Distribución proporcional del gasto operativo y personal
          </p>
        </div>

        {/* View toggle */}
        <div className="flex items-center bg-[#f5f5f7] p-1 rounded-full border border-[#e0e0e0] self-start sm:self-auto">
          <button
            onClick={() => setViewMode('donut')}
            className={`flex items-center space-x-1.5 px-3 py-1 rounded-full text-[13px] transition-all apple-pressable ${
              viewMode === 'donut'
                ? 'bg-[#1d1d1f] text-white font-medium'
                : 'text-[#1d1d1f] hover:bg-[#eaeaea]'
            }`}
          >
            <PieIcon className="w-3.5 h-3.5" />
            <span>Circular</span>
          </button>
          <button
            onClick={() => setViewMode('bars')}
            className={`flex items-center space-x-1.5 px-3 py-1 rounded-full text-[13px] transition-all apple-pressable ${
              viewMode === 'bars'
                ? 'bg-[#1d1d1f] text-white font-medium'
                : 'text-[#1d1d1f] hover:bg-[#eaeaea]'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Barras</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pt-6 items-center">
        {/* Chart Side */}
        <div className="lg:col-span-5 h-[280px] sm:h-[320px] flex items-center justify-center relative">
          {viewMode === 'donut' ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={75}
                  outerRadius={115}
                  paddingAngle={3}
                  dataKey="value"
                  animationDuration={600}
                >
                  {chartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.color}
                      stroke="#ffffff"
                      strokeWidth={2}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(val: unknown) => [
                    formatCurrency(typeof val === 'number' ? val : 0),
                    'Gasto',
                  ]}
                  contentStyle={{
                    backgroundColor: '#1d1d1f',
                    border: 'none',
                    borderRadius: '12px',
                    color: '#ffffff',
                    fontSize: '13px',
                    boxShadow: 'none',
                  }}
                  itemStyle={{ color: '#ffffff' }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="w-full flex flex-col justify-center space-y-3 px-2">
              {chartData.slice(0, 5).map((item, i) => {
                const percent = Math.round((item.value / totalExpenseAmount) * 100);
                return (
                  <div key={i} className="w-full">
                    <div className="flex justify-between text-[13px] mb-1">
                      <span className="font-medium text-[#1d1d1f] truncate max-w-[200px]">
                        {item.name}
                      </span>
                      <span className="text-[#7a7a7a]">{formatCurrency(item.value)} ({percent}%)</span>
                    </div>
                    <div className="w-full h-2.5 bg-[#f5f5f7] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${percent}%`, backgroundColor: item.color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Centered Total in Donut */}
          {viewMode === 'donut' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-[12px] font-semibold text-[#7a7a7a] uppercase tracking-wider">
                Total Gastos
              </span>
              <span className="text-[20px] font-semibold text-[#1d1d1f] tracking-tight">
                {formatCurrency(metrics.totalExpenses)}
              </span>
            </div>
          )}
        </div>

        {/* Breakdown List Side */}
        <div className="lg:col-span-7 flex flex-col space-y-2.5 max-h-[340px] overflow-y-auto pr-1">
          {chartData.map((cat, idx) => {
            const percent = ((cat.value / totalExpenseAmount) * 100).toFixed(1);
            return (
              <div
                key={idx}
                className="flex items-center justify-between p-3 rounded-[12px] bg-[#fafafc] border border-[#f0f0f0] hover:border-[#e0e0e0] transition-colors"
              >
                <div className="flex items-center space-x-3 min-w-0">
                  <span
                    className="w-3.5 h-3.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: cat.color }}
                  />
                  <div className="truncate">
                    <span className="text-[15px] font-semibold text-[#1d1d1f] block truncate">
                      {cat.name}
                    </span>
                    <span className="text-[12px] text-[#7a7a7a]">
                      {cat.count} movimiento{cat.count > 1 ? 's' : ''}
                    </span>
                  </div>
                </div>

                <div className="text-right flex-shrink-0 pl-3">
                  <span className="text-[16px] font-semibold text-[#1d1d1f] block">
                    {formatCurrency(cat.value)}
                  </span>
                  <span className="text-[12px] text-[#7a7a7a] font-medium">
                    {percent}% del total
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
