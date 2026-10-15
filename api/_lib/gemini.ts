/**
 * Parser con Gemini (REST, sin SDK): texto libre → JSON estricto.
 *
 * Usamos `fetch` nativo y `responseSchema` en vez del SDK
 * `@google/generative-ai` (deprecado): menos dependencias y el JSON ya viene
 * forzado por la API. Si la llamada falla, se lanza `GeminiError` con el status
 * HTTP para que el bot explique el motivo (cuota, saturado, etc.).
 */

import { MENU_TEXTO, NOMBRES_CANONICOS } from './menu.js';

export const MODELO_DEFECTO = 'gemini-2.0-flash';
const URL_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const TIMEOUT_MS = 9000;

export const PROMPT_SISTEMA = `Eres el asistente de una hamburguesería en Nanchital, Veracruz.
Recibes mensajes de clientes (o del dueño) y devuelves SOLO un JSON con la operación detectada.

MENÚ:
${MENU_TEXTO}

NOMBRES EXACTOS que debes usar en "productos[].nombre": ${NOMBRES_CANONICOS.join(', ')}

REGLAS:
- Si el mensaje es un pedido de cliente, "tipo" es "pedido".
- Si el mensaje es un gasto del negocio ("gasté 450 en carne"), "tipo" es "gasto" y llenas monto/descripcion/categoria.
- "con papas" ⇒ el producto lleva papas (pon "conPapas": true). Si no lo menciona o dice "sin papas" ⇒ false.
- "modalidad": "delivery" si menciona domicilio/envío/a la casa/llévenlo/a la colonia; "pickup" si dice recoger/paso por él/para llevar/voy al local; "ambiguo" si no menciona la entrega.
- "metodoPago": "Efectivo", "Transferencia" o "Efectivo (Cambio)".
- "direccion": la calle y número si aparece, si no null.
- "cliente": el nombre si aparece, si no "Cliente WhatsApp".
- No inventes productos que no estén en el menú ni cantidades que no se mencionen.`;

export const ESQUEMA_RESPUESTA = {
  type: 'OBJECT',
  properties: {
    tipo: { type: 'STRING', enum: ['pedido', 'gasto'] },
    productos: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          nombre: { type: 'STRING' },
          cantidad: { type: 'NUMBER' },
          conPapas: { type: 'BOOLEAN' },
        },
        required: ['nombre', 'cantidad'],
      },
    },
    modalidad: { type: 'STRING', enum: ['delivery', 'pickup', 'ambiguo'] },
    direccion: { type: 'STRING', nullable: true },
    cliente: { type: 'STRING' },
    metodoPago: { type: 'STRING', enum: ['Efectivo', 'Transferencia', 'Efectivo (Cambio)'] },
    subtotalProductos: { type: 'NUMBER' },
    cargoEnvio: { type: 'NUMBER' },
    total: { type: 'NUMBER' },
    confianza: { type: 'STRING', enum: ['alta', 'baja'] },
    monto: { type: 'NUMBER' },
    descripcion: { type: 'STRING' },
    categoria: { type: 'STRING' },
  },
  required: ['tipo'],
} as const;

export function construirPrompt(texto: string): string {
  return `MENSAJE DEL CLIENTE:\n"""\n${texto}\n"""`;
}

