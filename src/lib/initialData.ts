import type { CategoryItem, Transaction } from '../types/finance';

export const DEFAULT_CATEGORIES: CategoryItem[] = [
  // Hamburguesas
  { id: 'h-inc-1', name: 'Ventas Mostrador', entity: 'hamburguesas', type: 'ingreso', color: '#0066cc' },
  { id: 'h-inc-2', name: 'Ventas Delivery', entity: 'hamburguesas', type: 'ingreso', color: '#2997ff' },
  { id: 'h-inc-3', name: 'Eventos & Catering', entity: 'hamburguesas', type: 'ingreso', color: '#5ac8fa' },
  // Categorías que escribe el bot de Telegram (envíos e insumos)
  { id: 'h-inc-4', name: 'Envíos', entity: 'hamburguesas', type: 'ingreso', color: '#34c759' },
  { id: 'h-exp-1', name: 'Carne & Pan', entity: 'hamburguesas', type: 'gasto', color: '#ff3b30' },
  { id: 'h-exp-2', name: 'Queso, Salsas & Verduras', entity: 'hamburguesas', type: 'gasto', color: '#ff9500' },
  { id: 'h-exp-3', name: 'Empaques & Desechables', entity: 'hamburguesas', type: 'gasto', color: '#ffcc00' },
  { id: 'h-exp-4', name: 'Gas & Servicios Local', entity: 'hamburguesas', type: 'gasto', color: '#af52de' },
  { id: 'h-exp-5', name: 'Sueldos & Ayudantes', entity: 'hamburguesas', type: 'gasto', color: '#5856d6' },
  { id: 'h-exp-6', name: 'Publicidad & Redes', entity: 'hamburguesas', type: 'gasto', color: '#8e8e93' },
  { id: 'h-exp-7', name: 'Insumos', entity: 'hamburguesas', type: 'gasto', color: '#5856d6' },

  // AirPods
  { id: 'a-inc-1', name: 'Venta AirPods Pro 2', entity: 'airpods', type: 'ingreso', color: '#0066cc' },
  { id: 'a-inc-2', name: 'Venta AirPods Max', entity: 'airpods', type: 'ingreso', color: '#2997ff' },
  { id: 'a-inc-3', name: 'Venta AirPods 4', entity: 'airpods', type: 'ingreso', color: '#5ac8fa' },
  { id: 'a-inc-4', name: 'Accesorios & Estuches', entity: 'airpods', type: 'ingreso', color: '#34c759' },
  { id: 'a-exp-1', name: 'Compra Lote de AirPods', entity: 'airpods', type: 'gasto', color: '#ff3b30' },
  { id: 'a-exp-2', name: 'Fletes & Envíos DHL/FedEx', entity: 'airpods', type: 'gasto', color: '#ff9500' },
  { id: 'a-exp-3', name: 'Empaque & Material de Envío', entity: 'airpods', type: 'gasto', color: '#ffcc00' },
  { id: 'a-exp-4', name: 'Ads Instagram & Marketplace', entity: 'airpods', type: 'gasto', color: '#af52de' },
  { id: 'a-exp-5', name: 'Garantías & Devoluciones', entity: 'airpods', type: 'gasto', color: '#8e8e93' },

  // Personal
  { id: 'p-inc-1', name: 'Retiro de Utilidades Negocios', entity: 'personal', type: 'ingreso', color: '#34c759' },
  { id: 'p-inc-2', name: 'Sueldo / Honorarios Fijos', entity: 'personal', type: 'ingreso', color: '#0066cc' },
  { id: 'p-inc-3', name: 'Otros Ingresos / Inversiones', entity: 'personal', type: 'ingreso', color: '#5ac8fa' },
  { id: 'p-exp-1', name: 'Renta & Vivienda', entity: 'personal', type: 'gasto', color: '#ff3b30' },
  { id: 'p-exp-2', name: 'Supermercado & Despensa', entity: 'personal', type: 'gasto', color: '#ff9500' },
  { id: 'p-exp-3', name: 'Transporte & Gasolina', entity: 'personal', type: 'gasto', color: '#ffcc00' },
  { id: 'p-exp-4', name: 'Servicios (Luz, Internet, Celular)', entity: 'personal', type: 'gasto', color: '#af52de' },
  { id: 'p-exp-5', name: 'Ocio, Restaurantes & Salidas', entity: 'personal', type: 'gasto', color: '#ff2d55' },
  { id: 'p-exp-6', name: 'Suscripciones (iCloud, Apple Music)', entity: 'personal', type: 'gasto', color: '#8e8e93' },
];

/**
 * DATOS MOCK COMENTADOS / ELIMINADOS
 * Ahora los datos se leen directamente desde la colección `transacciones` en Firestore.
 * Si Firestore está vacío, la aplicación inicializa con arreglo vacío y muestra $0.
 */
export const INITIAL_TRANSACTIONS: Transaction[] = [];

/*
// [MOCK HISTORICO ARCHIVADO]:
// { id: 'tx-h-01', title: 'Ventas fin de semana', amount: 14850, type: 'ingreso', entity: 'hamburguesas'... },
// { id: 'tx-a-01', title: 'Venta 3 AirPods Pro', amount: 14700, type: 'ingreso', entity: 'airpods'... },
// { id: 'tx-p-01', title: 'Retiro utilidades', amount: 7000, type: 'ingreso', entity: 'personal'... }
*/
