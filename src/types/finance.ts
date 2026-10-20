import type { NegocioId, Rol } from '../lib/roles';
import type { UnidadBase, UnidadCompra } from '../lib/costeo';

export type { NegocioId, Rol, SeccionId, TabId } from '../lib/roles';

export type TransactionType = 'ingreso' | 'gasto';

export type PaymentMethod = 'efectivo' | 'transferencia' | 'tarjeta' | 'otro';

export type { DateFilter, DateRange } from '../lib/fechas';

export interface CategoryItem {
  id: string;
  name: string;
  entity: NegocioId;
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
  negocio: NegocioId;
  // campos opcionales para compatibilidad
  title?: string;
  amount?: number;
  type?: 'income' | 'expense' | 'ingreso' | 'gasto';
  entity?: NegocioId;
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

export interface FinanceMetrics {
  totalIncome: number;
  totalExpenses: number;
  netFreeCash: number;
  savingsOrProfitMargin: number; // percentage
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

/* ── Insumos (colección `insumos`) ── */

export type CategoriaInsumo =
  | 'Carne'
  | 'Panadería'
  | 'Quesos'
  | 'Verduras'
  | 'Salsas'
  | 'Papas'
  | 'Bebidas'
  | 'Extras'
  | 'Otros';

export interface Insumo {
  id: string;
  nombre: string;
  categoria: CategoriaInsumo | string;
  unidadCompra: UnidadCompra;
  /** Cuánto trae la compra: 5 (kg), 1 (litro), 30 (pza), 2 (paquetes)… */
  cantidadCompra: number;
  /** Precio del paquete completo */
  precioCompra: number;
  /** Sólo para unidadCompra === 'paquete': piezas que trae cada paquete */
  piezasPorPaquete?: number | null;
  unidadBase: UnidadBase;
  factorConversion: number;
  costoUnidadBase: number;
  stockActual: number;
  stockMinimo: number;
  proveedor: string | null;
  notas: string | null;
  activo: boolean;
}

/* ── Recetas (colección `recetas`) ── */

export interface RecetaIngrediente {
  insumoId: string;
  insumoNombre: string;
  /** En unidadBase del insumo (150 = 150 g de carne) */
  cantidad: number;
  /** Costo por unidad base en el momento de guardar (histórico) */
  costoUnitarioSnapshot: number;
  costoTotal: number;
}

export interface Receta {
  id: string;
  /** id del producto en MENU_DATA ('burger-especial', 'hotdog-tocino'…) */
  productoId: string;
  productoNombre: string;
  ingredientes: RecetaIngrediente[];
  /** Suma de ingredientes (+ papas si incluyePapas) al momento de guardar */
  costoTotal: number;
  incluyePapas: boolean;
  activo: boolean;
}
