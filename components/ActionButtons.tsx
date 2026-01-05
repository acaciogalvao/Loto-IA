
import React from 'react';
import { GameConfig, AppStatus } from '../types';

interface ActionButtonsProps {
  activeGame: GameConfig;
  status: AppStatus;
  loadingProgress: number;
  onGenerateTop: () => void;
  onOpenAnalysis: () => void;
  hasResult: boolean;
}

const ActionButtons: React.FC<ActionButtonsProps> = ({ 
  activeGame, 
  status, 
  loadingProgress, 
  onGenerateTop, 
  onOpenAnalysis,
  hasResult
}) => {
  if (activeGame.id === 'federal') return null;

  return (
    <div className="grid grid-cols-2 gap-4">
      {/* Botão Padrão Ouro */}
      <button 
        onClick={onGenerateTop}
        disabled={status !== AppStatus.IDLE && status !== AppStatus.SUCCESS}
        className="group relative overflow-hidden rounded-2xl p-0.5 transition-all active:scale-95 shadow-lg"
        style={{ background: `linear-gradient(135deg, ${activeGame.theme.primary}, ${activeGame.theme.secondary})` }}
      >
        <div className="absolute inset-0 bg-white/10 group-hover:bg-white/0 transition-colors"></div>
        <div className="relative h-full bg-slate-900 rounded-[14px] p-4 flex flex-col items-center justify-center text-center gap-2 group-hover:bg-slate-800 transition-colors">
            {status === AppStatus.GENERATING ? (
                <div className="flex flex-col items-center w-full">
                    <div className="w-8 h-8 border-2 border-slate-600 border-t-white rounded-full animate-spin mb-2"></div>
                    <span className="text-[10px] font-bold text-slate-400">Processando {loadingProgress}%</span>
                </div>
            ) : (
                <>
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-xl shadow-lg shadow-orange-500/20">
                        🔥
                    </div>
                    <div>
                        <span className="block text-sm font-bold text-white leading-tight">Padrão Ouro</span>
                        <span className="block text-[9px] text-slate-400 font-medium mt-0.5">Jogos Otimizados</span>
                    </div>
                </>
            )}
        </div>
      </button>
      
      {/* Botão Raio-X */}
      <button 
        onClick={onOpenAnalysis}
        className="group relative overflow-hidden rounded-2xl p-0.5 transition-all active:scale-95 shadow-lg bg-gradient-to-br from-slate-700 to-slate-600"
      >
        <div className="absolute inset-0 bg-white/5 group-hover:bg-white/0 transition-colors"></div>
        <div className="relative h-full bg-slate-900 rounded-[14px] p-4 flex flex-col items-center justify-center text-center gap-2 group-hover:bg-slate-800 transition-colors">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-xl shadow-lg shadow-indigo-500/20">
                🔍
            </div>
            <div>
                <span className="block text-sm font-bold text-white leading-tight">Raio-X</span>
                <span className="block text-[9px] text-slate-400 font-medium mt-0.5">Análise Histórica</span>
            </div>
        </div>
      </button>
    </div>
  );
};

export default ActionButtons;
