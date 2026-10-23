/**
 * Descuento de insumos al registrar una venta.
 *
 * Funciones puras y SIN imports (igual que `costeo.ts`) para poder probarlas
 * con Node. `api/_lib/inventario.ts` mantiene la misma regla del lado del bot:
 * si cambias una, cambia la otra.
 */

export interface ProductoVendido {
  productoId: string;
  cantidad: number;
}

export interface RecetaParaStock {
  productoId: string;
  activo?: boolean | null;
  ingredientes: { insumoId: string; cantidad: number }[];
}

export interface MovimientoStockVenta {
  insumoId: string;
  cantidad: number;
}

export interface MenuParaVenta {
  id: string;
  nombre: string;
}

/** Venta tal como llega desde el modal (o desde Firestore). */
export interface VentaParaStock {
  tipo?: string | null;
  productoId?: string | null;
  cantidad?: number | null;
  /** Array de { productoId, cantidad } guardado en la transacción. */
  productos?: unknown;
  descripcion?: string | null;
}

function normalizar(texto: unknown): string {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizarCantidad(valor: unknown): number {
  const numero = Number(valor);
  if (!Number.isFinite(numero) || numero < 1) return 1;
  return Math.trunc(numero);
}

function esIngreso(tipo: string | null | undefined): boolean {
  const texto = String(tipo ?? '').trim().toLowerCase();
  // Sin tipo (llamadas internas/tests) se asume ingreso.
  return !texto || texto === 'ingreso' || texto === 'income';
}

/** [{ productoId, cantidad }] crudo → líneas normalizadas y agrupadas. */
export function normalizarProductosVenta(productos: unknown): ProductoVendido[] {
  if (!Array.isArray(productos)) return [];

  const agrupados = new Map<string, number>();
  for (const item of productos) {
    if (!item || typeof item !== 'object') continue;
    const registro = item as Record<string, unknown>;
    const productoId = String(registro.productoId ?? '').trim();
    if (!productoId) continue;
    agrupados.set(productoId, (agrupados.get(productoId) ?? 0) + normalizarCantidad(registro.cantidad));
  }

  return Array.from(agrupados, ([productoId, cantidad]) => ({ productoId, cantidad }));
}

/** Normaliza variantes de escritura: "Burguer"/"Hamburguesa" → familia estable. */
function normalizarProducto(texto: unknown): string {
  return normalizar(texto)
    .replace(/\bburguer\b/g, 'burger')
    .replace(/\bhotdog\b/g, 'hot dog')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Alias para casar la descripción del modal: "Especial", "Sencilla", "Pollo"… */
function aliasDe(nombre: string): string[] {
  const completo = normalizarProducto(nombre);
  const sinFamilia = completo
    .replace(/^(burger|hot dog)\s+/, '')
    .replace(/^de\s+/, '')
    .trim();
  return [...new Set([completo, sinFamilia].filter(Boolean))];
}

/**
 * Fallback para ventas escritas a mano: "2× Sencilla, 1× Papas".
 * Si un nombre es ambiguo (p. ej. "Tocino" existe en burger y hot dog) se
 * ignora la línea antes que descontar el insumo equivocado.
 */
export function lineasDesdeDescripcion(
  descripcion: string | null | undefined,
  menu: MenuParaVenta[]
): ProductoVendido[] {
  const texto = String(descripcion ?? '').trim();
  if (!texto) return [];

  const acumulados = new Map<string, number>();
  for (const parte of texto.split(',').map((trozo) => trozo.trim()).filter(Boolean)) {
    const coincidencia = /^(\d+)\s*[×x]\s*(.+)$/i.exec(parte);
    const cantidad = normalizarCantidad(coincidencia?.[1]);
    const nombre = (coincidencia ? coincidencia[2] : parte)
      .replace(/\s+(c\/papas|con papas|sin papas)\s*$/i, '')
      .trim();
    const objetivo = normalizarProducto(nombre);
    if (!objetivo) continue;

    const ids = new Set<string>();
    for (const producto of menu ?? []) {
      if (aliasDe(producto.nombre).includes(objetivo)) ids.add(producto.id);
    }
    if (ids.size !== 1) continue;

    const [productoId] = ids;
    acumulados.set(productoId, (acumulados.get(productoId) ?? 0) + cantidad);
  }

  return Array.from(acumulados, ([productoId, cantidad]) => ({ productoId, cantidad }));
}

/** Productos explícitos → productoId único → descripción (en ese orden). */
export function resolverLineasVenta(
  venta: VentaParaStock,
  menu: MenuParaVenta[]
): ProductoVendido[] {
  if (!esIngreso(venta.tipo)) return [];

  const explicitas = normalizarProductosVenta(venta.productos);
  if (explicitas.length > 0) return explicitas;

  const productoId = String(venta.productoId ?? '').trim();
  if (productoId) {
    return [{ productoId, cantidad: normalizarCantidad(venta.cantidad) }];
  }

  return lineasDesdeDescripcion(venta.descripcion, menu);
}

/**
 * Cruza las líneas vendidas con las recetas y devuelve cuánto descontar de
 * cada insumo (en su unidad base), agrupado por insumo.
 */
export function movimientosStockVenta(
  lineas: ProductoVendido[],
  recetas: RecetaParaStock[]
): MovimientoStockVenta[] {
  const totales = new Map<string, number>();

  for (const linea of lineas ?? []) {
    const receta = (recetas ?? []).find(
      (item) => item.productoId === linea.productoId && item.activo !== false
    );
    if (!receta) continue;

    for (const ingrediente of receta.ingredientes ?? []) {
      const insumoId = String(ingrediente.insumoId ?? '').trim();
      const cantidad = Number(ingrediente.cantidad) * normalizarCantidad(linea.cantidad);
      if (!insumoId || !(cantidad > 0)) continue;
      totales.set(insumoId, (totales.get(insumoId) ?? 0) + cantidad);
    }
  }

  return Array.from(totales, ([insumoId, cantidad]) => ({
    insumoId,
    cantidad: Math.round(cantidad * 10000) / 10000,
  }));
}
