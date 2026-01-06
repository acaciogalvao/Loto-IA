
import React from 'react';
import { GameConfig, AppStatus } from '../types';

interface GameControlsProps {
  activeGame: GameConfig;
  status: AppStatus;
  loadingProgress: number;
  selectionCount: number;
  closingMethod: string;
  onClear: () => void;
  onAiSuggestion: () => void;
  onGenerate: () => void;
}

const GameControls: React.FC<GameControlsProps> = ({
  activeGame,
  status,
  loadingProgress,
  selectionCount,
  closingMethod,
  onClear,
  onAiSuggestion,
  onGenerate
}) => {
  return (
    <footer className="fixed bottom-0 left-0 right-0 bg-slate-800/95 backdrop-blur-md border-t border-slate-700 p-3 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-40 pb-[calc(12px+env(safe-area-inset-bottom))]">
        <div className="max-w-lg mx-auto flex gap-3">
          <button onClick={onClear} className="px-4 py-3 rounded-xl bg-slate-700 text-slate-300 font-bold border border-slate-600 active:scale-95 transition-transform">Limpar</button>
          
          {activeGame.id !== 'federal' && (
             <button 
                onClick={onAiSuggestion} 
                className="flex-1 py-3 rounded-xl text-white font-bold shadow-lg active:scale-95 transition-transform relative overflow-hidden border border-white/20"
                style={{ backgroundColor: activeGame.theme.secondary, color: activeGame.theme.text }}
                disabled={status !== AppStatus.IDLE}
             >
               {status === AppStatus.GENERATING ? (
                   <>
                       <span className="relative z-10 text-xs">Analisando... {Math.round(loadingProgress)}%</span>
                       <div className="absolute top-0 left-0 h-full bg-black/20 transition-all duration-300 ease-out" style={{ width: `${loadingProgress}%` }}></div>
                   </>
               ) : '🔮 Palpite IA'}
             </button>
          )}
          
          <button 
            onClick={onGenerate}
            disabled={status === AppStatus.GENERATING || (activeGame.id !== 'federal' && selectionCount > 0 && selectionCount < activeGame.minSelection)}
            className={`flex-1 py-3 rounded-xl font-bold shadow-lg text-white active:scale-95 transition-transform relative overflow-hidden ${activeGame.id !== 'federal' && selectionCount > 0 && selectionCount < activeGame.minSelection ? 'bg-slate-600 opacity-50' : ''}`}
            style={!(activeGame.id !== 'federal' && selectionCount > 0 && selectionCount < activeGame.minSelection) ? { 
                backgroundColor: activeGame.theme.primary,
                color: activeGame.theme.text
            } : {}}
          >
            {status === AppStatus.GENERATING ? (
                <>
                  <span className="relative z-10 text-xs">Processando... {Math.round(loadingProgress)}%</span>
                  <div className="absolute top-0 left-0 h-full bg-black/20 transition-all duration-100 ease-linear" style={{ width: `${loadingProgress}%` }}></div>
                </>
            ) : (activeGame.id === 'federal' ? '🎫 Gerar Palpites' : (selectionCount === 0 ? '🎲 Gerar Automático' : (closingMethod === 'reduced' ? 'Gerar Fechamento' : (closingMethod === 'smart_pattern' ? 'Gerar (Padrão Ouro)' : (closingMethod === 'free_mode' ? 'Gerar (Modo Livre)' : 'Gerar Jogos')))))}
          </button>
        </div>
    </footer>
  );
};

export default GameControls;
