/**
 * Tests del dashboard: agregación de ingresos (regla anti-doble-conteo).
 *
 *   npm run test:dashboard
 *
 * Contexto del bug: los pedidos del bot de Telegram escriben su documento en
 * `pedidos` Y sus transacciones de ingreso en `transacciones`. El dashboard
 * suma las dos fuentes, así que un pedido de $395 aparecía como $790.
 */
import assert from 'node:assert/strict';
import {
  contarPedidosWeb,
  esPedidoDelBot,
  ingresoPedidosWeb,
  ingresoTotalDelDashboard,
  ingresoTransacciones,
  pedidoSumaComoIngreso,
} from '../src/lib/ingresos.ts';
import { movimientosStockVenta, resolverLineasVenta } from '../src/lib/inventario.ts';
import { MENU_DATA } from '../src/lib/products.ts';

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

/** 2026-10-12 (hoy), en ms locales */
const DIA = 86_400_000;
const HOY = new Date(2026, 9, 12, 12, 0, 0).getTime();
const INICIO = new Date(2026, 9, 12, 0, 0, 0, 0).getTime();
const FIN = new Date(2026, 9, 12, 23, 59, 59, 999).getTime();

const pedido = (extra) => ({
  origen: 'web',
  estado: 'Pendiente',
  total: 100,
  fechaMs: HOY,
  ...extra,
});

/* ═════════════ 1. Regla: qué pedido suma ═════════════ */
grupo('1. Qué pedidos suman al ingreso');

t('pedido web → sí suma', () => {
  assert.equal(esPedidoDelBot(pedido({ origen: 'web' })), false);
  assert.equal(pedidoSumaComoIngreso(pedido({ origen: 'web', total: 250 })), true);
  assert.equal(ingresoPedidosWeb([pedido({ origen: 'web', total: 250 })], INICIO, FIN), 250);
});

t('pedido whatsapp (bot) → NO suma', () => {
  assert.equal(esPedidoDelBot(pedido({ origen: 'whatsapp' })), true);
  assert.equal(esPedidoDelBot(pedido({ origen: 'WhatsApp' })), true);
  assert.equal(pedidoSumaComoIngreso(pedido({ origen: 'whatsapp' })), false);
  assert.equal(ingresoPedidosWeb([pedido({ origen: 'whatsapp', total: 395 })], INICIO, FIN), 0);
});

t('pedido sin origen (web pública antigua) → SÍ suma', () => {
  const sinOrigen = { estado: 'Pendiente', total: 180, fechaMs: HOY };
  assert.equal(esPedidoDelBot(sinOrigen), false);
  assert.equal(pedidoSumaComoIngreso(sinOrigen), true);
  assert.equal(ingresoPedidosWeb([sinOrigen], INICIO, FIN), 180);
});

t('pedido cancelado → no suma (ni web ni bot)', () => {
  assert.equal(pedidoSumaComoIngreso(pedido({ origen: 'web', estado: 'Cancelado' })), false);
  assert.equal(pedidoSumaComoIngreso(pedido({ origen: 'web', estado: 'cancelado' })), false);
  assert.equal(pedidoSumaComoIngreso(pedido({ origen: 'whatsapp', estado: 'Cancelado' })), false);
  assert.equal(
    ingresoPedidosWeb(
      [pedido({ origen: 'web', estado: 'Cancelado', total: 900 })],
      INICIO,
      FIN
    ),
    0
  );
});

t('pedido fuera del rango → no suma', () => {
  const ayer = pedido({ origen: 'web', total: 500, fechaMs: HOY - DIA });
  const manana = pedido({ origen: 'web', total: 700, fechaMs: HOY + DIA });
  assert.equal(ingresoPedidosWeb([ayer, manana], INICIO, FIN), 0);
  assert.equal(ingresoPedidosWeb([ayer, manana], INICIO - DIA, FIN - DIA), 500);
});

