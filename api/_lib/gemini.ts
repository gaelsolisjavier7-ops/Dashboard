/**
 * Parser con Gemini (REST, sin SDK): texto libre → JSON estricto.
 *
 * Usamos `fetch` nativo y `responseSchema` en vez del SDK
 * `@google/generative-ai` (deprecado): menos dependencias y el JSON ya viene
 * forzado por la API. Si Gemini falla, el bot responde TEXTO_NO_ENTENDIDO.
 */

import { MENU_TEXTO, NOMBRES_CANONICOS } from './menu.ts';

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

export type FetchLike = (url: string, init?: Record<string, unknown>) => Promise<{
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
  text: () => Promise<string>;
}>;

export interface OpcionesGemini {
  texto: string;
  apiKey: string;
  modelo?: string;
  fetchImpl?: FetchLike;
  timeoutMs?: number;
}

/** Llama a Gemini y devuelve el JSON crudo del modelo (o null si falla). */
export async function interpretarMensaje(opciones: OpcionesGemini): Promise<unknown | null> {
  const { texto, apiKey } = opciones;
  const modelo = opciones.modelo?.trim() || MODELO_DEFECTO;
  const hacerFetch = opciones.fetchImpl ?? (globalThis.fetch as unknown as FetchLike);

  if (!apiKey) {
    console.error('[gemini] falta GEMINI_API_KEY');
    return null;
  }

  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), opciones.timeoutMs ?? TIMEOUT_MS);

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
      const detalle = await respuesta.text().catch(() => '');
      console.error('[gemini] error HTTP', respuesta.status, detalle.slice(0, 300));
      return null;
    }

    const cuerpo = (await respuesta.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const contenido = cuerpo?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    return extraerJSON(contenido);
  } catch (error) {
    console.error('[gemini] fallo la llamada:', error);
    return null;
  } finally {
    clearTimeout(temporizador);
  }
}
