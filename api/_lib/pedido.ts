/**
 * Lógica pura del bot: modalidad, precios, totales, documentos de Firestore y
 * mensajes. Sin fetch, sin Firestore y sin Telegram → se testea con Node
 * (`npm run test:bot`) y es la ÚNICA fuente de verdad de los cálculos:
 * los precios y el total NUNCA se toman de lo que responda Gemini.
 */

import { CARGO_ENVIO, admitePapas, buscarProducto, normalizarTexto, precioProducto } from './menu.js';
import type { CategoriaMenu } from './menu.js';

export type TipoOperacion = 'pedido' | 'gasto';
export type Modalidad = 'delivery' | 'pickup' | 'ambiguo';
export type Confianza = 'alta' | 'baja';
export type MetodoPago = 'Efectivo' | 'Transferencia' | 'Efectivo (Cambio)';

export interface ProductoDetectado {
  nombre: string;
  cantidad: number;
  precioUnitario: number;
  conPapas: boolean;
  importe: number;
}

export interface PedidoDetectado {
  tipo: 'pedido';
  productos: ProductoDetectado[];
  modalidad: Modalidad;
  direccion: string | null;
  cliente: string;
  metodoPago: MetodoPago;
  subtotalProductos: number;
  cargoEnvio: number;
  total: number;
  confianza: Confianza;
  /** Nombres que Gemini devolvió pero que no existen en el menú. */
  noReconocidos: string[];
  textoOriginal: string;
}

export interface GastoDetectado {
  tipo: 'gasto';
  monto: number;
  descripcion: string;
  categoria: string;
  metodoPago: MetodoPago;
  confianza: Confianza;
  textoOriginal: string;
}

export type OperacionDetectada = PedidoDetectado | GastoDetectado;

/** Documento plano listo para Firestore (sin tipos de firebase-admin). */
export type RegistroPlano = Record<string, unknown>;

/** Marca que el almacén reemplaza por `FieldValue.serverTimestamp()`. */
export const MARCA_SERVIDOR = '__serverTimestamp__';

/** México ya no aplica horario de verano: UTC-6 todo el año. */
export const OFFSET_HORAS_MX = -6;

export const ESTADO_PENDIENTE = 'Pendiente';
export const ESTADO_ENTREGADO = 'Entregado';
export const ESTADO_CANCELADO = 'Cancelado';

export const MINUTO = 60_000;
export const HORA = 3_600_000;
export const DIA = 24 * HORA;

/** Un borrador dura 2 h: después las flechas dejan de funcionar. */
export const VIGENCIA_BORRADOR_MS = 2 * HORA;
/** Los updates procesados se recuerdan 1 día (anti-duplicados de Telegram). */
export const VIGENCIA_UPDATE_MS = DIA;

/* ─────────────────────────── saneado de entrada ─────────────────────────── */

/** Quita caracteres de control (los que rompen el mensaje de Telegram). */
function sinControl(texto: string): string {
  let salida = '';
  for (const caracter of texto) {
    const codigo = caracter.charCodeAt(0);
    const esControl =
      codigo <= 8 || codigo === 11 || codigo === 12 || (codigo >= 14 && codigo <= 31) || codigo === 127;
    if (!esControl) salida += caracter;
  }
  return salida;
}

