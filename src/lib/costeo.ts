/**
 * Costeo de insumos y recetas (funciones puras).
 *
 * Archivo deliberadamente SIN imports (ni siquiera `import type`) para que
 * `scripts/test-insumos.mjs` pueda importarlo directo con Node, sin Firebase ni
 * React. Los tipos de entrada son estructurales y minimalistas: basta con que
 * el objeto real traiga esos campos.
 */

/* ────────────────────────────── unidades ────────────────────────────── */

export type UnidadCompra = 'kg' | 'litro' | 'pza' | 'paquete';
export type UnidadBase = 'g' | 'ml' | 'pza';

export const UNIDADES_COMPRA: { id: UnidadCompra; label: string; ayuda: string }[] = [
  { id: 'kg', label: 'Kilogramo (kg)', ayuda: 'Se convierte a gramos (×1000)' },
  { id: 'litro', label: 'Litro (L)', ayuda: 'Se convierte a mililitros (×1000)' },
  { id: 'pza', label: 'Pieza', ayuda: 'Se usa tal cual' },
  { id: 'paquete', label: 'Paquete', ayuda: 'Indica cuántas piezas trae' },
];

/**
 * Reglas de conversión del negocio:
 *   kg      → g,   factor 1000
 *   litro   → ml,  factor 1000
 *   pza     → pza, factor 1
 *   paquete → pza, factor = piezas que trae el paquete (lo indica el usuario)
 */
export function resolverConversion(
  unidadCompra: UnidadCompra,
  piezasPorPaquete?: number | null
): { unidadBase: UnidadBase; factorConversion: number } {
  switch (unidadCompra) {
    case 'kg':
      return { unidadBase: 'g', factorConversion: 1000 };
    case 'litro':
      return { unidadBase: 'ml', factorConversion: 1000 };
    case 'paquete': {
      const piezas = Number(piezasPorPaquete) || 0;
      return { unidadBase: 'pza', factorConversion: piezas > 0 ? piezas : 0 };
    }
    default:
      return { unidadBase: 'pza', factorConversion: 1 };
  }
}

/** Redondeo a N decimales (evita el ruido de coma flotante al guardar dinero). */
export function redondear(valor: number, decimales = 2): number {
  const n = Number(valor);
  if (!Number.isFinite(n)) return 0;
  const factor = 10 ** decimales;
  return Math.round(n * factor) / factor;
}

/**
 * costoUnidadBase = precioCompra / (cantidadCompra × factorConversion)
 * Ej.: 5 kg a $450 → 450 / (5 × 1000) = $0.09 por gramo
 */
export function calcularCostoUnidadBase(
  precioCompra: number,
  cantidadCompra: number,
  factorConversion: number
): number {
  const total = (Number(cantidadCompra) || 0) * (Number(factorConversion) || 0);
  if (total <= 0) return 0;
  return redondear((Number(precioCompra) || 0) / total, 6);
}

/** Cuántas unidades base representa una compra completa. */
export function unidadesBaseDeCompra(cantidadCompra: number, factorConversion: number): number {
  return redondear((Number(cantidadCompra) || 0) * (Number(factorConversion) || 0), 4);
}

/* ────────────────────────────── insumos ────────────────────────────── */

/** Forma mínima de un insumo para poder costear. */
export interface InsumoParaCosto {
  id: string;
  nombre: string;
  categoria?: string | null;
  unidadBase?: string | null;
  costoUnidadBase: number;
  stockActual?: number | null;
  stockMinimo?: number | null;
  activo?: boolean | null;
}

export const CATEGORIAS_INSUMO = [
  'Carne',
  'Panadería',
  'Quesos',
  'Verduras',
  'Salsas',
  'Papas',
  'Bebidas',
  'Extras',
  'Otros',
] as const;

export function stockBajo(insumo: InsumoParaCosto): boolean {
  const actual = Number(insumo.stockActual) || 0;
  const minimo = Number(insumo.stockMinimo) || 0;
  return minimo > 0 && actual < minimo;
}

/* ─────────────────── presentación amigable del inventario ─────────────────── */

/** Semáforo visual de una tarjeta de insumo. */
export type SemaforoStock = 'rojo' | 'amarillo' | 'verde';

/** 1 porción de carne = 150 g (misma porción que se usa para las papas). */
export const GRAMOS_POR_PORCION_CARNE = 150;

/** “Cerca del mínimo”: por debajo de 1.5× el stock mínimo. */
export const FACTOR_CASI_MINIMO = 1.5;

/**
 * 🔴 debajo del mínimo (o sin stock) · 🟡 cerca del mínimo · 🟢 suficiente.
 * Si el insumo no tiene mínimo configurado, sólo se marca rojo cuando llega a 0.
 */
export function semaforoStock(insumo: InsumoParaCosto): SemaforoStock {
  const actual = Math.max(0, Number(insumo.stockActual) || 0);
  const minimo = Math.max(0, Number(insumo.stockMinimo) || 0);

  if (actual <= 0) return 'rojo';
  if (minimo <= 0) return 'verde';
  if (actual < minimo) return 'rojo';
  if (actual < minimo * FACTOR_CASI_MINIMO) return 'amarillo';
  return 'verde';
}

