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
  estado: string;
  subtotal?: number;
  modalidad?: string;
  origen?: string;
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
