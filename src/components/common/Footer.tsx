import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="w-full bg-[#f5f5f7] text-[#333333] pt-12 pb-24 sm:pt-16 sm:pb-12 px-4 sm:px-12 border-t border-[#e0e0e0] select-none">
      <div className="max-w-[1200px] mx-auto">
        {/* Footnote / Disclaimer section (Apple micro-legal / fine-print) */}
        <div className="text-[12px] text-[#7a7a7a] leading-relaxed pb-8 border-b border-[#e0e0e0] space-y-2">
          <p>
            1. El cálculo de Flujo de Caja Libre deduce los costos directos de materia prima, inventario, fletes y servicios operativos para determinar la utilidad neta transferible a finanzas personales.
          </p>
          <p>
            2. La sincronización en tiempo real opera a través de Google Cloud Firestore. En ausencia de claves de configuración de Firebase, todos los datos se persisten de manera segura en el almacenamiento local del dispositivo.
          </p>
        </div>

        {/* Directory Columns */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 py-10 border-b border-[#e0e0e0]">
          <div>
            <h4 className="text-[14px] font-semibold text-[#1d1d1f] mb-3">
              Módulos Financieros
            </h4>
            <ul className="text-[14px] text-[#555555] space-y-2.5">
              <li>Dashboard Ejecutivo</li>
              <li>Flujo de Caja Libre</li>
              <li>Libro de Movimientos</li>
              <li>Análisis por Categoría</li>
            </ul>
          </div>

          <div>
            <h4 className="text-[14px] font-semibold text-[#1d1d1f] mb-3">
              Unidades de Negocio
            </h4>
            <ul className="text-[14px] text-[#555555] space-y-2.5">
              <li>Smash Burgers & Delivery</li>
              <li>Reventa AirPods Pro / Max</li>
              <li>Gastos Personales & Vida</li>
              <li>Retiro de Utilidades</li>
            </ul>
          </div>

          <div>
            <h4 className="text-[14px] font-semibold text-[#1d1d1f] mb-3">
              Tecnología & Datos
            </h4>
            <ul className="text-[14px] text-[#555555] space-y-2.5">
              <li>React 19 & TypeScript</li>
              <li>Google Firebase Firestore</li>
              <li>Firebase Authentication</li>
              <li>Exportación JSON & CSV</li>
            </ul>
          </div>

          <div>
            <h4 className="text-[14px] font-semibold text-[#1d1d1f] mb-3">
              Diseño Apple
            </h4>
            <ul className="text-[14px] text-[#555555] space-y-2.5">
              <li>SF Pro Typographic System</li>
              <li>Action Blue (#0066cc)</li>
              <li>Frosted Glass Navbars</li>
              <li>Zero-Shadow Hairline Cards</li>
            </ul>
          </div>
        </div>

        {/* Legal Row */}
        <div className="flex flex-col sm:flex-row items-center justify-between pt-6 text-[12px] text-[#7a7a7a] gap-3">
          <div className="flex items-center space-x-2">
            <span>Copyright © {new Date().getFullYear()} Apple Finance Suite. Todos los derechos reservados.</span>
          </div>
          <div className="flex items-center space-x-4">
            <span className="hover:text-[#1d1d1f] cursor-pointer">Privacidad de Datos</span>
            <span>|</span>
            <span className="hover:text-[#1d1d1f] cursor-pointer">Seguridad Firestore</span>
            <span>|</span>
            <span className="hover:text-[#1d1d1f] cursor-pointer">Términos de Uso</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
