/**
 * Capturas de la app con datos demo (intercepta los hooks con CDP).
 * Uso: node scripts/capturar-ui.mjs antes|despues
 */
import fs from 'node:fs';
import path from 'node:path';

const etiqueta = process.argv[2] ?? 'captura';
const PUERTO = 9222;
const URL_APP = 'http://localhost:5173/';
const salida = path.join(process.cwd(), 'rediseno-audit');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
fs.mkdirSync(salida, { recursive: true });

const TRANSACCIONES = [
  { id: 't1', fecha: '2026-10-12', tipo: 'ingreso', categoria: 'Ventas Mostrador', monto: 3850, descripcion: 'Ventas del día', negocio: 'hamburguesas' },
  { id: 't2', fecha: '2026-10-12', tipo: 'gasto', categoria: 'Carne & Pan', monto: 1240, descripcion: 'Compra de carne', negocio: 'hamburguesas' },
  { id: 't3', fecha: '2026-10-12', tipo: 'ingreso', categoria: 'Envíos', monto: 210, descripcion: 'Envíos cobrados', negocio: 'hamburguesas' },
  { id: 't4', fecha: '2026-10-10', tipo: 'ingreso', categoria: 'Venta AirPods Pro 2', monto: 4200, descripcion: 'Venta AirPods', negocio: 'airpods' },
  { id: 't5', fecha: '2026-10-11', tipo: 'ingreso', categoria: 'Sueldo / Honorarios Fijos', monto: 6000, descripcion: 'Sueldo', negocio: 'personal' },
  { id: 't6', fecha: '2026-10-09', tipo: 'gasto', categoria: 'Gas & Servicios Local', monto: 480, descripcion: 'Gas', negocio: 'hamburguesas' },
];
const PEDIDOS = [
  { id: 'p1', fecha: '2026-10-12T14:10:00', fechaMs: Date.parse('2026-10-12T14:10:00'), tieneHora: true, total: 395, productos: [], cliente: 'Cliente WhatsApp', clienteDireccion: 'Calle Hidalgo 123', estado: 'Pendiente', modalidad: 'delivery', origen: 'whatsapp' },
  { id: 'p2', fecha: '2026-10-12T13:05:00', fechaMs: Date.parse('2026-10-12T13:05:00'), tieneHora: true, total: 250, productos: [], cliente: 'Ana', clienteDireccion: null, estado: 'Entregado', modalidad: 'pickup', origen: 'web' },
];
const MOVIMIENTOS = [
  { id: 'a1', tipo: 'venta', cantidad: 1, precio_unitario: 4200, total: 4200, fecha: '2026-10-10T12:00:00', fechaMs: Date.parse('2026-10-10T12:00:00'), tieneHora: true, notas: null, cliente: null, createdAtMs: null },
];

