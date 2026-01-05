
import React, { useState } from 'react';
import { SavedBetBatch, GameConfig, LotteryResult, PastGameResult, SavedGame } from '../../types';
import { GAMES } from '../../utils/gameConfig';
import { getResultNumbersAsSet, calculatePrizeForHits } from '../../utils/lotteryLogic';
import SavedGameItem from './SavedGameItem';

interface SavedBatchCardProps {
  batch: SavedBetBatch;
  activeGameId: string;
  manualSearchResult: PastGameResult | null;
  latestResult: LotteryResult | null;
  onDeleteBatch: (e: React.MouseEvent, id: string) => void;
  onDeleteGame: (e: React.MouseEvent, batchId: string, gameId: string) => void;
  onShareBatch: (e: React.MouseEvent, batch: SavedBetBatch) => void;
  onShareGame: (e: React.MouseEvent, game: SavedGame) => void; 
  deleteConfirmBatchId: string | null;
  deleteConfirmGameId: string | null;
}

const SavedBatchCard: React.FC<SavedBatchCardProps> = ({
  batch,
  activeGameId,
  manualSearchResult,
  latestResult,
  onDeleteBatch,
  onDeleteGame,
  onShareBatch,
  onShareGame,
  deleteConfirmBatchId,
  deleteConfirmGameId
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const gameConfig = GAMES[batch.gameType] || GAMES['lotofacil'];
  
  // Determina qual resultado usar para conferência
  const resultToUse = manualSearchResult || (latestResult?.concurso === batch.targetConcurso ? latestResult : null);
  const resultNums = resultToUse ? getResultNumbersAsSet(resultToUse, batch.gameType) : null;
  
  const calculateHits = (gameNums: number[]) => {
      if (!resultNums) return 0;
      return gameNums.filter(n => resultNums.has(n)).length;
  };

  const formatCurrency = (val: number) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  // --- CÁLCULOS DO LOTE ---
  let totalBatchPrize = 0;
  let winningTicketsCount = 0;

  batch.games.forEach(g => {
      if (resultToUse && resultNums) {
          const hits = calculateHits(g.numbers);
          const prizeVal = calculatePrizeForHits(hits, resultToUse, batch.gameType);
          
          if (prizeVal > 0) {
              totalBatchPrize += prizeVal;
              winningTicketsCount++;
          }
      }
  });

  const isCurrentTarget = resultToUse && batch.targetConcurso === resultToUse.concurso;
  const highlightResult = manualSearchResult ? true : isCurrentTarget;
  const hasWins = totalBatchPrize > 0;
  const themeColor = gameConfig.theme.primary;

  // Identifica o tamanho do jogo (ex: 15, 16 dezenas)
  const gameSize = batch.games.length > 0 ? batch.games[0].numbers.length : 0;

  return (
      <div className={`rounded-xl border overflow-hidden transition-all duration-300 ${hasWins ? 'border-emerald-500/50 bg-slate-800' : 'border-slate-700 bg-slate-800/40'}`}>
          
          {/* HEADER DO LOTE */}
          <div 
            className="p-3 cursor-pointer select-none relative"
            onClick={() => setIsExpanded(!isExpanded)}
          >
              <div className="flex justify-between items-start">
                  
                  {/* LADO ESQUERDO: Ícone e Info Básica */}
                  <div className="flex items-center gap-3">
                      <div 
                        className="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-white shadow-lg text-lg relative"
                        style={{ backgroundColor: themeColor }}
                      >
                          {gameConfig.name[0]}
                          {/* Badge de quantidade de jogos */}
                          <div className="absolute -bottom-1 -right-1 bg-slate-900 text-slate-200 text-[9px] px-1.5 rounded-full border border-slate-600 font-mono">
                             {batch.games.length}
                          </div>
                      </div>
                      
                      <div>
                          <div className="flex items-center gap-2">
                             <h4 className="font-bold text-slate-200 text-sm">{gameConfig.name}</h4>
                             {gameSize > 0 && (
                                <span className="text-[9px] bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded border border-slate-600 font-bold">
                                    {gameSize} Dezenas
                                </span>
                             )}
                          </div>
                          <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5">
                              <span className="bg-slate-900/50 px-1.5 py-0.5 rounded border border-slate-700">Conc. {batch.targetConcurso}</span>
                              <span className="text-slate-500">{batch.createdAt}</span>
                          </div>
                      </div>
                  </div>

                  {/* LADO DIREITO: RESUMO FINANCEIRO DO LOTE */}
                  <div className="text-right">
                       {highlightResult ? (
                           hasWins ? (
                               <div className="flex flex-col items-end">
                                   <span className="text-[9px] font-bold text-emerald-500 uppercase tracking-wide bg-emerald-950/30 px-1.5 rounded border border-emerald-500/20 mb-0.5 animate-pulse">
                                       Lote Premiado
                                   </span>
                                   <span className="text-lg font-mono font-black text-emerald-400 drop-shadow-sm leading-none">
                                       {formatCurrency(totalBatchPrize)}
                                   </span>
                                   <span className="text-[9px] text-emerald-500/60 mt-0.5">{winningTicketsCount} bilhetes premiados</span>
                               </div>
                           ) : (
                               <div className="flex flex-col items-end text-slate-500 opacity-60">
                                   <span className="text-[9px] font-bold uppercase">Resultado</span>
                                   <span className="text-xs font-bold">Sem Prêmios</span>
                               </div>
                           )
                       ) : (
                           <div className="text-slate-500">
                               <span className="text-xl">Wait</span>
                           </div>
                       )}
                  </div>
              </div>

              {/* Botão de Expandir Discreto */}
              <div className="absolute bottom-1 left-1/2 -translate-x-1/2 opacity-30 text-[10px] scale-75">
                  {isExpanded ? '▲' : '▼'}
              </div>
          </div>

          {/* BARRA DE AÇÕES DO LOTE */}
          {isExpanded && (
              <div className="bg-slate-900/80 px-3 py-2 flex justify-between items-center border-y border-slate-700/50">
                   <button 
                        onClick={(e) => onShareBatch(e, batch)} 
                        className="text-[10px] font-bold text-blue-300 hover:text-white flex items-center gap-1 transition-colors px-2 py-1 rounded hover:bg-slate-800"
                    >
                        📤 Compartilhar Lista
                    </button>
                   <button 
                        onClick={(e) => onDeleteBatch(e, batch.id)} 
                        className={`text-[10px] font-bold px-2 py-1 rounded border transition-colors ${deleteConfirmBatchId === batch.id ? 'bg-red-600 text-white border-red-500' : 'text-slate-500 border-transparent hover:text-red-400'}`}
                    >
                        {deleteConfirmBatchId === batch.id ? 'Toque para Confirmar' : 'Excluir Lote'}
                   </button>
              </div>
          )}
          
          {/* LISTA DE JOGOS (ITEMS) */}
          {isExpanded && (
            <div className="p-2 space-y-2 bg-slate-950/30">
                {batch.games.map((g) => (
                    <SavedGameItem 
                        key={g.id}
                        game={g}
                        batchId={batch.id}
                        gameConfig={gameConfig}
                        highlightResult={Boolean(highlightResult)}
                        resultNums={resultNums}
                        resultToUse={resultToUse}
                        deleteConfirmGameId={deleteConfirmGameId}
                        onDeleteGame={onDeleteGame}
                        onShare={onShareGame}
                    />
                ))}
            </div>
          )}
      </div>
  );
};

export default SavedBatchCard;