t('los bordes del día entran (00:00 y 23:59:59.999)', () => {
  const primerMs = pedido({ origen: 'web', total: 100, fechaMs: INICIO });
  const ultimoMs = pedido({ origen: 'web', total: 100, fechaMs: FIN });
  assert.equal(ingresoPedidosWeb([primerMs, ultimoMs], INICIO, FIN), 200);
});

t('contarPedidosWeb sólo cuenta los que suman', () => {
  const lista = [
    pedido({ origen: 'web', total: 250 }),
    pedido({ origen: 'whatsapp', total: 395 }),
    pedido({ origen: 'web', estado: 'Cancelado', total: 100 }),
    pedido({ origen: 'bot', total: 50 }),
  ];
  assert.equal(contarPedidosWeb(lista, INICIO, FIN), 2, 'web y bot(otro origen) sí cuentan');
});

/* ═════════════ 2. Transacciones ═════════════ */
grupo('2. Ingresos por transacciones');

t('suma sólo ingresos (ignora gastos y formatos antiguos)', () => {
  const movimientos = [
    { tipo: 'ingreso', monto: 365 },
    { tipo: 'ingreso', monto: 30 },
    { tipo: 'gasto', monto: 500 },
    { tipo: 'income', amount: 100 },
    { tipo: 'expense', amount: 50 },
  ];
  assert.equal(ingresoTransacciones(movimientos), 495);
});

/* ═════════════ 3. CASO NUMÉRICO: el pedido de Telegram de $395 ═════════════ */
grupo('3. Caso numérico: 1 pedido de Telegram por $395');

t('el dashboard muestra $395, NO $790', () => {
  // Lo que escribe el bot: 1 documento en `pedidos` + 2 transacciones
  const pedidos = [
    { origen: 'whatsapp', estado: 'Pendiente', total: 395, fechaMs: HOY },
  ];
  const transacciones = [
    { tipo: 'ingreso', monto: 365 }, // Ventas Delivery
    { tipo: 'ingreso', monto: 30 }, // Envíos
  ];

  const ingresosTransacciones = ingresoTransacciones(transacciones);
  const ingresosPedidos = ingresoPedidosWeb(pedidos, INICIO, FIN);
  const totalDashboard = ingresoTotalDelDashboard(transacciones, pedidos, INICIO, FIN);

  console.log(`        transacciones (lo que escribe el bot): $${ingresosTransacciones}`);
  console.log(`        pedidos web que suman:                $${ingresosPedidos}`);
  console.log(`        total del dashboard:                   $${totalDashboard}`);

  assert.equal(ingresosTransacciones, 395);
  assert.equal(ingresosPedidos, 0, 'el pedido del bot no debe sumar otra vez');
  assert.equal(totalDashboard, 395);

  // Comportamiento anterior (el bug): sumar el pedido del bot también
  const antesDelFix = ingresosTransacciones + 395;
  assert.equal(antesDelFix, 790, 'así se veía el doble conteo');
  assert.notEqual(totalDashboard, antesDelFix);
});

t('pedido web + pedido del bot en el mismo día', () => {
  const pedidos = [
    { origen: 'whatsapp', estado: 'Pendiente', total: 395, fechaMs: HOY },
    { origen: 'web', estado: 'Pendiente', total: 250, fechaMs: HOY },
  ];
  const transacciones = [
    { tipo: 'ingreso', monto: 365 },
    { tipo: 'ingreso', monto: 30 },
  ];
  // 395 (transacciones del bot) + 250 (pedido web) = 645
  assert.equal(ingresoTotalDelDashboard(transacciones, pedidos, INICIO, FIN), 645);
});

t('varios pedidos del bot sin transacciones no inventan ingreso', () => {
  const pedidos = [
    { origen: 'whatsapp', estado: 'Pendiente', total: 395, fechaMs: HOY },
    { origen: 'whatsapp', estado: 'Entregado', total: 480, fechaMs: HOY },
  ];
  assert.equal(ingresoTotalDelDashboard([], pedidos, INICIO, FIN), 0);
});

