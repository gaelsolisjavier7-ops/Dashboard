/**
 * Whitelist de los endpoints privados (ticket-scan).
 *
 * Debe coincidir con `src/lib/roles.ts` (CORREOS_PERMITIDOS). Se duplica aquí
 * a propósito: `api/` se compila aparte (tsconfig.api.json) y no debe importar
 * código del frontend.
 *
 * Módulo puro (sin Firebase ni red) para poder probarlo con Node.
 */

export const CORREOS_PERMITIDOS: readonly string[] = [
  'gaelsolisjavier7@gmail.com',
  'jcmissdj@gmail.com',
];

/** minúsculas + sin espacios, igual que `normalizarEmail` del frontend. */
export function normalizarCorreo(valor: unknown): string {
  return String(valor ?? '')
    .trim()
    .toLowerCase();
}

/** true sólo si el correo está en la whitelist (vacío/nulo → false). */
export function esCorreoAutorizado(valor: unknown): boolean {
  const correo = normalizarCorreo(valor);
  return correo.length > 0 && CORREOS_PERMITIDOS.includes(correo);
}
