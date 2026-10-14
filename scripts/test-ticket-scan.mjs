/**
 * Tests del escáner de tickets de compra.
 *
 *   npm run test:ticket
 *
 * No usa red ni Firebase: `procesarTicket` recibe las dependencias inyectadas
 * (verificador de token y llamada a Gemini), así que se prueban todos los
 * caminos HTTP reales del endpoint `api/ticket-scan.ts`.
 */
import assert from 'node:assert/strict';
import {
  CATEGORIAS_TICKET,
  construirDescripcion,
  leerBearer,
  normalizarCategoria,
  normalizarConfianza,
  normalizarFecha,
  normalizarTicket,
  procesarTicket,
  resumirProductos,
} from '../api/_lib/ticket.ts';
import { resolverCategoria } from '../src/lib/ticket.ts';

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

/** Respuesta realista de Gemini para un ticket mexicano. */
const TICKET_GEMINI = {
  proveedor: 'Carnemart',
  fecha: '2026-10-12',
  total: 450.5,
  productos: [
    { nombre: 'Carne molida', cantidad: 3, precioUnitario: 120 },
    { nombre: 'Pan brioche', cantidad: 2, precioUnitario: 45.25 },
  ],
  categoria: 'Insumos',
  confianza: 'alta',
};

const deps = (extra = {}) => ({
  // Mismo criterio que `verificarIdToken`: sin header válido no autoriza.
  verificarToken: async (authorization) => leerBearer(authorization) === 'token-valido',
  analizar: async () => TICKET_GEMINI,
  ...extra,
});

const peticion = (cuerpo, cabeceras = { authorization: 'Bearer token-valido' }) => ({
  method: 'POST',
  headers: cabeceras,
  body: cuerpo,
});

/* ═════════════ 1. Parseo correcto de la respuesta de Gemini ═════════════ */
grupo('1. Parseo de la respuesta de Gemini');

t('normaliza todos los campos del ticket', () => {
  const ticket = normalizarTicket(TICKET_GEMINI);
  assert.equal(ticket.proveedor, 'Carnemart');
  assert.equal(ticket.fecha, '2026-10-12');
  assert.equal(ticket.total, 450.5);
  assert.equal(ticket.productos.length, 2);
  assert.equal(ticket.productos[0].nombre, 'Carne molida');
  assert.equal(ticket.productos[0].cantidad, 3);
  assert.equal(ticket.productos[0].precioUnitario, 120);
  assert.equal(ticket.categoria, 'Insumos');
  assert.equal(ticket.confianza, 'alta');
  assert.equal(ticket.descripcion, 'Carnemart · 3× Carne molida, 2× Pan brioche');
});

t('acepta fecha ISO completa y la recorta a YYYY-MM-DD', () => {
  assert.equal(normalizarFecha('2026-10-12T18:30:00.000Z'), '2026-10-12');
});

t('acepta fecha dd/mm/aaaa del ticket', () => {
  assert.equal(normalizarFecha('12/10/2026'), '2026-10-12');
  assert.equal(normalizarFecha('3-2-26'), '2026-02-03');
});

t('redondea a 2 decimales', () => {
  assert.equal(normalizarTicket({ total: 450.567, productos: [] }).total, 450.57);
});

t('la descripción resume máximo 4 productos y agrega "+N más"', () => {
  const productos = Array.from({ length: 6 }, (_, i) => ({
    nombre: `Producto ${i + 1}`,
    cantidad: 1,
    precioUnitario: 10,
  }));
  const resumen = resumirProductos(productos);
  assert.ok(resumen.includes('+2 más'), resumen);
  assert.equal(resumen.split(',').length, 5);
  assert.equal(construirDescripcion({ proveedor: 'Oxxo', productos }), `Oxxo · ${resumen}`);
});

/* ═════════════ 2. Campos faltantes → defaults ═════════════ */
grupo('2. Campos faltantes → valores por defecto');

