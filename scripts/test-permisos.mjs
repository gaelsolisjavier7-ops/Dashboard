/**
 * Test de la lógica de permisos multi-usuario.
 *
 * Ejecutar:  npm run test:permisos
 *
 * No necesita dependencias nuevas: Node importa `src/lib/roles.ts` directamente
 * (type stripping nativo, Node >= 22.18). Cubre las dos cosas que se pidieron:
 *   1. resolución del rol para cada correo / documento de `usuarios`
 *   2. filtrado de pestañas, secciones (pills) y transacciones según el rol
 */
import assert from 'node:assert/strict';
import {
  ADMIN_HAMBURGUESAS_EMAIL,
  SUPER_ADMIN_EMAIL,
  filtrarTransaccionesPorRol,
  isEmailAllowed,
  negocioDeSeccion,
  normalizarEmail,
  normalizarRol,
  puedeVerNegocio,
  puedeVerSeccion,
  puedeVerTab,
  rolDesdeDocumento,
  seccionInicial,
  seccionesDisponibles,
  tabsDisponibles,
} from '../src/lib/roles.ts';

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

/* ─────────────── 1. whitelist de correos ─────────────── */
grupo('1. Whitelist de correos');
t('el super admin está permitido', () => assert.equal(isEmailAllowed(SUPER_ADMIN_EMAIL), true));
t('el socio está permitido', () => assert.equal(isEmailAllowed(ADMIN_HAMBURGUESAS_EMAIL), true));
t('un correo externo NO está permitido', () => assert.equal(isEmailAllowed('intruso@gmail.com'), false));
t('tolera mayúsculas y espacios', () =>
  assert.equal(isEmailAllowed('  GAELSOLISJAVIER7@GMAIL.COM '), true));
t('correo vacío o nulo NO está permitido', () => {
  assert.equal(isEmailAllowed(''), false);
  assert.equal(isEmailAllowed(null), false);
  assert.equal(isEmailAllowed(undefined), false);
});
t('normalizarEmail recorta y baja a minúsculas', () =>
  assert.equal(normalizarEmail(' JCMISSDJ@Gmail.com '), ADMIN_HAMBURGUESAS_EMAIL));

/* ─────────────── 2. resolución del rol (useUsuario) ─────────────── */
grupo('2. Rol a partir del documento usuarios/{email}');
t(`usuarios/${SUPER_ADMIN_EMAIL} con {rol:'super_admin'} → super_admin`, () =>
  assert.equal(rolDesdeDocumento({ rol: 'super_admin' }), 'super_admin'));
t(`usuarios/${ADMIN_HAMBURGUESAS_EMAIL} con {role:'admin_hamburguesas'} → admin_hamburguesas`, () =>
  assert.equal(rolDesdeDocumento({ role: 'admin_hamburguesas' }), 'admin_hamburguesas'));
t("tolera el campo 'tipo'", () => assert.equal(rolDesdeDocumento({ tipo: 'admin_hamburguesas' }), 'admin_hamburguesas'));
t("tolera el campo 'perfil'", () => assert.equal(rolDesdeDocumento({ perfil: 'super_admin' }), 'super_admin'));
t('tolera variantes de escritura', () => {
  assert.equal(rolDesdeDocumento({ rol: 'Super Admin' }), 'super_admin');
  assert.equal(rolDesdeDocumento({ rol: ' SUPERADMIN ' }), 'super_admin');
  assert.equal(rolDesdeDocumento({ rol: 'ADMIN-HAMBURGUESAS' }), 'admin_hamburguesas');
});
t('un rol desconocido devuelve null (→ pantalla "pendiente de activación")', () => {
  assert.equal(rolDesdeDocumento({ rol: 'invitado' }), null);
  assert.equal(normalizarRol('contador'), null);
});
t('un documento sin campo de rol devuelve null', () => {
  assert.equal(rolDesdeDocumento({}), null);
  assert.equal(rolDesdeDocumento(null), null);
  assert.equal(rolDesdeDocumento(undefined), null);
});
t('el rol se resuelve igual para los dos correos (docId = email)', () => {
  const docs = {
    [SUPER_ADMIN_EMAIL]: { rol: 'super_admin' },
    [ADMIN_HAMBURGUESAS_EMAIL]: { rol: 'admin_hamburguesas' },
  };
  for (const [email, datos] of Object.entries(docs)) {
    assert.equal(isEmailAllowed(email), true, `${email} debería estar en la whitelist`);
    assert.notEqual(rolDesdeDocumento(datos), null, `${email} debería resolver un rol`);
  }
});

/* ─────────────── 3. pestañas por rol ─────────────── */
grupo('3. Pestañas (header y bottom nav)');
t('super_admin ve dashboard, flujo y lista', () =>
  assert.deepEqual(tabsDisponibles('super_admin'), ['dashboard', 'cashflow', 'transactions']));