const formatearCantidad = (valor: number): string =>
  new Intl.NumberFormat('es-MX', { maximumFractionDigits: 2 }).format(valor);

export interface StockAmigable {
  /** Cifra ya convertida a la unidad fácil de leer ("15", "750", "6"). */
  valor: string;
  /** Unidad fácil de leer ("kg", "L", "piezas"). */
  unidad: string;
  /** Equivalencia extra para cocina ("100 porciones" en carne). */
  equivalencia: string | null;
}

/**
 * Traduce las unidades base a lenguaje de cocina:
 *   15000 g → 15 kg · 750 g → 750 g · 1500 ml → 1.5 L · 6 pza → 6 piezas
 * Para carne en gramos agrega “~100 porciones” (1 porción = 150 g).
 */
export function stockAmigable(insumo: InsumoParaCosto): StockAmigable {
  const actual = Math.max(0, Number(insumo.stockActual) || 0);
  const base = String(insumo.unidadBase ?? 'pza');
  const esCarne =
    String(insumo.categoria ?? '').trim().toLowerCase() === 'carne';

  if (base === 'g') {
    const equivalencia = esCarne
      ? `${Math.floor(actual / GRAMOS_POR_PORCION_CARNE)} ${
          Math.floor(actual / GRAMOS_POR_PORCION_CARNE) === 1 ? 'porción' : 'porciones'
        }`
      : null;

    if (actual >= 1000) {
      return { valor: formatearCantidad(actual / 1000), unidad: 'kg', equivalencia };
    }
    return { valor: formatearCantidad(actual), unidad: 'g', equivalencia };
  }

  if (base === 'ml') {
    if (actual >= 1000) {
      return { valor: formatearCantidad(actual / 1000), unidad: 'L', equivalencia: null };
    }
    return { valor: formatearCantidad(actual), unidad: 'ml', equivalencia: null };
  }

  return {
    valor: formatearCantidad(actual),
    unidad: actual === 1 ? 'pieza' : 'piezas',
    equivalencia: null,
  };
}

/**
 * ¿Para cuántas porciones de una receta alcanza el stock?
 * Devuelve el entero hacia abajo (0 si no alcanza ni para una).
 */
export function rendimientoReceta(stockActual: number, cantidadPorReceta: number): number {
  const cantidad = Number(cantidadPorReceta) || 0;
  if (cantidad <= 0) return 0;
  return Math.floor((Number(stockActual) || 0) / cantidad);
}

export function valorInventario(insumos: InsumoParaCosto[]): number {
  return redondear(
    insumos.reduce(
      (acc, i) => acc + (Number(i.stockActual) || 0) * (Number(i.costoUnidadBase) || 0),
      0
    ),
    2
  );
}

export function insumosActivos(insumos: InsumoParaCosto[]): InsumoParaCosto[] {
  return insumos.filter((i) => i.activo !== false);
}

/* ────────────────────────────── recetas ────────────────────────────── */

/** Porción de papas que se suma cuando `incluyePapas` está activo. */
export const PORCION_PAPAS_G = 150;
export const CATEGORIA_PAPAS = 'Papas';

export interface IngredienteInput {
  insumoId: string;
  cantidad: number;
}

export interface RecetaIngredienteSnapshot {
  insumoId: string;
  insumoNombre: string;
  cantidad: number;
  /** Costo por unidad base en el momento de guardar (histórico) */
  costoUnitarioSnapshot: number;
  costoTotal: number;
}

export function costoIngrediente(insumo: InsumoParaCosto | undefined, cantidad: number): number {
  if (!insumo) return 0;
  return redondear((Number(cantidad) || 0) * (Number(insumo.costoUnidadBase) || 0), 4);
}

/** Primer insumo activo de categoría "Papas" (ordenado por nombre). */
export function insumoPapas(insumos: InsumoParaCosto[]): InsumoParaCosto | null {
  const papas = insumos.filter(
    (i) => String(i.categoria ?? '').trim().toLowerCase() === CATEGORIA_PAPAS.toLowerCase() && i.activo !== false
  );
  if (papas.length === 0) return null;
  return [...papas].sort((a, b) => a.nombre.localeCompare(b.nombre))[0];
}

/** Costo de la porción de papas (150 g por defecto). */
export function costoPorcionPapas(insumos: InsumoParaCosto[], gramos = PORCION_PAPAS_G): number {
  return costoIngrediente(insumoPapas(insumos) ?? undefined, gramos);
}

export type ColorMargen = 'verde' | 'amarillo' | 'rojo';

/** Verde ≥ 50 % · Amarillo 30–50 % · Rojo < 30 % */
export function colorMargen(margenPct: number): ColorMargen {
  if (margenPct >= 50) return 'verde';
  if (margenPct >= 30) return 'amarillo';
  return 'rojo';
}

