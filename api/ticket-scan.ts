/**
 * Escaneo de tickets de compra con foto (Vercel Serverless Function).
 *
 *   App → POST /api/ticket-scan (Authorization: Bearer <ID token>) → Gemini Vision → JSON
 *
 * No escribe en Firestore: devuelve el ticket normalizado y el modal decide.
 * `crearHandler`/`depsReales` se exportan para poder probar el flujo completo
 * con dependencias falsas (`npm run test:ticket`), igual que en `api/telegram.ts`.
 */

import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { leerServiceAccount } from './_lib/firestore.js';
import { analizarTicket } from './_lib/ticket-gemini.js';
import { leerBearer, procesarTicket } from './_lib/ticket.js';
import type { DepsTicket, PeticionTicket, RespuestaTicket } from './_lib/ticket.js';

export interface RespuestaMinima {
  status(codigo: number): RespuestaMinima;
  json(cuerpo: unknown): void;
}

let adminLista = false;

/** Inicializa el Admin SDK una sola vez (mismo patrón que `_lib/firestore.ts`). */
function asegurarAdmin(): void {
  if (adminLista || getApps().length > 0) {
    adminLista = true;
    return;
  }
  const serviceAccount = leerServiceAccount(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  initializeApp({
    credential: cert(serviceAccount as Parameters<typeof cert>[0]),
    projectId: String(serviceAccount.project_id ?? ''),
  });
  adminLista = true;
}

/**
 * Verifica el ID token de Firebase del header `Authorization`.
 * Token ausente, inválido, expirado o sin configuración → false (401 en el flujo).
 */
export async function verificarIdToken(authorization: string | undefined): Promise<boolean> {
  const token = leerBearer(authorization);
  if (!token) return false;

  try {
    asegurarAdmin();
    const decodificado = await getAuth().verifyIdToken(token);
    return Boolean(decodificado?.uid);
  } catch (error) {
    console.warn(
      '[ticket] token rechazado:',
      error instanceof Error ? error.message : String(error)
    );
    return false;
  }
}

/** Handler con dependencias inyectadas (tests). */
export function crearHandler(deps: DepsTicket) {
  return async function handler(
    peticion: PeticionTicket,
    respuesta: RespuestaMinima
  ): Promise<void> {
    const resultado: RespuestaTicket = await procesarTicket(peticion, deps);
    respuesta.status(resultado.status).json(resultado.json);
  };
}

/** Dependencias reales: Admin SDK para el token + Gemini Vision para la imagen. */
export function depsReales(env: Record<string, string | undefined> = process.env): DepsTicket {
  const apiKey = env.GEMINI_API_KEY?.trim() ?? '';
  const modelo = env.GEMINI_MODEL?.trim() || undefined;
  return {
    verificarToken: (authorization) => verificarIdToken(authorization),
    analizar: (entrada) => analizarTicket({ ...entrada, apiKey, modelo }),
  };
}

export default async function handler(
  peticion: PeticionTicket,
  respuesta: RespuestaMinima
): Promise<void> {
  try {
    await crearHandler(depsReales())(peticion, respuesta);
  } catch (error) {
    console.error('[ticket] error inesperado:', error);
    respuesta.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Error interno',
    });
  }
}
