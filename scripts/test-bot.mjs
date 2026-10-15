/**
 * Tests del bot de Telegram.
 *
 * Ejecutar:  npm run test:bot
 *
 * No necesitan red, ni Firestore, ni Vercel: la lógica pura se prueba directo y
 * el flujo completo (mensaje → resumen → confirmación → documentos) se prueba
 * con dependencias falsas inyectadas en `crearBot` / `crearHandler`.
 */
import assert from 'node:assert/strict';
import {
  CARGO_ENVIO,
  MENU_TEXTO,
  PRODUCTOS,
  buscarProducto,
  precioProducto,
} from '../api/_lib/menu.ts';
import { MENU_DATA } from '../src/lib/products.ts';
import {
  MARCA_SERVIDOR,
  conModalidad,
  construirDocumentoGasto,
  construirDocumentoPedido,
  construirTransaccionesPedido,
  datosCallback,
  detectarConPapas,
  detectarMetodoPago,
  detectarModalidad,
  extraerMonto,
  fechaLocal,
  formatearResumenDia,
  formatearResumenPedido,
  inicioDiaLocal,
  normalizarCategoriaGasto,
  normalizarOperacion,
  parsearCallback,
  rangoDiaLocal,
  sanitizarTexto,
} from '../api/_lib/pedido.ts';
import { esChatAutorizado, tecladoConfirmacion, verificarSecret } from '../api/_lib/telegram.ts';
import { GeminiError, construirPrompt, extraerJSON, interpretarMensaje } from '../api/_lib/gemini.ts';
import { crearBot } from '../api/_lib/bot.ts';
import { crearHandler, leerEnv } from '../api/telegram.ts';

