/**
 * Tests puros de periodos y etiquetas de fecha.
 *
 * Ejecutar:  npm run test:fechas
 *
 * Sin Firebase ni React: Node importa `src/lib/fechas.ts` directamente.
 * TZ esperada: America/Mexico_City (UTC-6) — se fija en el script de npm.
 */
import assert from 'node:assert/strict';
import {
  formatPeriodoLabel,
  rangoDePeriodo,
  estaEnPeriodo,
} from '../src/lib/fechas.ts';

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

const f = (y, m, d, h = 0, min = 0, s = 0, ms = 0) => new Date(y, m - 1, d, h, min, s, ms);
const AHORA = f(2026, 10, 12, 15, 30); // lunes 12 de octubre de 2026, 3:30 pm

/* ─────────── 1. rangoDePeriodo ─────────── */
grupo('1. rangoDePeriodo');

t('day 0 = hoy de 00:00 a 23:59:59.999', () => {
  const [ini, fin] = rangoDePeriodo('day', 0, AHORA);
  assert.equal(ini, f(2026, 10, 12).getTime());
  assert.equal(fin, f(2026, 10, 12, 23, 59, 59, 999).getTime());
  assert.equal(new Date(ini).getHours(), 0);
  assert.equal(new Date(fin).getMinutes(), 59);
});

t('day -1 = ayer completo', () => {
  const [ini, fin] = rangoDePeriodo('day', -1, AHORA);
  assert.equal(ini, f(2026, 10, 11).getTime());
  assert.equal(fin, f(2026, 10, 11, 23, 59, 59, 999).getTime());
});

t('day -1 cruzando mes (1 de noviembre → 31 de octubre)', () => {
  const [ini, fin] = rangoDePeriodo('day', -1, f(2026, 11, 1, 10, 0));
  assert.equal(ini, f(2026, 10, 31).getTime());
  assert.equal(fin, f(2026, 10, 31, 23, 59, 59, 999).getTime());
});

t('week 0 empieza en LUNES y termina en domingo', () => {
  const [ini, fin] = rangoDePeriodo('week', 0, AHORA);
  assert.equal(ini, f(2026, 10, 12).getTime());
  assert.equal(fin, f(2026, 10, 18, 23, 59, 59, 999).getTime());
  assert.equal(new Date(ini).getDay(), 1, 'el inicio debe ser lunes');
  assert.equal(new Date(fin).getDay(), 0, 'el fin debe ser domingo');
  assert.equal(Math.round((fin - ini) / 86_400_000), 7, 'deben ser 7 días');
});

t('week 0 es la misma si se consulta a mitad de semana', () => {
  const [a] = rangoDePeriodo('week', 0, f(2026, 10, 14, 9, 0)); // miércoles
  const [b] = rangoDePeriodo('week', 0, AHORA); // lunes
  assert.equal(a, b);
});

t('week 0 cuando el lunes cae en el mes anterior', () => {
  const [ini, fin] = rangoDePeriodo('week', 0, f(2026, 10, 2, 12, 0)); // viernes 2 oct
  assert.equal(ini, f(2026, 9, 28).getTime(), 'lunes 28 de septiembre');
  assert.equal(new Date(fin).getDate(), 4);
  assert.equal(new Date(fin).getMonth(), 9, 'octubre');
});

t('week -1 = semana pasada completa', () => {
  const [ini, fin] = rangoDePeriodo('week', -1, AHORA);
  assert.equal(ini, f(2026, 10, 5).getTime());
  assert.equal(fin, f(2026, 10, 11, 23, 59, 59, 999).getTime());
});

t('month 0 = del 1º al último día del mes', () => {
  const [ini, fin] = rangoDePeriodo('month', 0, AHORA);
  assert.equal(ini, f(2026, 10, 1).getTime());
  assert.equal(fin, f(2026, 10, 31, 23, 59, 59, 999).getTime());
});

t('month -1 = mes anterior completo', () => {
  const [ini, fin] = rangoDePeriodo('month', -1, AHORA);
  assert.equal(ini, f(2026, 9, 1).getTime());
  assert.equal(fin, f(2026, 9, 30, 23, 59, 59, 999).getTime());
});

t('month -3 = hace 3 meses (julio)', () => {
  const [ini, fin] = rangoDePeriodo('month', -3, AHORA);
  assert.equal(ini, f(2026, 7, 1).getTime());
  assert.equal(fin, f(2026, 7, 31, 23, 59, 59, 999).getTime());
});

