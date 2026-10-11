import React from 'react';
import type { SeccionId } from '../../types/finance';
import { SECCION_LABEL } from '../../lib/roles';
import { Boxes, ClipboardList, Hourglass } from 'lucide-react';

interface ProximamenteProps {
  seccion: SeccionId;
}

/**
 * Pantalla provisional para Insumos y Recetas: las pills y los permisos ya
 * existen, los módulos se construyen después. Así el socio ve exactamente las
 * secciones que le corresponden sin enlazar a una vista rota.
 */
export const Proximamente: React.FC<ProximamenteProps> = ({ seccion }) => {
  const esInsumos = seccion === 'insumos';

  return (
    <div className="w-full">
      <div className="w-full bg-[#272729] text-white py-12 sm:py-16 px-4 sm:px-12 border-b border-[#333333]">
        <div className="max-w-[1200px] mx-auto">
          <span className="text-[14px] font-semibold tracking-wider uppercase text-[#2997ff]">
            Módulo {SECCION_LABEL[seccion]}
          </span>
          <h1 className="text-[30px] sm:text-[44px] font-semibold tracking-[-0.025em] leading-[1.08] mt-2 text-white">
            {SECCION_LABEL[seccion]}
          </h1>
          <p className="text-[16px] sm:text-[19px] text-[#cccccc] leading-relaxed mt-2 max-w-[620px]">
            {esInsumos
              ? 'Control de costos de insumos y proveedores. Los permisos ya están configurados; el módulo se habilita en la siguiente entrega.'
              : 'Recetario con costo por platillo y margen. Los permisos ya están configurados; el módulo se habilita en la siguiente entrega.'}
          </p>
        </div>
      </div>

      <div className="w-full py-10 px-4 sm:py-14 sm:px-12 bg-[#f5f5f7] border-b border-[#e0e0e0]">
        <div className="max-w-[1200px] mx-auto">
          <div className="apple-card bg-white max-w-[560px]">
            <div className="w-12 h-12 rounded-full bg-[#f5f5f7] flex items-center justify-center text-[#7a7a7a]">
              {esInsumos ? <Boxes className="w-6 h-6" /> : <ClipboardList className="w-6 h-6" />}
            </div>
            <h2 className="text-[19px] font-semibold text-[#1d1d1f] mt-4">
              {esInsumos ? 'Insumos' : 'Recetas'} — próximamente
            </h2>
            <p className="text-[14px] text-[#7a7a7a] mt-1">
              Esta pantalla es intencionalmente provisional: tu rol ya tiene permiso sobre{' '}
              {SECCION_LABEL[seccion].toLowerCase()}, así que en cuanto el módulo exista aparecerá
              aquí sin cambiar permisos ni navegación.
            </p>
            <div className="flex items-center space-x-2 mt-4 pt-4 border-t border-[#f0f0f0] text-[13px] text-[#7a7a7a]">
              <Hourglass className="w-3.5 h-3.5" />
              <span>Sin datos que mostrar todavía.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
