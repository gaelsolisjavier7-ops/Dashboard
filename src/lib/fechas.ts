import type { DateFilter } from '../types/finance';

/**
 * Utilidades genéricas de fecha compartidas por pedidos web e inventario.
 *
 * Regla clave: las fechas SIN hora (ej. "2026-10-09") se interpretan a
 * medianoche LOCAL, nunca UTC, para que el filtro de periodo no se desplace
 * un día por la zona horaria.
 */

export interface FechaParseada {
  ms: number;
  hasTime: boolean;
}

const MESES_CORTOS = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
];

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

/** ¿La fecha (en ms) cae dentro del periodo seleccionado en el dashboard? */
export function estaEnPeriodo(ms: number, filter: DateFilter, ahora: Date = new Date()): boolean {
  if (filter === 'all') return true;
  if (!Number.isFinite(ms)) return true;

  const date = new Date(ms);
  if (isNaN(date.getTime())) return true;
  if (date.getFullYear() !== ahora.getFullYear()) return false;

  if (filter === 'month') return date.getMonth() === ahora.getMonth();
  return Math.floor(date.getMonth() / 3) === Math.floor(ahora.getMonth() / 3);
}

export const DATE_FILTER_LABEL: Record<DateFilter, string> = {
  month: 'Este Mes',
  quarter: 'Trimestre',
  all: 'Todo el tiempo',
};
