/**
 * Tipos y helpers del escáner de tickets (lado cliente).
 *
 * Sin imports a propósito: el test (`npm run test:ticket`) lo carga con Node.
 */

export type ConfianzaTicket = 'alta' | 'media' | 'baja';
export type CategoriaSugerida = 'Insumos' | 'Salsas' | 'Papelería' | 'Otros';

export interface ProductoTicket {
  nombre: string;
  cantidad: number;
  /** Unidad detectada: "kg", "g", "pza", "litro", "ml"… ('' si no se leyó). */
  unidad: string;
  precioUnitario: number;
}

export interface TicketEscaneado {
  proveedor: string;
  /** YYYY-MM-DD ('' si no se pudo leer). */
  fecha: string;
  total: number;
  productos: ProductoTicket[];
  categoria: CategoriaSugerida;
  confianza: ConfianzaTicket;
  /** Descripción armada por el servidor (proveedor + productos). */
  descripcion?: string;
}

/** Texto del badge de confianza. */
export function etiquetaConfianza(confianza: ConfianzaTicket): string {
  if (confianza === 'alta') return 'Lectura clara';
  if (confianza === 'media') return 'Revisa algunos datos';
  return 'Verifica antes de guardar';
}

function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Elige la categoría del catálogo del usuario más parecida a la que sugirió
 * Gemini. El catálogo real no tiene "Salsas"/"Papelería"/"Otros", así que:
 *   1. coincidencia exacta,
 *   2. categoría que contenga la sugerencia (p.ej. "Queso, Salsas & Verduras"),
 *   3. "Insumos" (o la primera disponible) como red de seguridad.
 */
export function resolverCategoria(sugerida: string, opciones: string[]): string {
  const lista = opciones.filter((opcion) => Boolean(opcion && opcion.trim()));
  if (lista.length === 0) return sugerida;

  const objetivo = normalizar(sugerida);
  const exacta = lista.find((opcion) => normalizar(opcion) === objetivo);
  if (exacta) return exacta;

  const clave = objetivo.slice(0, 4);
  if (clave.length === 4) {
    const parecida = lista.find((opcion) => normalizar(opcion).includes(clave));
    if (parecida) return parecida;
  }

  const insumos = lista.find((opcion) => normalizar(opcion) === 'insumos');
  return insumos ?? lista[0];
}

/* ─────────────── mapeo ticket → inventario ─────────────── */

export type UnidadMedida = 'kg' | 'g' | 'l' | 'ml' | 'pza' | 'paquete' | 'otro';

const ALIAS_UNIDAD: Record<string, UnidadMedida> = {
  kg: 'kg',
  kgs: 'kg',
  kilo: 'kg',
  kilos: 'kg',
  kilogramo: 'kg',
  kilogramos: 'kg',
  g: 'g',
  gr: 'g',
  grs: 'g',
  gramo: 'g',
  gramos: 'g',
  l: 'l',
  lt: 'l',
  lts: 'l',
  litro: 'l',
  litros: 'l',
  ml: 'ml',
  mls: 'ml',
  mililitro: 'ml',
  mililitros: 'ml',
  pza: 'pza',
  pzas: 'pza',
  pz: 'pza',
  pieza: 'pza',
  piezas: 'pza',
  u: 'pza',
  unidad: 'pza',
  unidades: 'pza',
  paquete: 'paquete',
  paquetes: 'paquete',
  bolsa: 'paquete',
  bolsas: 'paquete',
  caja: 'paquete',
  cajas: 'paquete',
};

/** "KG.", "2 kg", "Kilos" → 'kg'; desconocida → 'otro'. */
export function normalizarUnidad(valor: unknown): UnidadMedida {
  const texto = normalizar(String(valor ?? ''))
    .replace(/[^a-z0-9]/g, '')
    .replace(/^\d+(?:[.,]\d+)?/, '');
  if (!texto) return 'otro';
  return ALIAS_UNIDAD[texto] ?? 'otro';
}

/**
 * Convierte la cantidad del ticket a la unidad base del insumo.
 *
 * Regla crítica del negocio: 2 kg de un insumo que se guarda en gramos
 * equivalen a 2000 g. Si las unidades no son compatibles (p. ej. "2 pza"
 * contra un insumo en gramos) se devuelve la cantidad tal cual y
 * `compatible: false` para que la UI avise antes de guardar.
 */
