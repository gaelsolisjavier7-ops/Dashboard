/**
 * Utilidades de fecha y de periodos del dashboard.
 *
 * Archivo SIN imports (ni `import type`) para que `scripts/test-fechas.mjs`
 * pueda importarlo directo con Node, igual que `lib/roles.ts` y `lib/costeo.ts`.
 *
 * Reglas clave:
 * - Las fechas SIN hora ("2026-10-09") se interpretan a medianoche LOCAL.
 * - La semana empieza en LUNES.
 * - El offset se aplica al calendario local (America/Mexico_City, UTC-6).
 */

export type DateFilter = 'day' | 'week' | 'month' | 'quarter' | 'year' | 'all';

/** Periodo seleccionado: 0 = actual, -1 = anterior, -2 = hace dos… */
export interface DateRange {
  filter: DateFilter;
  offset: number;
}

export const DATE_FILTERS: readonly DateFilter[] = ['day', 'week', 'month', 'quarter', 'year', 'all'];

export const DATE_FILTER_OPTIONS: { id: DateFilter; label: string }[] = [
  { id: 'day', label: 'Día' },
  { id: 'week', label: 'Semana' },
  { id: 'month', label: 'Mes' },
  { id: 'quarter', label: 'Trimestre' },
  { id: 'year', label: 'Año' },
  { id: 'all', label: 'Todo el tiempo' },
];

export interface FechaParseada {
  ms: number;
  hasTime: boolean;
}

const MESES_CORTOS = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
];

const MESES_LARGOS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

/** getDay(): 0 = domingo */
const DIAS_CORTOS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

const TRIMESTRES = ['Ene-Mar', 'Abr-Jun', 'Jul-Sep', 'Oct-Dic'];
const ORDINAL_TRIMESTRE = ['1er', '2º', '3er', '4º'];

/* ─────────────────────────── parseo de fechas ─────────────────────────── */

/**
 * Convierte un campo de fecha de Firestore (Timestamp, { seconds }, ISO string,
 * YYYY-MM-DD, DD/MM/YYYY o epoch) a milisegundos locales.
 */
export function parseFechaFirestore(value: unknown): FechaParseada {
  const fallback: FechaParseada = { ms: Date.now(), hasTime: false };
  if (value == null) return fallback;

  // Firestore Timestamp u objeto { seconds }
  if (typeof value === 'object') {
    const maybe = value as { toDate?: () => Date; seconds?: number; _seconds?: number };
    if (typeof maybe.toDate === 'function') {
      const date = maybe.toDate();
      if (!isNaN(date.getTime())) return { ms: date.getTime(), hasTime: true };
    }
    const seconds = maybe.seconds ?? maybe._seconds;
    if (typeof seconds === 'number' && Number.isFinite(seconds)) {
      return { ms: seconds * 1000, hasTime: true };
    }
    return fallback;
  }

  // Epoch en segundos o milisegundos
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return fallback;
    return { ms: value > 1e11 ? value : value * 1000, hasTime: true };
  }

  const str = String(value).trim();
  if (!str) return fallback;

  // YYYY-MM-DD (sin hora) → medianoche local
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str);
  if (iso) {
    const date = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    if (!isNaN(date.getTime())) return { ms: date.getTime(), hasTime: false };
  }

  // DD/MM/YYYY o DD/MM/YYYY HH:mm
  const latino = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(.*)$/.exec(str);
  if (latino) {
    const hora = /(\d{1,2}):(\d{2})/.exec(latino[4] || '');
    const date = new Date(
      Number(latino[3]),
      Number(latino[2]) - 1,
      Number(latino[1]),
      hora ? Number(hora[1]) : 0,
      hora ? Number(hora[2]) : 0
    );
    if (!isNaN(date.getTime())) return { ms: date.getTime(), hasTime: Boolean(hora) };
  }

  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return { ms: parsed.getTime(), hasTime: /[T:]/.test(str) };
  }

  return fallback;
}

