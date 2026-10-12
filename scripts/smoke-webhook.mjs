/**
 * Smoke test del webhook sobre HTTP: levanta `crearHandler` en un servidor
 * local y le manda updates de Telegram simulados, igual que haría Vercel.
 *
 *   npm run bot:smoke
 *
 * Usa dependencias falsas (no toca Firestore, Gemini ni Telegram), así que
 * sirve para verificar el camino completo sin credenciales:
 *   401 sin secret → resumen con botones → confirmar → documentos escritos.
 */
import { createServer } from 'node:http';
import assert from 'node:assert/strict';
import { crearHandler } from '../api/telegram.ts';
import { crearBot } from '../api/_lib/bot.ts';

const CHAT = '6002544825';
const SECRET = 'secreto-de-prueba';
const PUERTO = Number(process.env.SMOKE_PORT ?? 4599);

const registro = { enviados: [], pedidos: [], transacciones: [], borradores: new Map() };

const almacen = {
  async guardarPedido(pedido, transacciones) {
    const id = 'pedido-http-1';
    registro.pedidos.push(pedido);
    registro.transacciones.push(...transacciones(id));
    return id;
  },
  async guardarGasto(gasto) {
    registro.pedidos.push({ tipo: 'gasto', ...gasto });
    return 'gasto-1';
  },
  async guardarBorrador(chatId, borrador) {
    registro.borradores.set(chatId, borrador);
  },
  async leerBorrador(chatId) {
    return registro.borradores.get(chatId) ?? null;
  },
  async borrarBorrador(chatId) {
    registro.borradores.delete(chatId);
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
    registro.enviados.push({ chatId, texto, opciones });
    return 700 + registro.enviados.length;
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
    confianza: 'alta',
  }),
  generarFolio: () => 'HTTP1',
});

const handler = crearHandler({ secret: SECRET, chatAutorizado: CHAT, bot });

const servidor = createServer((req, res) => {
  const trozos = [];
  req.on('data', (trozo) => trozos.push(trozo));
  req.on('end', async () => {
    const respuesta = {
      status(codigo) {
        res.statusCode = codigo;
        return respuesta;
      },
      json(cuerpo) {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(cuerpo));
      },
    };
    await handler(
      { method: req.method, headers: req.headers, body: Buffer.concat(trozos).toString('utf8') },
      respuesta
    );
  });
});

await new Promise((resolve) => servidor.listen(PUERTO, resolve));
const url = `http://127.0.0.1:${PUERTO}/api/telegram`;
console.log(`servidor local escuchando en ${url}\n`);

const POST = (cabeceras, cuerpo) =>
  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...cabeceras },
    body: JSON.stringify(cuerpo),
  });

try {
  const sinSecreto = await POST({}, { update_id: 1 });
  assert.equal(sinSecreto.status, 401);
  console.log('OK  sin secret → 401');

  const malSecreto = await POST({ 'X-Telegram-Bot-Api-Secret-Token': 'otro' }, { update_id: 2 });
  assert.equal(malSecreto.status, 401);
  console.log('OK  secret incorrecto → 401');

  const GET = await fetch(url);
  assert.equal(GET.status, 405);
  console.log('OK  GET → 405');

  const update = {
    update_id: 500,
    message: {
      message_id: 42,
      from: { first_name: 'Gael' },
      chat: { id: Number(CHAT) },
      text: '2 hamburguesas especiales y 1 hot dog de tocino a domicilio en Calle Hidalgo 123 efectivo',
    },
  };
  const respuesta = await POST({ 'X-Telegram-Bot-Api-Secret-Token': SECRET }, update);
  assert.equal(respuesta.status, 200);
  assert.equal((await respuesta.json()).ok, true);
  assert.equal(registro.enviados.length, 1);

  const enviado = registro.enviados[0];
  assert.ok(enviado.texto.includes('💵 TOTAL: $395'), enviado.texto);
  assert.ok(enviado.texto.includes('📍 Dirección: Calle Hidalgo 123'));
  assert.equal(enviado.opciones.reply_markup.inline_keyboard[0].length, 3);
  console.log('OK  update real → 200 y resumen enviado\n');
  console.log('──── mensaje que recibiría el dueño en Telegram ────');
  console.log(enviado.texto);
  console.log('botones:', enviado.opciones.reply_markup.inline_keyboard[0].map((b) => b.text).join(' | '));

  const data = enviado.opciones.reply_markup.inline_keyboard[0][0].callback_data;
  const confirmacion = await POST(
    { 'X-Telegram-Bot-Api-Secret-Token': SECRET },
    {
      update_id: 501,
      callback_query: { id: 'cb-http', data, message: { message_id: 701, chat: { id: Number(CHAT) } } },
    }
  );
  assert.equal(confirmacion.status, 200);
  assert.equal(registro.pedidos.length, 1);
  assert.equal(registro.transacciones.length, 2);
  console.log('\n──── documentos escritos en Firestore ────');
  console.log('pedido:', JSON.stringify(registro.pedidos[0], null, 1).slice(0, 500));
  console.log(
    'transacciones:',
    registro.transacciones.map((t) => `${t.categoria} $${t.monto} (${t.descripcion})`).join(' · ')
  );

  const ajeno = await POST(
    { 'X-Telegram-Bot-Api-Secret-Token': SECRET },
    { update_id: 502, message: { message_id: 43, chat: { id: 999 }, text: 'hola' } }
  );
  assert.equal(ajeno.status, 200);
  assert.equal((await ajeno.json()).ignorado, true);
  console.log('\nOK  chat ajeno → 200 ignorado');

  console.log('\nSMOKE TEST HTTP OK');
} finally {
  servidor.close();
}
