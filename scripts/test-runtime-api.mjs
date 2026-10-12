/**
 * Verifica el runtime REAL de Vercel (esto es lo que fallaba con
 * FUNCTION_INVOCATION_FAILED).
 *
 *   npm run test:runtime
 *
 * Vercel transpila cada archivo de `api/` a `.js` SIN bundlear, así que Node
 * carga `api/telegram.js`, que a su vez importa `./_lib/bot.js`. Si un import
 * relativo se queda sin extensión, Node tira:
 *   Cannot find module '/var/task/api/_lib/bot' imported from /var/task/api/telegram.js
 *
 * Este test reproduce ese camino exacto: emite `api/**` con `module: node16`
 * y luego hace `import()` de los `.js` compilados.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

let pass = 0;
let fail = 0;
const grupo = (titulo) => console.log(`\n── ${titulo} ──`);
const t = (nombre, fn) => {
  try {
    fn();
    pass += 1;
    console.log(`  OK    ${nombre}`);
  } catch (err) {
    fail += 1;
    console.log(`  FALLA ${nombre}\n        ${err.message}`);
    process.exitCode = 1;
  }
};
const ta = async (nombre, fn) => {
  try {
    await fn();
    pass += 1;
    console.log(`  OK    ${nombre}`);
  } catch (err) {
    fail += 1;
    console.log(`  FALLA ${nombre}\n        ${err.message}`);
    process.exitCode = 1;
  }
};

const raiz = process.cwd();
const temporal = path.join(raiz, '.api-runtime-check');
const salida = path.join(temporal, 'out');
const tsc = path.join(raiz, 'node_modules', 'typescript', 'bin', 'tsc');

/* ═════════ 1. Guardia estática: todos los imports relativos con .js ═════════ */
grupo('1. Los imports relativos de api/ llevan extensión .js');

const archivosApi = (() => {
  const encontrados = [];
  const recorrer = (dir) => {
    for (const entrada of readdirSync(dir, { withFileTypes: true })) {
      const completo = path.join(dir, entrada.name);
      if (entrada.isDirectory()) recorrer(completo);
      else if (entrada.name.endsWith('.ts')) encontrados.push(completo);
    }
  };
  recorrer(path.join(raiz, 'api'));
  return encontrados;
})();

t(`api/ tiene ${archivosApi.length} archivos .ts`, () => {
  assert.ok(archivosApi.length >= 7, `esperaba al menos 7, hay ${archivosApi.length}`);
});

for (const archivo of archivosApi) {
  const relativo = path.relative(raiz, archivo).replace(/\\/g, '/');
  const contenido = readFileSync(archivo, 'utf8');
  const especificadores = [...contenido.matchAll(/from\s+['"](\.[^'"]+)['"]/g)].map((m) => m[1]);
  t(`${relativo}: ${especificadores.length} imports relativos, todos con .js`, () => {
    for (const especificador of especificadores) {
      assert.ok(
        especificador.endsWith('.js'),
        `"${especificador}" no termina en .js → Node ESM fallaría en producción`
      );
    }
  });
}

/* ═════════ 2. Compilar como Vercel (module node16, sin bundler) ═════════ */
grupo('2. Compilación api/**/*.ts → .js (module node16)');

rmSync(temporal, { recursive: true, force: true });
mkdirSync(salida, { recursive: true });

writeFileSync(
  path.join(temporal, 'tsconfig.json'),
  JSON.stringify(
    {
      compilerOptions: {
        target: 'es2023',
        lib: ['ES2023'],
        types: ['node'],
        skipLibCheck: true,
        module: 'node16',
        moduleResolution: 'node16',
        verbatimModuleSyntax: true,
        outDir: './out',
        rootDir: '../api',
        noEmit: false,
        declaration: false,
        sourceMap: false,
        incremental: false,
      },
      include: ['../api/**/*.ts'],
    },
    null,
    2
  )
);

t('tsc emite los .js sin errores', () => {
  execFileSync(process.execPath, [tsc, '-p', path.join(temporal, 'tsconfig.json')], {
    stdio: 'inherit',
  });
  assert.ok(existsSync(path.join(salida, 'telegram.js')), 'no se generó telegram.js');
  assert.ok(existsSync(path.join(salida, '_lib', 'bot.js')), 'no se generó _lib/bot.js');
});

/* ═════════ 3. Cargar los .js compilados con import() (el camino de Vercel) ═════════ */
grupo('3. import() de los módulos compilados (Node ESM)');

let moduloTelegrama = null;

await ta('import(telegram.js) carga todo el grafo (incluido firebase-admin)', async () => {
  moduloTelegrama = await import(pathToFileURL(path.join(salida, 'telegram.js')).href);
  assert.equal(typeof moduloTelegrama.default, 'function', 'falta el export default');
  assert.equal(typeof moduloTelegrama.crearHandler, 'function');
  assert.equal(typeof moduloTelegrama.leerEnv, 'function');
});

