/**
 * Tests puros del costeo de insumos y recetas.
 *
 * Ejecutar:  npm run test:insumos
 *
 * Sin Firebase ni React: Node importa `src/lib/costeo.ts` y `src/lib/products.ts`
 * directamente (type stripping nativo, Node >= 22.18).
 */
import assert from 'node:assert/strict';
import {
  PORCION_PAPAS_G,
  calcularCostoUnidadBase,
  calcularMargen,
  calcularReceta,
  colorMargen,
  construirIngredientesSnapshot,
  costoIngrediente,
  costoPorcionPapas,
  formatCostoUnitario,
  formatMXN,
  insumoPapas,
  promediosRecetas,
  resolverConversion,
  stockBajo,
  unidadesBaseDeCompra,
  valorInventario,
} from '../src/lib/costeo.ts';
import { MENU_DATA, getProducto, precioVentaProducto } from '../src/lib/products.ts';

let pass = 0;
let fail = 0;
const grupo = (t) => console.log(`\n── ${t} ──`);
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
const casi = (actual, esperado, tolerancia = 0.0001) =>
  assert.ok(
    Math.abs(actual - esperado) <= tolerancia,
    `esperado ${esperado} ± ${tolerancia}, obtenido ${actual}`
  );

/* ─────────── 1. costoUnidadBase por tipo de unidad ─────────── */
grupo('1. costoUnidadBase según unidad de compra');

t('kg → g con factor 1000', () => {
  const { unidadBase, factorConversion } = resolverConversion('kg');
  assert.equal(unidadBase, 'g');
  assert.equal(factorConversion, 1000);
});
t('litro → ml con factor 1000', () => {
  const { unidadBase, factorConversion } = resolverConversion('litro');
  assert.equal(unidadBase, 'ml');
  assert.equal(factorConversion, 1000);
});
t('pza → pza con factor 1', () => {
  const { unidadBase, factorConversion } = resolverConversion('pza');
  assert.equal(unidadBase, 'pza');
  assert.equal(factorConversion, 1);
});
t('paquete → pza con factor = piezas indicadas', () => {
  const { unidadBase, factorConversion } = resolverConversion('paquete', 24);
  assert.equal(unidadBase, 'pza');
  assert.equal(factorConversion, 24);
});
t('paquete sin piezas → factor 0 (no se inventa un costo)', () => {
  assert.equal(resolverConversion('paquete').factorConversion, 0);
  assert.equal(calcularCostoUnidadBase(120, 1, 0), 0);
});

t('kg: 5 kg a $450 → $0.09 por gramo', () => {
  const { factorConversion } = resolverConversion('kg');
  casi(calcularCostoUnidadBase(450, 5, factorConversion), 0.09, 1e-6);
});
t('litro: 1 L de aceite a $35 → $0.035 por ml', () => {
  const { factorConversion } = resolverConversion('litro');
  casi(calcularCostoUnidadBase(35, 1, factorConversion), 0.035, 1e-6);
});
t('pza: 30 panes a $90 → $3.00 por pieza', () => {
  const { factorConversion } = resolverConversion('pza');
  casi(calcularCostoUnidadBase(90, 30, factorConversion), 3, 1e-6);
});
t('paquete: 2 paquetes de 24 (48 pzas) a $120 → $2.50 por pieza', () => {
  const { factorConversion } = resolverConversion('paquete', 24);
  casi(calcularCostoUnidadBase(120, 2, factorConversion), 2.5, 1e-6);
});
t('carne preformada en bolsa: 10 medallones a $320 → $32 por medallón', () => {
  const { factorConversion } = resolverConversion('paquete', 10);
  casi(calcularCostoUnidadBase(320, 1, factorConversion), 32, 1e-6);
});
t('unidadesBaseDeCompra: 5 kg = 5000 g', () => {
  assert.equal(unidadesBaseDeCompra(5, 1000), 5000);
});
t('sin cantidad o precio no hay división por cero', () => {
  assert.equal(calcularCostoUnidadBase(100, 0, 1000), 0);
  assert.equal(calcularCostoUnidadBase(0, 5, 1000), 0);
});

