/**
 * Sistema de permisos multi-usuario del panel ENTRE 3.
 *
 * Fase 2: el sistema quedó enfocado 100% en el negocio de hamburguesas.
 * Ya no existen secciones, pestañas ni negocios de "Personal", "AirPods"
 * o "Flujo de Caja".
 *
 * IMPORTANTE: este archivo es deliberadamente **puro** (cero imports de runtime,
 * sólo tipos) para que `scripts/test-permisos.mjs` pueda importarlo directo con
 * Node y verificar toda la lógica de roles sin Firebase ni React.
 * Si necesitas tipos desde otro módulo usa siempre `import type`.
 */

export type Rol = 'super_admin' | 'admin_hamburguesas';

/** Secciones del panel (cada una es una pill + una vista). */
export type SeccionId = 'hamburguesas' | 'insumos' | 'recetas';

/** Único negocio real: clave de `transacciones.negocio`. */
export type NegocioId = 'hamburguesas';

/** Pestañas de la app (header de escritorio y bottom nav de móvil). */
export type TabId = 'dashboard' | 'transactions';

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
  'hamburguesas',
  'insumos',
  'recetas',
];

export const SECCION_LABEL: Record<SeccionId, string> = {
  hamburguesas: 'Hamburguesas',
  insumos: 'Insumos',
  recetas: 'Recetas',
};

/** Secciones visibles por rol (el orden manda en el SubNav y en el test). */
export const SECCIONES_POR_ROL: Record<Rol, readonly SeccionId[]> = {
  super_admin: ['hamburguesas', 'insumos', 'recetas'],
  admin_hamburguesas: ['hamburguesas', 'insumos', 'recetas'],
};

/** Único negocio cuyos datos se pueden ver. */
export const NEGOCIOS_POR_ROL: Record<Rol, readonly NegocioId[]> = {
  super_admin: ['hamburguesas'],
  admin_hamburguesas: ['hamburguesas'],
};

/** Pestañas visibles por rol. Flujo de Caja fue eliminado del sistema. */
export const TABS_POR_ROL: Record<Rol, readonly TabId[]> = {
  super_admin: ['dashboard', 'transactions'],
  admin_hamburguesas: ['dashboard', 'transactions'],
};

export const TAB_LABEL: Record<TabId, string> = {
  dashboard: 'Dashboard',
  transactions: 'Transacciones',
};

/** Sección de negocio → negocio subyacente (Insumos y Recetas no mapean a ninguno). */
const SECCION_A_NEGOCIO: Partial<Record<SeccionId, NegocioId>> = {
  hamburguesas: 'hamburguesas',
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

/**
 * Único negocio permitido: hamburguesas. Los registros legacy sin `negocio`
 * se consideran hamburguesas; cualquier otro valor queda fuera.
 */
export function puedeVerNegocio(rol: Rol | null, negocio: NegocioId | string | null | undefined): boolean {
  if (!rol) return false;
  return String(negocio ?? 'hamburguesas') === 'hamburguesas';
}

/** Negocio subyacente de una sección (null para Insumos / Recetas). */
export function negocioDeSeccion(seccion: SeccionId): NegocioId | null {
  return SECCION_A_NEGOCIO[seccion] ?? null;
}

/**
 * Filtra transacciones según el rol. Es la única puerta por la que el frontend
 * puede ver movimientos: sólo `negocio === 'hamburguesas'` (o legacy sin
 * negocio, que se asume hamburguesas).
 */
export function filtrarTransaccionesPorRol<T extends { negocio?: string | null; entity?: string | null }>(
  rol: Rol | null,
  transacciones: readonly T[]
): T[] {
  if (!rol) return [];
  return transacciones.filter((tx) => puedeVerNegocio(rol, tx.negocio || tx.entity || 'hamburguesas'));
}
