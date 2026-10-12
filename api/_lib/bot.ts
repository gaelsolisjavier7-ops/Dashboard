/**
 * Orquestador del bot: recibe updates de Telegram, interpreta, pide confirmación
 * y escribe en Firestore. Toda la lógica vive acá con dependencias inyectadas
 * (almacén, cliente de Telegram e intérprete), así se puede probar de punta a
 * punta sin red, sin Firestore y sin Vercel (`npm run test:bot`).
 */

import {
  ESTADO_CANCELADO,
  ESTADO_ENTREGADO,
  TEXTO_AYUDA,
  TEXTO_ERROR_GUARDADO,
  TEXTO_NO_ENTENDIDO,
  TEXTO_PIDE_MODALIDAD,
  borradorVigente,
  conModalidad,
  construirBorrador,
  construirDocumentoGasto,
  construirDocumentoPedido,
  construirTransaccionesPedido,
  fechaLocal,
  formatearConfirmadoGasto,
  formatearConfirmadoPedido,
  formatearPendientes,
  formatearResumenDia,
  formatearResumenPedido,
  idCorto,
  normalizarOperacion,
  operacionDeBorrador,
  parsearCallback,
  rangoDiaLocal,
  sanitizarTexto,
} from './pedido.ts';
import type {
  EstadoBorrador,
  GastoDetectado,
  Modalidad,
  PedidoDetectado,
  PedidoResumen,
  RegistroPlano,
  ResumenDia,
} from './pedido.ts';
import { esChatAutorizado, tecladoConfirmacion, tecladoModalidad, tecladoPendientes } from './telegram.ts';
import type { ClienteTelegram } from './telegram.ts';

export interface Almacen {
  /** Crea el pedido y sus transacciones en un solo lote. Devuelve el id del pedido. */
  guardarPedido(
    pedido: RegistroPlano,
    transacciones: (pedidoId: string) => RegistroPlano[]
  ): Promise<string>;
  guardarGasto(gasto: RegistroPlano): Promise<string>;
  guardarBorrador(chatId: string, borrador: RegistroPlano): Promise<void>;
  leerBorrador(chatId: string): Promise<RegistroPlano | null>;
  borrarBorrador(chatId: string): Promise<void>;
  pedidosPendientes(limite: number): Promise<PedidoResumen[]>;
  actualizarEstadoPedido(pedidoId: string, estado: string): Promise<void>;
  resumenDia(inicioMs: number, finMs: number): Promise<ResumenDia>;
}

export interface DepsBot {
  almacen: Almacen;
  telegram: ClienteTelegram;
  interpretar: (texto: string) => Promise<unknown | null>;
  /** TELEGRAM_CHAT_ID: único chat atendido. */
  chatAutorizado: string;
  ahora?: () => number;
  generarFolio?: () => string;
}

export interface MensajeEntrante {
  message_id?: number;
  text?: string;
  chat?: { id?: number | string };
  from?: { first_name?: string; username?: string };
}

export interface CallbackEntrante {
  id?: string;
  data?: string;
  message?: { message_id?: number; chat?: { id?: number | string } };
}

export interface UpdateTelegram {
  update_id?: number;
  message?: MensajeEntrante;
  callback_query?: CallbackEntrante;
}

export interface BotTelegram {
  manejarUpdate(update: unknown): Promise<void>;
}

