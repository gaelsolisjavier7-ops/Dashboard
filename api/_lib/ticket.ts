/**
 * Escaneo de tickets de compra: esquema, normalización y flujo HTTP.
 *
 * Sin imports a propósito (igual que `pedido.ts`/`menu.ts`): así el flujo
 * completo se puede probar con Node sin red ni Firebase (`npm run test:ticket`),
 * inyectando las dependencias reales desde `api/ticket-scan.ts`.
 *
 * Este módulo NO escribe en Firestore: sólo devuelve el ticket normalizado para
 * que el usuario lo revise en el modal antes de guardarlo.
 */

export const CATEGORIAS_TICKET = ['Insumos', 'Salsas', 'Papelería', 'Otros'] as const;
export type CategoriaTicket = (typeof CATEGORIAS_TICKET)[number];

export const CONFIANZAS_TICKET = ['alta', 'media', 'baja'] as const;
export type ConfianzaTicket = (typeof CONFIANZAS_TICKET)[number];

export const PROMPT_TICKET = `Analiza este ticket de compra mexicano (foto de una nota de compra de un negocio de comida).
Extrae:
- "proveedor": el nombre del comercio (Carnemart, Oxxo, Soriana, La Costeña...). Si no se lee, "Desconocido".
- "fecha": la fecha del ticket en formato ISO (YYYY-MM-DD). Si no se lee, cadena vacía.
- "total": el total pagado en pesos MXN (número, sin símbolo ni comas).
- "productos": lista de artículos con "nombre" (como aparece en el ticket), "cantidad" y "precioUnitario" en MXN.
- "categoria": la categoría sugerida del gasto: "Insumos", "Salsas", "Papelería" u "Otros".
- "confianza": "alta" si el ticket se lee con claridad, "media" si algo es dudoso, "baja" si es ilegible o borroso.

Reglas:
- Si la imagen NO es un ticket de compra, devuelve "total": 0, "productos": [] y "confianza": "baja".
- No inventes productos ni precios: si no se leen, devuélvelos vacíos.
- Los precios son en pesos mexicanos; ignora subtotales, IVA y descuentos (usa el total final).`;

export const ESQUEMA_TICKET = {
  type: 'OBJECT',
  properties: {
    proveedor: { type: 'STRING' },
    fecha: { type: 'STRING' },
    total: { type: 'NUMBER' },
    productos: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          nombre: { type: 'STRING' },
          cantidad: { type: 'NUMBER' },
          precioUnitario: { type: 'NUMBER' },
        },
        required: ['nombre', 'cantidad'],
      },
    },
    categoria: { type: 'STRING', enum: [...CATEGORIAS_TICKET] },
    confianza: { type: 'STRING', enum: [...CONFIANZAS_TICKET] },
  },
  required: ['total', 'productos'],
} as const;

export interface ProductoTicket {
  nombre: string;
  cantidad: number;
  precioUnitario: number;
}

export interface TicketEscaneado {
  proveedor: string;
  /** YYYY-MM-DD (o '' si no se pudo leer); el modal usa input type="date". */
  fecha: string;
  total: number;
  productos: ProductoTicket[];
  categoria: CategoriaTicket;
  confianza: ConfianzaTicket;
  /** Texto listo para el campo "Descripción" del modal. */
  descripcion: string;
}

/* ─────────────────────────── normalización ─────────────────────────── */

