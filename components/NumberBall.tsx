
import React from 'react';
import { GameConfig } from '../types';

interface NumberBallProps {
  number: number;
  isSelected: boolean;
  isRecentResult?: boolean;
  onClick: (num: number) => void;
  disabled?: boolean;
  activeGame: GameConfig;
  size?: 'small' | 'medium'; 
  label?: string; 
}

const NumberBall: React.FC<NumberBallProps> = ({ 
  number, 
  isSelected, 
  isRecentResult, 
  onClick, 
  disabled,
  activeGame,
  size = 'medium',
  label
}) => {
  
  const baseSize = size === 'small' 
    ? "w-8 h-6 text-[10px] sm:w-9 sm:h-7 sm:text-xs" 
    : "w-full h-9 sm:h-10 text-sm font-bold";

  // Base styles
  const baseClasses = `${baseSize} rounded-[4px] flex items-center justify-center transition-all duration-150 border select-none`;
  
  // Dynamic styles based on theme
  const style: React.CSSProperties = {};
  
  if (isSelected) {
      style.backgroundColor = activeGame.theme.primary;
      style.color = activeGame.theme.text;
      style.borderColor = 'transparent';
      style.boxShadow = 'inset 0 2px 4px rgba(0,0,0,0.3)';
      style.transform = 'scale(0.95)';
  } else {
      style.backgroundColor = 'white';
      style.color = '#334155'; // slate-700
      style.borderColor = activeGame.theme.primary; // Border is theme color
  }

  if (disabled) {
      return (
        <button
          disabled
          className={`${baseClasses} opacity-30 cursor-not-allowed grayscale bg-slate-100 border-slate-200 text-slate-400`}
        >
          {label !== undefined ? label : number.toString().padStart(2, '0')}
        </button>
      );
  }

  // Result highlighting overrides
  const recentResultClasses = isRecentResult 
    ? "ring-2 ring-yellow-400 ring-offset-1 z-10 font-black" 
    : "";

  return (
    <button
      onClick={() => onClick(number)}
      className={`${baseClasses} ${!isSelected ? 'hover:bg-slate-50' : ''} ${recentResultClasses} active:scale-90`}
      style={style}
    >
      <span className={isSelected ? "" : "opacity-90"}>
        {label !== undefined ? label : number.toString().padStart(2, '0')}
      </span>
      
      {isSelected && (
        <span className="absolute inset-0 flex items-center justify-center opacity-20 pointer-events-none">
           <svg viewBox="0 0 24 24" className="w-full h-full p-1" fill="none" stroke="currentColor" strokeWidth="3">
             <path d="M18 6L6 18M6 6l12 12" />
           </svg>
        </span>
      )}
    </button>
  );
};

export default NumberBall;
