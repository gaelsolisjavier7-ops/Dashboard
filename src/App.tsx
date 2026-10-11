import { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { FinanceProvider, useFinance } from './context/FinanceContext';
import { GlobalNav } from './components/common/GlobalNav';
import { SubNav } from './components/common/SubNav';
import { BottomNav } from './components/common/BottomNav';
import { HeroMetrics } from './components/dashboard/HeroMetrics';
import { PedidosRecientes } from './components/dashboard/PedidosRecientes';
import { AirPodsModule } from './components/dashboard/AirPodsModule';
import { InsumosModule } from './components/dashboard/InsumosModule';
import { ExpenseCategoryChart } from './components/dashboard/ExpenseCategoryChart';
import { EntityComparison } from './components/dashboard/EntityComparison';
import { CashFlowView } from './components/cashflow/CashFlowView';
import { TransactionList } from './components/transactions/TransactionList';
import { TransactionModal } from './components/transactions/TransactionModal';
import { AuthModal } from './components/auth/AuthModal';
import {
  PantallaCargando,
  PantallaLogin,
  PantallaPendiente,
} from './components/auth/AccessScreens';
import { FirebaseConfigModal } from './components/common/FirebaseConfigModal';
import { Footer } from './components/common/Footer';
import type { Transaction } from './types/finance';
import { puedeVerSeccion, puedeVerTab, seccionInicial, tabsDisponibles } from './lib/roles';
import type { Rol, SeccionId, TabId } from './lib/roles';
import { ArrowRight, Plus } from 'lucide-react';

function FinanceApp({ rol }: { rol: Rol }) {
  const { selectedEntity } = useFinance();
  const [currentTabSolicitado, setCurrentTab] = useState<TabId>('dashboard');
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isFirebaseConfigModalOpen, setIsFirebaseConfigModalOpen] = useState(false);

  // ── Protección de pestañas (punto 5): si el rol no puede ver la pestaña
  // solicitada se cae a la primera permitida (el socio nunca llega a Flujo de
  // Caja, que expone Personal y AirPods).
  const pestañasPermitidas = tabsDisponibles(rol);
  const currentTab: TabId = pestañasPermitidas.includes(currentTabSolicitado)
    ? currentTabSolicitado
    : (pestañasPermitidas[0] ?? 'dashboard');

  // ── Protección de sección: si la pill activa no es visible para el rol se
  // renderiza la sección inicial del rol (Hamburguesas para el socio).
  const seccion: SeccionId = puedeVerSeccion(rol, selectedEntity)
    ? selectedEntity
    : seccionInicial(rol);

  const handleOpenNewTransaction = () => {
    setEditingTransaction(null);
    setIsTransactionModalOpen(true);
  };

  const handleEditTransaction = (tx: Transaction) => {
    setEditingTransaction(tx);
    setIsTransactionModalOpen(true);
  };

  // Insumos y Recetas comparten el mismo módulo de costeo (con sub-tabs)
  const esSeccionCosteo = seccion === 'insumos' || seccion === 'recetas';

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
          (seccion === 'airpods' ? (
            /* Tab AirPods: módulo de inventario en lugar del resumen general */
            <AirPodsModule />
          ) : esSeccionCosteo ? (
            /* Insumos y Recetas: módulo de costeo con sub-tabs Inventario | Recetas */
            <InsumosModule
              key={seccion}
              subTabInicial={seccion === 'recetas' ? 'recetas' : 'inventario'}
            />
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

              {/* 4. Quick Jump to Cash Flow & Transactions (sólo si el rol puede) */}
              {puedeVerTab(rol, 'cashflow') && (
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
              )}
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

      {/* Móvil: navegación inferior estilo app nativa (pestañas según rol) */}
      <BottomNav currentTab={currentTab} setCurrentTab={setCurrentTab} />
    </div>
  );
}

/**
 * Portero de acceso (punto 9):
 *  - cargando        → spinner
 *  - sin sesión      → pantalla de login con Google
 *  - sin rol válido  → "cuenta pendiente de activación"
 *  - con rol         → dashboard (el FinanceProvider no se monta antes, así que
 *                      no se abren listeners de Firestore para usuarios sin permisos)
 */
function AppGate() {
  const { user, rol, loading } = useAuth();

  if (loading) return <PantallaCargando />;
  if (!user) return <PantallaLogin />;
  if (!rol) return <PantallaPendiente />;

  return (
    <FinanceProvider>
      <FinanceApp rol={rol} />
    </FinanceProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppGate />
    </AuthProvider>
  );
}