/** Limita el texto a `max` caracteres y quita saltos/control raros. */
export function sanitizarTexto(entrada: unknown, max = 1000): string {
  const texto = sinControl(String(entrada ?? ''))
    .replace(/\r\n?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return texto.length > max ? texto.slice(0, max).trim() : texto;
}

function limitarNumero(valor: unknown, minimo: number, maximo: number, defecto: number): number {
  const numero = typeof valor === 'string' ? Number(valor.replace(/[^0-9.-]/g, '')) : Number(valor);
  if (!Number.isFinite(numero)) return defecto;
  return Math.min(maximo, Math.max(minimo, numero));
}

function limitarEntero(valor: unknown, minimo: number, maximo: number, defecto: number): number {
  return Math.round(limitarNumero(valor, minimo, maximo, defecto));
}

function textoOTexto(valor: unknown, max: number): string {
  return typeof valor === 'string' ? sanitizarTexto(valor, max) : '';
}

/* ──────────────────────── detección de modalidad/pago ──────────────────────── */

const CLAVES_DELIVERY = [
  'a domicilio', 'domicilio', 'envio', 'envien', 'enviamelo', 'delivery', 'a la casa',
  'a mi casa', 'para la casa', 'llevenlo', 'lleven', 'llévenlo', 'a la colonia', 'reparto',
  'mandenlo', 'traiganlo', 'traigan', 'a la calle',
];

const CLAVES_PICKUP = [
  'recoger', 'recojo', 'lo recojo', 'paso por el', 'paso por', 'paso a recoger', 'para llevar',
  'voy al local', 'en el local', 'paso al local', 'pickup', 'recogemos', 'iremos por el',
];

/**
 * Regla pedida por el negocio (determinista, manda sobre lo que diga Gemini):
 * palabras de entrega → delivery + envío $30; de recoger → pickup sin envío;
 * si no menciona nada → ambiguo (se pregunta antes de registrar).
 */
export function detectarModalidad(texto: unknown): Modalidad {
  const limpio = normalizarTexto(texto);
  if (!limpio) return 'ambiguo';
  if (CLAVES_DELIVERY.some((clave) => limpio.includes(clave))) return 'delivery';
  if (CLAVES_PICKUP.some((clave) => limpio.includes(clave))) return 'pickup';
  return 'ambiguo';
}

/** "con papas" ⇒ precio con papas; "sin papas" o silencio ⇒ precio sin papas. */
export function detectarConPapas(texto: unknown): boolean {
  const limpio = normalizarTexto(texto);
  if (/\bsin papas\b/.test(limpio)) return false;
  return /\bcon papas\b/.test(limpio);
}

export function detectarMetodoPago(texto: unknown, sugerido?: unknown): MetodoPago {
  const limpio = normalizarTexto(texto);
  if (/\bcambio\b/.test(limpio)) return 'Efectivo (Cambio)';
  if (/(transferencia|transferir|deposito|spei|transfiero|transferi)/.test(limpio)) return 'Transferencia';
  if (/(efectivo|efectivo cash|cash|billete)/.test(limpio)) return 'Efectivo';

  const pista = normalizarTexto(sugerido);
  if (pista.includes('cambio')) return 'Efectivo (Cambio)';
  if (pista.includes('transfer')) return 'Transferencia';
  return 'Efectivo';
}

/** Último recurso para gastos: sacar el monto del texto ("$450", "450 pesos", "1,250.50"). */
export function extraerMonto(texto: unknown): number {
  const crudo = String(texto ?? '').replace(/,/g, '');
  const conSimbolo = /\$\s*([0-9]+(?:\.[0-9]{1,2})?)/.exec(crudo);
  if (conSimbolo) return Number(conSimbolo[1]);
  const conPesos = /([0-9]+(?:\.[0-9]{1,2})?)\s*(pesos|mxn|varos)/i.exec(crudo);
  if (conPesos) return Number(conPesos[1]);
  const suelto = /\b([0-9]{2,6}(?:\.[0-9]{1,2})?)\b/.exec(crudo);
  return suelto ? Number(suelto[1]) : 0;
}

/* ────────────────────────── normalización del pedido ────────────────────────── */

/** Categorías válidas del dashboard para un gasto del bot. */
export const CATEGORIA_GASTO_DEFECTO = 'Insumos';

const CATEGORIAS_GASTO: { claves: string[]; nombre: string }[] = [
  { claves: ['carne', 'pan', 'res', 'pollo', 'carniceria', 'panaderia'], nombre: 'Carne & Pan' },
  { claves: ['queso', 'salsa', 'salsas', 'verdura', 'verduras', 'jitomate', 'tomate', 'lechuga', 'cebolla', 'cebollin'], nombre: 'Queso, Salsas & Verduras' },
  { claves: ['empaque', 'empaques', 'desechable', 'desechables', 'vaso', 'vasos', 'servilleta', 'servilletas', 'bolsa', 'bolsas', 'charola', 'contenedor'], nombre: 'Empaques & Desechables' },
  { claves: ['gas', 'luz', 'agua', 'internet', 'renta', 'local', 'servicios'], nombre: 'Gas & Servicios Local' },
  { claves: ['sueldo', 'sueldos', 'ayudante', 'ayudantes', 'empleado', 'empleados', 'salario', 'nomina'], nombre: 'Sueldos & Ayudantes' },
  { claves: ['publicidad', 'anuncio', 'anuncios', 'facebook', 'instagram', 'ads', 'promocion'], nombre: 'Publicidad & Redes' },
  { claves: ['insumo', 'insumos', 'ingrediente', 'ingredientes', 'compra', 'compras', 'mandado', 'supermercado', 'abarrotes', 'papas', 'tocino'], nombre: CATEGORIA_GASTO_DEFECTO },
];

const ESCAPE_REGEX = /[.*+?^${}()|[\]\\]/g;

/** Coincidencia por palabra completa: evita que "gasté" active la categoría "gas". */
function contienePalabra(texto: string, clave: string): boolean {
  const patron = new RegExp(`\\b${clave.replace(ESCAPE_REGEX, '\\$&')}\\b`);
  return patron.test(texto);
}

export function normalizarCategoriaGasto(sugerida: unknown, texto: unknown): string {
  const pista = normalizarTexto(`${textoOTexto(sugerida, 60)} ${textoOTexto(texto, 300)}`);
  for (const categoria of CATEGORIAS_GASTO) {
    if (categoria.claves.some((clave) => contienePalabra(pista, clave))) return categoria.nombre;
  }
  return CATEGORIA_GASTO_DEFECTO;
}

/** Palabras con las que el modelo a veces "envuelve" la dirección. */
const ENVOLTORIO_DIRECCION = /^(?:domicilio|delivery|env[ií]o|reparto)\s+(?:a|en|hacia|para)\s+/i;

/** Patrones de entrega con su dirección, del más específico al más genérico. */
const PATRONES_DIRECCION: RegExp[] = [
  // "domicilio en Calle Hidalgo", "envío a Av. Juárez 45", "reparto a X"
  /\b(?:domicilio|env[ií]o|env[ií]en|reparto)\s+(?:a|en|hacia|para)\s+(.+)$/i,
  // "llévenlo a X", "mándenlo a X", "tráiganlo a X"
  /\b(?:ll[eé]venlo|ll[eé]venle|ll[eé]ven|lleven|ll[eé]valo|m[aá]ndenlo|manden|tr[aá]iganlo|traigan)\s+(?:a|en|hacia|para)\s+(.+)$/i,
  // "en Calle Hidalgo"
  /\ben\s+(.+)$/i,
  // "hacia Calle Hidalgo"
  /\bhacia\s+(.+)$/i,
  // "para Calle Morelos #123 Col. Centro" (nunca "para llevar/recoger")
  /\bpara\s+(?!llevar\b|recoger\b|el\s+local\b|la\s+casa\b|mi\s+casa\b|domicilio\b)(.+)$/i,
  // "a Calle X" (pero no "a domicilio", "a la casa", "a la colonia")
  /\ba\s+(?!domicilio\b|la\s+casa\b|mi\s+casa\b|la\s+colonia\b|las?\s+\d)(.+)$/i,
];

/** Corta la dirección cuando ya empieza el pago u otra instrucción. */
const CORTE_DIRECCION =
  /[,;\n]|\b(?:con\s+papas|sin\s+papas|efectivo|transferencia|transfiero|deposito|spei|cash|cambio|pago|pagar[aáe]?|por\s+favor|gracias|para\s+llevar|a\s+las?)\b/i;

/** Lo que NO es una dirección aunque venga tras una preposición. */
const DIRECCION_NO_VALIDA =
  /^(?:domicilio|delivery|la colonia|colonia|nada|ninguna|sin direccion|no se|recoger|llevar|pickup|el local|la oficina|el trabajo|\d+\s*(?:min|mins|minuto|minutos|hora|horas|hr|hrs|peso|pesos))$/;

/** Frases posesivas ("la casa de…", "mi mamá") que nunca son una dirección. */
const DIRECCION_POSESIVA = /^(?:la|mi|su|de)\s+(?:casa|mama|papa|abuela|abuelo|oficina|trabajo|local)\b/;

/** Una dirección inventada ("la casa", "mi mamá") no sirve. */
function direccionInvalida(texto: string): boolean {
  const limpio = normalizarTexto(texto);
  return DIRECCION_NO_VALIDA.test(limpio) || DIRECCION_POSESIVA.test(limpio);
}

function limpiarDireccion(valor: unknown): string | null {
  const texto = textoOTexto(valor, 160)
    .replace(ENVOLTORIO_DIRECCION, '')
    .replace(/^(?:en|a|hacia|para)\s+/i, '')
    .replace(/[.,;]+$/, '')
    .trim();
  if (!texto) return null;
  if (direccionInvalida(texto)) return null;
  return texto;
}

/** Quita el relleno y corta la dirección cuando empieza el pago. */
function limpiarCandidatoDireccion(crudo: string): string | null {
  const corte = CORTE_DIRECCION.exec(crudo);
  let texto = (corte ? crudo.slice(0, corte.index) : crudo).trim();
  // "a la colonia Centro" → "Colonia Centro"
  texto = texto.replace(
    /^la\s+(?=(?:colonia|calle|avenida|av\.|privada|cerrada|callej[oó]n|prolongaci[oó]n|andador)\b)/i,
    ''
  );
  texto = texto.replace(/[.,;:\s]+$/, '').trim();
  if (texto.length < 3 || !/[a-záéíóúüñ]/i.test(texto)) return null;
  return direccionInvalida(texto) ? null : texto;
}

/**
 * Saca la dirección del texto libre aunque Gemini no la devuelva:
 * "1 hamburguesa tocino domicilio en Calle Hidalgo efectivo" → "Calle Hidalgo".
 */
export function extraerDireccion(texto: unknown): string | null {
  const original = sanitizarTexto(texto, 300);
  if (!original) return null;

  for (const patron of PATRONES_DIRECCION) {
    const coincidencia = patron.exec(original);
    const candidato = coincidencia ? limpiarCandidatoDireccion(coincidencia[1]) : null;
    if (candidato) return candidato;
  }
  return null;
}

function limpiarCliente(valor: unknown): string {
  const texto = textoOTexto(valor, 60);
  return texto || 'Cliente WhatsApp';
}

/**
 * Convierte la respuesta de Gemini en una operación confiable:
 * precios, importes y totales se recalculan con el menú local.
 */
export function normalizarOperacion(
  crudo: unknown,
  textoOriginal: unknown
): OperacionDetectada {
  const texto = sanitizarTexto(textoOriginal);
  const datos = (crudo && typeof crudo === 'object' ? crudo : {}) as Record<string, unknown>;
  const tipo = normalizarTexto(datos.tipo);

  if (tipo === 'gasto') {
    const monto = limitarNumero(datos.monto ?? extraerMonto(texto), 0, 1_000_000, 0);
    const descripcion =
      textoOTexto(datos.descripcion, 120) || sanitizarTexto(texto, 120) || 'Gasto registrado por Telegram';
    return {
      tipo: 'gasto',
      monto: Math.round(monto * 100) / 100,
      descripcion,
      categoria: normalizarCategoriaGasto(datos.categoria, `${descripcion} ${texto}`),
      metodoPago: 'Efectivo',
      confianza: monto > 0 ? 'alta' : 'baja',
      textoOriginal: texto,
    };
  }

  const modalidad = detectarModalidad(texto);
  const conPapasGlobal = detectarConPapas(texto);
  const crudosProductos = Array.isArray(datos.productos) ? datos.productos : [];

  const productos: ProductoDetectado[] = [];
  const noReconocidos: string[] = [];

  for (const item of crudosProductos) {
    const registro = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
    const nombreCrudo = textoOTexto(registro.nombre, 60);
    if (!nombreCrudo) continue;

    const cantidad = limitarEntero(registro.cantidad, 1, 99, 1);
    const producto = buscarProducto(nombreCrudo);
    if (!producto) {
      noReconocidos.push(`${cantidad}× ${nombreCrudo}`);
      continue;
    }

    const conPapas =
      typeof registro.conPapas === 'boolean' ? registro.conPapas : conPapasGlobal;
    const usaPapas = conPapas && admitePapas(producto.nombre);
    const precioUnitario = precioProducto(producto.nombre, usaPapas);

    productos.push({
      nombre: producto.nombre,
      cantidad,
      precioUnitario,
      conPapas: usaPapas,
      importe: Math.round(precioUnitario * cantidad * 100) / 100,
    });
  }

  const subtotalProductos = Math.round(productos.reduce((acc, p) => acc + p.importe, 0) * 100) / 100;
  const cargoEnvio = modalidad === 'delivery' ? CARGO_ENVIO : 0;
  const total = Math.round((subtotalProductos + cargoEnvio) * 100) / 100;
  const direccion = limpiarDireccion(datos.direccion) ?? extraerDireccion(texto);
  // Domicilio sin dirección clara: el bot debe preguntarla antes de confirmar.
  const faltaDireccion = modalidad === 'delivery' && !direccion;

  return {
    tipo: 'pedido',
    productos,
    modalidad,
    direccion,
    cliente: limpiarCliente(datos.cliente),
    metodoPago: detectarMetodoPago(texto, datos.metodoPago),
    subtotalProductos,
    cargoEnvio,
    total,
    confianza:
      modalidad === 'ambiguo' || productos.length === 0 || noReconocidos.length > 0 || faltaDireccion
        ? 'baja'
        : 'alta',
    noReconocidos,
    textoOriginal: texto,
  };
}

/** Aplica una modalidad elegida a mano (botones de "ambiguo"). */
export function conModalidad(pedido: PedidoDetectado, modalidad: Modalidad): PedidoDetectado {
  const cargoEnvio = modalidad === 'delivery' ? CARGO_ENVIO : 0;
  return {
    ...pedido,
    modalidad,
    cargoEnvio,
    total: Math.round((pedido.subtotalProductos + cargoEnvio) * 100) / 100,
    confianza: 'alta',
  };
}

/* ─────────────────────────────── formato ─────────────────────────────── */

export function formatoMXN(valor: number): string {
  const numero = Number(valor) || 0;
  const decimales = Number.isInteger(numero) ? 0 : 2;
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  }).format(numero);
}

