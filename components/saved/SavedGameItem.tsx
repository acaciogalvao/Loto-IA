
import React from 'react';
import { SavedGame, GameConfig, LotteryResult, PastGameResult } from '../../types';
import { calculatePrizeForHits } from '../../utils/lotteryLogic';

interface SavedGameItemProps {
  game: SavedGame;
  batchId: string;
  gameConfig: GameConfig;
  highlightResult: boolean;
  resultNums: Set<number> | null;
  resultToUse: LotteryResult | PastGameResult | null;
  deleteConfirmGameId: string | null;
  onDeleteGame: (e: React.MouseEvent, batchId: string, gameId: string) => void;
  onShare?: (e: React.MouseEvent, game: SavedGame) => void;
}

const SavedGameItem: React.FC<SavedGameItemProps> = ({
  game,
  batchId,
  gameConfig,
  highlightResult,
  resultNums,
  resultToUse,
  deleteConfirmGameId,
  onDeleteGame,
  onShare
}) => {
  const calculateHits = (gameNums: number[]) => {
    if (!resultNums) return 0;
    return gameNums.filter(n => resultNums.has(n)).length;
  };

  const formatCurrency = (val: number) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const hits = highlightResult ? calculateHits(game.numbers) : 0;
  
  // Verifica acerto do Time do Coração
  const resultTeam = resultToUse && 'timeCoracao' in resultToUse ? resultToUse.timeCoracao : null;
  const teamHit = highlightResult && game.team && resultTeam ? game.team.trim().toUpperCase() === resultTeam.trim().toUpperCase() : false;
  
  const prizeValue = (resultToUse && highlightResult) 
    ? calculatePrizeForHits(hits, resultToUse, gameConfig.id)
    : 0;

  const isWinner = prizeValue > 0 || teamHit;

  // --- LÓGICA DE CORES POR TIER ---
  const getTierConfig = (gameId: string, h: number) => {
    let t = 'none';
    if (gameId === 'lotofacil') {
        if (h === 15) t = 'gold';
        else if (h === 14) t = 'silver';
        else if (h === 13) t = 'bronze';
        else if (h >= 11) t = 'green';
    } else if (gameId === 'megasena' || gameId === 'duplasena') {
        if (h === 6) t = 'gold';
        else if (h === 5) t = 'silver';
        else if (h === 4) t = 'green'; // Mega não tem bronze tipico, 4 é o piso
    } else if (gameId === 'quina') {
        if (h === 5) t = 'gold';
        else if (h === 4) t = 'silver';
        else if (h === 3) t = 'bronze';
        else if (h === 2) t = 'green';
    } else if (gameId === 'lotomania') {
        if (h === 20) t = 'gold';
        else if (h === 19) t = 'silver';
        else if (h === 18) t = 'bronze';
        else if (h >= 15) t = 'green';
    } else if (gameId === 'timemania') {
        if (h === 7) t = 'gold';
        else if (h === 6) t = 'silver';
        else if (h === 5) t = 'bronze';
        else if (h >= 3) t = 'green';
    } else if (gameId === 'diadesorte') {
        if (h === 7) t = 'gold';
        else if (h === 6) t = 'silver';
        else if (h >= 4) t = 'green';
    } else if (gameId === 'supersete') {
        if (h === 7) t = 'gold';
        else if (h === 6) t = 'silver';
        else if (h === 5) t = 'bronze';
        else if (h >= 3) t = 'green';
    }
    return t;
  };

  const getStyles = (t: string) => {
    switch (t) {
        case 'gold': return {
            container: "bg-gradient-to-r from-yellow-950/50 to-amber-900/30 border-yellow-400 shadow-[0_0_25px_rgba(250,204,21,0.15)]",
            badge: "bg-gradient-to-r from-yellow-400 to-amber-500 text-yellow-950 shadow-yellow-500/50 animate-pulse border-yellow-300",
            text: "text-yellow-400"
        };
        case 'silver': return {
            container: "bg-slate-700/60 border-slate-300 shadow-[0_0_15px_rgba(255,255,255,0.08)]",
            badge: "bg-slate-200 text-slate-900 border-slate-100 shadow-sm",
            text: "text-slate-200"
        };
        case 'bronze': return {
            container: "bg-orange-950/40 border-orange-400/70 shadow-[0_0_10px_rgba(249,115,22,0.1)]",
            badge: "bg-orange-500 text-white border-orange-400",
            text: "text-orange-400"
        };
        case 'green': return {
            container: "bg-emerald-950/30 border-emerald-500/50 shadow-[inset_0_0_10px_rgba(16,185,129,0.05)]",
            badge: "bg-emerald-600 text-white border-emerald-500",
            text: "text-emerald-400"
        };
        default: return {
            container: "bg-slate-900/50 border-slate-800 opacity-60 grayscale-[0.5]",
            badge: "bg-slate-800 text-slate-500 border-slate-700",
            text: "text-slate-500"
        };
    }
  };

  const tier = highlightResult ? (isWinner ? getTierConfig(gameConfig.id, hits) : 'none') : 'normal';
  
  // Override para normal state (sem highlight)
  const styles = tier === 'normal' 
    ? { container: "bg-slate-900 border-slate-800", badge: "", text: "" } 
    : getStyles(tier);

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onShare) onShare(e, game);
    else {
        navigator.clipboard.writeText(game.numbers.join(', '));
    }
  };

  const numbersOpacity = tier === 'none' ? "opacity-50" : "opacity-100";

  return (
      <div className={`p-3 rounded-lg border flex flex-col gap-3 transition-all duration-300 relative group ${styles.container}`}>
          
          <div className="flex justify-between items-start">
              {/* ESQUERDA: ÍNDICE E NÚMEROS */}
              <div className="flex items-start gap-3 flex-1">
                  <div className="flex-shrink-0 mt-1">
                      <span className="font-mono font-bold text-[10px] text-slate-500 w-5 block text-center border-r border-slate-700 pr-2">
                        #{String(game.gameNumber).padStart(2,'0')}
                      </span>
                  </div>

                  <div className={`flex flex-wrap gap-1 ${numbersOpacity}`}>
                      {game.numbers.map((n) => {
                          const isHit = highlightResult && resultNums && resultNums.has(n);
                          
                          return (
                              <div 
                                key={n}
                                className={`
                                    w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold border transition-all duration-300
                                    ${isHit 
                                        ? 'bg-emerald-600 text-white border-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.5)] z-10 scale-105' 
                                        : 'bg-slate-800 text-slate-400 border-slate-700'
                                    }
                                `}
                              >
                                 {String(n).padStart(2, '0')}
                              </div>
                          );
                      })}
                  </div>
              </div>

              {/* DIREITA: BOTÃO DE DELETAR */}
              <button 
                  onClick={(e) => onDeleteGame(e, batchId, game.id)} 
                  className={`w-6 h-6 flex items-center justify-center rounded transition-colors text-slate-600 hover:text-red-400 hover:bg-slate-800 ${deleteConfirmGameId === game.id ? 'text-red-500 animate-pulse' : ''}`}
                  title="Excluir Jogo"
              >
                  ✕
              </button>
          </div>

          {/* Time do Coração Salvo */}
          {game.team && (
              <div className={`flex items-center gap-2 pl-10 ${numbersOpacity}`}>
                   <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border flex items-center gap-1 ${teamHit ? 'bg-yellow-500 text-slate-900 border-yellow-400 animate-pulse' : 'bg-slate-800 text-yellow-500 border-yellow-500/30'}`}>
                       <span>♥</span> {game.team}
                       {teamHit && <span>(ACERTOU!)</span>}
                   </span>
              </div>
          )}

          {/* RODAPÉ DO ITEM: RESULTADOS E AÇÕES */}
          {highlightResult && (
              <div className="flex items-center justify-between pt-2 border-t border-slate-700/30 mt-1">
                  
                  {/* Status do Acerto com Cor do Tier */}
                  <div className="flex items-center gap-2">
                      {hits > 0 ? (
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider border ${styles.badge}`}>
                              {hits} Acertos
                          </span>
                      ) : (
                          <span className="text-[10px] text-slate-600 font-bold uppercase">Zero Acertos</span>
                      )}
                  </div>

                  {/* VALOR DO PRÊMIO */}
                  {(isWinner) && (
                      <div className="flex flex-col items-end">
                          <span className={`text-[8px] font-bold uppercase tracking-wider opacity-80 ${styles.text}`}>Sua Premiação</span>
                          <span className={`text-sm font-mono font-black drop-shadow-sm ${styles.text}`}>
                              {prizeValue > 0 ? formatCurrency(prizeValue) : (teamHit ? 'Time' : '---')}
                          </span>
                      </div>
                  )}

                  {!isWinner && (
                     <button 
                        onClick={handleShare}
                        className="text-[10px] text-indigo-400 hover:text-indigo-300 font-bold flex items-center gap-1"
                     >
                        📤 <span className="hidden sm:inline">Compartilhar</span>
                     </button>
                  )}
              </div>
          )}
      </div>
  );
};

export default SavedGameItem;
