import React from 'react';

interface LogoProps {
  className?: string;
  isCollapsed?: boolean;
}

export const Logo: React.FC<LogoProps> = ({ className = "h-10", isCollapsed = false }) => {
  return (
    <div className={`flex items-center ${isCollapsed ? 'justify-center' : ''} ${className}`}>
      <img 
        src={isCollapsed ? "/logo_small.png" : "/logo.png"} 
        alt="CheKify Logo" 
        className="h-full w-auto object-contain"
      />
    </div>
  );
};
