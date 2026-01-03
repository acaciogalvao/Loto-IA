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
  
  // Adjusted sizes for tighter grids
  const baseSize = size === 'small' 
    ? "w-7 h-7 text-[10px] sm:w-8 sm:h-8 sm:text-xs" 
    : "w-10 h-10 sm:w-11 sm:h-11 text-sm font-bold";

  // Base layout classes
  const baseClasses = `${baseSize} rounded-full flex items-center justify-center transition-all duration-200 relative`;
  
  // Dynamic Color Theme for Selected State (Imitates Pen Mark)
  const getSelectedColor = () => {
     switch(colorTheme) {
        case 'emerald': return "bg-emerald-600 border-emerald-600 text-white shadow-emerald-200";
        case 'indigo': return "bg-indigo-600 border-indigo-600 text-white shadow-indigo-200";
        case 'blue': return "bg-blue-600 border-blue-600 text-white shadow-blue-200";
        case 'cyan': return "bg-cyan-600 border-cyan-600 text-white shadow-cyan-200";
        case 'orange': return "bg-orange-500 border-orange-500 text-white shadow-orange-200";
        case 'yellow': return "bg-yellow-400 border-yellow-400 text-black shadow-yellow-200";
        case 'amber': return "bg-amber-500 border-amber-500 text-white shadow-amber-200";
        case 'rose': return "bg-rose-600 border-rose-600 text-white shadow-rose-200";
        case 'lime': return "bg-lime-500 border-lime-500 text-slate-900 shadow-lime-200";
        case 'violet': return "bg-violet-600 border-violet-600 text-white shadow-violet-200";
        case 'fuchsia': return "bg-fuchsia-600 border-fuchsia-600 text-white shadow-fuchsia-200";
        default: return "bg-purple-600 border-purple-600 text-white shadow-purple-200";
     }
  };

  // ESTILO "VOLANTE FÍSICO"
  // Selected: Cheio, cor forte, parece marcado com caneta
  const selectedClasses = `${getSelectedColor()} border-2 shadow-md transform scale-105 z-10`;
  
  // Unselected: Fundo transparente (papel), Borda Cinza, Texto Cinza Escuro (Tinta do bilhete)
  // Isso cria o efeito visual de um volante real não marcado
  const unselectedClasses = "bg-white border-2 border-slate-300 text-slate-500 hover:border-slate-400 hover:text-slate-700 hover:bg-slate-50";
  
  const disabledClasses = "opacity-40 cursor-not-allowed hover:scale-100 grayscale bg-slate-100";

  const recentResultClasses = isRecentResult 
    ? "ring-2 ring-offset-1 ring-offset-white ring-yellow-400 z-10 font-black" 
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
      
      {/* Marcador extra visual para selecionados (brilho) */}
      {isSelected && (
        <span className="absolute top-1 right-1.5 w-1.5 h-1.5 bg-white/30 rounded-full"></span>
      )}
    </button>
  );
};

export default NumberBall;