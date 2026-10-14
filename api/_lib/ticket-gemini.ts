/**
 * Gemini Vision (REST, sin SDK) para leer tickets: imagen → JSON estricto.
 *
 * Reutiliza `GEMINI_API_KEY` (la misma del bot) y `extraerJSON` de `gemini.ts`.
 * No modifica el parser de texto del bot: es una llamada aparte.
 */

import { extraerJSON } from './gemini.js';
import type { FetchLike } from './gemini.js';
import { ESQUEMA_TICKET, PROMPT_TICKET } from './ticket.js';

/** Modelo barato y rápido para visión; se puede sobreescribir con GEMINI_MODEL. */
export const MODELO_TICKET_DEFECTO = 'gemini-flash-lite-latest';
const URL_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const TIMEOUT_MS = 20000;

export interface OpcionesAnalizarTicket {
  image: string;
  mimeType: string;
  apiKey: string;
  modelo?: string;
  fetchImpl?: FetchLike;
  timeoutMs?: number;
}

/** Llama a Gemini con la foto del ticket y devuelve el JSON crudo (o null). */
export async function analizarTicket(opciones: OpcionesAnalizarTicket): Promise<unknown | null> {
  const { image, mimeType, apiKey } = opciones;
  const modelo = opciones.modelo?.trim() || MODELO_TICKET_DEFECTO;
  const hacerFetch = opciones.fetchImpl ?? (globalThis.fetch as unknown as FetchLike);

  if (!apiKey) {
    console.error('[ticket] falta GEMINI_API_KEY');
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
        systemInstruction: { parts: [{ text: PROMPT_TICKET }] },
        contents: [
          {
            role: 'user',
            parts: [
              { text: 'Analiza la foto de este ticket y devuelve el JSON.' },
              { inlineData: { mimeType, data: image } },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json',
          responseSchema: ESQUEMA_TICKET,
        },
      }),
    });

    if (!respuesta.ok) {
      const detalle = await respuesta.text().catch(() => '');
      console.error('[ticket] error HTTP', respuesta.status, detalle.slice(0, 300));
      return null;
    }

    const cuerpo = (await respuesta.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const contenido = cuerpo?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    return extraerJSON(contenido);
  } catch (error) {
    console.error('[ticket] falló la llamada a Gemini:', error);
    return null;
  } finally {
    clearTimeout(temporizador);
  }
}
