import React, { useState, useEffect, useMemo } from 'react';
import { generateCombinations, getStats } from './utils/lotteryLogic';
import { getAiSuggestions, analyzeClosing, getLotteryTrends, generateSmartClosing, getHistoricalSimulation } from './services/geminiService';
import { fetchLatestResult, fetchPastResults } from './services/lotteryService';
import { saveBets, getSavedBets, syncBets } from './services/storageService';
import NumberBall from './components/NumberBall';
import CountdownTimer from './components/CountdownTimer';
import { AppStatus, AnalysisResult, LotteryResult, TrendResult, HistoricalAnalysis, HistoryCheckResult, PastGameResult, SavedBetBatch } from './types';

const TOTAL_NUMBERS = 25;
const MIN_SELECTION = 15;
const MAX_SELECTION = 18; // Cap for browser performance

const App: React.FC = () => {
  const [selectedNumbers, setSelectedNumbers] = useState<Set<number>>(new Set());
  const [generatedGames, setGeneratedGames] = useState<number[][]>([]);
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [latestResult, setLatestResult] = useState<LotteryResult | null>(null);
  const [isResultLoading, setIsResultLoading] = useState(true); // New loading state
  const [trends, setTrends] = useState<TrendResult | null>(null);
  const [historySim, setHistorySim] = useState<HistoricalAnalysis | null>(null);
  const [historyCheck, setHistoryCheck] = useState<HistoryCheckResult | null>(null);
  const [isLoadingTrends, setIsLoadingTrends] = useState(false);
  const [isAiOptimized, setIsAiOptimized] = useState(false);
  const [historyLimit, setHistoryLimit] = useState(20);
  const [showPrizes, setShowPrizes] = useState(false); // Toggle for prize table
  
  // Winners Gallery State
  const [showWinnersGallery, setShowWinnersGallery] = useState(false);
  const [winningHistory, setWinningHistory] = useState<PastGameResult[]>([]);
  const [isLoadingWinners, setIsLoadingWinners] = useState(false);

  // Saved Games State
  const [savedBatches, setSavedBatches] = useState<SavedBetBatch[]>([]);
  const [showSavedGamesModal, setShowSavedGamesModal] = useState(false);
  const [notification, setNotification] = useState<{msg: string, type: 'success' | 'info'} | null>(null);

  // Clipboard state
  const [copiedGameIndex, setCopiedGameIndex] = useState<number | null>(null);

  const allNumbers = Array.from({ length: TOTAL_NUMBERS }, (_, i) => i + 1);

  // Fetch lottery result on mount and load saved games
  useEffect(() => {
    loadLatestResult();
    const loaded = getSavedBets();
    setSavedBatches(loaded);
  }, []);

  // Check for wins automatically when result and saved games are available
  useEffect(() => {
    if (latestResult && savedBatches.length > 0) {
      checkAutomaticWins(latestResult, savedBatches);
    }
  }, [latestResult, savedBatches.length]);

  const loadLatestResult = () => {
    setIsResultLoading(true);
    fetchLatestResult()
      .then((res) => {
        setLatestResult(res);
      })
      .catch((err) => console.error(err))
      .finally(() => setIsResultLoading(false));
  };

  const checkAutomaticWins = (result: LotteryResult, batches: SavedBetBatch[]) => {
    let maxHits = 0;
    let winningBatchId = '';

    batches.forEach(batch => {
      // Only check if the saved batch is for the current result
      if (batch.targetConcurso === result.concurso) {
        batch.games.forEach(game => {
          const resultSet = new Set(result.dezenas.map(d => parseInt(d, 10)));
          const hits = game.filter(n => resultSet.has(n)).length;
          if (hits > maxHits) {
            maxHits = hits;
            winningBatchId = batch.id;
          }
        });
      }
    });

    if (maxHits >= 11) {
      setNotification({
        msg: `🎉 Parabéns! O sistema detectou ${maxHits} pontos nos seus jogos salvos do concurso ${result.concurso}!`,
        type: 'success'
      });
      // Auto open saved games to show the win
      setTimeout(() => {
        setShowSavedGamesModal(true);
      }, 1500);
    }
  };

  // Memoize parsed result numbers for correct comparison (handling string/number types)
  const resultNumbers = useMemo(() => {
    if (!latestResult) return new Set<number>();
    return new Set(latestResult.dezenas.map(d => parseInt(d, 10)));
  }, [latestResult]);

  const toggleNumber = (num: number) => {
    const newSelection = new Set(selectedNumbers);
    if (newSelection.has(num)) {
      newSelection.delete(num);
    } else {
      if (newSelection.size >= MAX_SELECTION) return;
      newSelection.add(num);
    }
    setSelectedNumbers(newSelection);
    // Reset state if selection changes
    if (generatedGames.length > 0) {
      setGeneratedGames([]);
      setAnalysis(null);
      setHistorySim(null);
      setHistoryCheck(null);
      setStatus(AppStatus.IDLE);
    }
  };

  const handleClear = () => {
    setSelectedNumbers(new Set());
    setGeneratedGames([]);
    setAnalysis(null);
    setHistorySim(null);
    setHistoryCheck(null);
    setStatus(AppStatus.IDLE);
    setTrends(null);
  };

  const handleGenerate = async () => {
    if (selectedNumbers.size < MIN_SELECTION) return;

    setStatus(AppStatus.GENERATING);
    setHistorySim(null);
    setHistoryCheck(null);
    
    // Small delay to allow UI to update
    setTimeout(async () => {
      try {
        let games: number[][] = [];
        
        if (isAiOptimized) {
          // Use AI to generate reduced closing
          games = await generateSmartClosing(Array.from(selectedNumbers));
        } else {
          // Use Math to generate all combinations
          games = generateCombinations(Array.from(selectedNumbers));
        }
        
        setGeneratedGames(games);
        
        // Auto-analyze with Gemini after generation
        setStatus(AppStatus.ANALYZING);
        const analysisResult = await analyzeClosing(Array.from(selectedNumbers), games.length);
        setAnalysis(analysisResult);
        setStatus(AppStatus.SUCCESS);
      } catch (error) {
        console.error(error);
        setStatus(AppStatus.ERROR);
      }
    }, 100);
  };

  const handleSaveGames = () => {
    if (generatedGames.length === 0 || !latestResult) return;
    
    const targetConcurso = latestResult.proximoConcurso;
    
    const currentBatchJson = JSON.stringify(generatedGames);
    const existing = getSavedBets();
    const isDuplicate = existing.some(b => 
      b.targetConcurso === targetConcurso && 
      JSON.stringify(b.games) === currentBatchJson
    );

    if (isDuplicate) {
       setNotification({
        msg: `Estes jogos já foram salvos!`,
        type: 'info'
      });
      setTimeout(() => setNotification(null), 3000);
      return;
    }

    // 1. Salva no Storage e recebe o objeto COMPLETO com ID gerado
    const newBatch = saveBets(generatedGames, targetConcurso);
    
    // 2. Atualiza o estado MANUALMENTE com o objeto retornado (garante ID correto na UI)
    setSavedBatches(prevBatches => {
      const updated = [newBatch, ...prevBatches];
      // Mantém a regra de limite de 20
      if (updated.length > 20) return updated.slice(0, 20);
      return updated;
    });
    
    setNotification({
      msg: `Jogos salvos com sucesso para o Concurso ${targetConcurso}! O sistema avisará se você ganhar.`,
      type: 'success'
    });

    setTimeout(() => setNotification(null), 4000);
  };

  // Função Robustecida para Deletar
  const handleDeleteBatch = (id: string, index: number) => {
    if(window.confirm('Tem certeza que deseja apagar este grupo de jogos?')) {
      let newBatches;

      // Tenta deletar pelo ID se ele existir e for válido
      if (id && typeof id === 'string' && id.length > 0) {
         newBatches = savedBatches.filter(b => b.id !== id);
         
         // Se por acaso o filtro por ID não removeu nada (ID errado), tenta por índice
         if (newBatches.length === savedBatches.length) {
            newBatches = savedBatches.filter((_, i) => i !== index);
         }
      } else {
         // Fallback direto para exclusão por índice se não houver ID
         newBatches = savedBatches.filter((_, i) => i !== index);
      }

      setSavedBatches(newBatches);
      syncBets(newBatches); // Atualiza localStorage
      
      setNotification({ msg: 'Jogos removidos.', type: 'info' });
      setTimeout(() => setNotification(null), 2000);
    }
  };

  const handleAiSuggestion = async () => {
    setStatus(AppStatus.GENERATING);
    try {
      const suggestions = await getAiSuggestions();
      if (suggestions.length > 0) {
        // Cap at MAX_SELECTION if AI returns too many
        const capped = suggestions.slice(0, MAX_SELECTION);
        setSelectedNumbers(new Set(capped));
        setGeneratedGames([]);
        setAnalysis(null);
        setHistorySim(null);
        setHistoryCheck(null);
        setStatus(AppStatus.IDLE);
      }
    } catch (e) {
      console.error(e);
      alert("Erro ao conectar com a IA. Verifique sua chave API.");
    } finally {
      setStatus(AppStatus.IDLE);
    }
  };

  const handleGetTrends = async () => {
    setIsLoadingTrends(true);
    try {
      const result = await getLotteryTrends();
      setTrends(result);
    } catch (e) {
      console.error(e);
      alert("Erro ao buscar tendências.");
    } finally {
      setIsLoadingTrends(false);
    }
  };

  const handleOpenWinnersGallery = async () => {
    setShowWinnersGallery(true);
    if (winningHistory.length > 0) return; // Already loaded

    setIsLoadingWinners(true);
    if (!latestResult) return;

    try {
      // Fetch a larger batch (last 50) to find winners
      const past = await fetchPastResults(latestResult.concurso, 50);
      // Filter only those with 15 point winners
      const winners = past.filter(p => p.ganhadores15 > 0);
      setWinningHistory(winners);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingWinners(false);
    }
  };

  const handleHistorySim = async () => {
    if (selectedNumbers.size < 15) return;
    setStatus(AppStatus.SIMULATING);
    try {
      const sim = await getHistoricalSimulation(Array.from(selectedNumbers));
      setHistorySim(sim);
      setStatus(AppStatus.SUCCESS);
    } catch (e) {
      console.error(e);
    } finally {
      if (status !== AppStatus.ERROR) setStatus(AppStatus.SUCCESS);
    }
  };

  const handleCheckHistory = async () => {
    if (!latestResult || generatedGames.length === 0) return;
    setStatus(AppStatus.CHECKING_HISTORY);
    
    try {
      const pastResults = await fetchPastResults(latestResult.concurso, historyLimit);
      
      const matchesPerGame: Record<number, { concurso: number, hits: number }[]> = {};
      
      generatedGames.forEach((game, idx) => {
        const gameMatches: { concurso: number, hits: number }[] = [];
        
        pastResults.forEach(past => {
          const pastNumbers = new Set(past.dezenas.map(d => parseInt(d, 10)));
          const hits = game.filter(n => pastNumbers.has(n)).length;
          
          if (hits >= 11) { // Only record prize-winning hits
            gameMatches.push({
              concurso: past.concurso,
              hits: hits
            });
          }
        });
        
        if (gameMatches.length > 0) {
          matchesPerGame[idx] = gameMatches.sort((a, b) => b.concurso - a.concurso);
        }
      });
      
      setHistoryCheck({
        matchesPerGame,
        checkedCount: pastResults.length
      });
      setStatus(AppStatus.SUCCESS);
      
    } catch (e) {
      console.error(e);
      alert("Erro ao verificar histórico.");
      setStatus(AppStatus.SUCCESS); // Revert to success to keep UI shown
    }
  };

  const handleCopyGame = (game: number[], index: number) => {
    const text = game.join(', '); // Comma separated for easy reading/pasting
    navigator.clipboard.writeText(text).then(() => {
      setCopiedGameIndex(index);
      setTimeout(() => setCopiedGameIndex(null), 2000);
    }).catch(err => {
      console.error('Failed to copy: ', err);
    });
  };

  const handleWhatsAppShare = () => {
    if (generatedGames.length === 0) return;

    const targetNumber = "5599984252028";
    const nextDate = latestResult?.dataProximoConcurso || "Em breve";
    
    // 1. FILTERING LOGIC (The "Golden Rules" of Lotofácil)
    const filteredGames = generatedGames.filter(game => {
      const { odds, sum } = getStats(game);
      const isBalancedOdds = odds >= 7 && odds <= 9;
      const isBalancedSum = sum >= 170 && sum <= 225;
      return isBalancedOdds && isBalancedSum;
    });

    // Fallback: If filtering removes ALL games, use original
    const gamesToSend = filteredGames.length > 0 ? filteredGames : generatedGames;
    const isFiltered = filteredGames.length > 0 && filteredGames.length < generatedGames.length;

    // Header
    let message = `🤖 *LotoSmart AI - Relatório Otimizado*\n`;
    message += `📅 Próximo Sorteio: ${nextDate}\n`;
    if (isFiltered) {
       message += `✨ *Filtro Inteligente Ativo:* Enviando apenas ${gamesToSend.length} de ${generatedGames.length} jogos com maior probabilidade estatística (11-15 pts).\n\n`;
    } else {
       message += `📊 Jogos Gerados: ${gamesToSend.length}\n\n`;
    }

    // Analysis Section
    if (analysis) {
      message += `🎯 *Análise de Potencial (IA):*\n`;
      message += `Score: ${analysis.score}/100\n`;
      message += `Dica: ${analysis.tips}\n\n`;
    }

    // Historical Probability Section (11-15 hits)
    if (historySim) {
      message += `📊 *Probabilidade Estimada (Base Histórica):*\n`;
      message += `🏆 15 Pontos: ${historySim.wins15}x\n`;
      message += `🥈 14 Pontos: ${historySim.wins14}x\n`;
      message += `🥉 13 Pontos: ${historySim.wins13}x\n`;
      message += `🔹 11-12 Pontos: ${historySim.wins11 + historySim.wins12}x\n`;
      message += `📈 Índice Rentabilidade: ${historySim.profitabilityIndex}/100\n\n`;
    }

    // Games Section
    message += `🔢 *Jogos Selecionados (Padrão Ouro):*\n`;
    gamesToSend.forEach((game, index) => {
      const line = game.map(n => n.toString().padStart(2, '0')).join(' ');
      message += `*${(index + 1).toString().padStart(2, '0')}.* ${line}\n`;
    });

    message += `\n🍀 Boa sorte!`;

    // Encode and Open
    const url = `https://wa.me/${targetNumber}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  const calculateHits = (game: number[], targetResultSet?: Set<number>) => {
    const targets = targetResultSet || resultNumbers;
    if (targets.size === 0) return 0;
    const hits = game.filter(n => targets.has(n));
    return hits.length;
  };

  const selectionCount = selectedNumbers.size;
  const possibleGames = selectionCount >= 15 
    ? (selectionCount === 15 ? 1 : 
       selectionCount === 16 ? 16 : 
       selectionCount === 17 ? 136 : 
       816) // 18 numbers
    : 0;

  return (
    <div className="min-h-screen bg-slate-900 pb-36">
      {/* Toast Notification */}
      {notification && (
        <div className="fixed top-4 left-4 right-4 z-50 animate-bounce-in">
          <div className={`${notification.type === 'success' ? 'bg-emerald-600' : 'bg-blue-600'} text-white p-4 rounded-xl shadow-2xl flex items-center justify-between border border-white/20`}>
            <span className="text-sm font-bold pr-2">{notification.msg}</span>
            <button onClick={() => setNotification(null)} className="text-white/80 hover:text-white font-bold">✕</button>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-slate-800 border-b border-slate-700 p-4 sticky top-0 z-10 shadow-md">
        <div className="flex justify-between items-center max-w-lg mx-auto">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-to-tr from-purple-500 to-pink-500 rounded-lg flex items-center justify-center font-bold text-white text-lg">
              L
            </div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-400">
              LotoSmart AI
            </h1>
          </div>
          
          {/* Saved Games Button (Header) */}
          <button 
            onClick={() => setShowSavedGamesModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-full text-xs font-bold text-slate-200 transition-colors border border-slate-600"
          >
            <span>📁</span>
            <span>Meus Jogos</span>
            {savedBatches.length > 0 && (
              <span className="bg-purple-500 text-white w-4 h-4 flex items-center justify-center rounded-full text-[9px] ml-1">
                {savedBatches.length}
              </span>
            )}
          </button>
        </div>
      </header>

      <main className="max-w-lg mx-auto p-4 space-y-6">
        
        {/* Latest Result Card */}
        {isResultLoading ? (
          <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700 animate-pulse">
            <div className="h-4 bg-slate-700 rounded w-1/3 mb-4"></div>
            <div className="flex flex-wrap gap-2">
               {[...Array(15)].map((_, i) => <div key={i} className="w-7 h-7 bg-slate-700 rounded-full"></div>)}
            </div>
            <div className="h-3 bg-slate-700 rounded w-1/2 mt-3"></div>
          </div>
        ) : latestResult ? (
          <div className="bg-slate-800/80 rounded-xl border border-slate-700 shadow-md relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-2xl -mr-10 -mt-10"></div>
            
            <div className="p-4 relative z-10">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider bg-emerald-900/30 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    Concurso {latestResult.concurso}
                  </span>
                  <div className="text-xs text-slate-400 mt-1">{latestResult.data}</div>
                </div>
                <div className={`text-right ${latestResult.acumulou ? 'text-yellow-400' : 'text-emerald-400'}`}>
                  <div className="text-sm font-bold">
                    {latestResult.acumulou ? 'ACUMULOU!' : 'PREMIADO'}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {latestResult.acumulou 
                      ? `Próx: R$ ${latestResult.valorEstimadoProximoConcurso?.toLocaleString('pt-BR') || '---'}` 
                      : `${latestResult.ganhadores15} ganhador(es) de 15 pts`
                    }
                  </div>
                </div>
              </div>
              
              <div className="flex flex-wrap gap-1.5 justify-center sm:justify-start mb-4">
                {latestResult.dezenas.map((n) => (
                  <span key={n} className="w-7 h-7 flex items-center justify-center bg-gradient-to-br from-emerald-600/30 to-slate-800 border border-emerald-500/40 rounded-full text-xs font-bold text-emerald-100 shadow-sm">
                    {n}
                  </span>
                ))}
              </div>

              {/* Prize Table Accordion */}
              {latestResult.premiacoes && latestResult.premiacoes.length > 0 && (
                <div className="mb-4 bg-slate-900/40 rounded-lg overflow-hidden border border-slate-700/50">
                  <button 
                    onClick={() => setShowPrizes(!showPrizes)}
                    className="w-full flex items-center justify-between p-2 text-xs text-slate-300 hover:bg-slate-700/30 transition-colors"
                  >
                    <span className="font-bold flex items-center gap-1">
                      🏆 Premiação Detalhada
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {showPrizes ? 'Ocultar' : 'Ver Ganhadores'}
                    </span>
                  </button>
                  
                  {showPrizes && (
                    <div className="p-2 border-t border-slate-700/50 animate-fade-in">
                       <table className="w-full text-[10px] sm:text-xs">
                         <thead>
                           <tr className="text-slate-500 text-left border-b border-slate-700/50">
                             <th className="pb-1">Acertos</th>
                             <th className="pb-1 text-center">Ganhadores</th>
                             <th className="pb-1 text-right">Prêmio</th>
                           </tr>
                         </thead>
                         <tbody className="divide-y divide-slate-700/30">
                           {latestResult.premiacoes.map((p, idx) => (
                             <tr key={idx} className="text-slate-300">
                               <td className="py-1.5 font-bold text-slate-200">{p.faixa} Pontos</td>
                               <td className="py-1.5 text-center">{p.ganhadores.toLocaleString('pt-BR')}</td>
                               <td className="py-1.5 text-right font-mono text-emerald-400">
                                 R$ {p.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                               </td>
                             </tr>
                           ))}
                         </tbody>
                       </table>
                    </div>
                  )}
                </div>
              )}

              {/* Countdown Timer Integration - Ensure it's rendered if data exists */}
              {latestResult.dataProximoConcurso ? (
                <CountdownTimer targetDateStr={latestResult.dataProximoConcurso} />
              ) : (
                 <div className="bg-slate-900/40 border border-slate-600/30 rounded-lg p-2 mt-3 text-center">
                   <p className="text-[10px] text-slate-400 uppercase tracking-wide">Aguardando data do próximo sorteio</p>
                 </div>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-red-900/10 border border-red-500/20 p-4 rounded-xl text-center flex flex-col items-center justify-center gap-3">
             <p className="text-red-400 text-sm">Não foi possível carregar o último resultado. Verifique sua conexão.</p>
             <button 
               onClick={loadLatestResult}
               className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-lg text-red-300 text-xs font-bold transition-all active:scale-95 flex items-center gap-2"
             >
               🔄 Tentar Novamente
             </button>
          </div>
        )}

        {/* Buttons Group: Trends & Winners Gallery */}
        <div className="grid grid-cols-2 gap-3">
          <button 
            onClick={handleGetTrends}
            disabled={isLoadingTrends}
            className="w-full py-3 bg-slate-800 border border-slate-700 rounded-xl text-slate-300 font-bold flex flex-col items-center justify-center gap-1 active:bg-slate-700 transition-colors"
          >
            {isLoadingTrends ? (
              <span className="text-xs animate-pulse">Analisando...</span>
            ) : (
              <>
                <span className="text-lg">📊</span>
                <span className="text-xs">Tendências</span>
              </>
            )}
          </button>
          
          <button 
            onClick={handleOpenWinnersGallery}
            className="w-full py-3 bg-emerald-900/30 border border-emerald-500/30 rounded-xl text-emerald-200 font-bold flex flex-col items-center justify-center gap-1 active:bg-emerald-900/40 transition-colors"
          >
             <span className="text-lg">🏆</span>
             <span className="text-xs">Galeria 15 Pts</span>
          </button>
        </div>

        {/* External Bet Button */}
        <a 
          href="https://www.loteriasonline.caixa.gov.br/" 
          target="_blank" 
          rel="noopener noreferrer"
          className="w-full py-3 bg-gradient-to-r from-blue-600 to-blue-500 border border-blue-400/30 rounded-xl text-white font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-900/20 active:scale-95 transition-all group"
        >
           <span className="text-lg">🛒</span>
           <span>Comprar Jogo Online (Caixa)</span>
           <svg className="w-4 h-4 opacity-70 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
        </a>

        {/* Saved Games Modal */}
        {showSavedGamesModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
             <div className="bg-slate-800 w-full max-w-lg max-h-[85vh] rounded-xl border border-slate-700 shadow-2xl flex flex-col">
                <div className="p-4 border-b border-slate-700 flex justify-between items-center">
                   <h3 className="text-lg font-bold text-white flex items-center gap-2">
                     📁 Meus Jogos Salvos
                   </h3>
                   <button 
                     onClick={() => setShowSavedGamesModal(false)}
                     className="w-8 h-8 rounded-full bg-slate-700 text-slate-300 flex items-center justify-center hover:bg-slate-600"
                   >✕</button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {savedBatches.length === 0 ? (
                    <div className="text-center py-10 text-slate-500">
                       <p className="mb-2">📭 Nenhum jogo salvo.</p>
                       <p className="text-xs">Gere jogos e clique em "Salvar" para acompanhar aqui.</p>
                    </div>
                  ) : (
                    savedBatches.map((batch, idx) => {
                      // Check if this batch is for a contest that already happened or is current
                      const isChecked = latestResult && latestResult.concurso >= batch.targetConcurso;
                      const isWinnerBatch = isChecked && batch.games.some(g => calculateHits(g) >= 11);

                      return (
                        <div key={batch.id || idx} className={`bg-slate-900/50 rounded-lg border p-3 ${isWinnerBatch ? 'border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.1)]' : 'border-slate-700'}`}>
                          <div className="flex justify-between items-start mb-3 border-b border-slate-700/50 pb-2">
                            <div>
                               <div className="text-sm font-bold text-white">Concurso Alvo: {batch.targetConcurso}</div>
                               <div className="text-[10px] text-slate-500">Salvo em: {batch.createdAt} • {batch.games.length} jogos</div>
                            </div>
                            <button 
                              onClick={() => handleDeleteBatch(batch.id, idx)}
                              className="text-red-400 hover:text-red-300 hover:bg-red-900/20 text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors border border-red-500/20 shadow-sm active:scale-95"
                            >
                              <span>🗑️</span> Excluir
                            </button>
                          </div>

                          <div className="space-y-2">
                            {batch.games.map((game, idx) => {
                              // If checked, calculate hits against the LATEST result if the contest matches
                              // If the saved contest is older than latest result, we can't accurately check 
                              // unless we fetched historical data for THAT specific contest.
                              // For simplicity in this PWA, we assume "Checked" means comparing against current latest 
                              // IF latest.concurso == batch.targetConcurso.
                              
                              let hits = 0;
                              let isWinner = false;
                              let statusLabel = <span className="text-slate-500 text-[10px]">Aguardando Sorteio...</span>;
                              
                              if (latestResult) {
                                if (latestResult.concurso === batch.targetConcurso) {
                                  hits = calculateHits(game);
                                  isWinner = hits >= 11;
                                  if (isWinner) {
                                     statusLabel = (
                                       <span className="flex items-center gap-1 text-emerald-400 font-bold text-[10px] animate-pulse">
                                          🏆 {hits} PONTOS!
                                       </span>
                                     );
                                  } else {
                                     statusLabel = <span className="text-slate-400 text-[10px]">{hits} acertos</span>;
                                  }
                                } else if (latestResult.concurso > batch.targetConcurso) {
                                   statusLabel = <span className="text-yellow-500/70 text-[10px]">Não Conferido (Antigo)</span>;
                                }
                              }

                              return (
                                <div 
                                  key={idx} 
                                  className={`flex justify-between items-center px-2 py-2 rounded mb-1 border transition-all
                                    ${isWinner 
                                      ? 'bg-emerald-900/30 border-emerald-500/60 shadow-[0_0_10px_rgba(16,185,129,0.2)]' 
                                      : 'bg-slate-800 border-transparent'}
                                  `}
                                >
                                   <div className="flex gap-1 flex-wrap">
                                      {game.map(n => (
                                        <span key={n} className={`text-[10px] w-5 h-5 flex items-center justify-center rounded-full ${hits && latestResult?.concurso === batch.targetConcurso && resultNumbers.has(n) ? 'bg-emerald-600 text-white font-bold' : 'bg-slate-700 text-slate-300'}`}>
                                           {n}
                                        </span>
                                      ))}
                                   </div>
                                   <div className="ml-2 min-w-[70px] text-right">
                                      {statusLabel}
                                   </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
             </div>
          </div>
        )}

        {/* Winners Gallery Modal Area (Rendered in place for PWA feel) */}
        {showWinnersGallery && (
          <div className="bg-slate-800 rounded-xl border border-yellow-500/30 animate-fade-in relative overflow-hidden">
             <div className="absolute top-0 w-full h-1 bg-gradient-to-r from-yellow-600 to-yellow-300"></div>
             
             <div className="p-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-yellow-100 flex items-center gap-2">
                    🏆 Histórico de 15 Pontos
                  </h3>
                  <button 
                    onClick={() => setShowWinnersGallery(false)}
                    className="text-slate-400 hover:text-white bg-slate-900/50 rounded-full w-6 h-6 flex items-center justify-center"
                  >
                    ✕
                  </button>
                </div>
                
                <p className="text-xs text-slate-400 mb-4">
                  Exibindo concursos recentes onde houve <strong>ganhadores do prêmio máximo</strong>.
                </p>

                {isLoadingWinners ? (
                  <div className="py-8 text-center text-slate-500 text-xs animate-pulse">
                    Buscando resultados premiados...
                  </div>
                ) : winningHistory.length === 0 ? (
                  <div className="py-4 text-center text-slate-500 text-xs">
                    Nenhum ganhador encontrado no lote recente.
                  </div>
                ) : (
                  <div className="space-y-3 max-h-80 overflow-y-auto pr-1 no-scrollbar">
                     {winningHistory.map((game) => (
                       <div key={game.concurso} className="bg-slate-900/50 p-3 rounded-lg border border-yellow-500/10">
                          <div className="flex justify-between items-start mb-2">
                             <div>
                               <span className="text-[10px] text-yellow-500 font-bold border border-yellow-500/30 px-1.5 py-0.5 rounded">
                                 Conc. {game.concurso}
                               </span>
                               <span className="text-[10px] text-slate-500 ml-2">{game.data}</span>
                             </div>
                             <div className="text-right">
                               <div className="text-[10px] text-slate-400 uppercase">Ganhadores</div>
                               <div className="text-sm font-bold text-emerald-400">{game.ganhadores15} 👤</div>
                             </div>
                          </div>
                          <div className="flex flex-wrap gap-1">
                             {game.dezenas.map((d, i) => (
                               <span key={i} className="text-[10px] w-5 h-5 flex items-center justify-center bg-slate-700 text-slate-200 rounded-full">
                                 {d}
                               </span>
                             ))}
                          </div>
                       </div>
                     ))}
                  </div>
                )}
             </div>
          </div>
        )}

        {/* Trends Section (Displayed if active) */}
        {trends && (
          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 animate-fade-in space-y-4 relative">
             <button 
               onClick={() => setTrends(null)} 
               className="absolute top-2 right-2 text-slate-500 hover:text-white"
             >✕</button>
             
             <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
               📊 Tendências Históricas (IA)
             </h3>
             <p className="text-xs text-slate-400 italic mb-3">{trends.analysis}</p>

             <div className="grid grid-cols-2 gap-4">
               {/* Hot Numbers */}
               <div className="bg-orange-500/10 p-3 rounded-lg border border-orange-500/20">
                 <div className="text-xs text-orange-400 font-bold uppercase mb-2 flex items-center gap-1">
                   🔥 Quentes
                 </div>
                 <div className="flex flex-wrap gap-2">
                   {trends.hot.map(n => (
                     <button
                       key={n}
                       onClick={() => toggleNumber(n)}
                       className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${selectedNumbers.has(n) ? 'bg-orange-500 text-white shadow-lg scale-110' : 'bg-slate-900 text-orange-200 hover:bg-orange-900'}`}
                     >
                       {n}
                     </button>
                   ))}
                 </div>
               </div>

               {/* Cold Numbers */}
               <div className="bg-cyan-500/10 p-3 rounded-lg border border-cyan-500/20">
                 <div className="text-xs text-cyan-400 font-bold uppercase mb-2 flex items-center gap-1">
                   ❄️ Frios
                 </div>
                 <div className="flex flex-wrap gap-2">
                   {trends.cold.map(n => (
                     <button
                       key={n}
                       onClick={() => toggleNumber(n)}
                       className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${selectedNumbers.has(n) ? 'bg-cyan-500 text-white shadow-lg scale-110' : 'bg-slate-900 text-cyan-200 hover:bg-cyan-900'}`}
                     >
                       {n}
                     </button>
                   ))}
                 </div>
               </div>
             </div>
          </div>
        )}

        {/* Status Card */}
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <div className="flex justify-between items-center mb-2">
            <span className="text-slate-400 text-sm">Números Selecionados</span>
            <span className={`text-sm font-bold ${selectionCount === MAX_SELECTION ? 'text-red-400' : 'text-purple-400'}`}>
              {selectionCount} / {MAX_SELECTION}
            </span>
          </div>
          <div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden">
            <div 
              className="bg-purple-500 h-full transition-all duration-300"
              style={{ width: `${(selectionCount / MAX_SELECTION) * 100}%` }}
            ></div>
          </div>
          <div className="flex justify-between items-end mt-2">
            <p className="text-xs text-slate-500">
              Selecione entre 15 e 18 números.
            </p>
            <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
              <span className="w-2 h-2 rounded-full border border-emerald-500 bg-transparent"></span>
              <span>Último Sorteio</span>
            </div>
          </div>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-5 gap-3 sm:gap-4 justify-items-center">
          {allNumbers.map((num) => (
            <NumberBall
              key={num}
              number={num}
              isSelected={selectedNumbers.has(num)}
              isRecentResult={resultNumbers.has(num)}
              onClick={toggleNumber}
              disabled={status !== AppStatus.IDLE && status !== AppStatus.SUCCESS}
            />
          ))}
        </div>

        {/* History Simulation Results (AI Based) */}
        {historySim && (
          <div className="bg-slate-800 p-4 rounded-xl border border-blue-500/30 animate-fade-in relative overflow-hidden">
             <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-cyan-500"></div>
             <h3 className="text-sm font-bold text-blue-200 mb-3 flex items-center gap-2">
               ⏱️ Simulador: Últimos 100 Concursos (Estimativa IA)
             </h3>
             
             <div className="grid grid-cols-5 gap-2 text-center mb-4">
                <div className="bg-slate-900/50 p-2 rounded border border-slate-700">
                  <div className="text-[10px] text-slate-400">11pts</div>
                  <div className="font-bold text-white">{historySim.wins11}</div>
                </div>
                <div className="bg-slate-900/50 p-2 rounded border border-slate-700">
                  <div className="text-[10px] text-slate-400">12pts</div>
                  <div className="font-bold text-white">{historySim.wins12}</div>
                </div>
                <div className="bg-slate-900/50 p-2 rounded border border-slate-700">
                  <div className="text-[10px] text-slate-400">13pts</div>
                  <div className="font-bold text-cyan-400">{historySim.wins13}</div>
                </div>
                <div className="bg-slate-900/50 p-2 rounded border border-slate-700">
                  <div className="text-[10px] text-slate-400">14pts</div>
                  <div className="font-bold text-yellow-400">{historySim.wins14}</div>
                </div>
                <div className="bg-slate-900/50 p-2 rounded border border-slate-700">
                  <div className="text-[10px] text-slate-400">15pts</div>
                  <div className="font-bold text-emerald-400">{historySim.wins15}</div>
                </div>
             </div>

             <div className="flex items-center gap-4 bg-blue-900/20 p-3 rounded-lg border border-blue-500/10">
               <div className="flex-1">
                 <p className="text-xs text-blue-200">{historySim.probabilityText}</p>
               </div>
               <div className="text-right">
                 <div className="text-[10px] text-slate-400 uppercase">Índice Rentabilidade</div>
                 <div className={`text-xl font-bold ${historySim.profitabilityIndex > 70 ? 'text-emerald-400' : 'text-slate-200'}`}>
                   {historySim.profitabilityIndex}/100
                 </div>
               </div>
             </div>
          </div>
        )}

        {/* Analysis Section */}
        {analysis && status === AppStatus.SUCCESS && !historySim && (
          <div className="bg-gradient-to-br from-indigo-900 to-slate-800 p-5 rounded-xl border border-indigo-500/30 shadow-lg animate-fade-in">
            <div className="flex items-center space-x-2 mb-3">
              <span className="text-indigo-400 text-lg">✨</span>
              <h3 className="font-bold text-indigo-100">Análise da IA</h3>
            </div>
            <div className="flex items-center justify-between mb-4">
               <div className="text-slate-300 text-sm">{analysis.message}</div>
               <div className="flex flex-col items-end">
                 <span className="text-xs text-slate-400 uppercase tracking-wider">Score</span>
                 <span className="text-2xl font-bold text-emerald-400">{analysis.score}</span>
               </div>
            </div>
            <div className="bg-black/20 p-3 rounded-lg">
              <p className="text-xs text-indigo-200 italic">"{analysis.tips}"</p>
            </div>
            
            <button 
              onClick={handleHistorySim}
              className="mt-4 w-full py-2 bg-blue-600/20 border border-blue-500/50 rounded-lg text-blue-200 text-xs font-bold hover:bg-blue-600/30 transition-colors"
            >
               ⏱️ Simular nos últimos 100 concursos (Estimativa IA)
            </button>
          </div>
        )}

        {/* Generated Games Section */}
        {generatedGames.length > 0 && (
          <div className="space-y-3">
             <div className="flex flex-col space-y-2">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <h3 className="text-lg font-bold text-white flex items-center">
                    Jogos Gerados 
                    <span className="ml-2 bg-slate-700 text-slate-300 text-xs px-2 py-1 rounded-full">
                      {generatedGames.length}
                    </span>
                    {isAiOptimized && (
                      <span className="ml-2 bg-indigo-500/20 text-indigo-300 text-[10px] px-2 py-0.5 rounded border border-indigo-500/30">
                        IA Otimizada
                      </span>
                    )}
                  </h3>

                  {/* Actions Group */}
                  <div className="flex w-full sm:w-auto gap-2">
                    {/* Save Button */}
                    <button
                      onClick={handleSaveGames}
                      className="flex-1 sm:flex-none px-4 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/50 text-blue-200 text-xs font-bold rounded-lg shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95"
                    >
                      <span>💾</span> Salvar
                    </button>
                    
                    {/* WhatsApp Share Button */}
                    <button
                      onClick={handleWhatsAppShare}
                      className="flex-1 sm:flex-none px-4 py-1.5 bg-green-600 hover:bg-green-500 text-white text-xs font-bold rounded-lg shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95"
                    >
                      <span>💬</span> Enviar
                    </button>
                  </div>
                </div>

                <div className="text-xs text-slate-400 mb-2">
                   Toque em um jogo para <span className="text-white font-bold">copiar</span> os números e apostar.
                </div>
                
                {/* History Check Action */}
                {!historyCheck ? (
                  <div className="flex gap-2">
                     <select 
                       value={historyLimit} 
                       onChange={(e) => setHistoryLimit(Number(e.target.value))}
                       className="bg-slate-800 text-slate-300 text-xs rounded-lg border border-slate-700 px-2 py-1.5 focus:outline-none focus:border-purple-500"
                     >
                       <option value={10}>Últimos 10</option>
                       <option value={25}>Últimos 25</option>
                       <option value={50}>Últimos 50</option>
                       <option value={100}>Últimos 100 (Lento)</option>
                     </select>
                     <button 
                       onClick={handleCheckHistory}
                       disabled={status === AppStatus.CHECKING_HISTORY}
                       className="flex-1 bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-600/30 text-xs font-bold py-1.5 rounded-lg transition-colors flex items-center justify-center gap-2"
                     >
                        {status === AppStatus.CHECKING_HISTORY ? (
                          <span className="animate-pulse">Verificando...</span>
                        ) : (
                          <>🔍 Conferir no Histórico Real</>
                        )}
                     </button>
                  </div>
                ) : (
                  <div className="bg-emerald-900/20 border border-emerald-500/30 rounded-lg p-2 flex justify-between items-center text-xs">
                     <span className="text-emerald-300 font-bold">
                       Verificado: Últimos {historyCheck.checkedCount} concursos
                     </span>
                     <button 
                       onClick={() => setHistoryCheck(null)} 
                       className="text-slate-400 hover:text-white px-2"
                     >
                       Limpar
                     </button>
                  </div>
                )}
            </div>
            
            <div className="space-y-2">
              {generatedGames.map((game, idx) => {
                const stats = getStats(game);
                const hits = calculateHits(game);
                const isWinner = hits >= 11;
                const pastWins = historyCheck?.matchesPerGame[idx] || [];
                const isCopied = copiedGameIndex === idx;
                
                return (
                  <button 
                    key={idx} 
                    onClick={() => handleCopyGame(game, idx)}
                    className={`w-full text-left bg-slate-800 p-3 rounded-lg border flex flex-col space-y-2 relative overflow-hidden transition-all duration-200 active:scale-95 group hover:bg-slate-750 ${isWinner ? 'border-emerald-500/50 shadow-[0_0_10px_rgba(16,185,129,0.1)]' : 'border-slate-700 hover:border-slate-500'}`}
                  >
                    
                    {/* Copy Overlay */}
                    {isCopied && (
                      <div className="absolute inset-0 z-20 bg-emerald-600/90 flex items-center justify-center animate-fade-in">
                        <span className="text-white font-bold text-lg flex items-center gap-2">
                          📋 Copiado!
                        </span>
                      </div>
                    )}

                    {/* Hint overlay for desktop hover */}
                    <div className="absolute inset-0 z-10 bg-black/40 hidden group-hover:flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                       <span className="text-white font-bold text-xs bg-slate-900/80 px-2 py-1 rounded">Clique para Copiar</span>
                    </div>

                    {/* Current Contest Hit Badge */}
                    {latestResult && (
                      <div className={`absolute top-0 right-0 px-2 py-1 rounded-bl-lg text-[10px] font-bold ${isWinner ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-400'}`}>
                        {hits} PONTOS (Atual)
                      </div>
                    )}

                    <div className="flex flex-wrap gap-1 pr-24 sm:pr-12">
                      {game.map(n => {
                        const isHit = resultNumbers.has(n);
                        return (
                          <span key={n} className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-mono transition-colors ${isHit ? 'bg-emerald-600 text-white font-bold' : 'bg-slate-900 text-purple-300'}`}>
                            {n.toString().padStart(2, '0')}
                          </span>
                        );
                      })}
                    </div>
                    
                    {/* History Matches Display */}
                    {pastWins.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-slate-700/50 w-full">
                        <span className="text-[10px] text-slate-400 block mb-1 uppercase tracking-wider">Premiações no Histórico:</span>
                        <div className="flex flex-wrap gap-1">
                          {pastWins.map((win, wIdx) => (
                             <span key={wIdx} className={`text-[10px] px-1.5 py-0.5 rounded border font-bold ${win.hits === 15 ? 'bg-emerald-500 text-white border-emerald-400' : win.hits === 14 ? 'bg-yellow-500 text-black border-yellow-400' : 'bg-slate-700 text-slate-300 border-slate-600'}`}>
                               {win.hits}pts (C.{win.concurso})
                             </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex space-x-4 text-[10px] text-slate-500 uppercase tracking-wide border-t border-slate-700/50 pt-2 mt-auto w-full">
                      <span>Pares: {stats.evens}</span>
                      <span>Ímpares: {stats.odds}</span>
                      <span>Soma: {stats.sum}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

      </main>

      {/* Sticky Action Footer */}
      <footer className="fixed bottom-0 left-0 right-0 bg-slate-800/90 backdrop-blur-md border-t border-slate-700 p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-20">
        
        {/* Strategy Toggle */}
        <div className="max-w-lg mx-auto flex justify-center mb-3">
          <button 
             onClick={() => setIsAiOptimized(!isAiOptimized)}
             className={`
               flex items-center px-4 py-1.5 rounded-full text-xs font-bold transition-all border
               ${isAiOptimized 
                 ? 'bg-indigo-500/20 border-indigo-500 text-indigo-200' 
                 : 'bg-slate-700/50 border-slate-600 text-slate-400 hover:bg-slate-700'}
             `}
          >
            <span className="mr-2">{isAiOptimized ? '✨' : '🔢'}</span>
            {isAiOptimized ? 'Otimização IA (Reduzido)' : 'Matemático Completo (Garante 15pts)'}
          </button>
        </div>

        <div className="max-w-lg mx-auto flex gap-3">
          <button 
            onClick={handleClear}
            className="px-4 py-3 rounded-lg bg-slate-700 text-slate-300 font-medium active:bg-slate-600 transition-colors"
          >
            Limpar
          </button>
          
          {selectedNumbers.size === 0 ? (
             <button 
             onClick={handleAiSuggestion}
             className="flex-1 py-3 rounded-lg bg-indigo-600 text-white font-bold shadow-lg shadow-indigo-900/50 active:scale-95 transition-all flex items-center justify-center gap-2"
             disabled={status !== AppStatus.IDLE}
           >
             {status === AppStatus.GENERATING ? 'Consultando IA...' : '🔮 Palpite IA'}
           </button>
          ) : (
            <button 
              onClick={handleGenerate}
              disabled={selectionCount < MIN_SELECTION || (status !== AppStatus.IDLE && status !== AppStatus.SUCCESS)}
              className={`
                flex-1 py-3 rounded-lg font-bold shadow-lg transition-all flex items-center justify-center gap-2
                ${selectionCount < MIN_SELECTION 
                  ? 'bg-slate-600 text-slate-400 cursor-not-allowed' 
                  : 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-purple-900/50 active:scale-95 hover:brightness-110'}
              `}
            >
              {status === AppStatus.ANALYZING || status === AppStatus.SIMULATING || status === AppStatus.CHECKING_HISTORY ? 'Processando...' : 
               status === AppStatus.GENERATING ? 'Gerando...' : 
               isAiOptimized 
                 ? `Gerar Fechamento IA`
                 : `Gerar ${possibleGames > 0 ? possibleGames : ''} Jogos (Garantido)`
               }
            </button>
          )}
        </div>
      </footer>
    </div>
  );
};

export default App;