/**
 * Webhook de Telegram (Vercel Serverless Function, Node 20).
 *
 *   Telegram → POST /api/telegram → Gemini → Firestore
 *
 * Este archivo es el "composition root": lee las variables de entorno, arma las
 * dependencias reales y delega en `crearBot`. `crearHandler` se exporta aparte
 * para poder probar el webhook con dependencias falsas (`npm run test:bot`).
 */

import { crearBot } from './_lib/bot';
import type { BotTelegram } from './_lib/bot';
import { crearAlmacen } from './_lib/firestore';
import type { AlmacenBot, ConfiguracionFirestore } from './_lib/firestore';
import { interpretarMensaje } from './_lib/gemini';
import { crearClienteTelegram, esChatAutorizado, verificarSecret } from './_lib/telegram';

export interface PeticionMinima {
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
  body?: unknown;
}

export interface RespuestaMinima {
  status(codigo: number): RespuestaMinima;
  json(cuerpo: unknown): void;
}

export interface ConfigBot {
  telegramBotToken: string;
  telegramChatId: string;
  webhookSecret: string;
  geminiApiKey: string;
  serviceAccountJson: string;
  geminiModelo?: string;
}

/**
 * Resultado de leer el entorno.
 *
 * `config` y `faltantes` son opcionales a propósito: así el tipo no depende de
 * que TypeScript pueda discriminar la unión (el narrowing cambia entre versiones
 * de TS y Vercel puede compilar con otra distinta a la local).
 */
export interface ResultadoEnv {
  ok: boolean;
  config?: ConfigBot;
  faltantes?: string[];
}

/** Lee y valida las variables de entorno (sin exponer sus valores). */
export function leerEnv(env: Record<string, string | undefined> = process.env): ResultadoEnv {
  const telegramBotToken = env.TELEGRAM_BOT_TOKEN?.trim() ?? '';
  const telegramChatId = env.TELEGRAM_CHAT_ID?.trim() ?? '';
  const webhookSecret = env.TELEGRAM_WEBHOOK_SECRET?.trim() ?? '';
  const geminiApiKey = env.GEMINI_API_KEY?.trim() ?? '';
  const serviceAccountJson = env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim() ?? '';

  const faltantes: string[] = [];
  if (!telegramBotToken) faltantes.push('TELEGRAM_BOT_TOKEN');
  if (!telegramChatId) faltantes.push('TELEGRAM_CHAT_ID');
  if (!webhookSecret) faltantes.push('TELEGRAM_WEBHOOK_SECRET');
  if (!geminiApiKey) faltantes.push('GEMINI_API_KEY');
  if (!serviceAccountJson) faltantes.push('FIREBASE_SERVICE_ACCOUNT_JSON');

  if (faltantes.length > 0) return { ok: false, faltantes };

  return {
    ok: true,
    config: {
      telegramBotToken,
      telegramChatId,
      webhookSecret,
      geminiApiKey,
      serviceAccountJson,
      geminiModelo: env.GEMINI_MODEL?.trim() || undefined,
    },
  };
}

export interface DepsHandler {
  secret: string;
  chatAutorizado: string;
  bot: BotTelegram;
  /** Anti-duplicados de Telegram (opcional para los tests). */
  marcarUpdateProcesado?: (updateId: number) => Promise<boolean>;
  onError?: (error: unknown) => void;
}

function leerCuerpo(body: unknown): unknown {
  if (body == null) return {};
  if (typeof body === 'string') {
    try {
      return JSON.parse(body);
    } catch {
      return {};
    }
  }
  if (Buffer.isBuffer(body)) {
    try {
      return JSON.parse(body.toString('utf8'));
    } catch {
      return {};
    }
  }
  return body;
}

export function crearHandler(deps: DepsHandler) {
  return async function handler(peticion: PeticionMinima, respuesta: RespuestaMinima): Promise<void> {
    const metodo = (peticion.method ?? 'GET').toUpperCase();
    if (metodo !== 'POST') {
      respuesta.status(405).json({ ok: false, error: 'Method Not Allowed' });
      return;
    }

    const cabeceras = peticion.headers ?? {};

    // 1) Sólo Telegram (header secreto)
    if (!verificarSecret(cabeceras, deps.secret)) {
      respuesta.status(401).json({ ok: false, error: 'No autorizado' });
      return;
    }

    const update = leerCuerpo(peticion.body) as {
      update_id?: number;
      message?: { chat?: { id?: number | string } };
      callback_query?: { message?: { chat?: { id?: number | string } } };
    };

    // 2) Sólo el chat del dueño
    const chatId =
      update?.message?.chat?.id ?? update?.callback_query?.message?.chat?.id ?? null;
    if (!esChatAutorizado(chatId, deps.chatAutorizado)) {
      console.warn('[telegram] update de un chat no autorizado, se ignora');
      respuesta.status(200).json({ ok: true, ignorado: true });
      return;
    }

    // 3) Anti-duplicados: Telegram reintenta si no respondemos rápido
    const updateId = Number(update?.update_id);
    if (deps.marcarUpdateProcesado && Number.isFinite(updateId)) {
      const nuevo = await deps.marcarUpdateProcesado(updateId);
      if (!nuevo) {
        respuesta.status(200).json({ ok: true, duplicado: true });
        return;
      }
    }

    try {
      await deps.bot.manejarUpdate(update);
      respuesta.status(200).json({ ok: true });
    } catch (error) {
      (deps.onError ?? ((err: unknown) => console.error('[telegram] error:', err)))(error);
      // 200 para que Telegram no reintente en bucle; el error queda en los logs.
      respuesta.status(200).json({ ok: false, error: 'procesamiento' });
    }
  };
}

/* ─────────────────── composición real (producción en Vercel) ─────────────────── */

let cacheHandler: ReturnType<typeof crearHandler> | null = null;

function handlerPeresozo(): ReturnType<typeof crearHandler> {
  if (cacheHandler) return cacheHandler;

  const resultado = leerEnv();
  if (!resultado.ok || !resultado.config) {
    throw new Error(`Faltan variables de entorno: ${(resultado.faltantes ?? []).join(', ')}`);
  }
  const config: ConfigBot = resultado.config;
  const firestore: ConfiguracionFirestore = { serviceAccountJson: config.serviceAccountJson };

  const almacen: AlmacenBot = crearAlmacen(firestore);
  const telegram = crearClienteTelegram({ token: config.telegramBotToken });
  const bot = crearBot({
    almacen,
    telegram,
    chatAutorizado: config.telegramChatId,
    interpretar: (texto) =>
      interpretarMensaje({
        texto,
        apiKey: config.geminiApiKey,
        modelo: config.geminiModelo,
      }),
  });

  cacheHandler = crearHandler({
    secret: config.webhookSecret,
    chatAutorizado: config.telegramChatId,
    bot,
    marcarUpdateProcesado: (updateId) => almacen.marcarUpdateProcesado(updateId),
  });
  return cacheHandler;
}

export default async function handler(
  peticion: PeticionMinima,
  respuesta: RespuestaMinima
): Promise<void> {
  try {
    await handlerPeresozo()(peticion, respuesta);
  } catch (error) {
    console.error('[telegram] no se pudo arrancar el bot:', error);
    respuesta.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Error de configuración',
    });
  }
}
