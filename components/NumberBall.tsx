import React from 'react';

interface NumberBallProps {
  number: number;
  isSelected: boolean;
  isRecentResult?: boolean; // New prop for last result highlighting
  onClick: (num: number) => void;
  disabled?: boolean;
}

const NumberBall: React.FC<NumberBallProps> = ({ number, isSelected, isRecentResult, onClick, disabled }) => {
  const baseClasses = "w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center font-bold text-sm sm:text-base transition-all duration-200 shadow-sm relative";
  
  // Selection styles
  const selectedClasses = "bg-purple-600 text-white shadow-purple-500/50 scale-105";
  const unselectedClasses = "bg-slate-700 text-slate-300 hover:bg-slate-600";
  
  // Recent result style (Green border/ring)
  // If selected and recent: Purple bg + Green ring
  // If not selected and recent: Slate bg + Green ring + Emerald Text
  const recentResultClasses = isRecentResult 
    ? "ring-2 ring-emerald-500 ring-offset-2 ring-offset-slate-900 z-10" 
    : "";

  const disabledClasses = "opacity-50 cursor-not-allowed";

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
      {number.toString().padStart(2, '0')}
      
      {/* Tiny indicator dot for recent result (optional, but adds clarity) */}
      {isRecentResult && !isSelected && (
        <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-slate-900"></span>
      )}
    </button>
  );
};

export default NumberBall;