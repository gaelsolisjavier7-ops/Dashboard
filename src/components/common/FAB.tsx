import React from 'react';
import { Plus } from 'lucide-react';

interface FABProps {
  /** Abre el modal existente de Nuevo Registro (handleOpenNewTransaction). */
  onClick: () => void;
}

/**
 * Botón flotante de acción principal (FASE 1 del rediseño).
 *
 * - 64×64px, círculo, verde (#22c55e) y la ÚNICA sombra permitida del sistema.
 * - Vive en la raíz de App (no dentro del SubNav): el backdrop-filter del SubNav
 *   lo convertiría en `fixed` respecto al nav y no al viewport.
 * - Móvil: bottom-20 / right-4 (libra la BottomNav). Desktop: bottom-8 / right-8.
 * - En móvil reemplaza al botón "+ Nuevo Registro" del SubNav; en desktop conviven.
 *
 * El estilo está en la clase `.fab` (src/index.css) para que los tokens del tema
 * manden sobre el componente.
 */
export const FAB: React.FC<FABProps> = ({ onClick }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label="Nuevo Registro"
    title="Nuevo Registro"
    className="fab apple-pressable"
  >
    <Plus className="w-7 h-7" strokeWidth={2.5} aria-hidden="true" />
  </button>
);
