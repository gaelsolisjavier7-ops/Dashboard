import type { Rol } from '../lib/roles';

export type { NegocioId, Rol, SeccionId, TabId } from '../lib/roles';

export type EntityType = 'personal' | 'hamburguesas' | 'airpods';

export type TransactionType = 'ingreso' | 'gasto';

export type PaymentMethod = 'efectivo' | 'transferencia' | 'tarjeta' | 'otro';

export type DateFilter = 'month' | 'quarter' | 'all';

export interface CategoryItem {
  id: string;
  name: string;
  entity: EntityType | 'all';
  type: TransactionType;
  color?: string;
}

export interface Transaction {
  id: string;
  fecha: string; // ISO date YYYY-MM-DD o timestamp string
  tipo: TransactionType;
  categoria: string;
  monto: number;
  descripcion: string;
  negocio: EntityType;
  // campos opcionales para compatibilidad
  title?: string;
  amount?: number;
  type?: 'income' | 'expense' | 'ingreso' | 'gasto';
  entity?: EntityType;
  category?: string;
  date?: string;
  notes?: string;
  paymentMethod?: PaymentMethod;
  createdAt?: number;
}

export type Transaccion = Transaction;

export interface Pedido {
  id: string;
  /** Fecha completa en ISO 8601 (incluye hora cuando el pedido la trae). */
  fecha: string;
  /** Fecha del pedido en milisegundos (epoch) para ordenar y filtrar por periodo. */
  fechaMs: number;
  /** true si la fecha original del pedido incluía hora y minutos. */
  tieneHora: boolean;
  total: number;
  productos: any;
  cliente: string;
  clienteTelefono?: string | null;
  clienteDireccion?: string | null;
  estado: string;
  subtotal?: number;
  modalidad?: string;
  origen?: string;
}

/* ── Inventario AirPods (colección `inventario_airpods`) ── */

export type TipoMovimientoAirPods = 'compra' | 'venta';

/** Documento de `inventario_airpods` normalizado para la UI. */
export interface MovimientoAirPods {
  id: string;
  tipo: TipoMovimientoAirPods;
  cantidad: number;
  precio_unitario: number;
  /** cantidad × precio_unitario (lo que realmente se guarda en Firestore). */
  total: number;
  /** Fecha del movimiento en ISO 8601. */
  fecha: string;
  /** Fecha del movimiento en milisegundos (epoch) para ordenar y filtrar. */
  fechaMs: number;
  tieneHora: boolean;
  notas: string | null;
  cliente: string | null;
  createdAtMs: number | null;
}

export interface InventarioAirPodsMetrics {
  /** Unidades en stock: compradas − vendidas. */
  stockActual: number;
  /** Dinero parado en inventario: stockActual × precioPromedioCompra. */
  capitalInmovilizado: number;
  /** Ventas cobradas − costo promedio de lo vendido. */
  gananciaAcumulada: number;
  unidadesCompradas: number;
  unidadesVendidas: number;
  precioPromedioCompra: number;
  precioPromedioVenta: number;
  /** Ratio 0..1: para mostrarlo como % hay que multiplicar por 100. */
  margenPromedio: number;
  inversionTotal: number;
  ingresosTotales: number;
}

export interface CashFlowMetrics {
  totalIncome: number;
  totalExpenses: number;
  netFreeCash: number;
  savingsOrProfitMargin: number; // percentage
  entityBreakdown: {
    [key in EntityType]: {
      income: number;
      expenses: number;
      freeCash: number;
      margin: number;
    };
  };
}

export interface FirebaseConfigState {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
}

/* ── Permisos multi-usuario (colección `usuarios`) ── */

/** Documento `usuarios/{email}` normalizado para la UI. */
export interface UsuarioPerfil {
  /** docId: el correo exacto en minúsculas. */
  id: string;
  email: string;
  nombre?: string | null;
  /** null ⇒ documento inexistente o sin un rol reconocido. */
  rol: Rol | null;
  /** Documento crudo de Firestore, por si se necesitan campos extra. */
  datos: Record<string, unknown>;
}
