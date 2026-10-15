/**
 * Gemini Vision (REST, sin SDK) para leer tickets: imagen → JSON estricto.
 *
 * Reutiliza `GEMINI_API_KEY` (la misma del bot) y `extraerJSON` de `gemini.ts`.
 * No modifica el parser de texto del bot: es una llamada aparte.
 *
 * Mismo trato de errores que el bot: los HTTP no-ok (429 cuota, 503 saturado…)
 * se lanzan como `GeminiError` SIN reintentar; sólo se reintenta 1 vez en fallos
 * de red (timeout, ECONNRESET…).
 */

import { GeminiError, INTENTOS_MAX, codigoDeRed, errorHttp, extraerJSON } from './gemini.js';
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

/**
 * Llama a Gemini con la foto del ticket y devuelve el JSON crudo.
 *
 * Devuelve `null` si no hay API key o si el modelo no devolvió JSON parseable;
 * lanza `GeminiError` si la llamada falló (así el endpoint explica el motivo).
 */
export async function analizarTicket(opciones: OpcionesAnalizarTicket): Promise<unknown | null> {
  const { image, mimeType, apiKey } = opciones;
  const modelo = opciones.modelo?.trim() || MODELO_TICKET_DEFECTO;
  const hacerFetch = opciones.fetchImpl ?? (globalThis.fetch as unknown as FetchLike);
  const timeoutMs = opciones.timeoutMs ?? TIMEOUT_MS;

  if (!apiKey) {
    console.error('[ticket] falta GEMINI_API_KEY');
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
        // 429 (cuota) y 503 (saturado) se propagan SIN reintentar.
        const error = await errorHttp(respuesta);
        console.error('[ticket] error HTTP:', {
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
          `[ticket] fallo de red (${codigo}, intento ${intento}/${INTENTOS_MAX}), reintentando`
        );
        continue;
      }

      const message = error instanceof Error ? error.message : String(error);
      console.error('[ticket] falló la llamada:', { status: 0, code: codigo, message });
      throw new GeminiError(0, codigo, message);
    } finally {
      clearTimeout(temporizador);
    }
  }

  return null;
}
