/**
 * Menú oficial de ENTRE 3 (Nanchital, Veracruz).
 *
 * Los `id` son los que se guardan como `recetas.productoId` y `productoNombre`
 * se denormaliza al guardar la receta. Archivo puro (cero imports) para que los
 * tests de costeo puedan usarlo directo con Node.
 */

export type CategoriaProducto = 'burgers' | 'hotdogs' | 'extras';

export interface ProductoMenu {
  id: string;
  nombre: string;
  categoria: CategoriaProducto;
  /** Precio de venta en MXN */
  precio: number;
  /** Precio cuando el producto se vende con papas (hot dogs) */
  precioConPapas?: number;
}

export const MENU_CATEGORIAS: { id: CategoriaProducto; nombre: string }[] = [
  { id: 'burgers', nombre: 'Hamburguesas' },
  { id: 'hotdogs', nombre: 'Hot Dogs' },
  { id: 'extras', nombre: 'Extras' },
];

export const MENU_DATA: ProductoMenu[] = [
  // ── Hamburguesas ──
  { id: 'burger-sencilla', nombre: 'Burger Sencilla', categoria: 'burgers', precio: 100 },
  { id: 'burger-tocino', nombre: 'Burger Tocino', categoria: 'burgers', precio: 110 },
  { id: 'burger-hawaiana', nombre: 'Burger Hawaiana', categoria: 'burgers', precio: 125 },
  { id: 'burger-especial', nombre: 'Burger Especial', categoria: 'burgers', precio: 150 },

  // ── Hot dogs (precio sin papas / con papas) ──
  { id: 'hotdog-sencillo', nombre: 'Hot Dog Sencillo', categoria: 'hotdogs', precio: 40, precioConPapas: 50 },
  { id: 'hotdog-queso', nombre: 'Hot Dog Queso', categoria: 'hotdogs', precio: 45, precioConPapas: 55 },
  { id: 'hotdog-tocino', nombre: 'Hot Dog Tocino', categoria: 'hotdogs', precio: 65, precioConPapas: 75 },
  { id: 'hotdog-hawaiano', nombre: 'Hot Dog Hawaiano', categoria: 'hotdogs', precio: 70, precioConPapas: 75 },
  { id: 'hotdog-combinado', nombre: 'Hot Dog Combinado', categoria: 'hotdogs', precio: 80, precioConPapas: 90 },

  // ── Extras ──
  { id: 'extra-papas', nombre: 'Papas', categoria: 'extras', precio: 50 },
];

export function getProducto(productoId: string): ProductoMenu | undefined {
  return MENU_DATA.find((p) => p.id === productoId);
}

export function nombreProducto(productoId: string): string {
  return getProducto(productoId)?.nombre ?? productoId;
}

/**
 * Precio de venta a usar para el margen: si la receta incluye papas y el
 * producto tiene precio con papas (hot dogs), se usa ese.
 */
export function precioVentaProducto(productoId: string, incluyePapas = false): number {
  const producto = getProducto(productoId);
  if (!producto) return 0;
  if (incluyePapas && producto.precioConPapas != null) return producto.precioConPapas;
  return producto.precio;
}

/** Menú agrupado por categoría, respetando el orden de MENU_CATEGORIAS. */
export function menuPorCategoria(): { categoria: CategoriaProducto; nombre: string; productos: ProductoMenu[] }[] {
  return MENU_CATEGORIAS.map((cat) => ({
    categoria: cat.id,
    nombre: cat.nombre,
    productos: MENU_DATA.filter((p) => p.categoria === cat.id),
  }));
}
