
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
  
  // Busca o valor direto da API para essa faixa de acerto
  // Em Timemania, o prêmio do Time do Coração geralmente é separado. 
  // O helper calculatePrizeForHits pode precisar de ajuste se for somar, mas aqui trataremos como bônus.
  const prizeValue = (resultToUse && highlightResult) 
    ? calculatePrizeForHits(hits, resultToUse, gameConfig.id)
    : 0;

  // Se acertou o time, soma o prêmio fixo (geralmente R$ 7,50 ou similar, mas vamos pegar da API se possível ou assumir win)
  // A API Guidi retorna prêmios em listaRateioPremio. O Time do Coração costuma vir como uma faixa específica.
  // Como simplificação, consideramos vitória se prizeValue > 0 ou teamHit.
  
  // Regra de vitória (Financeira ou por faixa mínima de acerto)
  const isWinner = prizeValue > 0 || teamHit || (
      highlightResult && (
        (gameConfig.id === 'lotofacil' && hits >= 11) || 
        (gameConfig.id === 'megasena' && hits >= 4) ||
        (gameConfig.id === 'quina' && hits >= 2) ||
        (gameConfig.id === 'supersete' && hits >= 3) ||
        (gameConfig.id === 'timemania' && hits >= 3)
      )
  );

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onShare) onShare(e, game);
    else {
        navigator.clipboard.writeText(game.numbers.join(', '));
    }
  };

  // --- ESTILOS DINÂMICOS ---
  let containerClass = "bg-slate-900 border-slate-800";
  let numbersOpacity = "opacity-100";
  
  if (highlightResult) {
      if (isWinner) {
          // VENCEDOR: Borda Verde/Dourada e Fundo Sutil
          containerClass = "bg-emerald-950/20 border-emerald-500/50 shadow-[inset_0_0_20px_rgba(16,185,129,0.05)]";
      } else {
          // PERDEDOR: Mais apagado para dar foco aos vencedores
          containerClass = "bg-slate-900/50 border-slate-800 opacity-70";
          numbersOpacity = "opacity-60 grayscale";
      }
  }

  return (
      <div className={`p-3 rounded-lg border flex flex-col gap-3 transition-all relative group ${containerClass}`}>
          
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

              {/* DIREITA: BOTÃO DE DELETAR (Só aparece no hover ou mobile) */}
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
                  
                  {/* Status do Acerto */}
                  <div className="flex items-center gap-2">
                      {hits > 0 ? (
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${isWinner ? 'bg-emerald-500 text-slate-900' : 'bg-slate-700 text-slate-400'}`}>
                              {hits} Acertos
                          </span>
                      ) : (
                          <span className="text-[10px] text-slate-600 font-bold uppercase">Zero Acertos</span>
                      )}
                  </div>

                  {/* VALOR DO PRÊMIO (EXTRATO) */}
                  {isWinner && (
                      <div className="flex flex-col items-end">
                          <span className="text-[8px] text-emerald-500/70 font-bold uppercase tracking-wider">Sua Premiação</span>
                          <span className="text-sm font-mono font-black text-emerald-400 drop-shadow-sm">
                              {prizeValue > 0 ? formatCurrency(prizeValue) : (teamHit ? 'Time' : '---')}
                          </span>
                      </div>
                  )}

                  {/* Se não ganhou, mostra botão de compartilhar discreto */}
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
