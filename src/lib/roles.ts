/**
 * Sistema de permisos multi-usuario del panel ENTRE 3.
 *
 * IMPORTANTE: este archivo es deliberadamente **puro** (cero imports de runtime,
 * sólo tipos) para que `scripts/test-permisos.mjs` pueda importarlo directo con
 * Node y verificar toda la lógica de roles sin Firebase ni React.
 * Si necesitas tipos desde otro módulo usa siempre `import type`.
 */

export type Rol = 'super_admin' | 'admin_hamburguesas';

/** Secciones del panel (cada una es una pill + una vista). */
export type SeccionId = 'all' | 'personal' | 'hamburguesas' | 'airpods' | 'insumos' | 'recetas';

/** Negocios reales: son las claves de `transacciones.negocio` y del cash flow. */
export type NegocioId = 'personal' | 'hamburguesas' | 'airpods';

/** Pestañas de la app (header de escritorio y bottom nav de móvil). */
export type TabId = 'dashboard' | 'cashflow' | 'transactions';

export const SUPER_ADMIN_EMAIL = 'gaelsolisjavier7@gmail.com';
export const ADMIN_HAMBURGUESAS_EMAIL = 'jcmissdj@gmail.com';

/** Whitelist. Cualquier otro correo se cierra sesión inmediatamente. */
export const CORREOS_PERMITIDOS: readonly string[] = [
  SUPER_ADMIN_EMAIL,
  ADMIN_HAMBURGUESAS_EMAIL,
];

export const ROL_LABEL: Record<Rol, string> = {
  super_admin: 'Super Admin',
  admin_hamburguesas: 'Admin Hamburguesas',
};

/** Orden canónico de las pills. */
export const SECCIONES_ORDEN: readonly SeccionId[] = [
  'all',
  'personal',
  'hamburguesas',
  'airpods',
  'insumos',
  'recetas',
];

export const SECCION_LABEL: Record<SeccionId, string> = {
  all: 'Consolidado',
  personal: 'Personal',
  hamburguesas: 'Hamburguesas',
  airpods: 'AirPods',
  insumos: 'Insumos',
  recetas: 'Recetas',
};

/** Secciones visibles por rol (el orden manda en el SubNav y en el test). */
export const SECCIONES_POR_ROL: Record<Rol, readonly SeccionId[]> = {
  super_admin: ['all', 'personal', 'hamburguesas', 'airpods', 'insumos', 'recetas'],
  admin_hamburguesas: ['hamburguesas', 'insumos', 'recetas'],
};

/** Negocios cuyos datos puede ver cada rol. */
export const NEGOCIOS_POR_ROL: Record<Rol, readonly NegocioId[]> = {
  super_admin: ['personal', 'hamburguesas', 'airpods'],
  admin_hamburguesas: ['hamburguesas'],
};

/** Pestañas visibles por rol. El socio no tiene Flujo de Caja (expone Personal/AirPods). */
export const TABS_POR_ROL: Record<Rol, readonly TabId[]> = {
  super_admin: ['dashboard', 'cashflow', 'transactions'],
  admin_hamburguesas: ['dashboard', 'transactions'],
};

export const TAB_LABEL: Record<TabId, string> = {
  dashboard: 'Dashboard',
  cashflow: 'Flujo de Caja',
  transactions: 'Transacciones',
};

/** Sección de negocio → negocio subyacente (Consolidado, Insumos y Recetas no mapean a ninguno). */
const SECCION_A_NEGOCIO: Partial<Record<SeccionId, NegocioId>> = {
  personal: 'personal',
  hamburguesas: 'hamburguesas',
  airpods: 'airpods',
};

/* ─────────────────────────────── helpers ─────────────────────────────── */

export function normalizarEmail(email?: string | null): string {
  return String(email ?? '')
    .trim()
    .toLowerCase();
}

export function isEmailAllowed(email?: string | null): boolean {
  const normalizado = normalizarEmail(email);
  return normalizado.length > 0 && CORREOS_PERMITIDOS.includes(normalizado);
}

/** Normaliza el valor de rol que venga de Firestore. Desconocido → null (falla cerrado). */
export function normalizarRol(valor: unknown): Rol | null {
  const v = String(valor ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

  if (!v) return null;

  if (
    v === 'super_admin' ||
    v === 'superadmin' ||
    v === 'super_administrador' ||
    v === 'super_admin_hamburguesas' ||
    v === 'owner' ||
    v === 'dueno' ||
    v === 'dueño'
  ) {
    return 'super_admin';
  }

  if (
    v === 'admin_hamburguesas' ||
    v === 'admin_hamburguesa' ||
    v === 'admin_hambur' ||
    v === 'hamburguesas' ||
    v === 'socio'
  ) {
    return 'admin_hamburguesas';
  }

  return null;
}

/**
 * Extrae el rol del documento `usuarios/{email}` tolerando el nombre del campo
 * (`rol`, `role`, `tipo`, `perfil`, `permiso`, `tipo_usuario`).
 */
export function rolDesdeDocumento(datos?: Record<string, unknown> | null): Rol | null {
  if (!datos) return null;
  const candidatos = [datos.rol, datos.role, datos.tipo, datos.perfil, datos.permiso, datos.tipo_usuario];
  for (const candidato of candidatos) {
    const rol = normalizarRol(candidato);
    if (rol) return rol;
  }
  return null;
}

export function seccionesDisponibles(rol: Rol | null): SeccionId[] {
  if (!rol) return [];
  return [...SECCIONES_POR_ROL[rol]];
}

export function puedeVerSeccion(rol: Rol | null, seccion: SeccionId): boolean {
  if (!rol) return false;
  return SECCIONES_POR_ROL[rol].includes(seccion);
}

/** Sección a la que se entra por defecto (y a la que se redirige sin permiso). */
export function seccionInicial(rol: Rol | null): SeccionId {
  if (!rol) return 'hamburguesas';
  return SECCIONES_POR_ROL[rol][0] ?? 'hamburguesas';
}

export function tabsDisponibles(rol: Rol | null): TabId[] {
  if (!rol) return [];
  return [...TABS_POR_ROL[rol]];
}

export function puedeVerTab(rol: Rol | null, tab: TabId): boolean {
  if (!rol) return false;
  return TABS_POR_ROL[rol].includes(tab);
}

export function puedeVerNegocio(rol: Rol | null, negocio: NegocioId | string | null | undefined): boolean {
  if (!rol) return false;
  return (NEGOCIOS_POR_ROL[rol] as readonly string[]).includes(String(negocio ?? 'personal'));
}

/** Negocio subyacente de una sección (null para Consolidado / Insumos / Recetas). */
export function negocioDeSeccion(seccion: SeccionId): NegocioId | null {
  return SECCION_A_NEGOCIO[seccion] ?? null;
}

/**
 * Filtra transacciones según el rol. Es la única puerta por la que el frontend
 * del socio puede ver movimientos: sólo `negocio === 'hamburguesas'`.
 */
export function filtrarTransaccionesPorRol<T extends { negocio?: string | null; entity?: string | null }>(
  rol: Rol | null,
  transacciones: readonly T[]
): T[] {
  if (!rol) return [];
  return transacciones.filter((tx) => puedeVerNegocio(rol, tx.negocio || tx.entity || 'personal'));
}