/** Quita acentos para comparar categorías escritas de cualquier forma. */
function sinAcentos(texto: string): string {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

/** Categoría no reconocida → 'Otros'. */
export function normalizarCategoria(valor: unknown): CategoriaTicket {
  const texto = sinAcentos(String(valor ?? '').trim());
  if (texto.startsWith('insumo')) return 'Insumos';
  if (texto.startsWith('salsa')) return 'Salsas';
  if (texto.startsWith('papel')) return 'Papelería';
  return 'Otros';
}

export function normalizarConfianza(valor: unknown): ConfianzaTicket {
  const texto = String(valor ?? '').trim().toLowerCase();
  if (texto === 'alta' || texto === 'media' || texto === 'baja') return texto;
  return 'baja';
}

function redondear(valor: number): number {
  return Math.round(valor * 100) / 100;
}

/** Acepta "2026-10-12", "12/10/2026" o ISO completo → YYYY-MM-DD (o ''). */
export function normalizarFecha(valor: unknown): string {
  const texto = String(valor ?? '').trim();
  if (!texto) return '';

  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(texto);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const ddmm = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/.exec(texto);
  if (ddmm) {
    const anio = ddmm[3].length === 2 ? `20${ddmm[3]}` : ddmm[3];
    const dia = ddmm[1].padStart(2, '0');
    const mes = ddmm[2].padStart(2, '0');
    return `${anio}-${mes}-${dia}`;
  }

  const ms = Date.parse(texto);
  if (!Number.isFinite(ms)) return '';
  const fecha = new Date(ms);
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${fecha.getFullYear()}-${mes}-${dia}`;
}

function normalizarProducto(valor: unknown): ProductoTicket | null {
  if (!valor || typeof valor !== 'object') return null;
  const bruto = valor as Record<string, unknown>;
  const nombre = String(bruto.nombre ?? '').trim();
  if (!nombre) return null;

  const cantidad = Number(bruto.cantidad);
  const precio = Number(bruto.precioUnitario);
  return {
    nombre,
    cantidad: Number.isFinite(cantidad) && cantidad > 0 ? redondear(cantidad) : 1,
    precioUnitario: Number.isFinite(precio) && precio > 0 ? redondear(precio) : 0,
  };
}

/** Respuesta cruda de Gemini → ticket listo para la UI (con valores por defecto). */
export function normalizarTicket(datos: unknown): TicketEscaneado {
  const bruto =
    datos && typeof datos === 'object' ? (datos as Record<string, unknown>) : {};
  const total = Number(bruto.total);
  const productos = Array.isArray(bruto.productos)
    ? (bruto.productos.map(normalizarProducto).filter(Boolean) as ProductoTicket[])
    : [];

  const proveedor = String(bruto.proveedor ?? '').trim() || 'Proveedor sin identificar';
  return {
    proveedor,
    fecha: normalizarFecha(bruto.fecha),
    total: Number.isFinite(total) && total > 0 ? redondear(total) : 0,
    productos,
    categoria: normalizarCategoria(bruto.categoria),
    confianza: normalizarConfianza(bruto.confianza),
    descripcion: construirDescripcion({ proveedor, productos }),
  };
}

/** "3× Carne molida, 2× Pan brioche" (recorta la lista si es muy larga). */
export function resumirProductos(productos: ProductoTicket[], maximo = 4): string {
  const visibles = productos.slice(0, Math.max(1, maximo)).map((producto) => {
    const cantidad = Number.isFinite(producto.cantidad) ? producto.cantidad : 1;
    const cantidadTexto = Number.isInteger(cantidad) ? String(cantidad) : cantidad.toFixed(2);
    return `${cantidadTexto}× ${producto.nombre}`;
  });
  const resto = productos.length - visibles.length;
  if (resto > 0) visibles.push(`+${resto} más`);
  return visibles.join(', ');
}

/** Descripción para el movimiento: proveedor + productos resumidos. */
export function construirDescripcion(ticket: {
  proveedor?: string;
  productos?: ProductoTicket[];
}): string {
  const proveedor = String(ticket?.proveedor ?? '').trim();
  const resumen = resumirProductos(Array.isArray(ticket?.productos) ? ticket.productos : []);
  return [proveedor, resumen].filter(Boolean).join(' · ');
}

/* ─────────────────────────── flujo HTTP ─────────────────────────── */

export interface PeticionTicket {
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
  body?: unknown;
}

export interface RespuestaTicket {
  status: number;
  json: Record<string, unknown>;
}

export interface EntradaAnalisis {
  image: string;
  mimeType: string;
}

export interface DepsTicket {
  /** true sólo si el ID token de Firebase es válido. */
  verificarToken: (authorization: string | undefined) => Promise<boolean>;
  /** Llama a Gemini Vision; null si falló (red, HTTP o JSON ilegible). */
  analizar: (entrada: EntradaAnalisis) => Promise<unknown | null>;
  /** Corta payloads absurdos (el cliente comprime a ~200 KB). */
  maxBytes?: number;
  onError?: (error: unknown) => void;
}

function leerCabecera(
  cabeceras: Record<string, string | string[] | undefined>,
  nombre: string
): string | undefined {
  const buscado = nombre.toLowerCase();
  for (const [clave, valor] of Object.entries(cabeceras)) {
    if (clave.toLowerCase() !== buscado) continue;
    return Array.isArray(valor) ? valor[0] : valor;
  }
  return undefined;
}

/** "Bearer abc" (o "abc") → "abc". */
export function leerBearer(authorization: string | undefined): string {
  const texto = String(authorization ?? '').trim();
  if (!texto) return '';
  const partes = texto.split(/\s+/);
  if (partes.length === 1) return partes[0];
  return partes[0].toLowerCase() === 'bearer' ? partes.slice(1).join(' ').trim() : '';
}

function leerCuerpo(body: unknown): Record<string, unknown> {
  if (body == null) return {};
  if (typeof body === 'string') {
    try {
      const parsed: unknown = JSON.parse(body);
      return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  if (body instanceof Uint8Array) {
    try {
      const parsed: unknown = JSON.parse(new TextDecoder().decode(body));
      return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  return typeof body === 'object' ? (body as Record<string, unknown>) : {};
}

export const MAX_BYTES_TICKET = 8 * 1024 * 1024; // ~8 MB de base64 (≈6 MB de imagen)

/**
 * Flujo completo del endpoint, sin tocar red ni Firebase:
 * método → token → imagen → Gemini → normalización.
 */
export async function procesarTicket(
  peticion: PeticionTicket,
  deps: DepsTicket
): Promise<RespuestaTicket> {
  const avisar = deps.onError ?? ((error: unknown) => console.error('[ticket] error:', error));

  if ((peticion.method ?? 'GET').toUpperCase() !== 'POST') {
    return { status: 405, json: { ok: false, error: 'Method Not Allowed' } };
  }

  const authorization = leerCabecera(peticion.headers ?? {}, 'authorization');
  let autorizado = false;
  try {
    autorizado = await deps.verificarToken(authorization);
  } catch (error) {
    avisar(error);
    return { status: 500, json: { ok: false, error: 'No se pudo verificar la sesión' } };
  }
  if (!autorizado) {
    return { status: 401, json: { ok: false, error: 'No autorizado' } };
  }

  const cuerpo = leerCuerpo(peticion.body);
  const image = typeof cuerpo.image === 'string' ? cuerpo.image.trim() : '';
  const mimeType =
    typeof cuerpo.mimeType === 'string' && cuerpo.mimeType.trim()
      ? cuerpo.mimeType.trim()
      : 'image/jpeg';

  if (!image) {
    return { status: 400, json: { ok: false, error: 'Falta la imagen del ticket' } };
  }
  if (image.length > (deps.maxBytes ?? MAX_BYTES_TICKET)) {
    return { status: 413, json: { ok: false, error: 'La imagen es demasiado grande' } };
  }

  let crudo: unknown = null;
  try {
    crudo = await deps.analizar({ image, mimeType });
  } catch (error) {
    avisar(error);
    crudo = null;
  }
  if (!crudo) {
    return { status: 502, json: { ok: false, error: 'No se pudo leer el ticket' } };
  }

  const ticket = normalizarTicket(crudo);
  // "Si no es ticket → error": Gemini devuelve todo vacío o en blanco.
  if (ticket.total <= 0 && ticket.productos.length === 0) {
    return {
      status: 422,
      json: { ok: false, error: 'No parece un ticket de compra legible', confianza: 'baja' },
    };
  }

  return { status: 200, json: { ok: true, ticket } };
}
