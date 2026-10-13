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

const ROL = (process.argv.find((a) => a.startsWith('--rol=')) ?? '--rol=super_admin').replace('--rol=', '');
const ES_SOCIO = ROL === 'admin_hamburguesas';
const EMAIL = ES_SOCIO ? 'jcmissdj@gmail.com' : 'gaelsolisjavier7@gmail.com';
const NOMBRE = ES_SOCIO ? 'Socio' : 'Gael';
console.log('rol de la corrida:', ROL);

const TRANSACCIONES = [
  { id: 't1', fecha: '2026-10-12', tipo: 'ingreso', categoria: 'Ventas Mostrador', monto: 3850, descripcion: 'Ventas del día', negocio: 'hamburguesas' },
  { id: 't2', fecha: '2026-10-12', tipo: 'gasto', categoria: 'Carne & Pan', monto: 1240, descripcion: 'Compra de carne', negocio: 'hamburguesas' },
  { id: 't3', fecha: '2026-10-12', tipo: 'ingreso', categoria: 'Envíos', monto: 210, descripcion: 'Envíos cobrados', negocio: 'hamburguesas' },
  { id: 't4', fecha: '2026-10-10', tipo: 'ingreso', categoria: 'Venta AirPods Pro 2', monto: 4200, descripcion: 'Venta AirPods', negocio: 'airpods' },
  { id: 't5', fecha: '2026-10-11', tipo: 'ingreso', categoria: 'Sueldo / Honorarios Fijos', monto: 6000, descripcion: 'Sueldo', negocio: 'personal' },
  { id: 't6', fecha: '2026-10-09', tipo: 'gasto', categoria: 'Gas & Servicios Local', monto: 480, descripcion: 'Gas', negocio: 'hamburguesas' },
];
const PEDIDOS = [
  { id: 'p1', fecha: '2026-10-12T14:10:00', fechaMs: Date.now() - 5 * 60000, tieneHora: true, total: 395, productos: [], cliente: 'Cliente WhatsApp', clienteDireccion: 'Calle Hidalgo 123', estado: 'Pendiente', modalidad: 'delivery', origen: 'whatsapp' },
  { id: 'p2', fecha: '2026-10-12T13:58:00', fechaMs: Date.now() - 18 * 60000, tieneHora: true, total: 250, productos: [], cliente: 'Cliente WhatsApp', clienteDireccion: 'Av. Juárez 45', estado: 'pendiente', modalidad: 'pickup', origen: 'whatsapp' },
  { id: 'p3', fecha: '2026-10-12T13:40:00', fechaMs: Date.now() - 35 * 60000, tieneHora: true, total: 480, productos: [], cliente: 'Cliente WhatsApp', clienteDireccion: 'Calle Zaragoza 8', estado: 'Pendiente', modalidad: 'delivery', origen: 'whatsapp' },
  { id: 'p4', fecha: '2026-10-12T13:05:00', fechaMs: Date.now() - 70 * 60000, tieneHora: true, total: 150, productos: [], cliente: 'Ana', clienteDireccion: null, estado: 'Entregado', modalidad: 'pickup', origen: 'web' },
  { id: 'p5', fecha: '2026-10-12T12:30:00', fechaMs: Date.now() - 105 * 60000, tieneHora: true, total: 320, productos: [], cliente: 'Beto', clienteDireccion: 'Calle 5 de Mayo 22', estado: 'Entregado', modalidad: 'delivery', origen: 'web' },
];
const MOVIMIENTOS = [
  { id: 'a1', tipo: 'venta', cantidad: 1, precio_unitario: 4200, total: 4200, fecha: '2026-10-10T12:00:00', fechaMs: Date.parse('2026-10-10T12:00:00'), tieneHora: true, notas: null, cliente: null, createdAtMs: null },
];

