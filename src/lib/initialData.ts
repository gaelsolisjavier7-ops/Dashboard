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
*/
