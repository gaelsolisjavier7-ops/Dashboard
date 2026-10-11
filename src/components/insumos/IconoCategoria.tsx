import React from 'react';
import { Beef, Box, Carrot, CircleDot, CupSoda, Droplet, Package, Wheat, Zap } from 'lucide-react';

const ICONOS: Record<string, React.ReactNode> = {
  Carne: <Beef className="w-4 h-4 text-[#ff3b30]" />,
  'Panadería': <Wheat className="w-4 h-4 text-[#ff9500]" />,
  Quesos: <CircleDot className="w-4 h-4 text-[#ffcc00]" />,
  Verduras: <Carrot className="w-4 h-4 text-[#34c759]" />,
  Salsas: <Droplet className="w-4 h-4 text-[#ff2d55]" />,
  Papas: <Zap className="w-4 h-4 text-[#ff9500]" />,
  Bebidas: <CupSoda className="w-4 h-4 text-[#0066cc]" />,
  Extras: <Package className="w-4 h-4 text-[#5856d6]" />,
  Otros: <Box className="w-4 h-4 text-[#8e8e93]" />,
};

/** Icono por categoría de insumo (los pediste en la spec). */
export const IconoCategoria: React.FC<{ categoria: string; className?: string }> = ({
  categoria,
  className = 'w-7 h-7 rounded-full bg-[#f5f5f7] flex items-center justify-center flex-shrink-0',
}) => <span className={className}>{ICONOS[categoria] ?? ICONOS.Otros}</span>;

