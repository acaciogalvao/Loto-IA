import React from 'react';

interface NumberBallProps {
  number: number;
  isSelected: boolean;
  isRecentResult?: boolean;
  onClick: (num: number) => void;
  disabled?: boolean;
  colorTheme?: string; // Novo prop para tema (purple, emerald, etc.)
  size?: 'small' | 'medium'; // Para grids densos (lotomania)
  label?: string; // Custom label override (e.g. for Super Sete 0-9)
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
  
  // Base classes
  const baseSize = size === 'small' 
    ? "w-8 h-8 text-xs" 
    : "w-10 h-10 sm:w-12 sm:h-12 text-sm sm:text-base";

  const baseClasses = `${baseSize} rounded-full flex items-center justify-center font-bold transition-all duration-200 shadow-sm relative`;
  
  // Dynamic color handling
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

  const selectedClasses = `${getSelectedColor()} scale-105`;
  const unselectedClasses = "bg-slate-700 text-slate-300 hover:bg-slate-600";
  const disabledClasses = "opacity-50 cursor-not-allowed";

  // Recent result Highlight
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
      
      {/* Indicador de resultado recente (se não selecionado) */}
      {isRecentResult && !isSelected && (
        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-white rounded-full border-2 border-slate-900"></span>
      )}
    </button>
  );
};

export default NumberBall;