/* ─────────── insumos de prueba para las recetas ─────────── */
const insumos = [
  { id: 'carne', nombre: 'Carne molida de res', categoria: 'Carne', unidadBase: 'g', costoUnidadBase: 0.09, stockActual: 5000, stockMinimo: 1000 },
  { id: 'pan', nombre: 'Pan brioche', categoria: 'Panadería', unidadBase: 'pza', costoUnidadBase: 3, stockActual: 30, stockMinimo: 10 },
  { id: 'tocino', nombre: 'Tocineta doquera', categoria: 'Extras', unidadBase: 'g', costoUnidadBase: 0.18, stockActual: 2000, stockMinimo: 500 },
  { id: 'queso', nombre: 'Queso amarillo', categoria: 'Quesos', unidadBase: 'g', costoUnidadBase: 0.12, stockActual: 800, stockMinimo: 300 },
  { id: 'papas', nombre: 'Papas lisa europea', categoria: 'Papas', unidadBase: 'g', costoUnidadBase: 0.04, stockActual: 10000, stockMinimo: 2000 },
  { id: 'parmesano', nombre: 'Queso parmesano', categoria: 'Quesos', unidadBase: 'g', costoUnidadBase: 0.3, stockActual: 200, stockMinimo: 50 },
  { id: 'inactivo', nombre: 'Insumo de prueba', categoria: 'Papas', unidadBase: 'g', costoUnidadBase: 99, stockActual: 0, stockMinimo: 0, activo: false },
];

/* ─────────── 2. costo de receta con varios ingredientes ─────────── */
grupo('2. Costo total de una receta');

const recetaEspecial = [
  { insumoId: 'carne', cantidad: 150 }, // 150 g × 0.09   = 13.50
  { insumoId: 'pan', cantidad: 1 }, //     1 pza × 3     =  3.00
  { insumoId: 'tocino', cantidad: 40 }, // 40 g × 0.18   =  7.20
  { insumoId: 'queso', cantidad: 30 }, //  30 g × 0.12   =  3.60
]; // total 27.30

t('costoIngrediente = cantidad × costoUnidadBase', () => {
  casi(costoIngrediente(insumos[0], 150), 13.5, 1e-6);
  casi(costoIngrediente(insumos[1], 1), 3, 1e-6);
});
t('receta de 4 ingredientes suma $27.30', () => {
  const r = calcularReceta({ ingredientes: recetaEspecial, insumos, precioVenta: 150 });
  casi(r.costoIngredientes, 27.3, 0.001);
  casi(r.costoTotal, 27.3, 0.001);
});
t('un insumo inexistente cuesta 0 (no rompe la receta)', () => {
  const r = calcularReceta({
    ingredientes: [...recetaEspecial, { insumoId: 'no-existe', cantidad: 100 }],
    insumos,
    precioVenta: 150,
  });
  casi(r.costoTotal, 27.3, 0.001);
});
t('cantidades en 0 no suman', () => {
  const r = calcularReceta({ ingredientes: [{ insumoId: 'carne', cantidad: 0 }], insumos, precioVenta: 100 });
  casi(r.costoTotal, 0, 0.001);
});

/* ─────────── 3. margen en $ y % ─────────── */
grupo('3. Margen en pesos y porcentaje');

t('costo 27.30 con precio 150 → ganancia $122.70 y 81.8 %', () => {
  const { ganancia, margenPct } = calcularMargen(27.3, 150);
  casi(ganancia, 122.7, 0.001);
  casi(margenPct, 81.8, 0.05);
});
t('costo 70 con precio 100 → ganancia $30 y 30 %', () => {
  const { ganancia, margenPct } = calcularMargen(70, 100);
  casi(ganancia, 30, 0.001);
  casi(margenPct, 30, 0.05);
});
t('precio 0 no divide por cero', () => {
  const { ganancia, margenPct } = calcularMargen(20, 0);
  casi(ganancia, -20, 0.001);
  assert.equal(margenPct, 0);
});
t('producto que se vende bajo costo da margen negativo', () => {
  const { ganancia, margenPct } = calcularMargen(60, 50);
  casi(ganancia, -10, 0.001);
  casi(margenPct, -20, 0.05);
});