t('sin total ni productos → 0 y []', () => {
  const ticket = normalizarTicket({});
  assert.equal(ticket.total, 0);
  assert.deepEqual(ticket.productos, []);
  assert.equal(ticket.proveedor, 'Proveedor sin identificar');
  assert.equal(ticket.fecha, '');
  assert.equal(ticket.confianza, 'baja');
});

t('respuesta nula o basura → defaults sin lanzar', () => {
  for (const entrada of [null, undefined, 'texto', 42, []]) {
    const ticket = normalizarTicket(entrada);
    assert.equal(ticket.total, 0);
    assert.deepEqual(ticket.productos, []);
  }
});

t('total inválido o negativo → 0', () => {
  assert.equal(normalizarTicket({ total: 'cuatrocientos' }).total, 0);
  assert.equal(normalizarTicket({ total: -50 }).total, 0);
});

t('producto sin cantidad → 1; sin precio → 0; sin nombre → se descarta', () => {
  const ticket = normalizarTicket({
    total: 100,
    productos: [
      { nombre: 'Servilletas' },
      { nombre: 'Vasos', cantidad: 4 },
      { cantidad: 2, precioUnitario: 30 },
    ],
  });
  assert.equal(ticket.productos.length, 2);
  assert.equal(ticket.productos[0].cantidad, 1);
  assert.equal(ticket.productos[0].precioUnitario, 0);
  assert.equal(ticket.productos[1].precioUnitario, 0);
});

t('confianza desconocida → baja', () => {
  assert.equal(normalizarConfianza('ALTÍSIMA'), 'baja');
  assert.equal(normalizarConfianza('alta'), 'alta');
  assert.equal(normalizarConfianza('Media'), 'media');
});

/* ═════════════ 3. Categoría no reconocida → Otros ═════════════ */
grupo('3. Categoría');

t('categoría no reconocida → Otros', () => {
  assert.equal(normalizarCategoria('Ferretería'), 'Otros');
  assert.equal(normalizarCategoria(''), 'Otros');
  assert.equal(normalizarCategoria(undefined), 'Otros');
});

t('reconoce las 4 categorías aunque vengan con acentos o mayúsculas', () => {
  assert.equal(normalizarCategoria('insumos'), 'Insumos');
  assert.equal(normalizarCategoria(' SALSAS '), 'Salsas');
  assert.equal(normalizarCategoria('Papelería'), 'Papelería');
  assert.equal(normalizarCategoria('papeleria'), 'Papelería');
  assert.equal(normalizarCategoria('Otros'), 'Otros');
  assert.deepEqual([...CATEGORIAS_TICKET], ['Insumos', 'Salsas', 'Papelería', 'Otros']);
});

t('la categoría sugerida se mapea al catálogo real del usuario', () => {
  const catalogo = ['Carne & Pan', 'Queso, Salsas & Verduras', 'Empaques & Desechables', 'Insumos'];
  assert.equal(resolverCategoria('Insumos', catalogo), 'Insumos');
  assert.equal(resolverCategoria('Salsas', catalogo), 'Queso, Salsas & Verduras');
  // "Papelería" no existe en el catálogo → cae en Insumos (no rompe el <select>)
  assert.equal(resolverCategoria('Papelería', catalogo), 'Insumos');
  assert.equal(resolverCategoria('Otros', catalogo), 'Insumos');
  assert.equal(resolverCategoria('Salsas', []), 'Salsas');
});

/* ═════════════ 4. Flujo HTTP del endpoint ═════════════ */
grupo('4. Flujo HTTP (api/ticket-scan)');

await ta('sin imagen → 400', async () => {
  const r = await procesarTicket(peticion({ mimeType: 'image/jpeg' }), deps());
  assert.equal(r.status, 400);
  assert.equal(r.json.ok, false);
  assert.match(String(r.json.error), /imagen/i);
});

await ta('imagen vacía o sólo espacios → 400', async () => {
  assert.equal((await procesarTicket(peticion({ image: '   ' }), deps())).status, 400);
});

await ta('sin Authorization → 401', async () => {
  const r = await procesarTicket(peticion({ image: 'abc' }, {}), deps());
  assert.equal(r.status, 401);
  assert.equal(r.json.error, 'No autorizado');
});

