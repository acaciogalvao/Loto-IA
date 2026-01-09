
import React, { useMemo } from 'react';
import { GameConfig, DetailedStats } from '../types';
import TicketNumbers from './tickets/TicketNumbers';
import TicketStats from './tickets/TicketStats';
import { calculateGameScore } from '../utils/lotteryLogic';

interface LotteryTicketProps {
  game: number[];
  index: number; 
  gameNumber?: number; 
  activeGame: GameConfig;
  hits?: number; 
  isSavedView?: boolean; 
  isCopied?: boolean;
  isExpanded?: boolean;
  detailedStats?: DetailedStats | null;
  onCopy?: () => void;
  onAction?: (e: React.MouseEvent) => void; 
  onToggleStats?: (e: React.MouseEvent) => void;
  onShare?: (e: React.MouseEvent) => void; 
  resultNumbers?: Set<number>; 
  team?: string | null; 
}

const LotteryTicket: React.FC<LotteryTicketProps> = ({
  game,
  index,
  gameNumber,
  activeGame,
  hits = 0,
  isSavedView = false,
  isCopied = false,
  isExpanded = false,
  detailedStats,
  onCopy,
  onAction,
  onToggleStats,
  onShare,
  resultNumbers,
  team
}) => {
  const displayNum = gameNumber || index + 1;
  const isFederal = activeGame.id === 'federal';

  const score = useMemo(() => {
     if (isFederal) return 0;
     return calculateGameScore(game, activeGame);
  }, [game, activeGame, isFederal]);

  // --- LÓGICA DE CORES POR TIER ---
  const getTier = () => {
    if (!resultNumbers || resultNumbers.size === 0) return 'none';
    const h = hits;
    const gameId = activeGame.id;

    if (gameId === 'lotofacil') {
        if (h === 15) return 'gold';
        if (h === 14) return 'silver';
        if (h === 13) return 'bronze';
        if (h >= 11) return 'green';
    } else if (gameId === 'megasena' || gameId === 'duplasena') {
        if (h === 6) return 'gold';
        if (h === 5) return 'silver';
        if (h === 4) return 'green';
    } else if (gameId === 'quina') {
        if (h === 5) return 'gold';
        if (h === 4) return 'silver';
        if (h === 3) return 'bronze';
        if (h === 2) return 'green';
    } else if (gameId === 'lotomania') {
        if (h >= 20) return 'gold';
        if (h === 19) return 'silver';
        if (h === 18) return 'bronze';
        if (h >= 15) return 'green';
    } else if (gameId === 'diadesorte') {
        if (h === 7) return 'gold';
        if (h === 6) return 'silver';
        if (h >= 4) return 'green';
    } else if (gameId === 'supersete') {
        if (h === 7) return 'gold';
        if (h === 6) return 'silver';
        if (h === 5) return 'bronze';
        if (h >= 3) return 'green';
    }
    return 'none';
  };

  const getTierStyles = () => {
      const tier = getTier();
      switch(tier) {
          case 'gold': return "ring-2 ring-yellow-400 shadow-[0_0_20px_rgba(250,204,21,0.3)] bg-gradient-to-r from-yellow-950/40 to-amber-900/20 border-yellow-500/50";
          case 'silver': return "ring-2 ring-slate-300 shadow-[0_0_15px_rgba(255,255,255,0.1)] bg-slate-800 border-slate-400/50";
          case 'bronze': return "ring-2 ring-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.2)] bg-orange-950/30 border-orange-500/40";
          case 'green': return "ring-2 ring-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.2)] bg-emerald-950/20 border-emerald-500/40";
          default: return "bg-slate-800 border-slate-700";
      }
  };

  const getBadgeStyle = () => {
      const tier = getTier();
      switch(tier) {
          case 'gold': return "bg-yellow-400 text-yellow-950 border-yellow-300 animate-pulse shadow-yellow-500/50";
          case 'silver': return "bg-slate-200 text-slate-900 border-slate-100";
          case 'bronze': return "bg-orange-500 text-white border-orange-400";
          case 'green': return "bg-emerald-600 text-white border-emerald-500";
          default: return "bg-slate-700/50 text-slate-500 border-slate-600";
      }
  };

  return (
    <div 
        onClick={onCopy}
        className={`relative rounded-xl border p-4 overflow-hidden group cursor-pointer transition-all duration-200 active:scale-[0.99] ${getTierStyles()} ${isCopied ? 'ring-2 ring-blue-500' : ''}`}
    >
        {/* Header do Ticket */}
        <div className="flex justify-between items-start mb-3">
            <div>
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-700">
                        JOGO {String(displayNum).padStart(2, '0')}
                    </span>
                    
                    {/* Selo de Pontos */}
                    {resultNumbers && resultNumbers.size > 0 && (
                        <div className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase border shadow-sm ${getBadgeStyle()}`}>
                            {hits} Acertos
                        </div>
                    )}
                </div>
                
                {/* Score IQ */}
                {!isFederal && score > 0 && (
                     <div className="flex items-center gap-1 mt-1">
                         <div className="h-1 w-10 bg-slate-700 rounded-full overflow-hidden">
                             <div className="h-full bg-indigo-500" style={{width: `${score}%`}}></div>
                         </div>
                         <span className={`text-[8px] font-bold ${score > 70 ? 'text-indigo-400' : 'text-slate-500'}`}>IQ {score}</span>
                     </div>
                )}
            </div>

            {/* Ações */}
            <div className="flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                 {!isFederal && onToggleStats && (
                    <button 
                        onClick={(e) => { e.stopPropagation(); onToggleStats(e); }}
                        className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors ${isExpanded ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600 hover:text-white'}`}
                    >
                        <span className="text-xs">📊</span>
                    </button>
                 )}
                 {onAction && (
                    <button 
                        onClick={(e) => { e.stopPropagation(); onAction(e); }}
                        className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors ${isSavedView ? 'bg-red-900/30 text-red-400 border border-red-900/50' : 'bg-slate-700 text-slate-400 hover:bg-emerald-600 hover:text-white'}`}
                    >
                        <span className="text-xs">{isSavedView ? '✕' : '💾'}</span>
                    </button>
                 )}
            </div>
        </div>

        {/* Números */}
        <TicketNumbers 
            numbers={game} 
            activeGame={activeGame} 
            resultNumbers={resultNumbers} 
        />
        
        {/* Time do Coração */}
        {team && (
            <div className="mt-3 text-[10px] font-bold text-yellow-500 flex items-center gap-1 bg-yellow-500/10 px-2 py-1 rounded border border-yellow-500/20 w-fit">
                <span>♥</span>
                <span className="uppercase">{team}</span>
            </div>
        )}
        
        {/* Stats Expandidos */}
        {isExpanded && (
            <div className="mt-3 pt-3 border-t border-slate-700 animate-slide-down">
                <TicketStats 
                    stats={detailedStats || null} 
                    activeGame={activeGame} 
                    resultNumbers={resultNumbers}
                    gameNumbers={game}
                />
            </div>
        )}

        {/* Rodapé Compartilhar */}
        {onShare && (
            <div className="mt-3 pt-2 border-t border-slate-700/50 flex justify-center">
                <button 
                    onClick={(e) => { e.stopPropagation(); onShare(e); }}
                    className="flex items-center gap-1 text-[10px] font-bold text-slate-500 hover:text-slate-300 uppercase tracking-wide"
                >
                    <span>📤 Compartilhar</span>
                </button>
            </div>
        )}

        {/* Overlay Copiado */}
        {isCopied && (
            <div className="absolute inset-0 z-20 bg-emerald-900/90 flex items-center justify-center animate-fade-in backdrop-blur-sm">
                <div className="text-white font-bold flex flex-col items-center">
                    <span className="text-2xl mb-1">📋</span>
                    <span className="text-xs uppercase tracking-widest">Copiado!</span>
                </div>
            </div>
        )}
    </div>
  );
};

export default LotteryTicket;
