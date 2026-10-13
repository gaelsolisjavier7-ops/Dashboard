import React from 'react';

export const AirPodsVisual: React.FC<{ className?: string }> = ({ className = 'w-48 h-48' }) => {
  return (
    <div className={`relative flex items-center justify-center select-none ${className}`}>
      <svg
        viewBox="0 0 200 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full filter drop-shadow-[0_12px_24px_rgba(0,0,0,0.18)]"
      >
        {/* Charging Case Body */}
        <rect
          x="35"
          y="60"
          width="130"
          height="100"
          rx="32"
          fill="url(#caseGrad)"
          stroke="#d2d2d7"
          strokeWidth="1.5"
        />
        {/* Case Lid Line */}
        <line x1="35" y1="92" x2="165" y2="92" stroke="#d2d2d7" strokeWidth="1.2" />
        {/* LED Indicator */}
        <circle cx="100" cy="115" r="2.5" fill="#34c759" />

        {/* Left AirPod Earbud emerging */}
        <g transform="translate(58, 20)">
          <path
            d="M20 28 C10 28 6 18 14 10 C22 2 34 6 34 16 C34 26 28 32 24 38 L24 64 C24 66 22 68 20 68 C18 68 16 66 16 64 L16 38 C16 33 20 30 20 28 Z"
            fill="url(#budGrad)"
          />
          {/* Black acoustic mesh */}
          <ellipse cx="20" cy="18" rx="4" ry="7" fill="#1d1d1f" />
          <rect x="17" y="62" width="6" height="5" rx="2" fill="#d2d2d7" />
        </g>

        {/* Right AirPod Earbud emerging */}
        <g transform="translate(102, 20)">
          <path
            d="M20 28 C30 28 34 18 26 10 C18 2 6 6 6 16 C6 26 12 32 16 38 L16 64 C16 66 18 68 20 68 C22 68 24 66 24 64 L24 38 C24 33 20 30 20 28 Z"
            fill="url(#budGrad)"
          />
          {/* Black acoustic mesh */}
          <ellipse cx="20" cy="18" rx="4" ry="7" fill="#1d1d1f" />
          <rect x="17" y="62" width="6" height="5" rx="2" fill="#d2d2d7" />
        </g>

        <defs>
          <linearGradient id="caseGrad" x1="35" y1="60" x2="165" y2="160" gradientUnits="userSpaceOnUse">
            <stop stopColor="#ffffff" />
            <stop offset="0.75" stopColor="#f5f5f7" />
            <stop offset="1" stopColor="#e5e5ea" />
          </linearGradient>
          <linearGradient id="budGrad" x1="10" y1="10" x2="30" y2="60" gradientUnits="userSpaceOnUse">
            <stop stopColor="#ffffff" />
            <stop offset="1" stopColor="#e5e5ea" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
};

export const BurgerVisual: React.FC<{ className?: string }> = ({ className = 'w-48 h-48' }) => {
  return (
    <div className={`relative flex items-center justify-center select-none ${className}`}>
      <svg
        viewBox="0 0 200 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full filter drop-shadow-[0_12px_24px_rgba(0,0,0,0.18)]"
      >
        {/* Top Brioche Bun */}
        <path
          d="M30 92 C30 50 60 30 100 30 C140 30 170 50 170 92 Z"
          fill="url(#bunGrad)"
          stroke="#b8621b"
          strokeWidth="1"
        />
        {/* Sesame Seeds */}
        <ellipse cx="75" cy="55" rx="3" ry="1.5" fill="#fdf0d5" transform="rotate(-15 75 55)" />
        <ellipse cx="105" cy="48" rx="3" ry="1.5" fill="#fdf0d5" transform="rotate(10 105 48)" />
        <ellipse cx="130" cy="60" rx="3" ry="1.5" fill="#fdf0d5" transform="rotate(25 130 60)" />
        <ellipse cx="90" cy="68" rx="3" ry="1.5" fill="#fdf0d5" transform="rotate(-5 90 68)" />

        {/* Melted Cheddar Layer */}
        <path
          d="M26 102 L174 102 L160 120 L135 106 L105 125 L75 106 L45 122 Z"
          fill="#ff9f0a"
        />

        {/* Double Smashed Patty */}
        <rect x="24" y="94" width="152" height="13" rx="6.5" fill="#4a2511" />
        <rect x="25" y="116" width="150" height="14" rx="7" fill="#381c0d" />

        {/* Crispy Lettuce & Pickles */}
        <path
          d="M22 131 C35 128 45 136 60 131 C75 127 85 135 100 131 C115 127 125 135 140 131 C155 127 165 135 178 131 C178 135 172 138 168 138 L32 138 Z"
          fill="#30d158"
        />

        {/* Bottom Bun */}
        <rect x="32" y="138" width="136" height="24" rx="12" fill="url(#bunGrad)" />

        <defs>
          <linearGradient id="bunGrad" x1="30" y1="30" x2="170" y2="160" gradientUnits="userSpaceOnUse">
            <stop stopColor="#f39c12" />
            <stop offset="0.5" stopColor="#e67e22" />
            <stop offset="1" stopColor="#d35400" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
};

export const AppleCardVisual: React.FC<{ className?: string }> = ({ className = 'w-64 h-40' }) => {
  return (
    <div className={`relative select-none ${className}`}>
      <div className="w-full h-full rounded-[14px] bg-gradient-to-tr from-[var(--surface-elevated)] via-[var(--surface)] to-[var(--bg)] border border-[#262626] p-5 flex flex-col justify-between apple-product-shadow text-white">
        <div className="flex justify-between items-start">
          <span className="text-[24px] leading-none"></span>
          {/* Card Chip */}
          <div className="w-7 h-5 rounded-[4px] border border-[#b0b0b5] bg-[#eaeaea] flex items-center justify-center">
            <div className="w-3 h-2 border-t border-b border-[#8e8e93]" />
          </div>
        </div>
        <div>
          <div className="text-[12px] font-normal tracking-[1.5px] uppercase text-[#7a7a7a]">
            Titanium Personal & Cash Flow
          </div>
          <div className="text-[15px] font-semibold tracking-tight text-[#1d1d1f] mt-0.5">
            Finanzas Inteligentes
          </div>
        </div>
      </div>
    </div>
  );
};