export function calcularMargen(
  costoTotal: number,
  precioVenta: number
): { ganancia: number; margenPct: number } {
  const precio = Number(precioVenta) || 0;
  const ganancia = redondear(precio - (Number(costoTotal) || 0), 2);
  const margenPct = precio > 0 ? redondear((ganancia / precio) * 100, 1) : 0;
  return { ganancia, margenPct };
}

export interface ResumenReceta {
  costoIngredientes: number;
  costoPapas: number;
  costoTotal: number;
  precioVenta: number;
  ganancia: number;
  margenPct: number;
  color: ColorMargen;
  tienePapas: boolean;
}

/**
 * Resumen completo de una receta. Siempre usa los costos ACTUALES de los
 * insumos que recibe (no snapshots): así el margen mostrado es el de hoy.
 */
export function calcularReceta(opciones: {
  ingredientes: IngredienteInput[];
  insumos: InsumoParaCosto[];
  precioVenta: number;
  incluyePapas?: boolean;
  gramosPapas?: number;
}): ResumenReceta {
  const { ingredientes, insumos, precioVenta } = opciones;
  const incluyePapas = opciones.incluyePapas === true;

  const costoIngredientes = redondear(
    (ingredientes ?? []).reduce((acc, ing) => {
      const insumo = insumos.find((i) => i.id === ing.insumoId);
      return acc + costoIngrediente(insumo, ing.cantidad);
    }, 0),
    2
  );

  const papas = insumoPapas(insumos);
  const costoPapas = incluyePapas
    ? redondear(costoIngrediente(papas ?? undefined, opciones.gramosPapas ?? PORCION_PAPAS_G), 2)
    : 0;

  const costoTotal = redondear(costoIngredientes + costoPapas, 2);
  const { ganancia, margenPct } = calcularMargen(costoTotal, precioVenta);

  return {
    costoIngredientes,
    costoPapas,
    costoTotal,
    precioVenta: Number(precioVenta) || 0,
    ganancia,
    margenPct,
    color: colorMargen(margenPct),
    tienePapas: incluyePapas,
  };
}

/** Ingredientes listos para guardar (con snapshot del costo del momento). */
export function construirIngredientesSnapshot(
  ingredientes: IngredienteInput[],
  insumos: InsumoParaCosto[]
): RecetaIngredienteSnapshot[] {
  return (ingredientes ?? [])
    .filter((ing) => ing.insumoId && (Number(ing.cantidad) || 0) > 0)
    .map((ing) => {
      const insumo = insumos.find((i) => i.id === ing.insumoId);
      return {
        insumoId: ing.insumoId,
        insumoNombre: insumo?.nombre ?? 'Insumo eliminado',
        cantidad: Number(ing.cantidad) || 0,
        costoUnitarioSnapshot: Number(insumo?.costoUnidadBase) || 0,
        costoTotal: costoIngrediente(insumo, ing.cantidad),
      };
    });
}

/* ─────────────────────── agregados para el dashboard ─────────────────── */

export interface RecetaParaResumen {
  productoId: string;
  ingredientes: IngredienteInput[];
  incluyePapas: boolean;
}

/** Costo promedio y margen promedio ponderado de un conjunto de recetas. */
export function promediosRecetas(opciones: {
  recetas: RecetaParaResumen[];
  insumos: InsumoParaCosto[];
  precioDe: (productoId: string, incluyePapas: boolean) => number;
}): { conReceta: number; costoPromedio: number; margenPromedio: number; gananciaPromedio: number } {
  const { recetas, insumos, precioDe } = opciones;
  const resumenes = (recetas ?? []).map((r) =>
    calcularReceta({
      ingredientes: r.ingredientes,
      insumos,
      incluyePapas: r.incluyePapas,
      precioVenta: precioDe(r.productoId, r.incluyePapas),
    })
  );

  if (resumenes.length === 0) {
    return { conReceta: 0, costoPromedio: 0, margenPromedio: 0, gananciaPromedio: 0 };
  }

  const costoPromedio = redondear(
    resumenes.reduce((acc, r) => acc + r.costoTotal, 0) / resumenes.length,
    2
  );
  const gananciaPromedio = redondear(
    resumenes.reduce((acc, r) => acc + r.ganancia, 0) / resumenes.length,
    2
  );
  const margenPromedio = redondear(
    resumenes.reduce((acc, r) => acc + r.margenPct, 0) / resumenes.length,
    1
  );

  return { conReceta: resumenes.length, costoPromedio, margenPromedio, gananciaPromedio };
}

/* ────────────────────────────── formato ────────────────────────────── */

/** Formato de precio MXN: $1,234.56 */
export function formatMXN(valor: number, decimales = 2): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  }).format(Number(valor) || 0);
}

/** Costo unitario con más precisión (los gramos cuestan centavos): $0.0900 */
export function formatCostoUnitario(valor: number): string {
  const n = Number(valor) || 0;
  if (n === 0) return '$0.00';
  if (n < 1) return `$${n.toFixed(4)}`;
  return formatMXN(n, 2);
}