/** Fecha local de México a partir de un epoch (independiente del TZ del server). */
export function fechaLocal(ms: number): string {
  const desplazado = new Date(ms + OFFSET_HORAS_MX * HORA);
  const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  return `${desplazado.getUTCDate()} ${meses[desplazado.getUTCMonth()]}`;
}

export function horaLocal(ms: number): string {
  const desplazado = new Date(ms + OFFSET_HORAS_MX * HORA);
  const hh = String(desplazado.getUTCHours()).padStart(2, '0');
  const mm = String(desplazado.getUTCMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

/** Medianoche local de México (en epoch UTC), con desplazamiento en días. */
export function inicioDiaLocal(ahoraMs: number, dias = 0): number {
  const local = new Date(ahoraMs + OFFSET_HORAS_MX * HORA);
  return Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + dias) - OFFSET_HORAS_MX * HORA;
}

export function rangoDiaLocal(ahoraMs: number, dias = 0): [number, number] {
  const inicio = inicioDiaLocal(ahoraMs, dias);
  return [inicio, inicio + DIA - 1];
}

export function formatearResumenPedido(pedido: PedidoDetectado): string {
  const lineas: string[] = ['📋 Pedido detectado:'];

  if (pedido.productos.length === 0) {
    lineas.push('• (no se detectó ningún producto del menú)');
  }

  for (const producto of pedido.productos) {
    const papas = producto.conPapas ? ' (con papas)' : '';
    const unitario = producto.cantidad > 1 ? ` (${formatoMXN(producto.precioUnitario)} c/u)` : '';
    lineas.push(`• ${producto.cantidad}× ${producto.nombre}${papas}${unitario} → ${formatoMXN(producto.importe)}`);
  }

  lineas.push('────────────────────');
  lineas.push(`Subtotal: ${formatoMXN(pedido.subtotalProductos)}`);

  if (pedido.modalidad === 'delivery') {
    lineas.push(`🛵 Envío: ${formatoMXN(pedido.cargoEnvio)}`);
  } else if (pedido.modalidad === 'pickup') {
    lineas.push('🥡 Para recoger (sin envío)');
  } else {
    lineas.push('❓ Falta definir la entrega');
  }

  lineas.push(`💵 TOTAL: ${formatoMXN(pedido.total)}`);
  lineas.push('');
  lineas.push(`📍 Dirección: ${pedido.direccion ?? '(no detectada)'}`);
  lineas.push(`💳 Pago: ${pedido.metodoPago}`);

  // A domicilio sin dirección legible: hay que pedirla antes de confirmar.
  if (pedido.modalidad === 'delivery' && !pedido.direccion) {
    lineas.push('');
    lineas.push(TEXTO_PIDE_DIRECCION);
  }

  if (pedido.noReconocidos.length > 0) {
    lineas.push('');
    lineas.push(`⚠️ No reconocí: ${pedido.noReconocidos.join(', ')}. Edita el pedido o regístralo a mano.`);
  }

  return lineas.join('\n');
}

export function formatearResumenGasto(gasto: GastoDetectado): string {
  return [
    '🧾 Gasto detectado:',
    `• ${gasto.descripcion}`,
    `• Categoría: ${gasto.categoria}`,
    `💵 Monto: ${formatoMXN(gasto.monto)}`,
    `💳 Pago: ${gasto.metodoPago}`,
  ].join('\n');
}

export function formatearConfirmadoPedido(pedido: PedidoDetectado, folio: string): string {
  const envio = pedido.cargoEnvio > 0 ? ` (incluye ${formatoMXN(pedido.cargoEnvio)} de envío)` : '';
  return `✅ Pedido #${folio} registrado por ${formatoMXN(pedido.total)}${envio}. Ya aparece en tu dashboard.`;
}

export function formatearConfirmadoGasto(gasto: GastoDetectado): string {
  return `✅ Gasto registrado por ${formatoMXN(gasto.monto)} — ${gasto.descripcion} (${gasto.categoria}). Ya aparece en tu dashboard.`;
}

export const TEXTO_AYUDA = `👋 Soy el bot de pedidos de Entre 3.

Mándame el pedido en lenguaje natural y lo registro:
2 hamburguesas especiales y 1 hot dog de tocino a domicilio en Calle Hidalgo 123 efectivo

También registro gastos:
gasté 450 en carne

Comandos:
/hoy — resumen de hoy
/ayer — resumen de ayer
/pendientes — pedidos pendientes
/cancelar — cancela la operación en curso`;

export const TEXTO_NO_ENTENDIDO =
  'No pude entender el mensaje. Intenta: 2 hamburguesas especiales y 1 hot dog de tocino, a domicilio en [dirección]';

export const TEXTO_ERROR_GUARDADO =
  'Error al guardar. Intenta de nuevo o usa la web.';

export const TEXTO_PIDE_MODALIDAD =
  '🤔 No me quedó claro si es a domicilio o para recoger. Elige una opción:';

export const TEXTO_PIDE_DIRECCION = '❓ ¿A qué dirección lo enviamos?';

export function formatearResumenDia(resumen: ResumenDia, etiqueta: string): string {
  return [
    `📅 ${etiqueta}`,
    '────────────────────',
    `🧾 Pedidos: ${resumen.pedidos}`,
    `🍔 Ventas de productos: ${formatoMXN(resumen.ventasProductos)}`,
    `🛵 Envíos cobrados: ${formatoMXN(resumen.envios)}`,
    `💵 Total ingresos: ${formatoMXN(resumen.total)}`,
  ].join('\n');
}

export interface ResumenDia {
  pedidos: number;
  ventasProductos: number;
  envios: number;
  total: number;
}

export interface PedidoResumen {
  id: string;
  folio: string;
  cliente: string;
  direccion: string | null;
  total: number;
  estado: string;
  fechaMs: number;
  modalidad: string;
}

export function formatearPendientes(pedidos: PedidoResumen[], ahoraMs: number): string {
  if (pedidos.length === 0) return '📭 No tienes pedidos pendientes.';

  const lineas = [`📋 Pedidos pendientes (${pedidos.length})`, '────────────────────'];
  for (const pedido of pedidos) {
    const minutos = Math.max(0, Math.round((ahoraMs - pedido.fechaMs) / MINUTO));
    const cuando = minutos < 60 ? `hace ${minutos} min` : `hace ${Math.round(minutos / 60)} h`;
    const entrega = pedido.modalidad === 'delivery' ? '🛵' : pedido.modalidad === 'pickup' ? '🥡' : '❔';
    lineas.push(
      `${entrega} #${pedido.folio} · ${pedido.cliente} · ${formatoMXN(pedido.total)} · ${cuando}`
    );
    if (pedido.direccion) lineas.push(`   📍 ${pedido.direccion}`);
  }
  return lineas.join('\n');
}

/* ────────────────────────── documentos de Firestore ────────────────────────── */

function folioDe(idCorto: string): string {
  return idCorto.toUpperCase();
}

/** id corto y legible para el folio/comentario (#A1B2C). */
export function idCorto(aleatorio: () => number = Math.random): string {
  const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let salida = '';
  for (let i = 0; i < 5; i += 1) {
    salida += alfabeto[Math.floor(aleatorio() * alfabeto.length)] ?? 'X';
  }
  return salida;
}

export function construirDocumentoPedido(pedido: PedidoDetectado, idCortoPedido: string): RegistroPlano {
  return {
    origen: 'whatsapp',
    estado: ESTADO_PENDIENTE,
    folio: folioDe(idCortoPedido),
    cliente: {
      nombre: pedido.cliente,
      telefono: null,
      direccion: pedido.direccion,
    },
    productos: pedido.productos.map((p) => ({
      nombre: p.nombre,
      cantidad: p.cantidad,
      precioUnitario: p.precioUnitario,
      importe: p.importe,
      conPapas: p.conPapas,
    })),
    subtotal: pedido.subtotalProductos,
    cargoEnvio: pedido.cargoEnvio,
    total: pedido.total,
    modalidad: pedido.modalidad,
    metodo_pago: pedido.metodoPago,
    requiereReparto: pedido.modalidad === 'delivery',
    telefono: null,
    direccion: pedido.direccion,
    fecha: MARCA_SERVIDOR,
    createdAt: MARCA_SERVIDOR,
  };
}

/** Transcripción a `paymentMethod` (lo que lee el dashboard, en minúsculas). */
function paymentMethodApp(metodo: MetodoPago): string {
  if (metodo === 'Transferencia') return 'transferencia';
  if (metodo === 'Efectivo (Cambio)') return 'efectivo';
  return 'efectivo';
}

export function construirTransaccionesPedido(
  pedido: PedidoDetectado,
  idCortoPedido: string,
  pedidoId: string
): RegistroPlano[] {
  const categoria = pedido.modalidad === 'delivery' ? 'Ventas Delivery' : 'Ventas Mostrador';
  const descripcion = `Pedido WhatsApp #${folioDe(idCortoPedido)}`;

  const base = {
    tipo: 'ingreso',
    negocio: 'hamburguesas',
    metodo_pago: pedido.metodoPago,
    paymentMethod: paymentMethodApp(pedido.metodoPago),
    pedidoId,
    fecha: MARCA_SERVIDOR,
    createdAt: MARCA_SERVIDOR,
  };

  const movimientos: RegistroPlano[] = [
    {
      ...base,
      categoria,
      monto: pedido.subtotalProductos,
      descripcion,
    },
  ];

  // El envío se cobra aparte: ingreso propio para poder verlo en el dashboard.
  if (pedido.modalidad === 'delivery' && pedido.cargoEnvio > 0) {
    movimientos.push({
      ...base,
      categoria: 'Envíos',
      monto: pedido.cargoEnvio,
      descripcion: `Envío pedido #${folioDe(idCortoPedido)}`,
    });
  }

  return movimientos;
}

export function construirDocumentoGasto(gasto: GastoDetectado): RegistroPlano {
  return {
    tipo: 'gasto',
    negocio: 'hamburguesas',
    categoria: gasto.categoria,
    monto: gasto.monto,
    descripcion: gasto.descripcion,
    metodo_pago: gasto.metodoPago,
    paymentMethod: 'efectivo',
    origen: 'whatsapp',
    fecha: MARCA_SERVIDOR,
    createdAt: MARCA_SERVIDOR,
  };
}

export function construirBorrador(
  chatId: string,
  operacion: OperacionDetectada,
  estado: EstadoBorrador,
  ahoraMs: number,
  messageId: number | null = null,
  sello = ''
): RegistroPlano {
  return {
    chatId,
    estado,
    operacion,
    messageId,
    sello,
    createdAt: ahoraMs,
    expiresAt: ahoraMs + VIGENCIA_BORRADOR_MS,
  };
}

export type EstadoBorrador = 'pendiente_confirmacion' | 'esperando_modalidad' | 'esperando_correccion';

/* ─────────────────────────────── callbacks ─────────────────────────────── */

export type AccionCallback = 'cf' | 'cx' | 'ed' | 'dl' | 'pk' | 'po' | 'pc';

export function datosCallback(accion: AccionCallback, ...partes: (string | number)[]): string {
  return [accion, ...partes.map((p) => String(p))].join(':');
}

export function parsearCallback(data: unknown): { accion: AccionCallback; partes: string[] } | null {
  const texto = String(data ?? '');
  const [accion, ...partes] = texto.split(':');
  const validas: AccionCallback[] = ['cf', 'cx', 'ed', 'dl', 'pk', 'po', 'pc'];
  if (!validas.includes(accion as AccionCallback)) return null;
  return { accion: accion as AccionCallback, partes };
}

/** ¿El borrador sigue vigente y corresponde al botón que se está tocando? */
export function borradorVigente(
  borrador: RegistroPlano | null,
  sello: string | undefined,
  ahoraMs: number
): boolean {
  if (!borrador) return false;
  const expira = Number(borrador.expiresAt ?? 0);
  if (!Number.isFinite(expira) || expira < ahoraMs) return false;
  if (sello != null && sello !== '') {
    const propio = String(borrador.sello ?? borrador.messageId ?? '');
    if (propio !== String(sello)) return false;
  }
  return true;
}

export function operacionDeBorrador(borrador: RegistroPlano): OperacionDetectada | null {
  const operacion = borrador.operacion;
  if (!operacion || typeof operacion !== 'object') return null;
  const tipo = (operacion as { tipo?: unknown }).tipo;
  return tipo === 'pedido' || tipo === 'gasto' ? (operacion as unknown as OperacionDetectada) : null;
}

/** Categoría del menú de un producto (para agrupar en mensajes). */
export function categoriaDeProducto(nombre: string): CategoriaMenu | null {
  return buscarProducto(nombre)?.categoria ?? null;
}
