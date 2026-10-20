import { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { FinanceProvider, useFinance } from './context/FinanceContext';
import { GlobalNav } from './components/common/GlobalNav';
import { SubNav } from './components/common/SubNav';
import { BottomNav } from './components/common/BottomNav';
import { FAB } from './components/common/FAB';
import { Sidebar } from './components/common/Sidebar';
import { AlertaPedidosBot } from './components/dashboard/AlertaPedidosBot';
import { HeroMetrics } from './components/dashboard/HeroMetrics';
import { PedidosRecientes } from './components/dashboard/PedidosRecientes';
import { InsumosModule } from './components/dashboard/InsumosModule';
import { ExpenseCategoryChart } from './components/dashboard/ExpenseCategoryChart';
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
import {
  isEmailAllowed,
  puedeVerSeccion,
  seccionInicial,
  tabsDisponibles,
} from './lib/roles';
import type { Rol, SeccionId, TabId } from './lib/roles';

function FinanceApp({ rol }: { rol: Rol }) {
  const { selectedSection, setSelectedSection } = useFinance();
  const [currentTabSolicitado, setCurrentTab] = useState<TabId>('dashboard');
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isFirebaseConfigModalOpen, setIsFirebaseConfigModalOpen] = useState(false);

  // Protección de pestañas: si el rol no puede ver la pestaña solicitada,
  // se cae a la primera permitida.
  const pestañasPermitidas = tabsDisponibles(rol);
  const currentTab: TabId = pestañasPermitidas.includes(currentTabSolicitado)
    ? currentTabSolicitado
    : (pestañasPermitidas[0] ?? 'dashboard');

  // Protección de sección: si la sección activa no es visible para el rol se
  // renderiza la sección inicial (Hamburguesas).
  const seccion: SeccionId = puedeVerSeccion(rol, selectedSection)
    ? selectedSection
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
    <div className="ambient-bg min-h-screen flex bg-[#09080a] text-[var(--text)]">
      {/* Sidebar de escritorio (lg+): reemplaza al menú del header y a la BottomNav */}
      <Sidebar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        seccion={seccion}
        setSeccion={setSelectedSection}
      />

      <div className="flex-1 min-w-0 flex flex-col">
      {/* 44px Apple Global Navigation */}
      <GlobalNav
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        onOpenAuth={() => setIsAuthModalOpen(true)}
        onOpenFirebaseConfig={() => setIsFirebaseConfigModalOpen(true)}
      />

      {/* 52px Frosted Sub Navigation with Section Switcher */}
      <SubNav
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        onOpenNewTransaction={handleOpenNewTransaction}
      />

      {/* Main Content Areas */}
      <main className="flex-1 bg-transparent">
        {currentTab === 'dashboard' &&
          (esSeccionCosteo ? (
            /* Insumos y Recetas: módulo de costeo con sub-tabs Inventario | Recetas */
            <InsumosModule
              key={seccion}
              subTabInicial={seccion === 'recetas' ? 'recetas' : 'inventario'}
            />
          ) : (
            <div>
              {/* Alerta de pedidos nuevos del bot de Telegram (si hay pendientes) */}
              <AlertaPedidosBot />

              {/* 1. Hero Tiles (Alternating dark and parchment) */}
              <HeroMetrics />

              {/* 2. Pedidos web recientes (justo debajo del contador de pedidos) */}
              <PedidosRecientes />

              {/* 3. Charts & Financial Deep-dive (mismo --bg) */}
              <div className="w-full py-8 px-4 sm:py-12 sm:px-12 bg-transparent border-b border-white/5">
                <div className="max-w-[1200px] mx-auto grid grid-cols-1 gap-10">
                  <ExpenseCategoryChart />
                </div>
              </div>
            </div>
          ))}

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

      {/* FAB de nuevo registro (en la raíz: el backdrop-filter del SubNav lo
          convertiría en `fixed` respecto al nav y no al viewport).
          En móvil reemplaza al botón del SubNav; en desktop conviven los dos. */}
      <FAB onClick={handleOpenNewTransaction} />

      {/* Móvil: navegación inferior estilo app nativa (pestañas según rol) */}
      <BottomNav currentTab={currentTab} setCurrentTab={setCurrentTab} />
      </div>
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

  // Puerta cerrada: sin sesión, con correo fuera de la whitelist o con correo
  // sin verificar NUNCA se monta el dashboard ni el FinanceProvider (por tanto
  // tampoco se abren listeners de Firestore).
  if (!user || !user.emailVerified || !isEmailAllowed(user.email)) {
    return <PantallaLogin />;
  }

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