export function crearBot(deps: DepsBot): BotTelegram {
  const ahoraMs = deps.ahora ?? (() => Date.now());
  const generarFolio = deps.generarFolio ?? (() => idCorto());

  async function enviar(
    chatId: string,
    texto: string,
    opciones?: { reply_markup?: unknown }
  ): Promise<number | null> {
    try {
      return await deps.telegram.enviar(chatId, texto, opciones);
    } catch (error) {
      console.error('[bot] no se pudo enviar el mensaje:', error);
      return null;
    }
  }

  async function editar(chatId: string, messageId: number | null, texto: string): Promise<void> {
    if (!messageId) {
      await enviar(chatId, texto);
      return;
    }
    try {
      await deps.telegram.editar(chatId, messageId, texto);
    } catch (error) {
      console.error('[bot] no se pudo editar el mensaje:', error);
    }
  }

  async function leerBorrador(chatId: string): Promise<RegistroPlano | null> {
    try {
      return await deps.almacen.leerBorrador(chatId);
    } catch (error) {
      console.error('[bot] no se pudo leer el borrador:', error);
      return null;
    }
  }

  async function borrarBorrador(chatId: string): Promise<void> {
    try {
      await deps.almacen.borrarBorrador(chatId);
    } catch (error) {
      console.error('[bot] no se pudo borrar el borrador:', error);
    }
  }

  async function guardarBorrador(
    chatId: string,
    operacion: PedidoDetectado | GastoDetectado,
    estado: EstadoBorrador,
    messageId: number | null,
    sello: string
  ): Promise<void> {
    try {
      const borrador = construirBorrador(chatId, operacion, estado, ahoraMs(), messageId, sello);
      await deps.almacen.guardarBorrador(chatId, borrador);
    } catch (error) {
      console.error('[bot] no se pudo guardar el borrador:', error);
    }
  }

  /* ─────────────────────────── confirmación y guardado ─────────────────────────── */

  async function registrarPedido(
    chatId: string,
    operacion: PedidoDetectado,
    messageId: number | null
  ): Promise<void> {
    const folio = generarFolio();
    try {
      await deps.almacen.guardarPedido(construirDocumentoPedido(operacion, folio), (pedidoId) =>
        construirTransaccionesPedido(operacion, folio, pedidoId)
      );
      await borrarBorrador(chatId);
      await editar(chatId, messageId, formatearConfirmadoPedido(operacion, folio));
    } catch (error) {
      console.error('[bot] error al guardar el pedido:', error);
      await enviar(chatId, TEXTO_ERROR_GUARDADO);
    }
  }

  async function registrarGasto(
    chatId: string,
    operacion: GastoDetectado,
    messageId: number | null = null
  ): Promise<void> {
    try {
      await deps.almacen.guardarGasto(construirDocumentoGasto(operacion));
      await borrarBorrador(chatId);
      if (messageId) {
        await editar(chatId, messageId, formatearConfirmadoGasto(operacion));
      } else {
        await enviar(chatId, formatearConfirmadoGasto(operacion));
      }
    } catch (error) {
      console.error('[bot] error al guardar el gasto:', error);
      await enviar(chatId, TEXTO_ERROR_GUARDADO);
    }
  }

  /** Muestra el resumen con los botones que correspondan y guarda el borrador. */
  async function proponerPedido(chatId: string, operacion: PedidoDetectado): Promise<void> {
    const sello = String(ahoraMs());
    const ambiguo = operacion.modalidad === 'ambiguo';
    const texto = ambiguo
      ? `${formatearResumenPedido(operacion)}\n\n${TEXTO_PIDE_MODALIDAD}`
      : formatearResumenPedido(operacion);
    const teclado = ambiguo
      ? tecladoModalidad(chatId, sello)
      : tecladoConfirmacion(chatId, sello);

    const enviado = await enviar(chatId, texto, { reply_markup: teclado });
    if (enviado == null) return;
    // El borrador apunta SIEMPRE al mensaje del resumen (el que tiene los botones).
    await guardarBorrador(
      chatId,
      operacion,
      ambiguo ? 'esperando_modalidad' : 'pendiente_confirmacion',
      enviado,
      sello
    );
  }

  /* ─────────────────────────────── mensajes ─────────────────────────────── */

  async function manejarMensaje(mensaje: MensajeEntrante): Promise<void> {
    const chatId = String(mensaje.chat?.id ?? '');
    if (!esChatAutorizado(chatId, deps.chatAutorizado)) {
      console.warn('[bot] mensaje de un chat no autorizado, se ignora:', chatId);
      return;
    }

    const texto = sanitizarTexto(mensaje.text, 1000);
    if (!texto) {
      await enviar(chatId, TEXTO_NO_ENTENDIDO);
      return;
    }

    if (texto.startsWith('/')) {
      await manejarComando(chatId, texto);
      return;
    }

    const borradorPrevio = await leerBorrador(chatId);
    const corrigiendo =
      borradorPrevio?.estado === 'esperando_correccion' &&
      borradorVigente(borradorPrevio, undefined, ahoraMs());

    let crudo: unknown = null;
    try {
      crudo = await deps.interpretar(texto);
    } catch (error) {
      console.error('[bot] el intérprete falló:', error);
    }
    if (crudo == null) {
      await enviar(chatId, TEXTO_NO_ENTENDIDO);
      return;
    }

    const operacion = normalizarOperacion(crudo, texto);

    if (operacion.tipo === 'gasto') {
      // null: el gasto llega en un mensaje del usuario (no se puede editar), se responde uno nuevo.
      await registrarGasto(chatId, operacion, null);
      return;
    }

    if (operacion.productos.length === 0) {
      await enviar(chatId, TEXTO_NO_ENTENDIDO);
      return;
    }

    if (corrigiendo) await borrarBorrador(chatId);
    await proponerPedido(chatId, operacion);
  }

  /* ─────────────────────────────── comandos ─────────────────────────────── */

  async function manejarComando(chatId: string, texto: string): Promise<void> {
    const comando = (texto.trim().split(/[\s@]/)[0] ?? '').toLowerCase();

    switch (comando) {
      case '/start':
      case '/help':
        await enviar(chatId, TEXTO_AYUDA);
        return;

      case '/cancelar': {
        const borrador = await leerBorrador(chatId);
        await borrarBorrador(chatId);
        await enviar(
          chatId,
          borrador ? '❌ Operación cancelada.' : 'No hay ninguna operación en curso.'
        );
        return;
      }

      case '/hoy':
        await mandarResumen(chatId, 0);
        return;

      case '/ayer':
        await mandarResumen(chatId, -1);
        return;

      case '/pendientes':
        await mandarPendientes(chatId);
        return;

      default:
        await enviar(chatId, TEXTO_AYUDA);
    }
  }

  async function mandarResumen(chatId: string, dias: number): Promise<void> {
    try {
      const [inicio, fin] = rangoDiaLocal(ahoraMs(), dias);
      const resumen = await deps.almacen.resumenDia(inicio, fin);
      const etiqueta = `${dias === 0 ? 'Hoy' : 'Ayer'} (${fechaLocal(inicio)})`;
      await enviar(chatId, formatearResumenDia(resumen, etiqueta));
    } catch (error) {
      console.error('[bot] no se pudo armar el resumen:', error);
      await enviar(chatId, TEXTO_ERROR_GUARDADO);
    }
  }

  async function mandarPendientes(chatId: string, messageId: number | null = null): Promise<void> {
    try {
      const pendientes = await deps.almacen.pedidosPendientes(10);
      const texto = formatearPendientes(pendientes, ahoraMs());
      const teclado = pendientes.length > 0 ? tecladoPendientes(pendientes) : undefined;
      if (messageId) await editar(chatId, messageId, texto);
      else await enviar(chatId, texto, teclado ? { reply_markup: teclado } : undefined);
    } catch (error) {
      console.error('[bot] no se pudieron leer los pendientes:', error);
      await enviar(chatId, TEXTO_ERROR_GUARDADO);
    }
  }

  /* ─────────────────────────────── callbacks ─────────────────────────────── */

  async function manejarCallback(callback: CallbackEntrante): Promise<void> {
    const chatId = String(callback.message?.chat?.id ?? '');
    const messageId = callback.message?.message_id ?? null;
    const callbackId = callback.id ?? '';

    if (!esChatAutorizado(chatId, deps.chatAutorizado)) {
      console.warn('[bot] callback de un chat no autorizado, se ignora:', chatId);
      if (callbackId) await deps.telegram.confirmarCallback(callbackId);
      return;
    }

    // Respondemos siempre para que Telegram no deje el botón "cargando".
    if (callbackId) await deps.telegram.confirmarCallback(callbackId);

    const parseado = parsearCallback(callback.data);
    if (!parseado) return;
    const { accion, partes } = parseado;

    if (accion === 'po' || accion === 'pc') {
      const pedidoId = partes[0];
      if (!pedidoId) return;
      try {
        await deps.almacen.actualizarEstadoPedido(
          pedidoId,
          accion === 'po' ? ESTADO_ENTREGADO : ESTADO_CANCELADO
        );
      } catch (error) {
        console.error('[bot] no se pudo actualizar el pedido:', error);
        await enviar(chatId, TEXTO_ERROR_GUARDADO);
        return;
      }
      await mandarPendientes(chatId, messageId);
      return;
    }

    const borrador = await leerBorrador(chatId);
    const sello = partes[1];
    if (!borradorVigente(borrador, sello, ahoraMs())) {
      await enviar(
        chatId,
        '⌛ Ese botón ya expiró. Manda el pedido otra vez cuando quieras.'
      );
      return;
    }
    const actual = borrador as RegistroPlano;
    const operacion = operacionDeBorrador(actual);

    switch (accion) {
      case 'cf': {
        if (!operacion) {
          await enviar(chatId, TEXTO_ERROR_GUARDADO);
          return;
        }
        if (operacion.tipo === 'gasto') await registrarGasto(chatId, operacion, messageId);
        else await registrarPedido(chatId, operacion, messageId);
        return;
      }

      case 'cx': {
        await borrarBorrador(chatId);
        await editar(chatId, messageId, '❌ Operación cancelada.');
        return;
      }

      case 'ed': {
        if (!operacion) {
          await enviar(chatId, TEXTO_ERROR_GUARDADO);
          return;
        }
        await guardarBorrador(
          chatId,
          operacion,
          'esperando_correccion',
          (actual.messageId as number | null) ?? messageId,
          String(actual.sello ?? sello ?? '')
        );
        await editar(chatId, messageId, '✏️ Manda el pedido corregido y lo vuelvo a armar.');
        return;
      }

      case 'dl':
      case 'pk': {
        if (!operacion || operacion.tipo !== 'pedido') {
          await enviar(chatId, TEXTO_ERROR_GUARDADO);
          return;
        }
        const modalidad: Modalidad = accion === 'dl' ? 'delivery' : 'pickup';
        const actualizado = conModalidad(operacion, modalidad);
        const selloBorrador = String(actual.sello ?? sello ?? '');
        await guardarBorrador(
          chatId,
          actualizado,
          'pendiente_confirmacion',
          (actual.messageId as number | null) ?? messageId,
          selloBorrador
        );
        // Reescribimos el resumen ya con el envío y los botones de confirmación.
        if (messageId) {
          try {
            await deps.telegram.editar(chatId, messageId, formatearResumenPedido(actualizado), {
              reply_markup: tecladoConfirmacion(chatId, selloBorrador),
            });
          } catch (error) {
            console.error('[bot] no se pudo actualizar la modalidad:', error);
            await enviar(chatId, formatearResumenPedido(actualizado), {
              reply_markup: tecladoConfirmacion(chatId, selloBorrador),
            });
          }
        } else {
          await enviar(chatId, formatearResumenPedido(actualizado), {
            reply_markup: tecladoConfirmacion(chatId, selloBorrador),
          });
        }
        return;
      }

      default:
        return;
    }
  }

  return {
    async manejarUpdate(update: unknown): Promise<void> {
      const datos = (update ?? {}) as UpdateTelegram;
      if (datos.callback_query) {
        await manejarCallback(datos.callback_query);
        return;
      }
      if (datos.message) {
        await manejarMensaje(datos.message);
      }
    },
  };
}
