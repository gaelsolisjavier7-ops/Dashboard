import { useState } from 'react';
import { AuthProvider } from './context/AuthContext';
import { FinanceProvider } from './context/FinanceContext';
import { GlobalNav } from './components/common/GlobalNav';
import { SubNav } from './components/common/SubNav';
import { HeroMetrics } from './components/dashboard/HeroMetrics';
import { ExpenseCategoryChart } from './components/dashboard/ExpenseCategoryChart';
import { EntityComparison } from './components/dashboard/EntityComparison';
import { CashFlowView } from './components/cashflow/CashFlowView';
import { TransactionList } from './components/transactions/TransactionList';
import { TransactionModal } from './components/transactions/TransactionModal';
import { AuthModal } from './components/auth/AuthModal';
import { FirebaseConfigModal } from './components/common/FirebaseConfigModal';
import { Footer } from './components/common/Footer';
import type { Transaction } from './types/finance';
import { ArrowRight } from 'lucide-react';

function FinanceApp() {
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
        {currentTab === 'dashboard' && (
          <div>
            {/* 1. Hero Tiles (Alternating dark and parchment) */}
            <HeroMetrics />

            {/* 2. Charts & Financial Deep-dive (White Canvas) */}
            <div className="w-full py-12 px-6 sm:px-12 bg-[#ffffff] border-b border-[#e0e0e0]">
              <div className="max-w-[1200px] mx-auto grid grid-cols-1 gap-10">
                <ExpenseCategoryChart />
              </div>
            </div>

            {/* 3. Entity Comparison (Smash Burgers, AirPods, Personal) */}
            <EntityComparison />

            {/* 4. Quick Jump to Cash Flow & Transactions */}
            <div className="w-full py-14 px-6 sm:px-12 bg-[#f5f5f7] border-b border-[#e0e0e0]">
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
        )}

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