/* ─────────── 4. incluyePapas ─────────── */
grupo('4. Switch "incluye papas" (150 g)');

t(`la porción son ${PORCION_PAPAS_G} g de la categoría Papas`, () => {
  assert.equal(insumoPapas(insumos)?.id, 'papas');
  casi(costoPorcionPapas(insumos), 150 * 0.04, 0.001); // $6.00
});
t('incluyePapas suma exactamente $6.00 al costo', () => {
  const sin = calcularReceta({ ingredientes: recetaEspecial, insumos, precioVenta: 150, incluyePapas: false });
  const con = calcularReceta({ ingredientes: recetaEspecial, insumos, precioVenta: 150, incluyePapas: true });
  casi(con.costoPapas, 6, 0.001);
  casi(con.costoTotal - sin.costoTotal, 6, 0.001);
  casi(con.costoTotal, 33.3, 0.001);
});
t('ignora insumos de categoría Papas inactivos', () => {
  const soloInactivo = insumos.filter((i) => i.id === 'inactivo');
  assert.equal(insumoPapas(soloInactivo), null);
  casi(costoPorcionPapas(soloInactivo), 0, 0.001);
});
t('sin insumo de papas el switch no suma nada (y no rompe)', () => {
  const sinPapas = insumos.filter((i) => i.categoria !== 'Papas');
  const r = calcularReceta({ ingredientes: recetaEspecial, insumos: sinPapas, precioVenta: 150, incluyePapas: true });
  casi(r.costoPapas, 0, 0.001);
  casi(r.costoTotal, 27.3, 0.001);
});
t('permite otro gramaje de papas', () => {
  const r = calcularReceta({ ingredientes: [], insumos, precioVenta: 40, incluyePapas: true, gramosPapas: 100 });
  casi(r.costoPapas, 4, 0.001);
});
t('usa el precio con papas del hot dog cuando corresponde', () => {
  assert.equal(precioVentaProducto('hotdog-tocino', true), 75);
  assert.equal(precioVentaProducto('hotdog-tocino', false), 65);
  const r = calcularReceta({
    ingredientes: [{ insumoId: 'carne', cantidad: 0 }],
    insumos,
    precioVenta: precioVentaProducto('hotdog-tocino', true),
    incluyePapas: true,
  });
  casi(r.precioVenta, 75, 0.001);
  casi(r.costoTotal, 6, 0.001);
  casi(r.margenPct, 92, 0.1);
});

/* ─────────── 5. color del badge de margen ─────────── */
grupo('5. Color del badge según margen');

t('≥ 50 % → verde', () => {
  assert.equal(colorMargen(50), 'verde');
  assert.equal(colorMargen(81.8), 'verde');
  assert.equal(colorMargen(100), 'verde');
});
t('30–49.9 % → amarillo', () => {
  assert.equal(colorMargen(30), 'amarillo');
  assert.equal(colorMargen(45.5), 'amarillo');
  assert.equal(colorMargen(49.9), 'amarillo');
});
t('< 30 % → rojo', () => {
  assert.equal(colorMargen(29.9), 'rojo');
  assert.equal(colorMargen(0), 'rojo');
  assert.equal(colorMargen(-20), 'rojo');
});
t('calcularReceta devuelve el color coherente con su margen', () => {
  const barato = calcularReceta({ ingredientes: [{ insumoId: 'pan', cantidad: 1 }], insumos, precioVenta: 100 });
  assert.equal(barato.color, 'verde'); // 3 de costo / 100
  const caro = calcularReceta({ ingredientes: [{ insumoId: 'pan', cantidad: 26 }], insumos, precioVenta: 100 });
  assert.equal(caro.color, 'rojo'); // 78 de costo / 100 → 22 %
});

/* ─────────── extras: snapshot, inventario y resumen ─────────── */
grupo('6. Snapshots, inventario y promedios');

