/**
 * Helpers de la API de Telegram (fetch nativo, sin dependencias).
 * Las funciones de validación y los teclados son puros y se testean en
 * `npm run test:bot`; las llamadas HTTP se inyectan con `fetchImpl`.
 */

import { datosCallback } from './pedido';
import type { PedidoResumen } from './pedido';
import type { FetchLike } from './gemini';

export interface OpcionesTelegram {
  reply_markup?: unknown;
}

export interface ClienteTelegram {
  /** Devuelve el message_id del mensaje enviado (o null si falló). */
  enviar(chatId: string, texto: string, opciones?: OpcionesTelegram): Promise<number | null>;
  editar(chatId: string, messageId: number, texto: string, opciones?: OpcionesTelegram): Promise<void>;
  confirmarCallback(callbackId: string, texto?: string): Promise<void>;
}

/** Lee un header sin depender de mayúsculas/minúsculas (Vercel los normaliza). */
function cabecera(headers: Record<string, string | string[] | undefined>, nombre: string): string {
  const buscado = nombre.toLowerCase();
  for (const [clave, valor] of Object.entries(headers)) {
    if (clave.toLowerCase() !== buscado) continue;
    if (Array.isArray(valor)) return valor[0] ?? '';
    return valor ?? '';
  }
  return '';
}

/** Compara el header secreto de Telegram (timing-safe-ish y tolerante a mayúsculas). */
export function verificarSecret(
  headers: Record<string, string | string[] | undefined>,
  secret: string
): boolean {
  if (!secret) return false;
  const recibido = cabecera(headers, 'x-telegram-bot-api-secret-token').trim();
  if (!recibido || recibido.length !== secret.length) return false;
  let diferencia = 0;
  for (let i = 0; i < recibido.length; i += 1) {
    diferencia |= recibido.charCodeAt(i) ^ secret.charCodeAt(i);
  }
  return diferencia === 0;
}

/** Sólo atendemos al chat del dueño. */
export function esChatAutorizado(chatId: unknown, autorizado: string): boolean {
  const limpio = String(chatId ?? '').trim();
  if (!limpio || !autorizado) return false;
  return limpio === autorizado.trim();
}

export function tecladoConfirmacion(chatId: string, sello: string | number): unknown {
  return {
    inline_keyboard: [
      [
        { text: '✅ Confirmar', callback_data: datosCallback('cf', chatId, sello) },
        { text: '✏️ Editar', callback_data: datosCallback('ed', chatId, sello) },
        { text: '❌ Cancelar', callback_data: datosCallback('cx', chatId, sello) },
      ],
    ],
  };
}

export function tecladoModalidad(chatId: string, sello: string | number): unknown {
  return {
    inline_keyboard: [
      [
        { text: '🛵 A domicilio +$30', callback_data: datosCallback('dl', chatId, sello) },
        { text: '🥡 Para recoger', callback_data: datosCallback('pk', chatId, sello) },
      ],
      [{ text: '❌ Cancelar', callback_data: datosCallback('cx', chatId, sello) }],
    ],
  };
}

export function tecladoPendientes(pedidos: PedidoResumen[]): unknown {
  return {
    inline_keyboard: pedidos.map((pedido) => [
      { text: `✅ #${pedido.folio} Entregado`, callback_data: datosCallback('po', pedido.id) },
      { text: `❌ #${pedido.folio} Cancelar`, callback_data: datosCallback('pc', pedido.id) },
    ]),
  };
}

interface RespuestaTelegram {
  ok?: boolean;
  result?: { message_id?: number };
  description?: string;
}

export function crearClienteTelegram(config: { token: string; fetchImpl?: FetchLike }): ClienteTelegram {
  const hacerFetch = config.fetchImpl ?? (globalThis.fetch as unknown as FetchLike);

  const llamar = async (metodo: string, payload: Record<string, unknown>): Promise<RespuestaTelegram | null> => {
    try {
      const respuesta = await hacerFetch(`https://api.telegram.org/bot${config.token}/${metodo}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const cuerpo = (await respuesta.json()) as RespuestaTelegram;
      if (!respuesta.ok || cuerpo?.ok === false) {
        console.error(`[telegram] ${metodo} falló:`, cuerpo?.description ?? respuesta.status);
        return null;
      }
      return cuerpo;
    } catch (error) {
      console.error(`[telegram] ${metodo} excepción:`, error);
      return null;
    }
  };

  return {
    async enviar(chatId, texto, opciones) {
      const resultado = await llamar('sendMessage', {
        chat_id: chatId,
        text: texto,
        disable_web_page_preview: true,
        ...(opciones?.reply_markup ? { reply_markup: opciones.reply_markup } : {}),
      });
      return resultado?.result?.message_id ?? null;
    },

    async editar(chatId, messageId, texto, opciones) {
      await llamar('editMessageText', {
        chat_id: chatId,
        message_id: messageId,
        text: texto,
        disable_web_page_preview: true,
        ...(opciones?.reply_markup ? { reply_markup: opciones.reply_markup } : {}),
      });
    },

    async confirmarCallback(callbackId, texto) {
      await llamar('answerCallbackQuery', {
        callback_query_id: callbackId,
        ...(texto ? { text: texto } : {}),
      });
    },
  };
}