t('el socio ve dashboard y lista, NO flujo', () =>
  assert.deepEqual(tabsDisponibles('admin_hamburguesas'), ['dashboard', 'transactions']));
t('el socio no puede abrir Flujo de Caja', () => {
  assert.equal(puedeVerTab('admin_hamburguesas', 'cashflow'), false);
  assert.equal(puedeVerTab('admin_hamburguesas', 'dashboard'), true);
  assert.equal(puedeVerTab('admin_hamburguesas', 'transactions'), true);
});
t('sin rol no hay pestañas', () => assert.deepEqual(tabsDisponibles(null), []));

/* ─────────────── 4. secciones / pills por rol ─────────────── */
grupo('4. Secciones (pills)');
t('super_admin ve las 6 secciones en orden', () =>
  assert.deepEqual(seccionesDisponibles('super_admin'), [
    'all',
    'personal',
    'hamburguesas',
    'airpods',
    'insumos',
    'recetas',
  ]));
t('el socio ve Hamburguesas, Insumos y Recetas', () =>
  assert.deepEqual(seccionesDisponibles('admin_hamburguesas'), ['hamburguesas', 'insumos', 'recetas']));
t('el socio NO ve Consolidado, Personal ni AirPods', () => {
  for (const seccion of ['all', 'personal', 'airpods']) {
    assert.equal(puedeVerSeccion('admin_hamburguesas', seccion), false, `no debería ver ${seccion}`);
  }
});
t('el super admin ve todo', () => {
  for (const seccion of ['all', 'personal', 'hamburguesas', 'airpods', 'insumos', 'recetas']) {
    assert.equal(puedeVerSeccion('super_admin', seccion), true, `debería ver ${seccion}`);
  }
});
t('sin rol no puede ver ninguna sección', () =>
  assert.equal(puedeVerSeccion(null, 'hamburguesas'), false));
t('la sección inicial del socio es Hamburguesas', () =>
  assert.equal(seccionInicial('admin_hamburguesas'), 'hamburguesas'));
t('la sección inicial del super admin es Consolidado', () => assert.equal(seccionInicial('super_admin'), 'all'));

/* ─────────────── 5. filtrado de transacciones ─────────────── */
grupo('5. Filtrado de transacciones por negocio');
const transacciones = [
  { id: 'tx-1', negocio: 'hamburguesas', monto: 1500 },
  { id: 'tx-2', negocio: 'personal', monto: 9000 },
  { id: 'tx-3', negocio: 'airpods', monto: 4200 },
  { id: 'tx-4', entity: 'hamburguesas', monto: 300 }, // formato legacy
  { id: 'tx-5', entity: 'personal', monto: 50 }, // formato legacy
];

t('el socio sólo recibe movimientos de hamburguesas', () =>
  assert.deepEqual(
    filtrarTransaccionesPorRol('admin_hamburguesas', transacciones).map((tx) => tx.id),
    ['tx-1', 'tx-4']
  ));
t('el socio no ve ningún importe de Personal ni AirPods', () => {
  const visibles = filtrarTransaccionesPorRol('admin_hamburguesas', transacciones);
  assert.equal(visibles.some((tx) => (tx.negocio || tx.entity) === 'personal'), false);
  assert.equal(visibles.some((tx) => (tx.negocio || tx.entity) === 'airpods'), false);
  const total = visibles.reduce((acc, tx) => acc + tx.monto, 0);
  assert.equal(total, 1800);
});
t('el super admin recibe todas', () =>
  assert.equal(filtrarTransaccionesPorRol('super_admin', transacciones).length, transacciones.length));
t('sin rol no recibe ninguna', () =>
  assert.deepEqual(filtrarTransaccionesPorRol(null, transacciones), []));
t('puedeVerNegocio: socio sólo hamburguesas', () => {
  assert.equal(puedeVerNegocio('admin_hamburguesas', 'hamburguesas'), true);
  assert.equal(puedeVerNegocio('admin_hamburguesas', 'personal'), false);
  assert.equal(puedeVerNegocio('admin_hamburguesas', 'airpods'), false);
});
t('una transacción sin negocio ni entity se trata como personal (oculta al socio)', () =>
  assert.deepEqual(filtrarTransaccionesPorRol('admin_hamburguesas', [{ id: 'x' }]), []));
t('negocioDeSeccion mapea sólo las secciones de negocio', () => {
  assert.equal(negocioDeSeccion('hamburguesas'), 'hamburguesas');
  assert.equal(negocioDeSeccion('personal'), 'personal');
  assert.equal(negocioDeSeccion('airpods'), 'airpods');
  assert.equal(negocioDeSeccion('all'), null);
  assert.equal(negocioDeSeccion('insumos'), null);
  assert.equal(negocioDeSeccion('recetas'), null);
});

console.log(`\n${pass} OK / ${fail} FALLAS`);