/** Extrae el primer objeto JSON de una respuesta (tolera ```json fences y texto extra). */
export function extraerJSON(texto: unknown): unknown | null {
  const bruto = String(texto ?? '').trim();
  if (!bruto) return null;

  const sinFences = bruto
    .replace(/^\s*```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim();

  const candidatos: string[] = [sinFences];
  const inicio = sinFences.indexOf('{');
  if (inicio >= 0) {
    let profundidad = 0;
    let enCadena = false;
    let escape = false;
    for (let i = inicio; i < sinFences.length; i += 1) {
      const caracter = sinFences[i];
      if (enCadena) {
        if (escape) escape = false;
        else if (caracter === '\\') escape = true;
        else if (caracter === '"') enCadena = false;
        continue;
      }
      if (caracter === '"') {
        enCadena = true;
        continue;
      }
      if (caracter === '{') profundidad += 1;
      else if (caracter === '}') {
        profundidad -= 1;
        if (profundidad === 0) {
          candidatos.push(sinFences.slice(inicio, i + 1));
          break;
        }
      }
    }
  }

  for (const candidato of candidatos) {
    try {
      const parsed: unknown = JSON.parse(candidato);
      if (parsed && typeof parsed === 'object') return parsed;
    } catch {
      // probamos el siguiente candidato
    }
  }
  return null;
}

/** Respuesta mínima de `fetch` que usa el parser (se inyecta un mock en tests). */
export interface RespuestaGemini {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
  text: () => Promise<string>;
}

export type FetchLike = (url: string, init?: Record<string, unknown>) => Promise<RespuestaGemini>;

/**
 * Error tipado de Gemini: conserva el status HTTP para que el bot decida qué
 * contestarle al usuario (429 = sin cuota, 503 = saturado, 400 = mensaje raro).
 */
export class GeminiError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'GeminiError';
    this.status = status;
    this.code = code;
  }
}

export interface OpcionesGemini {
  texto: string;
  apiKey: string;
  modelo?: string;
  fetchImpl?: FetchLike;
  timeoutMs?: number;
}

/**
 * Intentos: 1 llamada + 1 reintento, y SÓLO cuando el fallo es de red
 * (timeout, ECONNRESET, connection reset…).
 *
 * Los HTTP 429 (cuota agotada) y 503 (saturado) NO se reintentan: con ~20 RPD
 * del tier gratuito, reintentar agota la cuota diaria en un par de pedidos.
 */
export const INTENTOS_MAX = 2;

/** true si el error es de red/timeout: lo único que vale la pena reintentar. */
export function esFalloDeRed(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const { name, code, message } = error as { name?: string; code?: string; message?: string };
  if (name === 'AbortError' || name === 'TimeoutError') return true;
  if (code === 'ECONNRESET' || code === 'ETIMEDOUT' || code === 'ECONNREFUSED' || code === 'EAI_AGAIN') {
    return true;
  }
  const texto = String(message ?? '').toLowerCase();
  return (
    texto.includes('timeout') ||
    texto.includes('connection reset') ||
    texto.includes('econnreset') ||
    texto.includes('socket hang up') ||
    texto.includes('fetch failed') ||
    texto.includes('network')
  );
}

/** Clasifica el fallo de red para el `code` del `GeminiError`. */
export function codigoDeRed(error: unknown): 'timeout' | 'network' | 'unknown' {
  const name = (error as { name?: string } | null)?.name;
  if (name === 'AbortError' || name === 'TimeoutError') return 'timeout';
  return esFalloDeRed(error) ? 'network' : 'unknown';
}

/** Convierte una respuesta HTTP no-ok de Gemini en un `GeminiError`. */
export async function errorHttp(respuesta: RespuestaGemini): Promise<GeminiError> {
  const crudo = await respuesta.text().catch(() => '');
  let code = `http_${respuesta.status}`;
  let message = crudo.slice(0, 300) || `HTTP ${respuesta.status}`;
  try {
    const cuerpo = JSON.parse(crudo) as { error?: { status?: string; message?: string } };
    if (cuerpo?.error?.status) code = cuerpo.error.status;
    if (cuerpo?.error?.message) message = cuerpo.error.message;
  } catch {
    // El cuerpo no era JSON: se conserva el texto crudo como mensaje.
  }
  return new GeminiError(respuesta.status, code, message);
}

/**
 * Llama a Gemini y devuelve el JSON crudo del modelo.
 *
 * Devuelve `null` si no hay API key o si el modelo no devolvió JSON parseable;
 * lanza `GeminiError` si la llamada falló (así el bot puede explicar el motivo).
 */
export async function interpretarMensaje(opciones: OpcionesGemini): Promise<unknown | null> {
  const { texto, apiKey } = opciones;
  const modelo = opciones.modelo?.trim() || MODELO_DEFECTO;
  const hacerFetch = opciones.fetchImpl ?? (globalThis.fetch as unknown as FetchLike);
  const timeoutMs = opciones.timeoutMs ?? TIMEOUT_MS;

  if (!apiKey) {
    console.error('[gemini] falta GEMINI_API_KEY');
    return null;
  }

  for (let intento = 1; intento <= INTENTOS_MAX; intento += 1) {
    const controlador = new AbortController();
    const temporizador = setTimeout(() => controlador.abort(), timeoutMs);

    try {
      const respuesta = await hacerFetch(`${URL_BASE}/${modelo}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controlador.signal,
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: PROMPT_SISTEMA }] },
          contents: [{ role: 'user', parts: [{ text: construirPrompt(texto) }] }],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: 'application/json',
            responseSchema: ESQUEMA_RESPUESTA,
          },
        }),
      });

      if (!respuesta.ok) {
        // 429 (cuota) y 503 (saturado) se propagan SIN reintentar.
        const error = await errorHttp(respuesta);
        console.error('[gemini] error HTTP:', {
          status: error.status,
          code: error.code,
          message: error.message,
        });
        throw error;
      }

      const cuerpo = (await respuesta.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
      };
      const contenido = cuerpo?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      return extraerJSON(contenido);
    } catch (error) {
      // Los fallos HTTP (GeminiError) nunca se reintentan.
      if (error instanceof GeminiError) throw error;

      const codigo = codigoDeRed(error);
      if (codigo !== 'unknown' && intento < INTENTOS_MAX) {
        console.warn(
          `[gemini] fallo de red (${codigo}, intento ${intento}/${INTENTOS_MAX}), reintentando`
        );
        continue;
      }

      const message = error instanceof Error ? error.message : String(error);
      console.error('[gemini] falló la llamada:', { status: 0, code: codigo, message });
      throw new GeminiError(0, codigo, message);
    } finally {
      clearTimeout(temporizador);
    }
  }

  return null;
}
