/**
 * Escritura en Firestore con el Admin SDK (Service Account de Vercel).
 *
 * El Admin SDK se salta las reglas de seguridad: por eso la función sólo
 * escribe lo que ya validó el bot y el webhook exige el secret token.
 */

import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, Timestamp, getFirestore } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';
import {
  ESTADO_PENDIENTE,
  MARCA_SERVIDOR,
  VIGENCIA_BORRADOR_MS,
  VIGENCIA_UPDATE_MS,
} from './pedido.ts';
import type { PedidoResumen, RegistroPlano, ResumenDia } from './pedido.ts';
import type { Almacen } from './bot.ts';

export interface AlmacenBot extends Almacen {
  /** true si el update es nuevo; false si Telegram lo reintentó. */
  marcarUpdateProcesado(updateId: number): Promise<boolean>;
}

export interface ConfiguracionFirestore {
  serviceAccountJson: string | undefined;
  projectId?: string;
}

/** Estados posibles en Firestore según quién creó el pedido. */
const ESTADOS_PENDIENTES = [ESTADO_PENDIENTE, 'pendiente', 'PENDIENTE', 'Pendiente '];

/**
 * Acepta el JSON completo del Service Account (o su versión en base64) y
 * arregla el `\n` literal que suele venir en private_key.
 */
export function leerServiceAccount(json: string | undefined): Record<string, unknown> {
  if (!json || !json.trim()) {
    throw new Error('Falta FIREBASE_SERVICE_ACCOUNT_JSON');
  }

  let texto = json.trim();
  if (!texto.startsWith('{')) {
    texto = Buffer.from(texto, 'base64').toString('utf8').trim();
  }

  let datos: Record<string, unknown>;
  try {
    datos = JSON.parse(texto) as Record<string, unknown>;
  } catch {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON no es un JSON válido');
  }

  if (typeof datos.private_key === 'string') {
    datos.private_key = datos.private_key.replace(/\\n/g, '\n');
  }
  if (!datos.project_id && !datos.projectId) {
    throw new Error('El Service Account no incluye project_id');
  }
  return datos;
}

function crearDb(config: ConfiguracionFirestore): Firestore {
  const serviceAccount = leerServiceAccount(config.serviceAccountJson);
  if (getApps().length === 0) {
    initializeApp({
      credential: cert(serviceAccount as Parameters<typeof cert>[0]),
      projectId: config.projectId ?? String(serviceAccount.project_id ?? ''),
    });
  }
  const db = getFirestore();
  try {
    db.settings({ ignoreUndefinedProperties: true });
  } catch {
    // settings() sólo se puede llamar una vez por instancia
  }
  return db;
}

/** Reemplaza la marca por el serverTimestamp real (recursivo en objetos planos). */
function preparar(valor: unknown): unknown {
  if (valor === MARCA_SERVIDOR) return FieldValue.serverTimestamp();
  if (Array.isArray(valor)) return valor.map(preparar);
  if (valor && typeof valor === 'object') {
    const salida: RegistroPlano = {};
    for (const [clave, contenido] of Object.entries(valor as RegistroPlano)) {
      salida[clave] = preparar(contenido);
    }
    return salida;
  }
  return valor;
}

function aMs(valor: unknown): number {
  if (valor == null) return 0;
  if (typeof valor === 'number') return valor < 1e12 ? valor * 1000 : valor;
  if (typeof valor === 'string') {
    const parseado = Date.parse(valor);
    return Number.isFinite(parseado) ? parseado : 0;
  }
  const objeto = valor as { toMillis?: () => number; seconds?: number; toDate?: () => Date };
  if (typeof objeto.toMillis === 'function') return objeto.toMillis();
  if (typeof objeto.seconds === 'number') return objeto.seconds * 1000;
  if (typeof objeto.toDate === 'function') return objeto.toDate().getTime();
  return 0;
}

function folioDe(id: string, datos: RegistroPlano): string {
  const guardado = datos.folio;
  if (typeof guardado === 'string' && guardado.trim()) return guardado.trim().toUpperCase();
  return id.slice(0, 5).toUpperCase();
}

function clienteDe(datos: RegistroPlano): { nombre: string; direccion: string | null } {
  const cliente = datos.cliente;
  if (cliente && typeof cliente === 'object') {
    const registro = cliente as RegistroPlano;
    return {
      nombre: String(registro.nombre ?? 'Cliente'),
      direccion: (registro.direccion as string | null) ?? null,
    };
  }
  return { nombre: String(cliente ?? datos.nombre ?? 'Cliente'), direccion: (datos.direccion as string | null) ?? null };
}

