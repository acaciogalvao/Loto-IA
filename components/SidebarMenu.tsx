
import React from 'react';
import { GameConfig } from '../types';
import { GAMES } from '../utils/gameConfig';

interface SidebarMenuProps {
  isOpen: boolean;
  onClose: () => void;
  activeGameId: string;
  onGameChange: (id: string) => void;
}

const SidebarMenu: React.FC<SidebarMenuProps> = ({ isOpen, onClose, activeGameId, onGameChange }) => {
  return (
    <div className={`fixed inset-0 z-50 bg-black/80 backdrop-blur-sm transition-opacity duration-300 ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`} onClick={onClose}>
       <div className={`absolute top-0 left-0 bottom-0 w-64 bg-slate-800 shadow-2xl transform transition-transform duration-300 ${isOpen ? 'translate-x-0' : '-translate-x-full'} flex flex-col`} onClick={e => e.stopPropagation()}>
          <div className="p-5 border-b border-slate-700 flex justify-between items-center bg-gradient-to-r from-slate-900 to-slate-800 pt-[calc(20px+env(safe-area-inset-top))]">
              <h2 className="font-bold text-xl text-white">Jogos</h2>
              <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
          </div>
          
          <div className="p-2 space-y-1 flex-1 overflow-y-auto">
              {Object.values(GAMES).map((game: GameConfig) => {
                  const isActive = activeGameId === game.id;
                  return (
                    <button 
                        key={game.id}
                        onClick={() => onGameChange(game.id)}
                        className={`w-full text-left p-3 rounded-lg flex items-center gap-3 transition-all ${isActive ? 'text-white shadow-lg scale-[1.02]' : 'text-slate-300 hover:bg-slate-700'}`}
                        style={isActive ? { backgroundColor: game.theme.primary, color: game.theme.text } : {}}
                    >
                        <span 
                          className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${isActive ? 'bg-white/20' : 'bg-slate-700'}`}
                          style={!isActive ? { color: game.theme.primary } : {}}
                        >
                          {game.name[0]}
                        </span>
                        <span className="font-medium">{game.name}</span>
                    </button>
                  );
              })}
          </div>

          <div className="p-4 border-t border-slate-700/50 text-center bg-slate-900/50 pb-[calc(16px+env(safe-area-inset-bottom))]">
             <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest opacity-60">
                 LotoSmart AI v1.0.1
             </span>
          </div>
       </div>
    </div>
  );
};

export default SidebarMenu;
