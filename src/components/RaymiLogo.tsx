import React from "react";

interface RaymiLogoProps {
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
}

export const RaymiLogo: React.FC<RaymiLogoProps> = ({ className = "", size = "md" }) => {
  const sizeClasses = {
    sm: "w-8 h-8",
    md: "w-10 h-10",
    lg: "w-14 h-14",
    xl: "w-20 h-20"
  };

  const iconSizes = {
    sm: 18,
    md: 24,
    lg: 32,
    xl: 44
  };

  const currentSize = iconSizes[size];

  return (
    <div className={`relative flex items-center justify-center shrink-0 ${sizeClasses[size]} ${className}`}>
      {/* Outer Glow Ring */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-[#0095F6] via-[#00D2FF] to-[#0055FF] blur-md opacity-70 animate-pulse" />
      
      {/* Main Container */}
      <div className="relative w-full h-full rounded-2xl bg-gradient-to-tr from-[#0095F6] via-[#00B2FE] to-[#0066FF] p-[2px] shadow-lg shadow-blue-500/25 transition-transform duration-300 hover:scale-105">
        <div className="w-full h-full rounded-[14px] bg-black flex items-center justify-center relative overflow-hidden">
          {/* Subtle Background Radial Reflection */}
          <div className="absolute inset-0 bg-radial-at-t from-[#0095F6]/30 via-transparent to-transparent pointer-events-none" />
          
          {/* Futuristic Stylized "R" Monogram SVG */}
          <svg 
            width={currentSize} 
            height={currentSize} 
            viewBox="0 0 40 40" 
            fill="none" 
            xmlns="http://www.w3.org/2000/svg"
            className="drop-shadow-[0_0_8px_rgba(0,149,246,0.8)]"
          >
            {/* Outer Hexagon/Shield Lines */}
            <path 
              d="M20 4L34 12V28L20 36L6 28V12L20 4Z" 
              stroke="url(#raymi_grad)" 
              strokeWidth="2.5" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
            />
            {/* Stylized Raymi 'R' */}
            <path 
              d="M14 12H23C25.7614 12 28 14.2386 28 17C28 19.7614 25.7614 22 23 22H14V12Z" 
              stroke="white" 
              strokeWidth="2.5" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
            />
            <path 
              d="M14 12V28" 
              stroke="white" 
              strokeWidth="2.5" 
              strokeLinecap="round" 
            />
            <path 
              d="M21 22L27.5 28" 
              stroke="url(#raymi_grad)" 
              strokeWidth="2.5" 
              strokeLinecap="round" 
            />
            {/* Electric Sparkle Accent */}
            <circle cx="30" cy="10" r="2" fill="#00D2FF" className="animate-ping" />
            <circle cx="30" cy="10" r="1.5" fill="white" />

            <defs>
              <linearGradient id="raymi_grad" x1="6" y1="4" x2="34" y2="36" gradientUnits="userSpaceOnUse">
                <stop stopColor="#0095F6" />
                <stop offset="0.5" stopColor="#00D2FF" />
                <stop offset="1" stopColor="#0055FF" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      </div>
    </div>
  );
};