let pass = 0;
let fail = 0;
const grupo = (titulo) => console.log(`\n── ${titulo} ──`);
const t = (nombre, fn) => {
  try {
    const resultado = fn();
    if (resultado instanceof Promise) throw new Error('usa "ta" para tests async');
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

const CHAT = '6002544825';
/** 2026-10-12 15:30 en México (UTC-6) */
const AHORA = Date.UTC(2026, 9, 12, 21, 30);

/* ═══════════════════════ 1. Menú y precios ═══════════════════════ */
grupo('1. Menú y precios');

t('el catálogo del bot tiene los 10 productos del menú', () => {
  assert.equal(PRODUCTOS.length, 10);
});

t('precios exactos del negocio', () => {
  assert.equal(precioProducto('Burger Sencilla'), 100);
  assert.equal(precioProducto('Burger Tocino'), 110);
  assert.equal(precioProducto('Burger Hawaiana'), 125);
  assert.equal(precioProducto('Burger Especial'), 150);
  assert.equal(precioProducto('Hot Dog Sencillo'), 40);
  assert.equal(precioProducto('Hot Dog Queso', true), 55);
  assert.equal(precioProducto('Hot Dog Tocino', true), 75);
  assert.equal(precioProducto('Hot Dog Hawaiano', true), 75);
  assert.equal(precioProducto('Hot Dog Combinado', true), 90);
  assert.equal(precioProducto('Papas'), 50);
  assert.equal(CARGO_ENVIO, 30);
});

t('los precios del bot coinciden con el dashboard (products.ts)', () => {
  for (const producto of PRODUCTOS) {
    const enDashboard = MENU_DATA.find((p) => p.nombre === producto.nombre);
    assert.ok(enDashboard, `falta ${producto.nombre} en MENU_DATA`);
    assert.equal(enDashboard.precio, producto.precio, `precio distinto en ${producto.nombre}`);
    assert.equal(
      enDashboard.precioConPapas ?? null,
      producto.precioConPapas ?? null,
      `precio con papas distinto en ${producto.nombre}`
    );
  }
});

t('los ids del dashboard existen para los 11 productos', () => {
  assert.equal(MENU_DATA.length, 11);
});

t('busca productos escritos de mil formas', () => {
  assert.equal(buscarProducto('Burguer Especial')?.nombre, 'Burger Especial');
  assert.equal(buscarProducto('hamburguesas especiales')?.nombre, 'Burger Especial');
  assert.equal(buscarProducto('Hot Dog de Tocino')?.nombre, 'Hot Dog Tocino');
  assert.equal(buscarProducto('hotdog tocino')?.nombre, 'Hot Dog Tocino');
  assert.equal(buscarProducto('2 hamburguesas hawaianas')?.nombre, 'Burger Hawaiana');
  assert.equal(buscarProducto('perro con queso')?.nombre, 'Hot Dog Queso');
  assert.equal(buscarProducto('orden de papas')?.nombre, 'Papas');
  assert.equal(buscarProducto('combinado')?.nombre, 'Hot Dog Combinado');
});

t('"tocino" sin familia no rompe (elige hamburguesa)', () => {
  assert.equal(buscarProducto('tocino')?.nombre, 'Burger Tocino');
});

t('un producto inexistente devuelve null', () => {
  assert.equal(buscarProducto('pizza pepperoni'), null);
  assert.equal(buscarProducto(''), null);
});

t('el menú que ve Gemini es el que pidió el negocio', () => {
  assert.ok(MENU_TEXTO.includes('HAMBURGUESAS: Sencilla $100 | Tocino $110 | Hawaiana $125 | Especial $150'));
  assert.ok(MENU_TEXTO.includes('HOT DOGS (sin/con papas): Sencillo $40/$50 | Queso $45/$55 | Tocino $65/$75 | Hawaiano $70/$75 | Combinado $80/$90'));
  assert.ok(MENU_TEXTO.includes('EXTRAS: Papas $50'));
  assert.ok(MENU_TEXTO.includes('ENVÍO: A domicilio $30'));
});

/* ═══════════════════════ 2. Modalidad, papas y pago ═══════════════════════ */
grupo('2. Reglas de modalidad / papas / pago');

t('palabras de domicilio → delivery', () => {
  for (const frase of [
    'a domicilio en Calle Hidalgo 123',
    'con envío por favor',
    'llévenlo a la casa',
    'a la colonia centro',
    'mandenlo a mi casa',
    'es delivery',
  ]) {
    assert.equal(detectarModalidad(frase), 'delivery', frase);
  }
});

t('palabras de recoger → pickup', () => {
  for (const frase of [
    'paso por él',
    'para llevar',
    'lo recojo en el local',
    'voy al local',
    'paso a recoger',
  ]) {
    assert.equal(detectarModalidad(frase), 'pickup', frase);
  }
});

t('sin mención de entrega → ambiguo (confianza baja)', () => {
  assert.equal(detectarModalidad('2 hamburguesas especiales'), 'ambiguo');
  assert.equal(detectarModalidad(''), 'ambiguo');
});

t('"con papas" y "sin papas"', () => {
  assert.equal(detectarConPapas('1 hot dog sencillo con papas'), true);
  assert.equal(detectarConPapas('1 hot dog sencillo sin papas'), false);
  assert.equal(detectarConPapas('1 hot dog sencillo'), false);
});

t('método de pago detectado del texto', () => {
  assert.equal(detectarMetodoPago('pago en efectivo'), 'Efectivo');
  assert.equal(detectarMetodoPago('te transfiero'), 'Transferencia');
  assert.equal(detectarMetodoPago('pago con cambio de 500'), 'Efectivo (Cambio)');
  assert.equal(detectarMetodoPago('lo de siempre', 'Transferencia'), 'Transferencia');
  assert.equal(detectarMetodoPago('lo de siempre'), 'Efectivo');
});

t('extrae montos de un gasto', () => {
  assert.equal(extraerMonto('gasté 450 en carne'), 450);
  assert.equal(extraerMonto('compré $1,250.50 de queso'), 1250.5);
  assert.equal(extraerMonto('pagué 380 pesos de gas'), 380);
  assert.equal(extraerMonto('sin números'), 0);
});

t('categoría del gasto detectada', () => {
  assert.equal(normalizarCategoriaGasto(null, 'compré carne y pan'), 'Carne & Pan');
  assert.equal(normalizarCategoriaGasto(null, 'pagué el gas del local'), 'Gas & Servicios Local');
  assert.equal(normalizarCategoriaGasto(null, 'compré vasos desechables'), 'Empaques & Desechables');
  assert.equal(normalizarCategoriaGasto(null, 'compré cosas'), 'Insumos');
  assert.equal(normalizarCategoriaGasto('Sueldos', 'pago a Juan'), 'Sueldos & Ayudantes');
});

/* ═══════════════════════ 3. Saneado y utilidades ═══════════════════════ */
grupo('3. Saneado y fechas');

t('sanitizarTexto recorta a 1000 caracteres', () => {
  const largo = 'a'.repeat(5000);
  assert.equal(sanitizarTexto(largo).length, 1000);
  assert.equal(sanitizarTexto('  hola  '), 'hola');
  assert.equal(sanitizarTexto(null), '');
  assert.equal(sanitizarTexto('con\u0000trol'), 'control');
});

t('inicioDiaLocal usa el día de México, no el del servidor', () => {
  // 2026-10-12 21:30 UTC = 15:30 en México → medianoche local = 06:00 UTC
  assert.equal(inicioDiaLocal(AHORA), Date.UTC(2026, 9, 12, 6));
  // 2026-10-13 02:00 UTC = 20:00 del 12 en México → sigue siendo el día 12
  assert.equal(inicioDiaLocal(Date.UTC(2026, 9, 13, 2)), Date.UTC(2026, 9, 12, 6));
  assert.equal(inicioDiaLocal(AHORA, -1), Date.UTC(2026, 9, 11, 6));
});

t('rangoDiaLocal cubre 24 h y fechaLocal etiqueta el día', () => {
  const [inicio, fin] = rangoDiaLocal(AHORA);
  assert.equal(fin - inicio, 86_400_000 - 1);
  assert.equal(fechaLocal(inicio), '12 Oct');
  assert.equal(fechaLocal(inicioDiaLocal(AHORA, -1)), '11 Oct');
});

/* ═══════════════════════ 4. Normalización de lo que responde Gemini ═══════════════════════ */
grupo('4. Normalización de la respuesta de Gemini');

const CRUDO_EJEMPLO = {
  tipo: 'pedido',
  productos: [
    { nombre: 'Burguer Especial', cantidad: 2, precioUnitario: 999 },
    { nombre: 'Hot Dog de Tocino', cantidad: 1 },
  ],
  modalidad: 'delivery',
  direccion: 'Calle Hidalgo 123',
  cliente: 'Cliente WhatsApp',
  metodoPago: 'Efectivo',
  subtotalProductos: 9999,
  cargoEnvio: 0,
  total: 1,
  confianza: 'alta',
};

t('recalcula precios y totales ignorando lo que dijo el modelo', () => {
  const operacion = normalizarOperacion(CRUDO_EJEMPLO, 'x a domicilio');
  assert.equal(operacion.tipo, 'pedido');
  assert.equal(operacion.productos[0].precioUnitario, 150);
  assert.equal(operacion.productos[0].importe, 300);
  assert.equal(operacion.productos[1].precioUnitario, 65);
  assert.equal(operacion.subtotalProductos, 365);
  assert.equal(operacion.cargoEnvio, 30);
  assert.equal(operacion.total, 395);
});

t('la modalidad la decide el texto, no el modelo', () => {
  const operacion = normalizarOperacion({ ...CRUDO_EJEMPLO, modalidad: 'pickup' }, 'a domicilio');
  assert.equal(operacion.modalidad, 'delivery');
  assert.equal(operacion.cargoEnvio, 30);
});

t('"con papas" aplica el precio con papas', () => {
  const operacion = normalizarOperacion(
    { tipo: 'pedido', productos: [{ nombre: 'Hot Dog Tocino', cantidad: 1 }] },
    '1 hot dog de tocino con papas para llevar'
  );
  assert.equal(operacion.productos[0].precioUnitario, 75);
  assert.equal(operacion.productos[0].conPapas, true);
  assert.equal(operacion.total, 75);
});

t('"sin papas" mantiene el precio base', () => {
  const operacion = normalizarOperacion(
    { tipo: 'pedido', productos: [{ nombre: 'Hot Dog Tocino', cantidad: 1 }] },
    '1 hot dog de tocino sin papas para llevar'
  );
  assert.equal(operacion.productos[0].precioUnitario, 65);
});

t('conPapas por producto manda sobre el texto', () => {
  const operacion = normalizarOperacion(
    { tipo: 'pedido', productos: [{ nombre: 'Hot Dog Sencillo', cantidad: 1, conPapas: true }] },
    'para llevar'
  );
  assert.equal(operacion.productos[0].precioUnitario, 50);
});

t('las hamburguesas no tienen variante con papas', () => {
  const operacion = normalizarOperacion(
    { tipo: 'pedido', productos: [{ nombre: 'Burger Especial', cantidad: 1, conPapas: true }] },
    'con papas a domicilio'
  );
  assert.equal(operacion.productos[0].precioUnitario, 150);
  assert.equal(operacion.productos[0].conPapas, false);
});

t('productos fuera del menú se marcan y bajan la confianza', () => {
  const operacion = normalizarOperacion(
    { tipo: 'pedido', productos: [{ nombre: 'Burger Especial', cantidad: 1 }, { nombre: 'Pizza', cantidad: 2 }] },
    'a domicilio'
  );
  assert.equal(operacion.productos.length, 1);
  assert.deepEqual(operacion.noReconocidos, ['2× Pizza']);
  assert.equal(operacion.confianza, 'baja');
});

t('cantidades absurdas se limitan (1..99)', () => {
  const operacion = normalizarOperacion(
    { tipo: 'pedido', productos: [{ nombre: 'Burger Sencilla', cantidad: 999 }, { nombre: 'Papas', cantidad: 0 }] },
    'para llevar'
  );
  assert.equal(operacion.productos[0].cantidad, 99);
  assert.equal(operacion.productos[1].cantidad, 1);
});

t('sin productos → confianza baja y nada que registrar', () => {
  const operacion = normalizarOperacion({ tipo: 'pedido', productos: [] }, 'hola');
  assert.equal(operacion.productos.length, 0);
  assert.equal(operacion.confianza, 'baja');
});

t('gasto con monto y categoría', () => {
  const operacion = normalizarOperacion({ tipo: 'gasto', monto: 450, descripcion: 'carne' }, 'gasté 450 en carne');
  assert.equal(operacion.tipo, 'gasto');
  assert.equal(operacion.monto, 450);
  assert.equal(operacion.categoria, 'Carne & Pan');
  assert.equal(operacion.metodoPago, 'Efectivo');
});

t('gasto sin monto del modelo lo saca del texto', () => {
  const operacion = normalizarOperacion({ tipo: 'gasto' }, 'gasté 380 en gas');
  assert.equal(operacion.monto, 380);
  assert.equal(operacion.confianza, 'alta');
});

t('conModalidad recalcula el total', () => {
  const base = normalizarOperacion(
    { tipo: 'pedido', productos: [{ nombre: 'Burger Especial', cantidad: 2 }] },
    'sin mención de entrega'
  );
  assert.equal(base.modalidad, 'ambiguo');
  assert.equal(base.total, 300);
  const entrega = conModalidad(base, 'delivery');
  assert.equal(entrega.total, 330);
  assert.equal(entrega.cargoEnvio, 30);
  assert.equal(conModalidad(base, 'pickup').total, 300);
});

/* ═══════════════════════ 5. Documentos de Firestore ═══════════════════════ */
grupo('5. Documentos de Firestore');

const PEDIDO_EJEMPLO = normalizarOperacion(
  CRUDO_EJEMPLO,
  'a domicilio en Calle Hidalgo 123 efectivo'
);

t('el documento de pedido trae todo lo que pide la spec', () => {
  const doc = construirDocumentoPedido(PEDIDO_EJEMPLO, 'AB12C');
  assert.equal(doc.origen, 'whatsapp');
  assert.equal(doc.estado, 'Pendiente');
  assert.deepEqual(doc.cliente, { nombre: 'Cliente WhatsApp', telefono: null, direccion: 'Calle Hidalgo 123' });
  assert.equal(doc.subtotal, 365);
  assert.equal(doc.cargoEnvio, 30);
  assert.equal(doc.total, 395);
  assert.equal(doc.modalidad, 'delivery');
  assert.equal(doc.metodo_pago, 'Efectivo');
  assert.equal(doc.requiereReparto, true);
  assert.equal(doc.folio, 'AB12C');
  assert.equal(doc.fecha, MARCA_SERVIDOR);
  assert.equal(doc.createdAt, MARCA_SERVIDOR);
  assert.equal(doc.productos.length, 2);
});

t('delivery → 2 transacciones (productos + envío)', () => {
  const movimientos = construirTransaccionesPedido(PEDIDO_EJEMPLO, 'AB12C', 'pedido-1');
  assert.equal(movimientos.length, 2);
  assert.equal(movimientos[0].tipo, 'ingreso');
  assert.equal(movimientos[0].negocio, 'hamburguesas');
  assert.equal(movimientos[0].categoria, 'Ventas Delivery');
  assert.equal(movimientos[0].monto, 365);
  assert.equal(movimientos[0].descripcion, 'Pedido WhatsApp #AB12C');
  assert.equal(movimientos[0].pedidoId, 'pedido-1');
  assert.equal(movimientos[1].categoria, 'Envíos');
  assert.equal(movimientos[1].monto, 30);
  assert.equal(movimientos[1].descripcion, 'Envío pedido #AB12C');
});

t('pickup → 1 sola transacción, categoría mostrador y sin reparto', () => {
  const pedido = conModalidad(PEDIDO_EJEMPLO, 'pickup');
  assert.equal(construirTransaccionesPedido(pedido, 'ZZ999', 'pedido-2').length, 1);
  const doc = construirDocumentoPedido(pedido, 'ZZ999');
  assert.equal(doc.requiereReparto, false);
  assert.equal(doc.cargoEnvio, 0);
  assert.equal(construirTransaccionesPedido(pedido, 'ZZ999', 'pedido-2')[0].categoria, 'Ventas Mostrador');
});

t('documento de gasto', () => {
  const gasto = normalizarOperacion({ tipo: 'gasto', monto: 450, descripcion: 'carne' }, 'gasté 450 en carne');
  const doc = construirDocumentoGasto(gasto);
  assert.equal(doc.tipo, 'gasto');
  assert.equal(doc.negocio, 'hamburguesas');
  assert.equal(doc.categoria, 'Carne & Pan');
  assert.equal(doc.monto, 450);
  assert.equal(doc.metodo_pago, 'Efectivo');
  assert.equal(doc.fecha, MARCA_SERVIDOR);
});

t('callbacks: ida y vuelta y datos inválidos', () => {
  const data = datosCallback('cf', CHAT, '1750000000000');
  assert.equal(data, `cf:${CHAT}:1750000000000`);
  const parseado = parsearCallback(data);
  assert.deepEqual(parseado, { accion: 'cf', partes: [CHAT, '1750000000000'] });
  assert.equal(parsearCallback('basura'), null);
  assert.equal(parsearCallback(undefined), null);
  assert.ok(datosCallback('cf', CHAT, '1750000000000').length <= 64);
});

t('el resumen usa el formato que pidió el negocio', () => {
  const texto = formatearResumenPedido(PEDIDO_EJEMPLO);
  assert.ok(texto.includes('📋 Pedido detectado:'), texto);
  assert.ok(texto.includes('• 2× Burger Especial ($150 c/u) → $300'), texto);
  assert.ok(texto.includes('• 1× Hot Dog Tocino → $65'), texto);
  assert.ok(texto.includes('Subtotal: $365'), texto);
  assert.ok(texto.includes('🛵 Envío: $30'), texto);
  assert.ok(texto.includes('💵 TOTAL: $395'), texto);
  assert.ok(texto.includes('📍 Dirección: Calle Hidalgo 123'), texto);
  assert.ok(texto.includes('💳 Pago: Efectivo'), texto);
});

t('resumen del día', () => {
  const texto = formatearResumenDia({ pedidos: 3, ventasProductos: 1250, envios: 60, total: 1310 }, 'Hoy (12 Oct)');
  assert.ok(texto.includes('📅 Hoy (12 Oct)'));
  assert.ok(texto.includes('🧾 Pedidos: 3'));
  assert.ok(texto.includes('🍔 Ventas de productos: $1,250'));
  assert.ok(texto.includes('🛵 Envíos cobrados: $60'));
  assert.ok(texto.includes('💵 Total ingresos: $1,310'));
});

/* ═══════════════════════ 6. Seguridad del webhook ═══════════════════════ */
grupo('6. Seguridad');

t('verificarSecret compara el header correcto', () => {
  assert.equal(verificarSecret({ 'x-telegram-bot-api-secret-token': 'abc123' }, 'abc123'), true);
  assert.equal(verificarSecret({ 'X-Telegram-Bot-Api-Secret-Token': ['abc123'] }, 'abc123'), true);
  assert.equal(verificarSecret({ 'x-telegram-bot-api-secret-token': 'otro' }, 'abc123'), false);
  assert.equal(verificarSecret({}, 'abc123'), false);
  assert.equal(verificarSecret({ 'x-telegram-bot-api-secret-token': 'abc123' }, ''), false);
});

t('sólo el chat autorizado', () => {
  assert.equal(esChatAutorizado(CHAT, CHAT), true);
  assert.equal(esChatAutorizado(Number(CHAT), CHAT), true);
  assert.equal(esChatAutorizado('123', CHAT), false);
  assert.equal(esChatAutorizado(undefined, CHAT), false);
});

t('el teclado de confirmación trae las 3 acciones', () => {
  const teclado = tecladoConfirmacion(CHAT, '123');
  const botones = teclado.inline_keyboard[0].map((b) => b.text);
  assert.deepEqual(botones, ['✅ Confirmar', '✏️ Editar', '❌ Cancelar']);
});

/* ═══════════════════════ 7. Gemini ═══════════════════════ */
grupo('7. Gemini');

t('extrae JSON aunque venga con fences o texto extra', () => {
  assert.deepEqual(extraerJSON('{"a":1}'), { a: 1 });
  assert.deepEqual(extraerJSON('```json\n{"a":1}\n```'), { a: 1 });
  assert.deepEqual(extraerJSON('Claro:\n{"tipo":"pedido"}\nEso es todo'), { tipo: 'pedido' });
  assert.equal(extraerJSON('sin json'), null);
  assert.equal(extraerJSON(''), null);
  assert.equal(extraerJSON('{roto'), null);
});

t('extraerJSON respeta llaves dentro de strings', () => {
  assert.deepEqual(extraerJSON('{"nota":"} no cierra","x":2}'), { nota: '} no cierra', x: 2 });
});

t('el prompt incluye el menú y el mensaje', () => {
  const prompt = construirPrompt('2 especiales');
  assert.ok(prompt.includes('2 especiales'));
  assert.ok(construirPrompt('x').includes('MENSAJE DEL CLIENTE'));
});

await ta('interpretarMensaje manda el esquema y devuelve el JSON', async () => {
  let capturado = null;
  const fetchFalso = async (url, init) => {
    capturado = { url, init };
    return {
      ok: true,
      status: 200,
      json: async () => ({ candidates: [{ content: { parts: [{ text: '{"tipo":"pedido"}' }] } }] }),
      text: async () => '',
    };
  };
  const resultado = await interpretarMensaje({ texto: 'hola', apiKey: 'k', fetchImpl: fetchFalso });
  assert.deepEqual(resultado, { tipo: 'pedido' });
  assert.ok(capturado.url.includes('gemini-2.0-flash:generateContent'));
  assert.ok(capturado.url.includes('key=k'));
  const cuerpo = JSON.parse(capturado.init.body);
  assert.equal(cuerpo.generationConfig.responseMimeType, 'application/json');
  assert.ok(cuerpo.generationConfig.responseSchema);
  assert.ok(cuerpo.systemInstruction.parts[0].text.includes('HAMBURGUESAS: Sencilla $100'));
});

await ta('interpretarMensaje lanza GeminiError en HTTP y NO reintenta', async () => {
  let llamadas = 0;
  const fetchFalso = async () => {
    llamadas += 1;
    return { ok: false, status: 429, json: async () => ({}), text: async () => 'cuota' };
  };
  await assert.rejects(
    () => interpretarMensaje({ texto: 'hola', apiKey: 'k', fetchImpl: fetchFalso }),
    (error) => error instanceof GeminiError && error.status === 429 && error.code === 'http_429'
  );
  assert.equal(llamadas, 1, '429 no debe reintentarse');
  assert.equal(await interpretarMensaje({ texto: 'hola', apiKey: '', fetchImpl: fetchFalso }), null);
});

/* ═══════════════════════ 8. Flujo completo con dependencias falsas ═══════════════════════ */
grupo('8. Flujo completo (mensaje → resumen → confirmar → Firestore)');

function crearEntorno({ respuestaGemini = CRUDO_EJEMPLO, fallaGuardado = false } = {}) {
  const estado = {
    enviados: [],
    editados: [],
    callbacks: [],
    pedidos: [],
    gastos: [],
    borradores: new Map(),
    estados: [],
    pendientes: [],
    resumen: { pedidos: 2, ventasProductos: 800, envios: 30, total: 830 },
    rangos: [],
  };

  const almacen = {
    async guardarPedido(pedido, transacciones) {
      if (fallaGuardado) throw new Error('firestore caído');
      const id = 'pedido-1';
      estado.pedidos.push({ id, pedido, transacciones: transacciones(id) });
      return id;
    },
    async guardarGasto(gasto) {
      if (fallaGuardado) throw new Error('firestore caído');
      estado.gastos.push(gasto);
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
    async pedidosPendientes(limite) {
      return estado.pendientes.slice(0, limite);
    },
    async actualizarEstadoPedido(id, nuevo) {
      estado.estados.push({ id, estado: nuevo });
    },
    async resumenDia(inicio, fin) {
      estado.rangos.push({ inicio, fin });
      return estado.resumen;
    },
  };

  const telegram = {
    async enviar(chatId, texto, opciones) {
      const id = 500 + estado.enviados.length;
      estado.enviados.push({ chatId, texto, opciones, messageId: id });
      return id;
    },
    async editar(chatId, messageId, texto, opciones) {
      estado.editados.push({ chatId, messageId, texto, opciones });
    },
    async confirmarCallback(id, texto) {
      estado.callbacks.push({ id, texto });
    },
  };

  const bot = crearBot({
    almacen,
    telegram,
    chatAutorizado: CHAT,
    interpretar: async (texto) =>
      typeof respuestaGemini === 'function' ? respuestaGemini(texto) : respuestaGemini,
    ahora: () => AHORA,
    generarFolio: () => 'AB12C',
  });

  return { estado, bot };
}

const selloDe = (estado, indice = 0) => {
  const teclado = estado.enviados[indice]?.opciones?.reply_markup;
  return teclado?.inline_keyboard?.[0]?.[0]?.callback_data ?? '';
};

await ta('mensaje claro: muestra resumen y botones, sin escribir todavía', async () => {
  const { estado, bot } = crearEntorno();
  await bot.manejarUpdate({
    update_id: 1,
    message: { message_id: 10, text: '2 hamburguesas especiales y 1 hot dog de tocino a domicilio en Calle Hidalgo 123 efectivo', chat: { id: CHAT } },
  });
  assert.equal(estado.pedidos.length, 0, 'no debe escribir hasta confirmar');
  assert.equal(estado.gastos.length, 0);
  const enviado = estado.enviados[0];
  assert.ok(enviado.texto.includes('📋 Pedido detectado:'), enviado.texto);
  assert.ok(enviado.texto.includes('💵 TOTAL: $395'), enviado.texto);
  assert.ok(enviado.texto.includes('📍 Dirección: Calle Hidalgo 123'), enviado.texto);
  assert.equal(enviado.opciones.reply_markup.inline_keyboard[0].length, 3);
  assert.ok(estado.borradores.has(CHAT), 'debe guardar el borrador');
  assert.equal(estado.borradores.get(CHAT).messageId, enviado.messageId);
});

await ta('confirmar guarda el pedido + 2 transacciones y responde', async () => {
  const { estado, bot } = crearEntorno();
  await bot.manejarUpdate({ update_id: 1, message: { message_id: 10, text: '2 hamburguesas especiales y 1 hot dog de tocino a domicilio en Calle Hidalgo 123 efectivo', chat: { id: CHAT } } });
  const data = selloDe(estado);
  await bot.manejarUpdate({
    update_id: 2,
    callback_query: { id: 'cb1', data, message: { message_id: estado.enviados[0].messageId, chat: { id: CHAT } } },
  });

  assert.equal(estado.callbacks.length, 1, 'siempre responde el callback');
  assert.equal(estado.pedidos.length, 1);
  const { pedido, transacciones } = estado.pedidos[0];
  assert.equal(pedido.estado, 'Pendiente');
  assert.equal(pedido.total, 395);
  assert.equal(pedido.requiereReparto, true);
  assert.equal(transacciones.length, 2);
  assert.equal(transacciones[0].pedidoId, 'pedido-1');
  assert.equal(transacciones[1].categoria, 'Envíos');
  assert.equal(estado.borradores.size, 0, 'el borrador se limpia');

  const editado = estado.editados.at(-1);
  assert.ok(editado.texto.includes('✅ Pedido #AB12C registrado por $395'), editado.texto);
  assert.ok(editado.texto.includes('incluye $30 de envío'), editado.texto);
  assert.ok(editado.texto.includes('dashboard'), editado.texto);
});

await ta('modalidad ambigua: pregunta antes de registrar', async () => {
  const { estado, bot } = crearEntorno({
    respuestaGemini: {
      tipo: 'pedido',
      productos: [{ nombre: 'Burger Especial', cantidad: 2 }],
      modalidad: 'ambiguo',
      direccion: null,
      cliente: 'Cliente WhatsApp',
      metodoPago: 'Efectivo',
      confianza: 'baja',
    },
  });
  await bot.manejarUpdate({ update_id: 3, message: { message_id: 11, text: '2 hamburguesas especiales', chat: { id: CHAT } } });

  const enviado = estado.enviados[0];
  assert.ok(enviado.texto.includes('No me quedó claro'), enviado.texto);
  assert.ok(enviado.texto.includes('❓ Falta definir la entrega'), enviado.texto);
  const botones = enviado.opciones.reply_markup.inline_keyboard;
  assert.equal(botones[0][0].text, '🛵 A domicilio +$30');
  assert.equal(botones[0][1].text, '🥡 Para recoger');
  assert.equal(estado.borradores.get(CHAT).estado, 'esperando_modalidad');
  assert.equal(estado.pedidos.length, 0);
});

await ta('elegir "a domicilio" en el botón actualiza el total con el envío', async () => {
  const { estado, bot } = crearEntorno({
    respuestaGemini: {
      tipo: 'pedido',
      productos: [{ nombre: 'Burger Especial', cantidad: 2 }],
      modalidad: 'ambiguo',
      confianza: 'baja',
    },
  });
  await bot.manejarUpdate({ update_id: 3, message: { message_id: 11, text: '2 hamburguesas especiales', chat: { id: CHAT } } });
  const dataDelivery = estado.enviados[0].opciones.reply_markup.inline_keyboard[0][0].callback_data;

  await bot.manejarUpdate({
    update_id: 4,
    callback_query: { id: 'cb2', data: dataDelivery, message: { message_id: estado.enviados[0].messageId, chat: { id: CHAT } } },
  });

  const editado = estado.editados.at(-1);
  assert.ok(editado.texto.includes('🛵 Envío: $30'), editado.texto);
  assert.ok(editado.texto.includes('💵 TOTAL: $330'), editado.texto);
  assert.equal(estado.borradores.get(CHAT).estado, 'pendiente_confirmacion');
  assert.equal(estado.borradores.get(CHAT).operacion.total, 330);
});

await ta('"editar" pide el pedido corregido y el siguiente mensaje lo reemplaza', async () => {
  // Gemini respondería distinto según el texto: simulamos ese comportamiento.
  const { estado, bot } = crearEntorno({
    respuestaGemini: (texto) =>
      texto.includes('sencilla')
        ? { tipo: 'pedido', productos: [{ nombre: 'Burger Sencilla', cantidad: 1 }], modalidad: 'delivery', direccion: 'Calle Hidalgo 123', metodoPago: 'Efectivo' }
        : CRUDO_EJEMPLO,
  });
  await bot.manejarUpdate({ update_id: 5, message: { message_id: 12, text: '2 especiales a domicilio en Calle Hidalgo 123', chat: { id: CHAT } } });
  const dataEditar = estado.enviados[0].opciones.reply_markup.inline_keyboard[0][1].callback_data;
  await bot.manejarUpdate({
    update_id: 6,
    callback_query: { id: 'cb3', data: dataEditar, message: { message_id: estado.enviados[0].messageId, chat: { id: CHAT } } },
  });
  assert.equal(estado.borradores.get(CHAT).estado, 'esperando_correccion');
  assert.ok(estado.editados.at(-1).texto.includes('Manda el pedido corregido'));

  await bot.manejarUpdate({ update_id: 7, message: { message_id: 13, text: '1 hamburguesa sencilla a domicilio en Calle Hidalgo 123', chat: { id: CHAT } } });
  assert.equal(estado.enviados.length, 2);
  assert.ok(estado.enviados[1].texto.includes('1× Burger Sencilla'), estado.enviados[1].texto);
  assert.equal(estado.borradores.get(CHAT).estado, 'pendiente_confirmacion');
});

await ta('cancelar borra el borrador y los botones viejos ya no sirven', async () => {
  const { estado, bot } = crearEntorno();
  await bot.manejarUpdate({ update_id: 8, message: { message_id: 14, text: '2 especiales a domicilio en Calle Hidalgo 123', chat: { id: CHAT } } });
  const dataConfirmar = selloDe(estado);
  const dataCancelar = estado.enviados[0].opciones.reply_markup.inline_keyboard[0][2].callback_data;

  await bot.manejarUpdate({
    update_id: 9,
    callback_query: { id: 'cb4', data: dataCancelar, message: { message_id: estado.enviados[0].messageId, chat: { id: CHAT } } },
  });
  assert.equal(estado.borradores.size, 0);
  assert.ok(estado.editados.at(-1).texto.includes('cancelada'));

  await bot.manejarUpdate({
    update_id: 10,
    callback_query: { id: 'cb5', data: dataConfirmar, message: { message_id: estado.enviados[0].messageId, chat: { id: CHAT } } },
  });
  assert.equal(estado.pedidos.length, 0, 'un botón viejo no debe registrar nada');
  assert.ok(estado.enviados.at(-1).texto.includes('ya expiró'), estado.enviados.at(-1).texto);
});

await ta('gasto: se guarda directo y confirma', async () => {
  const { estado, bot } = crearEntorno({
    respuestaGemini: { tipo: 'gasto', monto: 450, descripcion: 'carne', categoria: 'Insumos' },
  });
  await bot.manejarUpdate({ update_id: 11, message: { message_id: 15, text: 'gasté 450 en carne', chat: { id: CHAT } } });

  assert.equal(estado.pedidos.length, 0);
  assert.equal(estado.gastos.length, 1);
  assert.equal(estado.gastos[0].tipo, 'gasto');
  assert.equal(estado.gastos[0].monto, 450);
  // La categoría se afina con el texto: "carne" → la categoría real del dashboard
  assert.equal(estado.gastos[0].categoria, 'Carne & Pan');
  assert.ok(estado.enviados.at(-1).texto.includes('✅ Gasto registrado por $450'), estado.enviados.at(-1).texto);
});

await ta('un gasto sin pistas queda en la categoría "Insumos"', async () => {
  const { estado, bot } = crearEntorno({
    respuestaGemini: { tipo: 'gasto', monto: 200, descripcion: 'cosas varias', categoria: 'Insumos' },
  });
  await bot.manejarUpdate({ update_id: 111, message: { message_id: 55, text: 'gasté 200 en cosas varias', chat: { id: CHAT } } });
  assert.equal(estado.gastos[0].categoria, 'Insumos');
});

await ta('un chat no autorizado se ignora por completo', async () => {
  const { estado, bot } = crearEntorno();
  await bot.manejarUpdate({ update_id: 12, message: { message_id: 16, text: '2 especiales a domicilio', chat: { id: '999999' } } });
  assert.equal(estado.enviados.length, 0);
  assert.equal(estado.pedidos.length, 0);
  assert.equal(estado.borradores.size, 0);
});

await ta('Gemini ilegible → mensaje de ayuda', async () => {
  const { estado, bot } = crearEntorno({ respuestaGemini: null });
  await bot.manejarUpdate({ update_id: 13, message: { message_id: 17, text: 'asdkjhasd', chat: { id: CHAT } } });
  assert.ok(estado.enviados[0].texto.includes('No pude entender el mensaje'), estado.enviados[0].texto);
});

/** fetch falso que siempre responde con el mismo status (mock de Gemini caído). */
function fetchConStatus(status, cuerpo = '{}') {
  const contador = { llamadas: 0 };
  const impl = async () => {
    contador.llamadas += 1;
    return { ok: false, status, json: async () => ({}), text: async () => cuerpo };
  };
  return { impl, contador };
}

await ta('Gemini 503 → NO reintenta y avisa que está saturado', async () => {
  const { impl, contador } = fetchConStatus(
    503,
    JSON.stringify({ error: { status: 'UNAVAILABLE', message: 'overloaded' } })
  );
  const { estado, bot } = crearEntorno({
    respuestaGemini: (texto) => interpretarMensaje({ texto, apiKey: 'k', fetchImpl: impl }),
  });
  await bot.manejarUpdate({ update_id: 30, message: { message_id: 30, text: '2 especiales', chat: { id: CHAT } } });

  assert.equal(contador.llamadas, 1, 'no debe reintentar en 503');
  assert.equal(estado.enviados.length, 1);
  assert.equal(estado.enviados[0].texto, '🔄 Gemini está saturado. Intenta en 1 minuto.');
  assert.equal(estado.borradores.size, 0, 'no debe dejar borrador');
});

await ta('Gemini 429 → NO reintenta y avisa del límite por hoy', async () => {
  const { impl, contador } = fetchConStatus(
    429,
    JSON.stringify({ error: { status: 'RESOURCE_EXHAUSTED', message: 'quota' } })
  );
  const { estado, bot } = crearEntorno({
    respuestaGemini: (texto) => interpretarMensaje({ texto, apiKey: 'k', fetchImpl: impl }),
  });
  await bot.manejarUpdate({ update_id: 31, message: { message_id: 31, text: '2 especiales', chat: { id: CHAT } } });

  assert.equal(contador.llamadas, 1, 'no debe reintentar en 429');
  assert.equal(
    estado.enviados[0].texto,
    '⏱️ Gemini alcanzó su límite por hoy. Intenta mañana o usa la web.'
  );
});

await ta('timeout de Gemini → SÍ reintenta 1 vez y lanza GeminiError', async () => {
  let llamadas = 0;
  const fetchLento = (_url, init) =>
    new Promise((_resolver, rechazar) => {
      llamadas += 1;
      init.signal.addEventListener('abort', () => {
        const error = new Error('The operation was aborted');
        error.name = 'AbortError';
        rechazar(error);
      });
    });

  await assert.rejects(
    () => interpretarMensaje({ texto: 'hola', apiKey: 'k', fetchImpl: fetchLento, timeoutMs: 20 }),
    (error) => error instanceof GeminiError && error.status === 0 && error.code === 'timeout'
  );
  assert.equal(llamadas, 2, 'un intento + un reintento por timeout');
});

await ta('si Firestore falla al confirmar → error controlado', async () => {
  const { estado, bot } = crearEntorno({ fallaGuardado: true });
  await bot.manejarUpdate({ update_id: 14, message: { message_id: 18, text: '2 especiales a domicilio en Calle Hidalgo 123', chat: { id: CHAT } } });
  await bot.manejarUpdate({
    update_id: 15,
    callback_query: { id: 'cb6', data: selloDe(estado), message: { message_id: estado.enviados[0].messageId, chat: { id: CHAT } } },
  });
  assert.ok(estado.enviados.at(-1).texto.includes('Error al guardar'), estado.enviados.at(-1).texto);
});

await ta('comandos: /start, /cancelar, /hoy, /ayer, /pendientes', async () => {
  const { estado, bot } = crearEntorno();
  await bot.manejarUpdate({ update_id: 20, message: { message_id: 20, text: '/start', chat: { id: CHAT } } });
  assert.ok(estado.enviados[0].texto.includes('Soy el bot de pedidos'), estado.enviados[0].texto);

  await bot.manejarUpdate({ update_id: 21, message: { message_id: 21, text: '/cancelar', chat: { id: CHAT } } });
  assert.ok(estado.enviados.at(-1).texto.includes('No hay ninguna operación en curso'));

  await bot.manejarUpdate({ update_id: 22, message: { message_id: 22, text: '/hoy', chat: { id: CHAT } } });
  const rangoHoy = estado.rangos.at(-1);
  assert.equal(rangoHoy.inicio, Date.UTC(2026, 9, 12, 6), 'medianoche de México');
  assert.ok(estado.enviados.at(-1).texto.includes('📅 Hoy (12 Oct)'), estado.enviados.at(-1).texto);
  assert.ok(estado.enviados.at(-1).texto.includes('🧾 Pedidos: 2'));
  assert.ok(estado.enviados.at(-1).texto.includes('💵 Total ingresos: $830'));

  await bot.manejarUpdate({ update_id: 23, message: { message_id: 23, text: '/ayer', chat: { id: CHAT } } });
  assert.equal(estado.rangos.at(-1).inicio, Date.UTC(2026, 9, 11, 6));
  assert.ok(estado.enviados.at(-1).texto.includes('📅 Ayer (11 Oct)'), estado.enviados.at(-1).texto);

  estado.pendientes = [
    { id: 'p1', folio: 'AB12C', cliente: 'Cliente WhatsApp', direccion: 'Calle Hidalgo 123', total: 395, estado: 'Pendiente', fechaMs: AHORA - 30 * 60_000, modalidad: 'delivery' },
  ];
  await bot.manejarUpdate({ update_id: 24, message: { message_id: 24, text: '/pendientes', chat: { id: CHAT } } });
  const pendientes = estado.enviados.at(-1);
  assert.ok(pendientes.texto.includes('#AB12C'), pendientes.texto);
  assert.ok(pendientes.texto.includes('hace 30 min'), pendientes.texto);
  assert.equal(pendientes.opciones.reply_markup.inline_keyboard[0][0].text, '✅ #AB12C Entregado');
});

await ta('marcar entregado actualiza el pedido y refresca la lista', async () => {
  const { estado, bot } = crearEntorno();
  estado.pendientes = [
    { id: 'p1', folio: 'AB12C', cliente: 'Cliente WhatsApp', direccion: 'Calle Hidalgo 123', total: 395, estado: 'Pendiente', fechaMs: AHORA - 60_000, modalidad: 'delivery' },
  ];
  await bot.manejarUpdate({ update_id: 25, message: { message_id: 25, text: '/pendientes', chat: { id: CHAT } } });
  const data = estado.enviados.at(-1).opciones.reply_markup.inline_keyboard[0][0].callback_data;

  estado.pendientes = [];
  await bot.manejarUpdate({
    update_id: 26,
    callback_query: { id: 'cb7', data, message: { message_id: estado.enviados.at(-1).messageId, chat: { id: CHAT } } },
  });
  assert.deepEqual(estado.estados, [{ id: 'p1', estado: 'Entregado' }]);
  assert.ok(estado.editados.at(-1).texto.includes('No tienes pedidos pendientes'));
});

/* ═══════════════════════ 9. Handler HTTP del webhook ═══════════════════════ */
grupo('9. Handler del webhook (Vercel)');

function respuestaFalsa() {
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
}

const cabecerasSecret = (secret) => ({ 'x-telegram-bot-api-secret-token': secret });

await ta('sin header secreto → 401', async () => {
  const { res, registro } = respuestaFalsa();
  const handler = crearHandler({ secret: 's3cr3t0', chatAutorizado: CHAT, bot: { manejarUpdate: async () => {} } });
  await handler({ method: 'POST', headers: {}, body: {} }, res);
  assert.equal(registro.codigo, 401);
});

await ta('secreto incorrecto → 401', async () => {
  const { res, registro } = respuestaFalsa();
  const handler = crearHandler({ secret: 's3cr3t0', chatAutorizado: CHAT, bot: { manejarUpdate: async () => {} } });
  await handler({ method: 'POST', headers: cabecerasSecret('otro'), body: {} }, res);
  assert.equal(registro.codigo, 401);
});

await ta('GET → 405', async () => {
  const { res, registro } = respuestaFalsa();
  const handler = crearHandler({ secret: 's3cr3t0', chatAutorizado: CHAT, bot: { manejarUpdate: async () => {} } });
  await handler({ method: 'GET', headers: cabecerasSecret('s3cr3t0') }, res);
  assert.equal(registro.codigo, 405);
});

await ta('update válido → 200 y el bot procesa', async () => {
  const { res, registro } = respuestaFalsa();
  let procesado = null;
  const handler = crearHandler({
    secret: 's3cr3t0',
    chatAutorizado: CHAT,
    bot: { manejarUpdate: async (u) => { procesado = u; } },
  });
  await handler(
    { method: 'POST', headers: cabecerasSecret('s3cr3t0'), body: JSON.stringify({ update_id: 99, message: { text: 'hola', chat: { id: Number(CHAT) } } }) },
    res
  );
  assert.equal(registro.codigo, 200);
  assert.equal(registro.cuerpo.ok, true);
  assert.equal(procesado.update_id, 99);
});

await ta('update repetido (Telegram reintenta) se ignora', async () => {
  const { res, registro } = respuestaFalsa();
  const procesados = [];
  const yaVistos = new Set();
  const handler = crearHandler({
    secret: 's3cr3t0',
    chatAutorizado: CHAT,
    bot: { manejarUpdate: async (u) => { procesados.push(u.update_id); } },
    marcarUpdateProcesado: async (id) => {
      if (yaVistos.has(id)) return false;
      yaVistos.add(id);
      return true;
    },
  });
  const peticion = { method: 'POST', headers: cabecerasSecret('s3cr3t0'), body: { update_id: 100, message: { text: 'x', chat: { id: CHAT } } } };
  await handler(peticion, res);
  const { res: res2, registro: registro2 } = respuestaFalsa();
  await handler(peticion, res2);
  assert.deepEqual(procesados, [100]);
  assert.equal(registro2.cuerpo.duplicado, true);
});

await ta('chat ajeno → 200 ignorado, sin tocar el bot', async () => {
  const { res, registro } = respuestaFalsa();
  let llamado = false;
  const handler = crearHandler({
    secret: 's3cr3t0',
    chatAutorizado: CHAT,
    bot: { manejarUpdate: async () => { llamado = true; } },
  });
  await handler(
    { method: 'POST', headers: cabecerasSecret('s3cr3t0'), body: { update_id: 101, message: { text: 'x', chat: { id: 123456 } } } },
    res
  );
  assert.equal(registro.codigo, 200);
  assert.equal(registro.cuerpo.ignorado, true);
  assert.equal(llamado, false);
});

await ta('error inesperado → 200 (para que Telegram no reintente) y se registra', async () => {
  const { res, registro } = respuestaFalsa();
  const errores = [];
  const handler = crearHandler({
    secret: 's3cr3t0',
    chatAutorizado: CHAT,
    bot: { manejarUpdate: async () => { throw new Error('boom'); } },
    onError: (err) => errores.push(err),
  });
  await handler(
    { method: 'POST', headers: cabecerasSecret('s3cr3t0'), body: { update_id: 102, message: { text: 'x', chat: { id: CHAT } } } },
    res
  );
  assert.equal(registro.codigo, 200);
  assert.equal(registro.cuerpo.ok, false);
  assert.equal(errores.length, 1);
});

t('leerEnv detecta lo que falta y arma la config completa', () => {
  const incompleto = leerEnv({ TELEGRAM_BOT_TOKEN: 'x' });
  assert.equal(incompleto.ok, false);
  assert.deepEqual(incompleto.faltantes, [
    'TELEGRAM_CHAT_ID',
    'TELEGRAM_WEBHOOK_SECRET',
    'GEMINI_API_KEY',
    'FIREBASE_SERVICE_ACCOUNT_JSON',
  ]);

  const completo = leerEnv({
    TELEGRAM_BOT_TOKEN: 'token',
    TELEGRAM_CHAT_ID: CHAT,
    TELEGRAM_WEBHOOK_SECRET: 'secreto',
    GEMINI_API_KEY: 'gemini',
    FIREBASE_SERVICE_ACCOUNT_JSON: '{"project_id":"x"}',
  });
  assert.equal(completo.ok, true);
  assert.equal(completo.config.telegramChatId, CHAT);
  assert.equal(completo.config.geminiModelo, undefined);
});

console.log(`\n${pass} OK / ${fail} FALLAS`);