const MODULOS = {
  useUsuario: `export function useUsuario() {
  return { usuarioAuth: { email: 'gaelsolisjavier7@gmail.com', displayName: 'Gael', photoURL: null },
    usuarioPerfil: { id: 'gaelsolisjavier7@gmail.com', email: 'gaelsolisjavier7@gmail.com', nombre: 'Gael', rol: 'super_admin', datos: { rol: 'super_admin' } },
    rol: 'super_admin', loading: false, error: null };
}
`,
  useTransactions: `const transacciones = ${JSON.stringify(TRANSACCIONES)};
export function useTransactions() { return { transacciones, loading: false, error: null }; }
`,
  usePedidos: `const pedidos = ${JSON.stringify(PEDIDOS)};
export function usePedidos() { return { pedidos, loading: false, error: null, updateEstado: async () => {} }; }
`,
  useAirPods: `const movimientos = ${JSON.stringify(MOVIMIENTOS)};
export function useAirPods() { return { movimientos, loading: false, error: null, stockActual: 3, capitalInmovilizado: 9000, gananciaAcumulada: 4200, unidadesVendidas: 1, precioPromedioCompra: 3000, precioPromedioVenta: 4200, margenPromedio: 28, unidadesCompradas: 4, inversionTotal: 12000, ingresosTotales: 4200 }; }
`,
  useInsumos: `const insumos = [
  { id: 'i1', nombre: 'Carne molida de res', categoria: 'Carne', unidadCompra: 'kg', cantidadCompra: 5, precioCompra: 450, unidadBase: 'g', factorConversion: 1000, costoUnidadBase: 0.09, stockActual: 5000, stockMinimo: 1000, proveedor: 'Carnicería La Central', notas: null, activo: true },
  { id: 'i2', nombre: 'Pan brioche', categoria: 'Panadería', unidadCompra: 'pza', cantidadCompra: 30, precioCompra: 90, unidadBase: 'pza', factorConversion: 1, costoUnidadBase: 3, stockActual: 6, stockMinimo: 10, proveedor: null, notas: null, activo: true },
  { id: 'i3', nombre: 'Papas lisa europea', categoria: 'Papas', unidadCompra: 'kg', cantidadCompra: 10, precioCompra: 400, unidadBase: 'g', factorConversion: 1000, costoUnidadBase: 0.04, stockActual: 10000, stockMinimo: 2000, proveedor: null, notas: null, activo: true }
];
export function useInsumos() { return { insumos, loading: false, error: null, metricas: { totalActivos: 3, valorTotal: 1384, stockBajo: 1, categorias: 3 } }; }
`,
  useRecetas: `const recetas = [{ id: 'r1', productoId: 'burger-especial', productoNombre: 'Burger Especial', incluyePapas: false, activo: true, costoTotal: 27.3, ingredientes: [{ insumoId: 'i1', insumoNombre: 'Carne molida de res', cantidad: 150, costoUnitarioSnapshot: 0.09, costoTotal: 13.5 }, { insumoId: 'i2', insumoNombre: 'Pan brioche', cantidad: 1, costoUnitarioSnapshot: 3, costoTotal: 3 }] }];
export function useRecetas() { return { recetas, loading: false, error: null }; }
`,
};

async function getTarget() {
  for (let i = 0; i < 60; i++) {
    try {
      const page = (await (await fetch(`http://127.0.0.1:${PUERTO}/json/list`)).json()).find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
      if (page) return page;
    } catch {}
    await sleep(500);
  }
  throw new Error('sin target CDP');
}

class CDP {
  constructor(ws) { this.ws = ws; this.seq = 0; this.pending = new Map(); this.onEvent = null; }
  static async connect(url) {
    const ws = new WebSocket(url);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('WS')); });
    const c = new CDP(ws);
    ws.onmessage = (e) => {
      const m = JSON.parse(e.data);
      if (m.id && c.pending.has(m.id)) { const p = c.pending.get(m.id); c.pending.delete(m.id); m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result); }
      else if (m.method && c.onEvent) c.onEvent(m);
    };
    return c;
  }
  send(method, params = {}) {
    const id = ++this.seq;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
      setTimeout(() => { if (this.pending.has(id)) { this.pending.delete(id); reject(new Error('timeout ' + method)); } }, 25000);
    });
  }
}

const cdp = await CDP.connect((await getTarget()).webSocketDebuggerUrl);
await cdp.send('Page.enable');
await cdp.send('Runtime.enable');
cdp.onEvent = async (msg) => {
  if (msg.method !== 'Fetch.requestPaused') return;
  const { requestId, request } = msg.params;
  const clave = Object.keys(MODULOS).find((k) => request.url.includes(`${k}.ts`));
  try {
    if (clave) {
      await cdp.send('Fetch.fulfillRequest', { requestId, responseCode: 200, responseHeaders: [{ name: 'Content-Type', value: 'application/javascript' }], body: Buffer.from(MODULOS[clave], 'utf8').toString('base64') });
    } else {
      await cdp.send('Fetch.continueRequest', { requestId });
    }
  } catch {}
};
await cdp.send('Fetch.enable', { patterns: Object.keys(MODULOS).map((k) => ({ urlPattern: `*${k}*` })) });