t('month -1 de enero cae en diciembre del año anterior', () => {
  const [ini, fin] = rangoDePeriodo('month', -1, f(2026, 1, 15));
  assert.equal(ini, f(2025, 12, 1).getTime());
  assert.equal(fin, f(2025, 12, 31, 23, 59, 59, 999).getTime());
});

t('month 0 en febrero respeta 28 días', () => {
  const [ini, fin] = rangoDePeriodo('month', 0, f(2026, 2, 10));
  assert.equal(ini, f(2026, 2, 1).getTime());
  assert.equal(new Date(fin).getDate(), 28);
});

t('quarter 0 = 3 meses calendario (oct-dic)', () => {
  const [ini, fin] = rangoDePeriodo('quarter', 0, AHORA);
  assert.equal(ini, f(2026, 10, 1).getTime());
  assert.equal(fin, f(2026, 12, 31, 23, 59, 59, 999).getTime());
});

t('quarter 0 en febrero = ene-mar', () => {
  const [ini, fin] = rangoDePeriodo('quarter', 0, f(2026, 2, 20));
  assert.equal(ini, f(2026, 1, 1).getTime());
  assert.equal(fin, f(2026, 3, 31, 23, 59, 59, 999).getTime());
});

t('quarter -1 = trimestre anterior (jul-sep)', () => {
  const [ini, fin] = rangoDePeriodo('quarter', -1, AHORA);
  assert.equal(ini, f(2026, 7, 1).getTime());
  assert.equal(fin, f(2026, 9, 30, 23, 59, 59, 999).getTime());
});

t('quarter -1 en el primer trimestre cae en el año anterior', () => {
  const [ini, fin] = rangoDePeriodo('quarter', -1, f(2026, 2, 20));
  assert.equal(ini, f(2025, 10, 1).getTime());
  assert.equal(fin, f(2025, 12, 31, 23, 59, 59, 999).getTime());
});

t('year 0 = 1 ene a 31 dic', () => {
  const [ini, fin] = rangoDePeriodo('year', 0, AHORA);
  assert.equal(ini, f(2026, 1, 1).getTime());
  assert.equal(fin, f(2026, 12, 31, 23, 59, 59, 999).getTime());
});

t('year -1 = año anterior completo', () => {
  const [ini, fin] = rangoDePeriodo('year', -1, AHORA);
  assert.equal(ini, f(2025, 1, 1).getTime());
  assert.equal(fin, f(2025, 12, 31, 23, 59, 59, 999).getTime());
});

t('all = [0, ahora] e ignora el offset', () => {
  const [ini, fin] = rangoDePeriodo('all', -5, AHORA);
  assert.equal(ini, 0);
  assert.equal(fin, AHORA.getTime());
});

/* ─────────── 2. estaEnPeriodo ─────────── */
grupo('2. estaEnPeriodo');

t('day: el último milisegundo del día entra y el primero del siguiente no', () => {
  assert.equal(estaEnPeriodo(f(2026, 10, 12, 23, 59, 59, 999).getTime(), 'day', 0, AHORA), true);
  assert.equal(estaEnPeriodo(f(2026, 10, 13, 0, 0, 0, 0).getTime(), 'day', 0, AHORA), false);
  assert.equal(estaEnPeriodo(f(2026, 10, 12, 0, 0, 0, 0).getTime(), 'day', 0, AHORA), true);
});

t('week: domingo entra, lunes siguiente no', () => {
  assert.equal(estaEnPeriodo(f(2026, 10, 18, 23, 0).getTime(), 'week', 0, AHORA), true);
  assert.equal(estaEnPeriodo(f(2026, 10, 19, 0, 1).getTime(), 'week', 0, AHORA), false);
  assert.equal(estaEnPeriodo(f(2026, 10, 11, 23, 0).getTime(), 'week', 0, AHORA), false);
});

t('month -1 incluye septiembre y excluye octubre', () => {
  assert.equal(estaEnPeriodo(f(2026, 9, 15).getTime(), 'month', -1, AHORA), true);
  assert.equal(estaEnPeriodo(f(2026, 10, 1).getTime(), 'month', -1, AHORA), false);
  assert.equal(estaEnPeriodo(f(2026, 8, 31).getTime(), 'month', -1, AHORA), false);
});

t('all siempre entra', () => {
  assert.equal(estaEnPeriodo(f(2020, 1, 1).getTime(), 'all', 0, AHORA), true);
  assert.equal(estaEnPeriodo(f(2030, 1, 1).getTime(), 'all', 0, AHORA), true);
});

/* ─────────── 3. formatPeriodoLabel ─────────── */
grupo('3. formatPeriodoLabel');

