/**
 * Hook de resolución para los tests locales.
 *
 * Los archivos de `api/` usan imports SIN extensión (`from './menu'`) porque así
 * los compila Vercel con esbuild. Node en cambio exige la extensión en ESM, así
 * que este hook la añade (`./menu` → `./menu.ts`) sólo cuando hace falta.
 *
 * Se registra con:  node --import ./scripts/resolver-ts.mjs scripts/test-bot.mjs
 *
 * No afecta al build de Vercel: es sólo para `npm run test:bot` y `npm run bot:smoke`.
 */
import { registerHooks } from 'node:module';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const EXTENSIONES = ['.ts', '.mjs', '.js', '/index.ts'];

registerHooks({
  resolve(especificador, contexto, siguiente) {
    const esRelativo = especificador.startsWith('./') || especificador.startsWith('../');
    const tieneExtension = /\.[a-z0-9]+$/i.test(especificador);

    if (esRelativo && !tieneExtension && contexto.parentURL) {
      for (const extension of EXTENSIONES) {
        const candidato = new URL(especificador + extension, contexto.parentURL);
        if (candidato.protocol === 'file:' && existsSync(fileURLToPath(candidato))) {
          return siguiente(especificador + extension, contexto);
        }
      }
    }

    return siguiente(especificador, contexto);
  },
});