function formatHora(date: Date): string {
  const h24 = date.getHours();
  const minutos = String(date.getMinutes()).padStart(2, '0');
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${minutos}${h24 >= 12 ? 'pm' : 'am'}`;
}

function diasDeDiferencia(desde: Date, hasta: Date): number {
  const inicio = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.round((inicio(desde) - inicio(hasta)) / 86_400_000);
}

/**
 * Formato relativo usado en las listas:
 * "hoy 8:45pm", "ayer" o "12 oct" (con año si no es el año en curso).
 */
export function formatFechaRelativa(ms: number, tieneHora = true, ahora: Date = new Date()): string {
  if (!Number.isFinite(ms)) return '—';

  const date = new Date(ms);
  if (isNaN(date.getTime())) return '—';

  const diff = diasDeDiferencia(ahora, date);

  if (diff === 0) return tieneHora ? `hoy ${formatHora(date)}` : 'hoy';
  if (diff === 1) return 'ayer';

  const base = `${date.getDate()} ${MESES_CORTOS[date.getMonth()]}`;
  return date.getFullYear() === ahora.getFullYear() ? base : `${base} ${date.getFullYear()}`;
}

/* ────────────────────────────── periodos ────────────────────────────── */

const capitalizar = (texto: string) => texto.charAt(0).toUpperCase() + texto.slice(1);
const mesCorto = (d: Date) => capitalizar(MESES_CORTOS[d.getMonth()]);

function inicioDelDia(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function finDelDia(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999).getTime();
}

/** Lunes de la semana de `d` (la semana va de lunes a domingo). */
function inicioDeSemana(d: Date): Date {
  const base = inicioDelDia(d);
  const dia = base.getDay(); // 0 = domingo
  const desplazamiento = dia === 0 ? -6 : 1 - dia;
  return new Date(base.getFullYear(), base.getMonth(), base.getDate() + desplazamiento);
}

/**
 * Rango [inicio, fin] en milisegundos del periodo pedido, aplicando el offset
 * al calendario local:
 *   day     00:00 → 23:59:59.999
 *   week    lunes → domingo
 *   month   1º → último día
 *   quarter 3 meses calendario
 *   year    1 ene → 31 dic
 *   all     [0, ahora]
 */
export function rangoDePeriodo(
  filter: DateFilter,
  offset = 0,
  ahora: Date = new Date()
): [number, number] {
  const off = filter === 'all' ? 0 : Math.trunc(Number(offset)) || 0;

  switch (filter) {
    case 'day': {
      const dia = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() + off);
      return [dia.getTime(), finDelDia(dia)];
    }
    case 'week': {
      const lunes = inicioDeSemana(ahora);
      const inicio = new Date(lunes.getFullYear(), lunes.getMonth(), lunes.getDate() + off * 7);
      const fin = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + 6);
      return [inicio.getTime(), finDelDia(fin)];
    }
    case 'month': {
      const inicio = new Date(ahora.getFullYear(), ahora.getMonth() + off, 1);
      const fin = new Date(inicio.getFullYear(), inicio.getMonth() + 1, 0); // último día del mes
      return [inicio.getTime(), finDelDia(fin)];
    }
    case 'quarter': {
      const trimestreActual = Math.floor(ahora.getMonth() / 3);
      const inicio = new Date(ahora.getFullYear(), (trimestreActual + off) * 3, 1);
      const fin = new Date(inicio.getFullYear(), inicio.getMonth() + 3, 0);
      return [inicio.getTime(), finDelDia(fin)];
    }
    case 'year': {
      const inicio = new Date(ahora.getFullYear() + off, 0, 1);
      const fin = new Date(inicio.getFullYear(), 11, 31);
      return [inicio.getTime(), finDelDia(fin)];
    }
    default:
      return [0, ahora.getTime()];
  }
}

/** ¿La fecha (en ms) cae dentro del periodo indicado? */
export function estaEnPeriodo(
  ms: number,
  filter: DateFilter,
  offset = 0,
  ahora: Date = new Date()
): boolean {
  if (filter === 'all') return true;
  if (!Number.isFinite(ms)) return true;

  const [inicio, fin] = rangoDePeriodo(filter, offset, ahora);
  return ms >= inicio && ms <= fin;
}

/** "7-13 Oct" · "30 Sep - 6 Oct" · "28 Dic 2025 - 3 Ene 2026" */
function etiquetaRangoDias(inicio: Date, fin: Date, ahora: Date): string {
  const mismoAnio = inicio.getFullYear() === fin.getFullYear();
  const mismoMes = mismoAnio && inicio.getMonth() === fin.getMonth();

  if (mismoMes) {
    const anio = fin.getFullYear() !== ahora.getFullYear() ? ` ${fin.getFullYear()}` : '';
    return `${inicio.getDate()}-${fin.getDate()} ${mesCorto(fin)}${anio}`;
  }

  if (mismoAnio) {
    const anio = fin.getFullYear() !== ahora.getFullYear() ? ` ${fin.getFullYear()}` : '';
    return `${inicio.getDate()} ${mesCorto(inicio)} - ${fin.getDate()} ${mesCorto(fin)}${anio}`;
  }

  return `${inicio.getDate()} ${mesCorto(inicio)} ${inicio.getFullYear()} - ${fin.getDate()} ${mesCorto(fin)} ${fin.getFullYear()}`;
}

/**
 * Etiqueta legible del periodo:
 *   day     0 → "Hoy (12 Oct)"      -1 → "Ayer (11 Oct)"      otros → "Mié 10 Oct"
 *   week    0 → "Esta semana (12-18 Oct)"  -1 → "Semana pasada (5-11 Oct)"  otros → "Semana del 28 Sep - 4 Oct"
 *   month   0 → "Octubre 2026"      otros → "Septiembre 2026"
 *   quarter 0 → "Este trimestre (Oct-Dic 2026)"  -1 → "Trimestre pasado (Jul-Sep 2026)"  otros → "2º trimestre 2026 (Abr-Jun)"
 *   year    0 → "Este año (2026)"   -1 → "Año pasado (2025)"   otros → "2024"
 *   all     → "Todo el tiempo"
 */
export function formatPeriodoLabel(
  filter: DateFilter,
  offset = 0,
  ahora: Date = new Date()
): string {
  const off = filter === 'all' ? 0 : Math.trunc(Number(offset)) || 0;
  const [inicioMs, finMs] = rangoDePeriodo(filter, off, ahora);
  const inicio = new Date(inicioMs);
  const fin = new Date(finMs);

  switch (filter) {
    case 'day': {
      const base = `${inicio.getDate()} ${mesCorto(inicio)}`;
      if (off === 0) return `Hoy (${base})`;
      if (off === -1) return `Ayer (${base})`;
      return `${capitalizar(DIAS_CORTOS[inicio.getDay()])} ${base}`;
    }
    case 'week': {
      const rango = etiquetaRangoDias(inicio, fin, ahora);
      if (off === 0) return `Esta semana (${rango})`;
      if (off === -1) return `Semana pasada (${rango})`;
      return `Semana del ${rango}`;
    }
    case 'month':
      return `${MESES_LARGOS[inicio.getMonth()]} ${inicio.getFullYear()}`;
    case 'quarter': {
      const numero = Math.floor(inicio.getMonth() / 3) + 1;
      const rango = TRIMESTRES[numero - 1];
      if (off === 0) return `Este trimestre (${rango} ${inicio.getFullYear()})`;
      if (off === -1) return `Trimestre pasado (${rango} ${inicio.getFullYear()})`;
      return `${ORDINAL_TRIMESTRE[numero - 1]} trimestre ${inicio.getFullYear()} (${rango})`;
    }
    case 'year': {
      if (off === 0) return `Este año (${inicio.getFullYear()})`;
      if (off === -1) return `Año pasado (${inicio.getFullYear()})`;
      return `${inicio.getFullYear()}`;
    }
    default:
      return 'Todo el tiempo';
  }
}
