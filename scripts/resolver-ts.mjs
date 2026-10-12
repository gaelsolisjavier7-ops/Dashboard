/**
 * Hook de resolución para los tests locales.
 *
 * Los archivos de `api/` importan con extensión `.js` (convención Node ESM +
 * TypeScript: el fuente es `.ts`, pero el import apunta al `.js` que genera
 * Vercel al transpilar). En local sólo existen los `.ts`, así que este hook
 * mapea `./foo.js` → `./foo.ts`. También resuelve imports sin extensión.
 *
 * Se registra con:  node --import ./scripts/resolver-ts.mjs scripts/test-bot.mjs
 *
 * No afecta al build de Vercel: es sólo para `npm run test:bot`, `bot:smoke`
 * y `test:runtime`.
 */
import { registerHooks } from 'node:module';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** Candidatas en orden: el fuente real primero. */
const EXTENSIONES = ['.ts', '.tsx', '.mts', '.mjs', '.js', '/index.ts'];

function existe(especificador, parentURL) {
  try {
    const url = new URL(especificador, parentURL);
    return url.protocol === 'file:' && existsSync(fileURLToPath(url));
  } catch {
    return false;
  }
}

registerHooks({
  resolve(especificador, contexto, siguiente) {
    const esRelativo = especificador.startsWith('./') || especificador.startsWith('../');
    if (!esRelativo || !contexto.parentURL) return siguiente(especificador, contexto);

    // ./foo.js → ./foo.ts  (el .js no existe en el repo, el .ts sí)
    if (especificador.endsWith('.js') && !existe(especificador, contexto.parentURL)) {
      const sinJs = especificador.slice(0, -3);
      for (const extension of EXTENSIONES) {
        if (existe(sinJs + extension, contexto.parentURL)) {
          return siguiente(sinJs + extension, contexto);
        }
      }
    }

    // Imports sin extensión → probamos las candidatas típicas
    if (!/\.[a-z0-9]+$/i.test(especificador)) {
      for (const extension of EXTENSIONES) {
        if (existe(especificador + extension, contexto.parentURL)) {
          return siguiente(especificador + extension, contexto);
        }
      }
    }

    return siguiente(especificador, contexto);
  },
});
