import { useState } from 'react';
import { AuthProvider } from './context/AuthContext';
import { FinanceProvider, useFinance } from './context/FinanceContext';
import { GlobalNav } from './components/common/GlobalNav';
import { SubNav } from './components/common/SubNav';
import { BottomNav } from './components/common/BottomNav';
import { HeroMetrics } from './components/dashboard/HeroMetrics';
import { PedidosRecientes } from './components/dashboard/PedidosRecientes';
import { AirPodsModule } from './components/dashboard/AirPodsModule';
import { ExpenseCategoryChart } from './components/dashboard/ExpenseCategoryChart';
import { EntityComparison } from './components/dashboard/EntityComparison';
import { CashFlowView } from './components/cashflow/CashFlowView';
import { TransactionList } from './components/transactions/TransactionList';
import { TransactionModal } from './components/transactions/TransactionModal';
import { AuthModal } from './components/auth/AuthModal';
import { FirebaseConfigModal } from './components/common/FirebaseConfigModal';
import { Footer } from './components/common/Footer';
import type { Transaction } from './types/finance';
import { ArrowRight, Plus } from 'lucide-react';

function FinanceApp() {
  const { selectedEntity } = useFinance();
  const [currentTab, setCurrentTab] = useState<'dashboard' | 'transactions' | 'cashflow'>('dashboard');
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isFirebaseConfigModalOpen, setIsFirebaseConfigModalOpen] = useState(false);

  const handleOpenNewTransaction = () => {
    setEditingTransaction(null);
    setIsTransactionModalOpen(true);
  };

  const handleEditTransaction = (tx: Transaction) => {
    setEditingTransaction(tx);
    setIsTransactionModalOpen(true);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#ffffff] text-[#1d1d1f]">
      {/* 44px Apple Global Navigation */}
      <GlobalNav
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        onOpenAuth={() => setIsAuthModalOpen(true)}
        onOpenFirebaseConfig={() => setIsFirebaseConfigModalOpen(true)}
      />

      {/* 52px Frosted Sub Navigation with Entity Switcher */}
      <SubNav
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        onOpenNewTransaction={handleOpenNewTransaction}
      />

      {/* Main Content Areas */}
      <main className="flex-1">
        {currentTab === 'dashboard' &&
          (selectedEntity === 'airpods' ? (
            /* Tab AirPods: módulo de inventario en lugar del resumen general */
            <AirPodsModule />
          ) : (
            <div>
              {/* 1. Hero Tiles (Alternating dark and parchment) */}
              <HeroMetrics />

              {/* 2. Pedidos web recientes (justo debajo del contador de pedidos) */}
              <PedidosRecientes />

              {/* 3. Charts & Financial Deep-dive (White Canvas) */}
              <div className="w-full py-8 px-4 sm:py-12 sm:px-12 bg-[#ffffff] border-b border-[#e0e0e0]">
                <div className="max-w-[1200px] mx-auto grid grid-cols-1 gap-10">
                  <ExpenseCategoryChart />
                </div>
              </div>

              {/* 3. Entity Comparison (Smash Burgers, AirPods, Personal) */}
              <EntityComparison />

              {/* 4. Quick Jump to Cash Flow & Transactions */}
              <div className="w-full py-10 px-4 sm:py-14 sm:px-12 bg-[#f5f5f7] border-b border-[#e0e0e0]">
                <div className="max-w-[1200px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
                  <div>
                    <h3 className="text-[24px] font-semibold text-[#1d1d1f] tracking-tight">
                      ¿Quieres ver cuánto dinero libre te queda exactamente?
                    </h3>
                    <p className="text-[15px] text-[#7a7a7a] mt-1">
                      Accede a la vista detallada de Flujo de Caja con el desglose paso a paso de cada negocio.
                    </p>
                  </div>
                  <button
                    onClick={() => setCurrentTab('cashflow')}
                    className="apple-btn-primary whitespace-nowrap px-6 py-3 cursor-pointer"
                  >
                    <span>Abrir Flujo de Caja</span>
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </button>
                </div>
              </div>
            </div>
          ))}

        {currentTab === 'cashflow' && <CashFlowView />}

        {currentTab === 'transactions' && (
          <TransactionList
            onOpenNewTransaction={handleOpenNewTransaction}
            onEditTransaction={handleEditTransaction}
          />
        )}
      </main>

      {/* Apple Parchment Footer */}
      <Footer />

      {/* Modals */}
      <TransactionModal
        isOpen={isTransactionModalOpen}
        onClose={() => {
          setIsTransactionModalOpen(false);
          setEditingTransaction(null);
        }}
        editingTransaction={editingTransaction}
      />

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onOpenConfig={() => setIsFirebaseConfigModalOpen(true)}
      />

      <FirebaseConfigModal
        isOpen={isFirebaseConfigModalOpen}
        onClose={() => setIsFirebaseConfigModalOpen(false)}
      />

      {/* Móvil: FAB de nuevo registro.
          Va en la raíz (no dentro del SubNav) porque el backdrop-filter del
          SubNav convertiría a este elemento en `fixed` respecto a él y no al viewport. */}
      <button
        type="button"
        onClick={handleOpenNewTransaction}
        aria-label="Nuevo Registro"
        title="Nuevo Registro"
        className="sm:hidden fixed bottom-20 right-4 z-40 w-14 h-14 rounded-full bg-[#0066cc] text-white shadow-2xl flex items-center justify-center apple-pressable cursor-pointer hover:bg-[#0071e3]"
      >
        <Plus className="w-6 h-6" />
      </button>

      {/* Móvil: navegación inferior estilo app nativa */}
      <BottomNav currentTab={currentTab} setCurrentTab={setCurrentTab} />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <FinanceProvider>
        <FinanceApp />
      </FinanceProvider>
    </AuthProvider>
  );
}