await ta('token inválido (el verificador dice no) → 401 y no llama a Gemini', async () => {
  let llamo = false;
  const r = await procesarTicket(peticion({ image: 'abc' }), {
    verificarToken: async () => false,
    analizar: async () => {
      llamo = true;
      return TICKET_GEMINI;
    },
  });
  assert.equal(r.status, 401);
  assert.equal(llamo, false, 'no debe gastar una llamada a Gemini');
});

await ta('verificador que explota → 500', async () => {
  const r = await procesarTicket(
    peticion({ image: 'abc' }),
    deps({
      verificarToken: async () => {
        throw new Error('admin sin credenciales');
      },
    })
  );
  assert.equal(r.status, 500);
});

await ta('método distinto a POST → 405', async () => {
  const r = await procesarTicket({ method: 'GET', headers: {} }, deps());
  assert.equal(r.status, 405);
});

await ta('el body llega como string (runtime de Vercel) y se procesa igual', async () => {
  const r = await procesarTicket(
    peticion(JSON.stringify({ image: 'abc', mimeType: 'image/png' })),
    deps()
  );
  assert.equal(r.status, 200);
});

await ta('imagen demasiado grande → 413', async () => {
  const r = await procesarTicket(peticion({ image: 'a'.repeat(2000) }), deps({ maxBytes: 1000 }));
  assert.equal(r.status, 413);
});

await ta('Gemini devuelve null (500/timeout) → 502', async () => {
  const r = await procesarTicket(peticion({ image: 'abc' }), deps({ analizar: async () => null }));
  assert.equal(r.status, 502);
  assert.match(String(r.json.error), /no se pudo leer/i);
});

await ta('Gemini lanza (mock 500 de fetch) → 502, no 500', async () => {
  const r = await procesarTicket(
    peticion({ image: 'abc' }),
    deps({
      analizar: async () => {
        throw new Error('HTTP 500');
      },
    })
  );
  assert.equal(r.status, 502);
});

await ta('no es un ticket (todo vacío) → 422', async () => {
  const r = await procesarTicket(
    peticion({ image: 'abc' }),
    deps({ analizar: async () => ({ proveedor: '', total: 0, productos: [], confianza: 'baja' }) })
  );
  assert.equal(r.status, 422);
  assert.equal(r.json.confianza, 'baja');
});

await ta('éxito → 200 con el ticket normalizado y su descripción', async () => {
  const r = await procesarTicket(peticion({ image: 'abc' }), deps());
  assert.equal(r.status, 200);
  assert.equal(r.json.ok, true);
  const ticket = r.json.ticket;
  assert.equal(ticket.proveedor, 'Carnemart');
  assert.equal(ticket.total, 450.5);
  assert.equal(ticket.categoria, 'Insumos');
  assert.equal(ticket.productos.length, 2);
  assert.ok(String(ticket.descripcion).startsWith('Carnemart · 3× Carne molida'));
});

await ta('mimeType ausente → se asume image/jpeg', async () => {
  let mimeRecibido = null;
  const r = await procesarTicket(
    peticion({ image: 'abc' }),
    deps({
      analizar: async ({ mimeType }) => {
        mimeRecibido = mimeType;
        return TICKET_GEMINI;
      },
    })
  );
  assert.equal(r.status, 200);
  assert.equal(mimeRecibido, 'image/jpeg');
});

/* ═════════════ 5. Header Authorization ═════════════ */
grupo('5. Lectura del header Authorization');

t('acepta "Bearer x", "bearer x" y el token suelto', () => {
  assert.equal(leerBearer('Bearer abc.def'), 'abc.def');
  assert.equal(leerBearer('bearer abc'), 'abc');
  assert.equal(leerBearer('  Bearer   abc  '), 'abc');
  assert.equal(leerBearer('abc'), 'abc');
});

t('rechaza esquemas raros y vacíos', () => {
  assert.equal(leerBearer(''), '');
  assert.equal(leerBearer(undefined), '');
  assert.equal(leerBearer('Basic abc'), '');
});