export function convertirCantidadAUnidadBase(
  cantidad: number,
  unidadTicket: unknown,
  unidadBase: unknown
): { cantidad: number; factor: number; compatible: boolean } {
  const origen = normalizarUnidad(unidadTicket);
  const destino = normalizarUnidad(unidadBase);
  const valor = Number(cantidad) > 0 ? Number(cantidad) : 0;

  let factor: number | null = null;
  if (origen === destino) factor = 1;
  else if (origen === 'kg' && destino === 'g') factor = 1000;
  else if (origen === 'l' && destino === 'ml') factor = 1000;
  else if (origen === 'g' && destino === 'kg') factor = 0.001;
  else if (origen === 'ml' && destino === 'l') factor = 0.001;

  if (factor == null) return { cantidad: valor, factor: 1, compatible: false };
  const convertida = Math.round(valor * factor * 10000) / 10000;
  return { cantidad: convertida, factor, compatible: true };
}

/** Unidad base con la que se guardaría un insumo creado desde el ticket. */
export function unidadBaseDeTicket(unidadTicket: unknown): 'g' | 'ml' | 'pza' {
  const unidad = normalizarUnidad(unidadTicket);
  if (unidad === 'kg' || unidad === 'g') return 'g';
  if (unidad === 'l' || unidad === 'ml') return 'ml';
  return 'pza';
}

const PALABRAS_SIN_PESO = new Set([
  'de',
  'del',
  'la',
  'el',
  'los',
  'las',
  'con',
  'sin',
  'y',
  'para',
  'por',
  'un',
  'una',
  'al',
  'kg',
  'kilo',
  'kilos',
  'g',
  'gr',
  'grs',
  'gramo',
  'gramos',
  'l',
  'lt',
  'litro',
  'litros',
  'ml',
  'pza',
  'pzas',
  'pieza',
  'piezas',
  'paquete',
  'paquetes',
  'bolsa',
  'bolsas',
  'caja',
  'cajas',
  'unidad',
  'unidades',
]);

function palabrasClave(texto: string): string[] {
  return normalizar(texto)
    .replace(/(\d+(?:[.,]\d+)?)\s*(kgs?|kilos?|kilogramos?|grs?|gramos?|lts?|litros?|mls?|pzas?|piezas?|paquetes?|bolsas?|cajas?|unidades?)\b/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((palabra) => palabra.length > 1)
    .filter((palabra) => !/^\d+([.,]\d+)?$/.test(palabra))
    .filter((palabra) => !PALABRAS_SIN_PESO.has(palabra));
}

/**
 * Busca el insumo más parecido por nombre: primero coincidencia exacta
 * normalizada, luego contención y por último proporción de palabras en común.
 * Devuelve null si no hay una coincidencia razonable (umbral 50 %).
 */
export function buscarInsumoPorNombre<T extends { id: string; nombre: string }>(
  nombreTicket: string,
  insumos: T[]
): T | null {
  const objetivo = normalizar(nombreTicket)
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!objetivo) return null;

  let mejor: T | null = null;
  let mejorPuntaje = 0;
  const clavesTicket = new Set(palabrasClave(nombreTicket));

  for (const insumo of insumos ?? []) {
    const nombreInsumo = normalizar(insumo.nombre)
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!nombreInsumo) continue;

    if (nombreInsumo === objetivo) return insumo;

    if (nombreInsumo.includes(objetivo) || objetivo.includes(nombreInsumo)) {
      // La contención vale más que el solapamiento de palabras, pero un
      // nombre muy corto ("Pan") no debe ganarle a uno más específico.
      const puntaje = 0.8 + Math.min(nombreInsumo.length, objetivo.length) / 1000;
      if (puntaje > mejorPuntaje) {
        mejor = insumo;
        mejorPuntaje = puntaje;
      }
      continue;
    }

    const clavesInsumo = palabrasClave(insumo.nombre);
    if (clavesTicket.size === 0 || clavesInsumo.length === 0) continue;

    const comunes = clavesInsumo.filter((clave) => clavesTicket.has(clave)).length;
    if (comunes === 0) continue;
    // Cobertura de las palabras del ticket: "Papas 10kg" debe encontrar
    // "Papas lisa europea" aunque el insumo tenga palabras extra.
    const puntaje = comunes / Math.max(1, clavesTicket.size);
    if (puntaje >= 0.5 && puntaje > mejorPuntaje) {
      mejor = insumo;
      mejorPuntaje = puntaje;
    }
  }

  return mejor;
}