const MODULOS = {
  useUsuario: `export function useUsuario() {
  return { usuarioAuth: { email: '${EMAIL}', displayName: '${NOMBRE}', photoURL: null },
    usuarioPerfil: { id: '${EMAIL}', email: '${EMAIL}', nombre: '${NOMBRE}', rol: '${ROL}', datos: { rol: '${ROL}' } },
    rol: '${ROL}', loading: false, error: null };
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
      if (m.id && c.pending.has(m.id)) {
        const p = c.pending.get(m.id);
        c.pending.delete(m.id);
        if (m.error) p.reject(new Error(JSON.stringify(m.error)));
        else p.resolve(m.result);
      } else if (m.method && c.onEvent) c.onEvent(m);
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
const erroresConsola = [];
cdp.onEvent = async (msg) => {
  if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
    const texto = (msg.params.args || [])
      .map((a) => a.value ?? a.description ?? '')
      .join(' ')
      .slice(0, 160);
    erroresConsola.push(texto);
  }
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

const ev = async (expresion) => {
  const r = await cdp.send('Runtime.evaluate', { expression: expresion, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) {
    console.log('   ⚠ excepción en el DOM:', (r.exceptionDetails.exception || {}).description || r.exceptionDetails.text);
  }
  return r.result.value;
};
const capturar = async (nombre) => {
  await sleep(450);
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(salida, `${nombre}.png`), Buffer.from(data, 'base64'));
  console.log('  ✓', `${nombre}.png`);
};

for (const vista of [
  { n: 'movil', w: 390, h: 844, m: true },
  { n: 'tablet', w: 768, h: 1024, m: false },
  { n: 'escritorio', w: 1440, h: 900, m: false },
]) {
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: vista.w, height: vista.h, deviceScaleFactor: 2, mobile: vista.m });
  await cdp.send('Page.navigate', { url: URL_APP });
  await sleep(5200);
  console.log(`\n=== ${vista.n} ===`);

  const info = await ev(`(() => {
    const fondo = getComputedStyle(document.body).backgroundColor;
    const fuente = getComputedStyle(document.body).fontFamily;
    const card = document.querySelector('.apple-card');
    const fab = [...document.querySelectorAll('button')].find(b => (b.getAttribute('aria-label')||'').includes('Nuevo'));
    const hero = document.querySelector('.num-hero');
    return {
      fondoBody: fondo,
      fuenteBody: fuente.slice(0, 40),
      cardFondo: card ? getComputedStyle(card).backgroundColor : null,
      cardBorde: card ? getComputedStyle(card).borderTopColor : null,
      fab: fab ? { ancho: Math.round(fab.getBoundingClientRect().width), fondo: getComputedStyle(fab).backgroundColor, sombra: getComputedStyle(fab).boxShadow.slice(0, 40) } : null,
      heroFuente: hero ? getComputedStyle(hero).fontFamily.slice(0, 30) : null,
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      // FIX 1: el card "Pedidos Web" debe excluir los pedidos del bot
      pedidosWebCard: (document.body.innerText.match(/PEDIDOS WEB[\\s\\S]{0,40}?(\\d+)\\s*(\\$[\\d,.]+)/) || []).slice(1),
      ventasHoy: (document.body.innerText.match(/VENTAS HOY[\\s\\S]{0,40}?(\\$[\\d,.]+)/i) || [])[1] ?? null,
    };
  })()`);
  console.log('  ', JSON.stringify(info));

  // Sidebar (sólo lg) y BottomNav (sólo móvil)
  const navegacion = await ev(`(() => {
    const aside = document.querySelector('aside');
    const bottom = document.querySelector('nav[class*="bottom-0"]');
    const texto = aside ? aside.textContent : '';
    const items = aside
      ? [...aside.querySelectorAll('button')].map(b => b.textContent.trim()).filter(Boolean)
      : [];
    const criticos = items.filter(t => t.includes(' de '));
    return JSON.stringify({
      sidebarItems: items,
      sidebarAncho: aside ? Math.round(aside.getBoundingClientRect().width) : 0,
      sidebarVisible: aside ? getComputedStyle(aside).display !== 'none' : false,
      bottomNavVisible: bottom ? getComputedStyle(bottom).display !== 'none' : false,
      insumosCriticos: criticos.slice(0, 6),
      footerNombre: texto.includes('Gael') ? 'Gael' : (texto.includes('Socio') ? 'Socio' : null),
    });
  })()`);
  console.log('   navegación:', navegacion);
  await capturar(`rediseno-${etiqueta}-hero-${vista.n}`);

  /* ── Alerta del bot: al tocarla hace scroll y resalta las pendientes ── */
  const alerta = await ev(`(() => {
    const boton = [...document.querySelectorAll('button')].find(b => (b.textContent || '').includes('pedidos nuevos del bot'));
    if (!boton) return 'sin alerta';
    const antes = window.scrollY;
    boton.click();
    return JSON.stringify({ antes });
  })()`);
  await sleep(1200);
  const trasAlerta = await ev(`(() => ({
    scrollY: Math.round(window.scrollY),
    resaltada: !!document.querySelector('#pedidos-recientes.alerta-pendientes'),
    filasPendientes: document.querySelectorAll('#pedidos-recientes [data-pendiente="true"]').length,
  }))()`);
  console.log('   alerta:', alerta, '→', JSON.stringify(trasAlerta));
  await capturar(`rediseno-${etiqueta}-alerta-${vista.n}`);
  await ev(`window.scrollTo(0, 0)`);
  await sleep(400);
  await ev(`window.scrollTo(0, document.body.scrollHeight * 0.42)`);
  await capturar(`rediseno-${etiqueta}-cards-${vista.n}`);

  /* ── FASE 3: página de Transacciones (sidebar en lg, header en tablet) ── */
  const irATransacciones = await ev(`(() => {
    const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === 'Transacciones');
    if (!b) return 'NO';
    b.click();
    return 'ok';
  })()`);
  await sleep(1400);
  const pagina = await ev(`(() => {
    const texto = document.body.innerText;
    const botones = [...document.querySelectorAll('button')].map(b => b.textContent.trim());
    const lineas = texto.split(String.fromCharCode(10)).map(l => l.trim());
    const dias = lineas.filter(t => t.startsWith('HOY') || t.startsWith('AYER'));
    return JSON.stringify({
      titulo: texto.includes('Transacciones') ? 'ok' : 'NO',
      chipsPeriodo: botones.filter(t => ['Hoy', 'Ayer', 'Esta semana', 'Este mes', 'Todo el tiempo'].includes(t)),
      chipsNegocio: botones.filter(t => ['Todos', 'Hamburguesas', 'AirPods', 'Personal'].includes(t)),
      gruposDia: dias.slice(0, 4),
      totalPeriodo: lineas.some(t => t.includes('Total del período')),
      ctaDesktop: [...document.querySelectorAll('button')].some(b => b.textContent.trim() === 'Nuevo Registro' && b.getBoundingClientRect().width > 0),
      overflow: document.documentElement.scrollWidth - window.innerWidth,
    });
  })()`);
  console.log('   transacciones:', irATransacciones, JSON.stringify(pagina));
  await ev(`window.scrollTo(0, 0)`);
  await sleep(400);
  await capturar(`rediseno-${etiqueta}-transacciones-${vista.n}`);
  await ev(`window.scrollTo(0, document.body.scrollHeight * 0.35)`);
  await sleep(400);
  await capturar(`rediseno-${etiqueta}-transacciones-lista-${vista.n}`);
  await ev(`window.scrollTo(0, 0)`);
  await sleep(300);
  await ev(`(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === 'Dashboard'); if (b) b.click(); return 1; })()`);
  await sleep(900);
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

  /* ── FASE 2: quick products → 2× Sencilla + 1× Papas = $250 ── */
  const tapProducto = (texto) => `(() => {
    const boton = [...document.querySelectorAll('button')].find(b => b.textContent.trim().includes(${JSON.stringify(texto)}));
    if (!boton) return 'NO';
    boton.click();
    return 'ok';
  })()`;
  const estadoModal = () => ev(`(() => {
    const numero = document.querySelector('input[type="number"]');
    const texto = [...document.querySelectorAll('input[type="text"]')].find(i => i.placeholder && i.placeholder.includes('Sencilla'));
    const guardar = [...document.querySelectorAll('button[type="submit"]')].pop();
    const toggles = [...document.querySelectorAll('button')]
      .filter(b => /Pedido|Gasto/.test(b.textContent || '') && b.className.includes('min-h-[48px]'))
      .map(b => ({ texto: b.textContent.trim(), fondo: getComputedStyle(b).backgroundColor }));
    return {
      monto: numero ? numero.value : null,
      descripcion: texto ? texto.value : null,
      boton: guardar ? guardar.textContent.trim() : null,
      deshabilitado: guardar ? guardar.disabled : null,
      alerta: (document.body.innerText.match(/(\\d+) pedidos? nuevos? del bot/) || [])[0] ?? null,
      tipoActivo: (toggles.find(t => t.fondo === 'rgb(34, 197, 94)') || {}).texto ?? null,
      categoriaSelect: (() => {
        // El select del modal es el último del DOM (el primero es el del SubNav)
        const select = [...document.querySelectorAll('select')].pop();
        return select
          ? { valor: select.value, opciones: [...select.options].map(o => o.textContent.trim()) }
          : null;
      })(),
      toggles,
    };
  })()`);

  const vacio = await estadoModal();
  console.log('   modal vacío:', JSON.stringify(vacio));
  const listadoBotones = await ev(`[...document.querySelectorAll('button')].map(b => b.textContent.trim()).filter(Boolean).slice(0, 28)`);
  console.log('   botones:', JSON.stringify(listadoBotones));
  const tap = async (texto) => {
    const resultado = await ev(tapProducto(texto));
    console.log(`   tap "${texto}" → ${resultado}`);
  };
  await tap('Sencilla');
  await tap('Sencilla');
  await tap('Papas');
  await sleep(500);
  const lleno = await estadoModal();
  console.log('   modal con productos:', JSON.stringify(lleno));
  await capturar(`rediseno-${etiqueta}-modal-lleno-${vista.n}`);

  /* ── Flujo de guardar: el submit debe llegar al mismo handler (addTransaction) ── */
  erroresConsola.length = 0;
  await ev(`(() => { const b = [...document.querySelectorAll('button[type="submit"]')].pop(); if (b) b.click(); return 1; })()`);
  await sleep(1500);
  const trasGuardar = await ev(`(() => {
    const guardar = [...document.querySelectorAll('button[type="submit"]')].pop();
    return { modalSigueAbierto: !!guardar, boton: guardar ? guardar.textContent.trim() : null };
  })()`);
  console.log('   guardar →', JSON.stringify(trasGuardar), '| errores consola:', JSON.stringify(erroresConsola.slice(0, 2)));

  // Cerrar el modal para la comprobación de light mode
  await ev(`(() => { const x = document.querySelector('button[aria-label="Cerrar"]'); if (x) x.click(); return 1; })()`);
  await sleep(400);

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
