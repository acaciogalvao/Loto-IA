
import React from 'react';
import { useGameContext } from '../contexts/GameContext';

interface HeaderProps {
  activeGame: any; // Mantido para compatibilidade se passado, mas preferimos usar context
  onOpenMenu: () => void;
  onOpenInfo: () => void;
  onOpenSaved: () => void;
  savedCount?: number; // Opcional, pois pegamos do context
}

const Header: React.FC<HeaderProps> = ({ onOpenMenu, onOpenInfo, onOpenSaved }) => {
  const { activeGame, savedBatches } = useGameContext();
  
  const savedCount = savedBatches.filter(b => b.gameType === activeGame.id).length;

  return (
    <header className="bg-slate-800 border-b border-slate-700 p-3 sticky top-0 z-40 shadow-md pt-[calc(12px+env(safe-area-inset-top))]">
      <div className="flex justify-between items-center max-w-lg mx-auto">
        <div className="flex items-center gap-3">
          <button onClick={onOpenMenu} className="p-2 text-slate-300 hover:text-white bg-slate-700/50 rounded-lg active:scale-95 transition-transform">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          <div className="flex items-center gap-2">
              <div>
                  <h1 className="text-lg font-bold leading-none" style={{ color: activeGame.theme.primary }}>
                    {activeGame.name}
                  </h1>
                  <span className="text-[10px] text-slate-500 font-bold tracking-wider">LOTOSMART AI</span>
              </div>
              <button onClick={onOpenInfo} className="w-6 h-6 rounded-full bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center text-xs font-bold border border-slate-600 ml-1 active:scale-95" title="Como Jogar">ℹ️</button>
          </div>
        </div>
        <button 
          onClick={onOpenSaved}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-full text-xs font-bold text-slate-200 border border-slate-600 active:scale-95 transition-transform"
        >
          <span>📁</span>
          {savedCount > 0 && (
            <span 
              className="text-white w-4 h-4 flex items-center justify-center rounded-full text-[9px] ml-1 shadow-sm"
              style={{ backgroundColor: activeGame.theme.primary, color: activeGame.theme.text }}
            >
                {savedCount}
            </span>
          )}
        </button>
      </div>
    </header>
  );
};

export default Header;