t('day 0 → "Hoy (12 Oct)"', () => assert.equal(formatPeriodoLabel('day', 0, AHORA), 'Hoy (12 Oct)'));
t('day -1 → "Ayer (11 Oct)"', () => assert.equal(formatPeriodoLabel('day', -1, AHORA), 'Ayer (11 Oct)'));
t('day -3 → "Vie 9 Oct"', () => assert.equal(formatPeriodoLabel('day', -3, AHORA), 'Vie 9 Oct'));
t('day +1 (futuro) → "Mar 13 Oct"', () =>
  assert.equal(formatPeriodoLabel('day', 1, AHORA), 'Mar 13 Oct'));

t('week 0 → "Esta semana (12-18 Oct)"', () =>
  assert.equal(formatPeriodoLabel('week', 0, AHORA), 'Esta semana (12-18 Oct)'));
t('week -1 → "Semana pasada (5-11 Oct)"', () =>
  assert.equal(formatPeriodoLabel('week', -1, AHORA), 'Semana pasada (5-11 Oct)'));
t('week -2 → "Semana del 28 Sep - 4 Oct" (cruzando mes)', () =>
  assert.equal(formatPeriodoLabel('week', -2, AHORA), 'Semana del 28 Sep - 4 Oct'));
t('week 0 cruzando año → incluye ambos años', () => {
  const label = formatPeriodoLabel('week', 0, f(2026, 1, 1, 12, 0)); // jueves 1 ene 2026
  assert.equal(label, 'Esta semana (29 Dic 2025 - 4 Ene 2026)');
});
t('week de otro año incluye el año en el rango', () =>
  assert.equal(formatPeriodoLabel('week', -60, AHORA), 'Semana del 18-24 Ago 2025'));

t('month 0 → "Octubre 2026"', () => assert.equal(formatPeriodoLabel('month', 0, AHORA), 'Octubre 2026'));
t('month -1 → "Septiembre 2026"', () =>
  assert.equal(formatPeriodoLabel('month', -1, AHORA), 'Septiembre 2026'));
t('month -12 → "Octubre 2025"', () =>
  assert.equal(formatPeriodoLabel('month', -12, AHORA), 'Octubre 2025'));

t('quarter 0 → "Este trimestre (Oct-Dic 2026)"', () =>
  assert.equal(formatPeriodoLabel('quarter', 0, AHORA), 'Este trimestre (Oct-Dic 2026)'));
t('quarter -1 → "Trimestre pasado (Jul-Sep 2026)"', () =>
  assert.equal(formatPeriodoLabel('quarter', -1, AHORA), 'Trimestre pasado (Jul-Sep 2026)'));
t('quarter -2 → "2º trimestre 2026 (Abr-Jun)"', () =>
  assert.equal(formatPeriodoLabel('quarter', -2, AHORA), '2º trimestre 2026 (Abr-Jun)'));

t('year 0 → "Este año (2026)"', () => assert.equal(formatPeriodoLabel('year', 0, AHORA), 'Este año (2026)'));
t('year -1 → "Año pasado (2025)"', () => assert.equal(formatPeriodoLabel('year', -1, AHORA), 'Año pasado (2025)'));
t('year -2 → "2024"', () => assert.equal(formatPeriodoLabel('year', -2, AHORA), '2024'));

t('all → "Todo el tiempo"', () => assert.equal(formatPeriodoLabel('all', -3, AHORA), 'Todo el tiempo'));

/* ─────────── 4. coherencia rango/etiqueta ─────────── */
grupo('4. Coherencia entre rango y etiqueta');

t('cada filtro con offset 0 contiene "ahora"', () => {
  for (const filtro of ['day', 'week', 'month', 'quarter', 'year', 'all']) {
    assert.equal(estaEnPeriodo(AHORA.getTime(), filtro, 0, AHORA), true, `${filtro} debería contener ahora`);
  }
});

t('offset -1 nunca contiene "ahora"', () => {
  for (const filtro of ['day', 'week', 'month', 'quarter', 'year']) {
    assert.equal(estaEnPeriodo(AHORA.getTime(), filtro, -1, AHORA), false, `${filtro} -1 no debería contener ahora`);
  }
});

t('los rangos son contiguos: el fin de un periodo no toca el inicio del anterior', () => {
  const [iniActual] = rangoDePeriodo('month', 0, AHORA);
  const [, finAnterior] = rangoDePeriodo('month', -1, AHORA);
  assert.ok(finAnterior < iniActual, 'el mes anterior termina antes de que empiece el actual');
  assert.equal(new Date(iniActual).getTime() - new Date(finAnterior).getTime(), 1, 'sin huecos');
});

console.log(`\n${pass} OK / ${fail} FALLAS`);
