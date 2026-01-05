
import React, { useMemo } from 'react';
import { motion, PanInfo } from 'framer-motion';
import { GAMES } from '../utils/gameConfig';
import { getResultNumbersAsSet, calculatePrizeForHits, isFixedPrize } from '../utils/lotteryLogic';
import FinancialSummary from './saved/FinancialSummary';
import SavedBatchCard from './saved/SavedBatchCard';
import { useGameContext } from '../contexts/GameContext';
import { SavedBetBatch, SavedGame } from '../types';

// Modal agora é autocontido e busca dados do contexto
const SavedGamesModal: React.FC = () => {
  const { 
    showSavedGamesModal: isOpen,
    setShowSavedGamesModal: onClose, // Mapped to context setter
    savedBatches,
    manualSearchConcurso,
    setManualSearchConcurso,
    manualSearchResult,
    isManualSearchLoading,
    handleManualSearch,
    clearManualSearch,
    activeGame,
    latestResult,
    handleDeleteBatch,
    handleDeleteGame,
    deleteConfirmBatchId,
    deleteConfirmGameId,
    grandTotalPrize
  } = useGameContext();
  
  const activeResult = manualSearchResult || latestResult;
  const activeGameId = activeGame.id;

  // --- LÓGICA FINANCEIRA DETALHADA ---
  const { totalInvested, displayTotalPrize, netBalance, relevantBatchesCount, hasSplitPrize, winnersCount } = useMemo(() => {
    let invested = 0;
    let individualPrizeSum = 0; 
    let count = 0;
    let splitDetected = false;
    let maxWinnersFound = 0;
    
    const resultSet = activeResult ? getResultNumbersAsSet(activeResult, activeGameId) : null;
    const activeGameConfig = GAMES[activeGameId];

    savedBatches.forEach(batch => {
        if (batch.gameType !== activeGameId) return;

        const isTarget = manualSearchResult 
            ? true 
            : (activeResult && batch.targetConcurso === activeResult.concurso);

        if (isTarget) {
             count++;
             batch.games.forEach(g => {
                 const qty = g.numbers.length;
                 const priceItem = activeGameConfig.priceTable.find(p => p.quantity == qty);
                 const cost = (priceItem && typeof priceItem.price === 'number') ? priceItem.price : 0;
                 invested += cost;

                 if (resultSet && activeResult) {
                     const hits = g.numbers.filter(n => resultSet.has(n)).length;
                     const prizeForTicket = calculatePrizeForHits(hits, activeResult, activeGameId);
                     
                     if (prizeForTicket > 0) {
                         individualPrizeSum += prizeForTicket;
                     }

                     const pEntry = activeResult.premiacoes.find(p => p.faixa === hits);
                     if (pEntry && pEntry.ganhadores > 1 && !isFixedPrize(activeGameId, hits)) {
                        splitDetected = true;
                        maxWinnersFound = Math.max(maxWinnersFound, pEntry.ganhadores);
                     }
                 }
             });
        }
    });

    return { 
        totalInvested: invested, 
        displayTotalPrize: individualPrizeSum,
        netBalance: individualPrizeSum - invested, 
        relevantBatchesCount: count,
        hasSplitPrize: splitDetected,
        winnersCount: maxWinnersFound
    };
  }, [savedBatches, manualSearchResult, latestResult, activeGameId, activeResult]);

  if (!isOpen) return null;

  const handleDragEnd = (_: any, info: PanInfo) => {
    if (info.offset.y > 100) onClose(false);
  };
  
  const handleManualSearchWrapper = async () => {
      await handleManualSearch();
  };

  // --- FUNÇÕES DE COMPARTILHAMENTO APRIMORADAS ---
  
  const formatGameForShare = (numbers: number[]): string => {
      return numbers.map(n => String(n).padStart(2, '0')).join(' ');
  };

  const shareTextContent = async (text: string, title: string) => {
      if (navigator.share) {
          try {
              await navigator.share({
                  title: title,
                  text: text
              });
          } catch (error) {
              console.log('Compartilhamento cancelado', error);
          }
      } else {
          navigator.clipboard.writeText(text);
          alert("Texto copiado para a área de transferência!");
      }
  };

  const onShareBatch = (e: React.MouseEvent, batch: SavedBetBatch) => {
      e.stopPropagation();
      const gameConfig = GAMES[batch.gameType] || activeGame;
      const header = `🎰 *LotoSmart AI* - ${gameConfig.name}\n📋 *Lote Salvo* (Conc. ${batch.targetConcurso})\n\n`;
      const body = batch.games.map((g, i) => `*Jogo ${g.gameNumber || i + 1}:* ${formatGameForShare(g.numbers)}`).join('\n');
      const footer = `\n\n🍀 Boa sorte!`;
      
      shareTextContent(header + body + footer, `Lote ${gameConfig.name}`);
  };

  const onShareGame = (e: React.MouseEvent, game: SavedGame) => {
      e.stopPropagation();
      const line = formatGameForShare(game.numbers);
      const text = `🎰 *LotoSmart AI* - ${activeGame.name}\n*Jogo ${game.gameNumber}:* ${line}\n\n🍀 Boa sorte!`;
      shareTextContent(text, `Jogo ${game.gameNumber}`);
  };

  const activeResultLabel = manualSearchResult 
      ? `Resumo Financeiro • Concurso ${manualSearchResult.concurso}` 
      : 'Resumo Financeiro • Concurso Atual';
      
  const currentGameTheme = GAMES[activeGameId]?.theme || GAMES['lotofacil'].theme;

  return (
    <motion.div
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      transition={{ type: "spring", damping: 25, stiffness: 300 }}
      drag="y"
      dragConstraints={{ top: 0 }}
      onDragEnd={handleDragEnd}
      className="fixed inset-0 z-[100] bg-slate-900 flex flex-col pt-[env(safe-area-inset-top)]"
    >
       {/* MODAL HEADER */}
       <div 
         className="flex justify-between items-center p-4 border-b border-white/10 sticky top-0 z-10 shadow-lg"
         style={{ backgroundColor: currentGameTheme.primary, color: currentGameTheme.text }}
       >
           <h2 className="text-xl font-bold flex items-center gap-2"><span>📁</span> Meus Jogos</h2>
           <button onClick={() => onClose(false)} className="w-8 h-8 flex items-center justify-center bg-black/20 hover:bg-black/30 rounded-full font-bold active:scale-95 transition-colors">✕</button>
       </div>

       <div className="flex-1 overflow-y-auto p-4 space-y-5 pb-20 bg-gradient-to-b from-slate-900 to-slate-950">
          
          {/* PAINEL DE BUSCA */}
          <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700 shadow-md backdrop-blur-sm">
              <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-2">Simular / Conferir Passado</label>
              <div className="flex gap-2">
                  <input type="number" placeholder="Digite o Concurso..." className="flex-1 bg-slate-950 border border-slate-600 rounded-lg px-3 py-2 text-white font-mono focus:ring-2 focus:ring-purple-500 outline-none transition-all placeholder:text-slate-600" value={manualSearchConcurso} onChange={(e) => setManualSearchConcurso(e.target.value)} />
                  <button onClick={handleManualSearchWrapper} disabled={isManualSearchLoading} className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg font-bold disabled:opacity-50 shadow-lg active:scale-95 transition-transform border border-purple-500">
                      {isManualSearchLoading ? '...' : '🔍'}
                  </button>
                  {manualSearchResult && <button onClick={clearManualSearch} className="bg-slate-700 text-slate-300 px-3 py-2 rounded-lg font-bold hover:bg-slate-600 border border-slate-600">✕</button>}
              </div>
          </div>

          {/* PAINEL FINANCEIRO */}
          {relevantBatchesCount > 0 && (
               <FinancialSummary 
                  totalInvested={totalInvested}
                  totalPrize={displayTotalPrize}
                  netBalance={netBalance}
                  resultLabel={activeResultLabel}
                  hasSplitPrize={hasSplitPrize}
                  winnersCount={winnersCount}
               />
           )}

          {/* INFO DO CONCURSO BUSCADO */}
          {manualSearchResult && (
              <div className="bg-slate-800 border border-emerald-500/30 rounded-xl p-4 animate-fade-in relative overflow-hidden shadow-[0_0_20px_rgba(16,185,129,0.1)]">
                  <div className="absolute top-0 right-0 px-2 py-1 bg-emerald-600 text-[10px] font-bold text-white rounded-bl-lg shadow-sm">Concurso Localizado</div>
                  <h3 className="font-bold text-emerald-400">Concurso {manualSearchResult.concurso}</h3>
                  <p className="text-[10px] text-slate-400 mb-3">{manualSearchResult.data}</p>
                  <div className="flex flex-wrap gap-1.5">
                       {manualSearchResult.dezenas.map(d => (
                           <span key={d} className="w-7 h-7 rounded-full bg-emerald-900/50 text-emerald-200 border border-emerald-500/30 flex items-center justify-center text-xs font-bold shadow-sm">{d}</span>
                       ))}
                  </div>
              </div>
          )}
          
          {/* LISTA DE JOGOS */}
          {savedBatches.length === 0 ? (
              <div className="text-center py-12 text-slate-600 flex flex-col items-center">
                  <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-3">
                    <span className="text-3xl opacity-50">📂</span>
                  </div>
                  <p className="font-bold text-slate-500">Nenhum jogo salvo</p>
                  <p className="text-xs max-w-[200px] mt-1">Gere novos jogos e clique em salvar para que eles apareçam aqui.</p>
              </div>
          ) : (
              <div className="space-y-4">
                {savedBatches.filter(b => b.gameType === activeGameId).map((batch) => (
                    <SavedBatchCard
                      key={batch.id}
                      batch={batch}
                      activeGameId={activeGameId}
                      manualSearchResult={manualSearchResult}
                      latestResult={latestResult}
                      onDeleteBatch={handleDeleteBatch}
                      onDeleteGame={handleDeleteGame}
                      onShareBatch={onShareBatch}
                      onShareGame={onShareGame}
                      deleteConfirmBatchId={deleteConfirmBatchId}
                      deleteConfirmGameId={deleteConfirmGameId}
                    />
                ))}
                {savedBatches.filter(b => b.gameType === activeGameId).length === 0 && (
                    <div className="text-center py-8 text-slate-500">
                        <p>Nenhum jogo salvo para <strong>{GAMES[activeGameId].name}</strong>.</p>
                    </div>
                )}
              </div>
          )}
       </div>
    </motion.div>
  );
};

export default SavedGamesModal;
