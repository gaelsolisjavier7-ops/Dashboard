import type { ColorMargen } from '../../lib/costeo';

/** Etiqueta corta de la unidad base para mostrar junto a una cantidad. */
export const etiquetaUnidad = (unidadBase: string | null | undefined): string =>
  unidadBase === 'g' ? 'g' : unidadBase === 'ml' ? 'ml' : 'pza';

/** Clases compartidas del módulo de costeo (Apple: tarjetas blancas, hairline). */

export const INPUT_CLASE =
  'w-full min-h-[44px] px-3.5 rounded-[12px] bg-[#f5f5f7] border border-[#e0e0e0] focus:border-[#0071e3] focus:bg-white outline-none transition-colors text-[15px] text-[#1d1d1f]';

export const INPUT_NUM_CLASE = `${INPUT_CLASE} font-semibold`;

export const ETIQUETA_CLASE = 'block text-[13px] font-semibold text-[#1d1d1f] mb-1.5';

export const PANEL_MODAL =
  'bg-white rounded-[24px] w-[95%] border border-[#e0e0e0] shadow-2xl max-h-[92vh] overflow-y-auto';

export const OVERLAY_MODAL =
  'fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm';

/** Badge de margen: verde ≥ 50 %, amarillo 30–50 %, rojo < 30 %. */
export const CLASE_MARGEN: Record<ColorMargen, string> = {
  verde: 'bg-[#34c759]/10 text-[#34c759] border-[#34c759]/30',
  amarillo: 'bg-[#ff9500]/10 text-[#ff9500] border-[#ff9500]/30',
  rojo: 'bg-[#ff3b30]/10 text-[#ff3b30] border-[#ff3b30]/30',
};

export const BARRA_MARGEN: Record<ColorMargen, string> = {
  verde: 'bg-[#34c759]',
  amarillo: 'bg-[#ff9500]',
  rojo: 'bg-[#ff3b30]',
};

export const TEXTO_MARGEN: Record<ColorMargen, string> = {
  verde: 'text-[#34c759]',
  amarillo: 'text-[#ff9500]',
  rojo: 'text-[#ff3b30]',
};
