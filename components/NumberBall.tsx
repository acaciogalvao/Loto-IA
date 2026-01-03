import React from 'react';

interface NumberBallProps {
  number: number;
  isSelected: boolean;
  isRecentResult?: boolean;
  onClick: (num: number) => void;
  disabled?: boolean;
  colorTheme?: string; 
  size?: 'small' | 'medium'; 
  label?: string; 
}

const NumberBall: React.FC<NumberBallProps> = ({ 
  number, 
  isSelected, 
  isRecentResult, 
  onClick, 
  disabled,
  colorTheme = 'purple',
  size = 'medium',
  label
}) => {
  
  const baseSize = size === 'small' 
    ? "w-8 h-8 text-xs" 
    : "w-10 h-10 sm:w-12 sm:h-12 text-sm sm:text-base";

  const baseClasses = `${baseSize} rounded-full flex items-center justify-center font-bold transition-all duration-200 shadow-sm relative border-2`;
  
  const getSelectedColor = () => {
     switch(colorTheme) {
        case 'emerald': return "bg-emerald-600 text-white shadow-emerald-500/50";
        case 'indigo': return "bg-indigo-600 text-white shadow-indigo-500/50";
        case 'blue': return "bg-blue-600 text-white shadow-blue-500/50";
        case 'orange': return "bg-orange-500 text-white shadow-orange-500/50";
        case 'yellow': return "bg-yellow-500 text-black shadow-yellow-500/50";
        case 'amber': return "bg-amber-600 text-white shadow-amber-500/50";
        case 'rose': return "bg-rose-600 text-white shadow-rose-500/50";
        case 'lime': return "bg-lime-600 text-black shadow-lime-500/50";
        default: return "bg-purple-600 text-white shadow-purple-500/50";
     }
  };

  const selectedClasses = `${getSelectedColor()} scale-105 border-white/30 hover:scale-110 ring-2 ring-offset-2 ring-offset-slate-900 ring-white/50 z-10`;
  
  const unselectedClasses = "bg-slate-700 text-slate-300 hover:bg-slate-600 border-transparent hover:border-slate-500 hover:scale-110";
  
  const disabledClasses = "opacity-50 cursor-not-allowed hover:scale-100 hover:border-transparent";

  const recentResultClasses = isRecentResult 
    ? "ring-2 ring-white ring-offset-2 ring-offset-slate-900 z-10 font-bold" 
    : "";

  return (
    <button
      onClick={() => onClick(number)}
      disabled={disabled}
      className={`
        ${baseClasses} 
        ${isSelected ? selectedClasses : unselectedClasses} 
        ${recentResultClasses}
        ${disabled ? disabledClasses : 'active:scale-95'}
      `}
    >
      {label !== undefined ? label : number.toString().padStart(2, '0')}
      
      {isRecentResult && !isSelected && (
        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-white rounded-full border-2 border-slate-900"></span>
      )}
    </button>
  );
};

export default NumberBall;