export function crearAlmacen(config: ConfiguracionFirestore): AlmacenBot {
  const db = crearDb(config);
  const pedidos = () => db.collection('pedidos');
  const transacciones = () => db.collection('transacciones');
  const borradores = () => db.collection('bot_borradores');
  const updates = () => db.collection('bot_updates');

  return {
    async guardarPedido(pedido, construirTransacciones) {
      const referencia = pedidos().doc();
      const lote = db.batch();
      lote.set(referencia, preparar(pedido) as RegistroPlano);
      for (const movimiento of construirTransacciones(referencia.id)) {
        lote.set(transacciones().doc(), preparar(movimiento) as RegistroPlano);
      }
      await lote.commit();
      return referencia.id;
    },

    async guardarGasto(gasto) {
      const referencia = transacciones().doc();
      await referencia.set(preparar(gasto) as RegistroPlano);
      return referencia.id;
    },

    async guardarBorrador(chatId, borrador) {
      await borradores().doc(chatId).set(preparar({ ...borrador, expiresAt: Date.now() + VIGENCIA_BORRADOR_MS }) as RegistroPlano);
    },

    async leerBorrador(chatId) {
      const snap = await borradores().doc(chatId).get();
      if (!snap.exists) return null;
      const datos = snap.data() as RegistroPlano;
      if (aMs(datos.expiresAt) < Date.now()) return null;
      return datos;
    },

    async borrarBorrador(chatId) {
      await borradores().doc(chatId).delete();
    },

    async pedidosPendientes(limite) {
      const snap = await pedidos().where('estado', 'in', ESTADOS_PENDIENTES).limit(50).get();
      const lista = snap.docs.map((docSnap) => {
        const datos = docSnap.data() as RegistroPlano;
        const cliente = clienteDe(datos);
        return {
          id: docSnap.id,
          folio: folioDe(docSnap.id, datos),
          cliente: cliente.nombre,
          direccion: cliente.direccion,
          total: Number(datos.total ?? datos.monto ?? 0),
          estado: String(datos.estado ?? ESTADO_PENDIENTE),
          fechaMs: aMs(datos.fecha ?? datos.createdAt ?? datos.fechaPedido),
          modalidad: String(datos.modalidad ?? ''),
        } satisfies PedidoResumen;
      });
      lista.sort((a, b) => b.fechaMs - a.fechaMs);
      return lista.slice(0, limite);
    },

    async actualizarEstadoPedido(pedidoId, estado) {
      await pedidos().doc(pedidoId).update({ estado });
    },

    async resumenDia(inicioMs, finMs) {
      const desde = Timestamp.fromMillis(inicioMs);
      const hasta = Timestamp.fromMillis(finMs);

      let snap = await pedidos().where('fecha', '>=', desde).where('fecha', '<=', hasta).get();
      if (snap.empty) {
        // Pedidos viejos guardados con `createdAt` en lugar de `fecha`.
        snap = await pedidos().where('createdAt', '>=', desde).where('createdAt', '<=', hasta).get();
      }

      const resumen: ResumenDia = { pedidos: 0, ventasProductos: 0, envios: 0, total: 0 };
      for (const docSnap of snap.docs) {
        const datos = docSnap.data() as RegistroPlano;
        const estado = String(datos.estado ?? '').toLowerCase();
        if (estado.startsWith('cancel')) continue;

        const total = Number(datos.total ?? datos.monto ?? 0);
        const envio = Number(datos.cargoEnvio ?? 0);
        const subtotal = datos.subtotal != null ? Number(datos.subtotal) : total - envio;

        resumen.pedidos += 1;
        resumen.ventasProductos += Number.isFinite(subtotal) ? subtotal : 0;
        resumen.envios += Number.isFinite(envio) ? envio : 0;
        resumen.total += Number.isFinite(total) ? total : 0;
      }
      return resumen;
    },

    async marcarUpdateProcesado(updateId) {
      try {
        await updates()
          .doc(String(updateId))
          .create({
            createdAt: FieldValue.serverTimestamp(),
            expiresAt: Timestamp.fromMillis(Date.now() + VIGENCIA_UPDATE_MS),
          });
        return true;
      } catch (error) {
        const codigo = (error as { code?: number | string }).code;
        if (codigo === 6 || codigo === 'already-exists') return false;
        throw error;
      }
    },
  };
}
