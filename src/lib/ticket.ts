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