await ta('los imports internos resuelven a .js reales (no .ts)', async () => {
  const contenido = readFileSync(path.join(salida, 'telegram.js'), 'utf8');
  assert.ok(contenido.includes("'./_lib/bot.js'"), 'el .js debe conservarse al compilar');
  assert.equal(/from\s+['"]\.\.?\/(?!.*\.js['"])/.test(contenido), false, 'quedó un import sin .js');
  assert.ok(existsSync(path.join(salida, '_lib', 'pedido.js')));
  assert.ok(existsSync(path.join(salida, '_lib', 'firestore.js')));
  assert.ok(existsSync(path.join(salida, '_lib', 'gemini.js')));
  assert.ok(existsSync(path.join(salida, '_lib', 'menu.js')));
});

await ta('el handler por defecto se ejecuta y reporta la config faltante (500, no crash)', async () => {
  const respaldo = { ...process.env };
  delete process.env.TELEGRAM_BOT_TOKEN;
  delete process.env.TELEGRAM_CHAT_ID;
  delete process.env.TELEGRAM_WEBHOOK_SECRET;
  delete process.env.GEMINI_API_KEY;
  delete process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  try {
    const registro = { codigo: 0, cuerpo: null };
    const res = {
      status(codigo) {
        registro.codigo = codigo;
        return res;
      },
      json(cuerpo) {
        registro.cuerpo = cuerpo;
      },
    };
    // El handler loguea el error de configuración: silenciamos ese log esperado.
    const errorOriginal = console.error;
    console.error = () => {};
    try {
      await moduloTelegrama.default({ method: 'POST', headers: {}, body: {} }, res);
    } finally {
      console.error = errorOriginal;
    }
    assert.equal(registro.codigo, 500);
    assert.ok(String(registro.cuerpo.error).includes('TELEGRAM_BOT_TOKEN'), JSON.stringify(registro.cuerpo));
  } finally {
    process.env = respaldo;
  }
});

/* ═════════ 4. Flujo completo con el código compilado ═════════ */
grupo('4. Flujo completo usando los .js compilados');

const CHAT = '6002544825';

await ta('mensaje → resumen con botones → confirmar → pedido + 2 transacciones', async () => {
  const { crearBot } = await import(pathToFileURL(path.join(salida, '_lib', 'bot.js')).href);
  const { crearHandler } = moduloTelegrama;

  const estado = { enviados: [], pedidos: [], transacciones: [], borradores: new Map() };
  const almacen = {
    async guardarPedido(pedido, transacciones) {
      const id = 'pedido-runtime-1';
      estado.pedidos.push(pedido);
      estado.transacciones.push(...transacciones(id));
      return id;
    },
    async guardarGasto(gasto) {
      estado.pedidos.push(gasto);
      return 'gasto-1';
    },
    async guardarBorrador(chatId, borrador) {
      estado.borradores.set(chatId, borrador);
    },
    async leerBorrador(chatId) {
      return estado.borradores.get(chatId) ?? null;
    },
    async borrarBorrador(chatId) {
      estado.borradores.delete(chatId);
    },
    async pedidosPendientes() {
      return [];
    },
    async actualizarEstadoPedido() {},
    async resumenDia() {
      return { pedidos: 0, ventasProductos: 0, envios: 0, total: 0 };
    },
  };
  const telegram = {
    async enviar(chatId, texto, opciones) {
      estado.enviados.push({ chatId, texto, opciones });
      return 900 + estado.enviados.length;
    },
    async editar() {},
    async confirmarCallback() {},
  };

  const bot = crearBot({
    almacen,
    telegram,
    chatAutorizado: CHAT,
    interpretar: async () => ({
      tipo: 'pedido',
      productos: [
        { nombre: 'Burguer Especial', cantidad: 2 },
        { nombre: 'Hot Dog de Tocino', cantidad: 1 },
      ],
      modalidad: 'delivery',
      direccion: 'Calle Hidalgo 123',
      cliente: 'Cliente WhatsApp',
      metodoPago: 'Efectivo',
    }),
    generarFolio: () => 'RT123',
  });

  const handler = crearHandler({ secret: 'secreto', chatAutorizado: CHAT, bot });

  const responder = () => {
    const registro = { codigo: 0, cuerpo: null };
    const res = {
      status(codigo) {
        registro.codigo = codigo;
        return res;
      },
      json(cuerpo) {
        registro.cuerpo = cuerpo;
      },
    };
    return { res, registro };
  };

  // 401 sin secret (la función responde, no crashea)
  const sinSecreto = responder();
  await handler({ method: 'POST', headers: {}, body: {} }, sinSecreto.res);
  assert.equal(sinSecreto.registro.codigo, 401);

  // mensaje válido
  const cabeceras = { 'x-telegram-bot-api-secret-token': 'secreto' };
  const mensaje = responder();
  await handler(
    {
      method: 'POST',
      headers: cabeceras,
      body: JSON.stringify({
        update_id: 1,
        message: {
          message_id: 10,
          chat: { id: Number(CHAT) },
          text: '2 hamburguesas especiales y 1 hot dog de tocino a domicilio en Calle Hidalgo 123 efectivo',
        },
      }),
    },
    mensaje.res
  );
  assert.equal(mensaje.registro.codigo, 200);
  assert.equal(estado.enviados.length, 1);
  assert.ok(estado.enviados[0].texto.includes('💵 TOTAL: $395'), estado.enviados[0].texto);

  // confirmar
  const data = estado.enviados[0].opciones.reply_markup.inline_keyboard[0][0].callback_data;
  const confirmacion = responder();
  await handler(
    {
      method: 'POST',
      headers: cabeceras,
      body: JSON.stringify({
        update_id: 2,
        callback_query: { id: 'cb', data, message: { message_id: 901, chat: { id: Number(CHAT) } } },
      }),
    },
    confirmacion.res
  );
  assert.equal(confirmacion.registro.codigo, 200);
  assert.equal(estado.pedidos.length, 1);
  assert.equal(estado.pedidos[0].total, 395);
  assert.equal(estado.pedidos[0].requiereReparto, true);
  assert.equal(estado.transacciones.length, 2);
  assert.equal(estado.transacciones[1].categoria, 'Envíos');
});

/* ═════════ limpieza ═════════ */
rmSync(temporal, { recursive: true, force: true });
console.log(`\n${pass} OK / ${fail} FALLAS`);