const ev = async (expresion) => (await cdp.send('Runtime.evaluate', { expression: expresion, returnByValue: true, awaitPromise: true })).result.value;
const capturar = async (nombre) => {
  await sleep(450);
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(salida, `${nombre}.png`), Buffer.from(data, 'base64'));
  console.log('  ✓', `${nombre}.png`);
};

for (const vista of [{ n: 'movil', w: 390, h: 844, m: true }, { n: 'escritorio', w: 1440, h: 900, m: false }]) {
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: vista.w, height: vista.h, deviceScaleFactor: 2, mobile: vista.m });
  await cdp.send('Page.navigate', { url: URL_APP });
  await sleep(5200);
  console.log(`\n=== ${vista.n} ===`);

  const info = await ev(`(() => {
    const fondo = getComputedStyle(document.body).backgroundColor;
    const fuente = getComputedStyle(document.body).fontFamily;
    const card = document.querySelector('.apple-card');
    const fab = [...document.querySelectorAll('button')].find(b => (b.getAttribute('aria-label')||'').includes('Nuevo'));
    const hero = [...document.querySelectorAll('h1,div,span')].find(e => e.textContent && e.textContent.trim().startsWith('$') && parseFloat(e.getComputedStyle ? 1 : 1));
    return {
      fondoBody: fondo,
      fuenteBody: fuente.slice(0, 40),
      cardFondo: card ? getComputedStyle(card).backgroundColor : null,
      cardBorde: card ? getComputedStyle(card).borderTopColor : null,
      fab: fab ? { ancho: Math.round(fab.getBoundingClientRect().width), fondo: getComputedStyle(fab).backgroundColor, sombra: getComputedStyle(fab).boxShadow.slice(0, 40) } : null,
      heroFuente: hero ? getComputedStyle(hero).fontFamily.slice(0, 30) : null,
      overflow: document.documentElement.scrollWidth - window.innerWidth,
    };
  })()`);
  console.log('  ', JSON.stringify(info));
  await capturar(`rediseno-${etiqueta}-hero-${vista.n}`);
  await ev(`window.scrollTo(0, document.body.scrollHeight * 0.42)`);
  await capturar(`rediseno-${etiqueta}-cards-${vista.n}`);
  await ev(`window.scrollTo(0, 0)`);
  await sleep(300);

  // El FAB abre el modal de Nuevo Registro
  const abierto = await ev(`(() => {
    const fab = [...document.querySelectorAll('button')].find(b => (b.getAttribute('aria-label')||'').includes('Nuevo'));
    if (!fab) return 'sin FAB';
    fab.click();
    return 'click';
  })()`);
  await sleep(1100);
  const modal = await ev(`(() => {
    const texto = document.body.innerText;
    const abierto = texto.includes('Monto') || texto.includes('PEDIDO') || !!document.querySelector('input[type="number"]');
    return abierto ? 'modal abierto' : 'modal NO abierto';
  })()`);
  console.log(`   FAB: ${abierto} → ${modal}`);
  await capturar(`rediseno-${etiqueta}-modal-${vista.n}`);

  // Light mode opcional: debe seguir funcionando (data-theme="light" en <html>)
  await ev(`document.querySelectorAll('input[type="number"]').forEach(() => {});
    document.documentElement.setAttribute('data-theme', 'light')`);
  await sleep(500);
  const luz = await ev(`(() => {
    const card = document.querySelector('.apple-card');
    return { body: getComputedStyle(document.body).backgroundColor,
             card: card ? getComputedStyle(card).backgroundColor : null,
             borde: card ? getComputedStyle(card).borderTopColor : null,
             texto: getComputedStyle(document.body).color };
  })()`);
  console.log('   light:', JSON.stringify(luz));
  await capturar(`rediseno-${etiqueta}-light-${vista.n}`);
  await ev(`document.documentElement.removeAttribute('data-theme')`);
}

process.exit(0);