t('un pedido web cancelado no suma aunque no sea del bot', () => {
  const pedidos = [{ origen: 'web', estado: 'Cancelado', total: 300, fechaMs: HOY }];
  assert.equal(ingresoTotalDelDashboard([], pedidos, INICIO, FIN), 0);
});

/* ═════════════ 4. Descuento de inventario al vender ═════════════ */
grupo('4. Descuento automático de stock al registrar una venta');

/** Receta real de "Burger Especial": 150 g de Carne Sirloin por pieza. */
const RECETAS = [
  {
    productoId: 'burger-especial',
    activo: true,
    ingredientes: [
      { insumoId: 'carne-sirloin', cantidad: 150 },
      { insumoId: 'pan-brioche', cantidad: 1 },
    ],
  },
];

/** Aplica los movimientos como lo hace el writeBatch (`increment(-cantidad)`). */
function stockTrasVenta(stockInicial, movimientos, insumoId) {
  return movimientos
    .filter((movimiento) => movimiento.insumoId === insumoId)
    .reduce((stock, movimiento) => stock - movimiento.cantidad, stockInicial);
}

t('venta de "Burguer Especial" baja 150 g el stock de Carne Sirloin', () => {
  // El modal manda los productos explícitos al usar los botones rápidos.
  const lineas = resolverLineasVenta(
    { tipo: 'ingreso', productos: [{ productoId: 'burger-especial', cantidad: 1 }] },
    MENU_DATA
  );
  assert.deepEqual(lineas, [{ productoId: 'burger-especial', cantidad: 1 }]);

  const movimientos = movimientosStockVenta(lineas, RECETAS);
  const carne = movimientos.find((movimiento) => movimiento.insumoId === 'carne-sirloin');
  assert.equal(carne?.cantidad, 150);

  const stockFinal = stockTrasVenta(1000, movimientos, 'carne-sirloin');
  console.log(`        Carne Sirloin: 1000 g → ${stockFinal} g`);
  assert.equal(stockFinal, 850, '1000 g - 150 g = 850 g');
});

t('la venta escrita a mano también descuenta por descripción', () => {
  const lineas = resolverLineasVenta(
    { tipo: 'ingreso', descripcion: '2× Burguer Especial' },
    MENU_DATA
  );
  assert.deepEqual(lineas, [{ productoId: 'burger-especial', cantidad: 2 }]);

  const movimientos = movimientosStockVenta(lineas, RECETAS);
  assert.equal(stockTrasVenta(1000, movimientos, 'carne-sirloin'), 700);
});

t('un gasto nunca descuenta stock y una receta inexistente no rompe la venta', () => {
  const gasto = resolverLineasVenta(
    { tipo: 'gasto', descripcion: '2× Burguer Especial' },
    MENU_DATA
  );
  assert.deepEqual(gasto, []);

  const sinReceta = resolverLineasVenta(
    { tipo: 'ingreso', productos: [{ productoId: 'extra-papas', cantidad: 3 }] },
    MENU_DATA
  );
  assert.deepEqual(movimientosStockVenta(sinReceta, RECETAS), []);
});

t('las cantidades del mismo insumo se agrupan en un solo movimiento', () => {
  const lineas = resolverLineasVenta(
    {
      tipo: 'ingreso',
      productos: [
        { productoId: 'burger-especial', cantidad: 2 },
        { productoId: 'burger-especial', cantidad: 1 },
      ],
    },
    MENU_DATA
  );
  const movimientos = movimientosStockVenta(lineas, RECETAS);
  assert.equal(movimientos.length, 2, 'carne + pan, sin duplicados');
  assert.equal(stockTrasVenta(1000, movimientos, 'carne-sirloin'), 550);
});

console.log(`\n${pass} OK / ${fail} FALLAS`);