t('construirIngredientesSnapshot congela el costo del momento', () => {
  const snap = construirIngredientesSnapshot(recetaEspecial, insumos);
  assert.equal(snap.length, 4);
  assert.equal(snap[0].insumoNombre, 'Carne molida de res');
  casi(snap[0].costoUnitarioSnapshot, 0.09, 1e-6);
  casi(snap[0].costoTotal, 13.5, 0.001);
  assert.equal(snap.reduce((a, s) => a + s.costoTotal, 0).toFixed(2), '27.30');
});
t('el snapshot ignora líneas vacías o en cero', () => {
  const snap = construirIngredientesSnapshot(
    [{ insumoId: 'carne', cantidad: 0 }, { insumoId: '', cantidad: 50 }],
    insumos
  );
  assert.equal(snap.length, 0);
});
t('valorInventario = Σ stock × costoUnidadBase', () => {
  casi(valorInventario([insumos[0], insumos[1]]), 5000 * 0.09 + 30 * 3, 0.01); // 450 + 90
});
t('stockBajo sólo cuando hay mínimo definido', () => {
  assert.equal(stockBajo({ id: 'x', nombre: 'x', costoUnidadBase: 1, stockActual: 5, stockMinimo: 10 }), true);
  assert.equal(stockBajo({ id: 'x', nombre: 'x', costoUnidadBase: 1, stockActual: 50, stockMinimo: 10 }), false);
  assert.equal(stockBajo({ id: 'x', nombre: 'x', costoUnidadBase: 1, stockActual: 0, stockMinimo: 0 }), false);
});
t('promediosRecetas promedia costo y margen de las recetas existentes', () => {
  const r = promediosRecetas({
    recetas: [
      { productoId: 'burger-especial', ingredientes: recetaEspecial, incluyePapas: false }, // costo 27.30, precio 150
      { productoId: 'hotdog-tocino', ingredientes: [{ insumoId: 'pan', cantidad: 1 }], incluyePapas: true }, // 3+6=9, precio 75
    ],
    insumos,
    precioDe: (id, incluyePapas) => precioVentaProducto(id, incluyePapas),
  });
  assert.equal(r.conReceta, 2);
  casi(r.costoPromedio, (27.3 + 9) / 2, 0.01);
  casi(r.margenPromedio, (81.8 + 88) / 2, 0.2);
});
t('promediosRecetas sin recetas devuelve ceros', () => {
  assert.deepEqual(promediosRecetas({ recetas: [], insumos, precioDe: () => 0 }), {
    conReceta: 0,
    costoPromedio: 0,
    margenPromedio: 0,
    gananciaPromedio: 0,
  });
});
t('formatMXN usa el formato de precio del panel', () => {
  assert.equal(formatMXN(1234.5), '$1,234.50');
  assert.ok(formatMXN(0).startsWith('$'));
});
t('formatCostoUnitario da 4 decimales a los costos por gramo', () => {
  assert.equal(formatCostoUnitario(0.09), '$0.0900');
  assert.equal(formatCostoUnitario(0.04), '$0.0400');
  assert.equal(formatCostoUnitario(3), '$3.00');
  assert.equal(formatCostoUnitario(0), '$0.00');
});

/* ─────────── menú ─────────── */
grupo('7. MENÚ_DATA');

t('tiene los 10 productos con sus ids exactos', () => {
  assert.equal(MENU_DATA.length, 10);
  for (const id of [
    'burger-sencilla',
    'burger-tocino',
    'burger-hawaiana',
    'burger-especial',
    'hotdog-sencillo',
    'hotdog-queso',
    'hotdog-tocino',
    'hotdog-hawaiano',
    'hotdog-combinado',
    'extra-papas',
  ]) {
    assert.ok(getProducto(id), `falta ${id}`);
  }
});
t('precios de hamburguesas y hot dogs coinciden con el menú', () => {
  assert.equal(getProducto('burger-sencilla').precio, 100);
  assert.equal(getProducto('burger-especial').precio, 150);
  assert.equal(precioVentaProducto('hotdog-sencillo'), 40);
  assert.equal(precioVentaProducto('hotdog-sencillo', true), 50);
  assert.equal(precioVentaProducto('hotdog-combinado', true), 90);
  assert.equal(precioVentaProducto('extra-papas'), 50);
});
t('un producto inexistente devuelve precio 0', () => {
  assert.equal(precioVentaProducto('no-existe'), 0);
});

console.log(`\n${pass} OK / ${fail} FALLAS`);