t('lee el header sin importar mayúsculas/minúsculas', async () => {
  const r = await procesarTicket(
    peticion({ image: 'abc' }, { AUTHORIZATION: 'bearer token-valido' }),
    deps()
  );
  assert.equal(r.status, 200);
});

/* ═════════════ 6. Capa de Gemini (fetch simulado) ═════════════ */
grupo('6. Llamada a Gemini Vision');

const respuestaGemini = (texto) => ({
  ok: true,
  status: 200,
  json: async () => ({ candidates: [{ content: { parts: [{ text: texto }] } }] }),
  text: async () => texto,
});

await ta('analizarTicket parsea el JSON del modelo', async () => {
  const { analizarTicket } = await import('../api/_lib/ticket-gemini.ts');
  const recibido = { url: '', cuerpo: null };
  const crudo = await analizarTicket({
    image: 'base64-falsa',
    mimeType: 'image/jpeg',
    apiKey: 'llave',
    fetchImpl: async (url, init) => {
      recibido.url = url;
      recibido.cuerpo = JSON.parse(String(init?.body));
      return respuestaGemini(`\`\`\`json\n${JSON.stringify(TICKET_GEMINI)}\n\`\`\``);
    },
  });
  assert.equal(crudo.proveedor, 'Carnemart');
  assert.ok(recibido.url.includes('gemini-flash-lite-latest'), recibido.url);
  assert.ok(recibido.url.includes('key=llave'));
  const partes = recibido.cuerpo.contents[0].parts;
  assert.equal(partes[1].inlineData.data, 'base64-falsa');
  assert.equal(partes[1].inlineData.mimeType, 'image/jpeg');
  assert.ok(recibido.cuerpo.generationConfig.responseSchema);
});

await ta('GEMINI_MODEL sobreescribe el modelo por defecto', async () => {
  const { analizarTicket } = await import('../api/_lib/ticket-gemini.ts');
  let url = '';
  await analizarTicket({
    image: 'x',
    mimeType: 'image/jpeg',
    apiKey: 'llave',
    modelo: 'gemini-2.0-flash',
    fetchImpl: async (u) => {
      url = u;
      return respuestaGemini('{}');
    },
  });
  assert.ok(url.includes('gemini-2.0-flash'));
});

await ta('HTTP 500 de Gemini → null (y el flujo responde 502)', async () => {
  const { analizarTicket } = await import('../api/_lib/ticket-gemini.ts');
  const errorOriginal = console.error;
  console.error = () => {};
  try {
    const crudo = await analizarTicket({
      image: 'x',
      mimeType: 'image/jpeg',
      apiKey: 'llave',
      fetchImpl: async () => ({ ok: false, status: 500, json: async () => ({}), text: async () => 'boom' }),
    });
    assert.equal(crudo, null);
  } finally {
    console.error = errorOriginal;
  }
});

await ta('fetch que lanza (red caída) → null', async () => {
  const { analizarTicket } = await import('../api/_lib/ticket-gemini.ts');
  const errorOriginal = console.error;
  console.error = () => {};
  try {
    const crudo = await analizarTicket({
      image: 'x',
      mimeType: 'image/jpeg',
      apiKey: 'llave',
      fetchImpl: async () => {
        throw new Error('ECONNRESET');
      },
    });
    assert.equal(crudo, null);
  } finally {
    console.error = errorOriginal;
  }
});

await ta('sin GEMINI_API_KEY → null sin llamar a la red', async () => {
  const { analizarTicket } = await import('../api/_lib/ticket-gemini.ts');
  const errorOriginal = console.error;
  console.error = () => {};
  try {
    let llamo = false;
    const crudo = await analizarTicket({
      image: 'x',
      mimeType: 'image/jpeg',
      apiKey: '',
      fetchImpl: async () => {
        llamo = true;
        return respuestaGemini('{}');
      },
    });
    assert.equal(crudo, null);
    assert.equal(llamo, false);
  } finally {
    console.error = errorOriginal;
  }
});

console.log(`\n${pass} OK / ${fail} FALLAS`);
