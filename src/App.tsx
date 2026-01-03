import React, { useState, useEffect, useMemo } from 'react';
import { generateCombinations, getStats, generateBalancedMatrix, calculateHotNumbers, getYearsList, LOTOFACIL_YEAR_START, calculateDetailedStats } from './utils/lotteryLogic';
import { getAiSuggestions, analyzeClosing, getLotteryTrends, generateSmartClosing, getHistoricalSimulation, getHistoricalBestNumbers } from './services/geminiService';
import { fetchLatestResult, fetchPastResults, fetchResultsRange } from './services/lotteryService';
import { saveBets, getSavedBets, syncBets, deleteBatch, deleteGame } from './services/storageService';
import NumberBall from './components/NumberBall';
import CountdownTimer from './components/CountdownTimer';
import { GAMES } from './utils/gameConfig';
import { AppStatus, AnalysisResult, LotteryResult, TrendResult, HistoricalAnalysis, HistoryCheckResult, PastGameResult, SavedBetBatch, PrizeEntry, DetailedStats } from './types';

const TOTAL_NUMBERS = 25;
const MIN_SELECTION = 15;
const MAX_SELECTION = 21; 

const App: React.FC = () => {
  const [selectedNumbers, setSelectedNumbers] = useState<Set<number>>(new Set());
  const [generatedGames, setGeneratedGames] = useState<number[][]>([]);
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [latestResult, setLatestResult] = useState<LotteryResult | null>(null);
  const [isResultLoading, setIsResultLoading] = useState(true); 
  const [trends, setTrends] = useState<TrendResult | null>(null);
  const [historySim, setHistorySim] = useState<HistoricalAnalysis | null>(null);
  const [historyCheck, setHistoryCheck] = useState<HistoryCheckResult | null>(null);
  const [isLoadingTrends, setIsLoadingTrends] = useState(false);
  const [isAiOptimized, setIsAiOptimized] = useState(true); 
  const [historyLimit, setHistoryLimit] = useState(20);
  
  // Galleries State
  const [showGalleriesModal, setShowGalleriesModal] = useState(false);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [winningHistory, setWinningHistory] = useState<PastGameResult[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyCursor, setHistoryCursor] = useState<number>(1); 
  
  // GAME DETAIL STATE
  const [viewingGame, setViewingGame] = useState<PastGameResult | null>(null);

  // Saved Games State
  const [savedBatches, setSavedBatches] = useState<SavedBetBatch[]>([]);
  const [showSavedGamesModal, setShowSavedGamesModal] = useState(false);
  const [notification, setNotification] = useState<{msg: string, type: 'success' | 'info'} | null>(null);

  // Clipboard state
  const [copiedGameIndex, setCopiedGameIndex] = useState<number | null>(null);

  // EXPANDED STATS STATE
  const [expandedGameStats, setExpandedGameStats] = useState<number | null>(null);

  const allNumbers = Array.from({ length: TOTAL_NUMBERS }, (_, i) => i + 1);
  const availableYears = useMemo(() => getYearsList(2003), []);

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
    fetchLatestResult('lotofacil')
      .then((res) => {
        setLatestResult(res);
      })
      .catch((err) => console.error(err))
      .finally(() => setIsResultLoading(false));
  };

  const checkAutomaticWins = (result: LotteryResult, batches: SavedBetBatch[]) => {
    let maxHits = 0;
    batches.forEach(batch => {
      if (batch.targetConcurso === result.concurso) {
        batch.games.forEach(gameObj => {
          const resultSet = new Set(result.dezenas.map(d => parseInt(d, 10)));
          const hits = gameObj.numbers.filter(n => resultSet.has(n)).length;
          if (hits > maxHits) {
            maxHits = hits;
          }
        });
      }
    });

    if (maxHits >= 11) {
      setNotification({
        msg: `🎉 Parabéns! O sistema detectou ${maxHits} pontos nos seus jogos salvos do concurso ${result.concurso}!`,
        type: 'success'
      });
      setTimeout(() => {
        setShowSavedGamesModal(true);
      }, 1500);
    }
  };

  // Memoize parsed result numbers
  const resultNumbers = useMemo<Set<number>>(() => {
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
    if (generatedGames.length > 0) {
      setGeneratedGames([]);
      setAnalysis(null);
      setHistorySim(null);
      setHistoryCheck(null);
      setExpandedGameStats(null);
      setStatus(AppStatus.IDLE);
    }
  };

  const handleClear = () => {
    setSelectedNumbers(new Set());
    setGeneratedGames([]);
    setAnalysis(null);
    setHistorySim(null);
    setHistoryCheck(null);
    setExpandedGameStats(null);
    setStatus(AppStatus.IDLE);
    setTrends(null);
  };

  const toggleGameStats = (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    setExpandedGameStats(prev => prev === index ? null : index);
  };

  const handleGenerateTop200 = async () => {
    if (!latestResult) return;
    setStatus(AppStatus.GENERATING);
    setGeneratedGames([]);
    setHistoryCheck(null);
    setExpandedGameStats(null);
    
    try {
      const pastResults = await fetchPastResults('lotofacil', latestResult.concurso, 200);
      const hotNumbers = calculateHotNumbers(pastResults, 21);
      setSelectedNumbers(new Set(hotNumbers));
      const games = generateBalancedMatrix(hotNumbers, 25, 15);
      
      setGeneratedGames(games);
      setStatus(AppStatus.SUCCESS);
      
      setNotification({
        msg: 'Top 21 dezenas dos últimos 200 concursos carregadas!',
        type: 'success'
      });
      setTimeout(() => setNotification(null), 3000);

    } catch (e) {
      console.error(e);
      setNotification({ msg: 'Erro ao analisar histórico.', type: 'info' });
      setStatus(AppStatus.ERROR);
    }
  };

  const handleHistoricalStrategy = async () => {
    setStatus(AppStatus.GENERATING);
    setGeneratedGames([]);
    setHistoryCheck(null);
    setExpandedGameStats(null);

    try {
      setNotification({ msg: 'Analisando histórico completo desde o concurso #1...', type: 'info' });
      const historicalNumbers = await getHistoricalBestNumbers('lotofacil', 15);
      
      if (!historicalNumbers || historicalNumbers.length < 15) {
        throw new Error("Falha na análise histórica");
      }

      setSelectedNumbers(new Set(historicalNumbers));

      let games: number[][] = [];
      try {
        games = await generateSmartClosing('lotofacil', historicalNumbers, 15);
      } catch {
        games = generateBalancedMatrix(historicalNumbers, 25, 15);
      }

      setGeneratedGames(games);
      setStatus(AppStatus.SUCCESS);

      setNotification({
        msg: 'Fechamento Histórico (Baseado em todos os resultados) gerado!',
        type: 'success'
      });
      setTimeout(() => setNotification(null), 4000);

    } catch (e) {
      console.error(e);
      setNotification({ msg: 'Erro na análise histórica.', type: 'info' });
      setStatus(AppStatus.ERROR);
    }
  };

  const handleGenerate = async () => {
    if (selectedNumbers.size < MIN_SELECTION) return;

    setStatus(AppStatus.GENERATING);
    setHistorySim(null);
    setHistoryCheck(null);
    setExpandedGameStats(null);
    
    setTimeout(async () => {
      try {
        let finalSelection: number[] = Array.from(selectedNumbers);
        let wasAutoFilled = false;

        if (finalSelection.length < MAX_SELECTION && latestResult) {
           try {
               const pastResults = await fetchPastResults('lotofacil', latestResult.concurso, 25);
               const hotNumbers = calculateHotNumbers(pastResults);
               for (const num of hotNumbers) {
                  if (finalSelection.length >= MAX_SELECTION) break;
                  if (!selectedNumbers.has(num)) {
                     finalSelection.push(num);
                     wasAutoFilled = true;
                  }
               }
               if (wasAutoFilled) {
                 finalSelection.sort((a, b) => a - b);
                 setSelectedNumbers(new Set(finalSelection));
                 setNotification({
                    msg: `Completado para 21 dezenas usando números quentes!`,
                    type: 'success'
                 });
                 setTimeout(() => setNotification(null), 2500);
               }
           } catch (err) {
               console.warn("Erro ao buscar tendências para auto-completar", err);
           }
        }

        let games: number[][] = [];
        const selectionSize = finalSelection.length;
        
        if (isAiOptimized || selectionSize > 18) {
          try {
             games = await generateSmartClosing('lotofacil', finalSelection, 15);
             if (!games || games.length === 0) throw new Error("AI Empty Result");
          } catch (aiError) {
             console.warn("AI Generation failed, falling back to Deterministic Balanced Matrix", aiError);
             games = generateBalancedMatrix(finalSelection, 25, 15);
          }
        } else {
          games = generateCombinations(finalSelection, 15);
        }
        
        setGeneratedGames(games);
        setStatus(AppStatus.ANALYZING);
        try {
           const analysisResult = await analyzeClosing(finalSelection, games.length);
           setAnalysis(analysisResult);
        } catch (e) {
           console.log("Analysis skipped");
        }
        setStatus(AppStatus.SUCCESS);
      } catch (error) {
        console.error(error);
        setStatus(AppStatus.ERROR);
      }
    }, 100);
  };

  const handleSaveBatch = () => {
    if (generatedGames.length === 0 || !latestResult) return;
    const targetConcurso = latestResult.proximoConcurso;
    const gamesPayload = generatedGames.map((g, i) => ({ 
        numbers: g, 
        gameNumber: i + 1 
    }));
    const updatedBatches = saveBets(gamesPayload, targetConcurso);
    setSavedBatches(updatedBatches);
    setNotification({
      msg: `Todos os ${generatedGames.length} jogos foram salvos!`,
      type: 'success'
    });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleSaveSingleGame = (e: React.MouseEvent, game: number[], originalIndex: number) => {
    e.stopPropagation(); 
    if (!latestResult) return;
    const targetConcurso = latestResult.proximoConcurso;
    const originalGameNumber = originalIndex + 1;
    const updatedBatches = saveBets(
        [{ numbers: game, gameNumber: originalGameNumber }], 
        targetConcurso
    );
    setSavedBatches(updatedBatches);
    setNotification({
      msg: `Jogo ${originalGameNumber} salvo em "Meus Jogos"!`,
      type: 'success'
    });
    setTimeout(() => setNotification(null), 2000);
  };

  const handleCopyGame = (game: number[], index: number) => {
    const text = game.join(', ');
    navigator.clipboard.writeText(text).then(() => {
      setCopiedGameIndex(index);
      setTimeout(() => setCopiedGameIndex(null), 2000);
      setNotification({ msg: 'Jogo copiado para área de transferência!', type: 'success' });
      setTimeout(() => setNotification(null), 1500);
    }).catch(err => {
      console.error('Failed to copy: ', err);
    });
  };

  // --- DELETE HANDLERS CORRIGIDOS ---

  const handleDeleteBatch = (e: React.MouseEvent, batchId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if(!window.confirm('Tem certeza que deseja apagar TODOS os jogos deste grupo?')) return;
    
    // Usa o service para deletar e obter a lista atualizada
    const updatedBatches = deleteBatch(batchId);
    setSavedBatches(updatedBatches);
    
    setNotification({ msg: 'Grupo de jogos removido.', type: 'info' });
    setTimeout(() => setNotification(null), 2000);
  };

  const handleDeleteSpecificGame = (e: React.MouseEvent, batchId: string, gameId: string, gameNumber: number) => {
    e.preventDefault(); 
    e.stopPropagation(); 
    if(!window.confirm(`Deseja realmente apagar o Jogo ${gameNumber}?`)) return;
    
    // Usa o service para deletar o jogo específico e obter a lista atualizada
    const updatedBatches = deleteGame(batchId, gameId);
    setSavedBatches(updatedBatches);
    
    setNotification({ msg: `Jogo ${gameNumber} removido com sucesso.`, type: 'info' });
    setTimeout(() => setNotification(null), 1500);
  };

  const handleAiSuggestion = async () => {
    setStatus(AppStatus.GENERATING);
    try {
      const suggestions = await getAiSuggestions('lotofacil', 15, 25);
      if (suggestions.length > 0) {
        const capped = suggestions.slice(0, MAX_SELECTION);
        setSelectedNumbers(new Set(capped));
        setGeneratedGames([]);
        setAnalysis(null);
        setHistorySim(null);
        setHistoryCheck(null);
        setExpandedGameStats(null);
        setStatus(AppStatus.IDLE);
      }
    } catch (e) {
      console.error(e);
      alert("Erro na IA.");
    } finally {
      setStatus(AppStatus.IDLE);
    }
  };

  // --- GALLERY LOGIC ---
  const handleOpenGalleries = async () => {
    setShowGalleriesModal(true);
    // Initialize with current year
    const currentYear = new Date().getFullYear();
    handleYearSelect(currentYear);
  };

  const handleYearSelect = async (year: number) => {
    setSelectedYear(year);
    setWinningHistory([]);
    setIsLoadingHistory(true);

    const startConcurso = LOTOFACIL_YEAR_START[year] || 1;
    // Load first batch for that year (e.g., 50 games)
    // We assume about 200-300 games per year, so we load chunks.
    setHistoryCursor(startConcurso);
    
    // Determine end of range for this year (next year start - 1, or latest)
    let endLimit = 99999;
    if (LOTOFACIL_YEAR_START[year + 1]) {
       endLimit = LOTOFACIL_YEAR_START[year + 1] - 1;
    } else if (latestResult) {
       endLimit = latestResult.concurso;
    }

    try {
       const initialBatchEnd = Math.min(startConcurso + 49, endLimit);
       const results = await fetchResultsRange('lotofacil', startConcurso, initialBatchEnd);
       // Sort ASCENDING (1, 2, 3...)
       setWinningHistory(results.sort((a, b) => a.concurso - b.concurso));
       setHistoryCursor(initialBatchEnd + 1);
    } catch(e) {
       console.error(e);
    } finally {
       setIsLoadingHistory(false);
    }
  };

  const handleLoadMoreInYear = async () => {
    if (isLoadingHistory || !latestResult) return;
    setIsLoadingHistory(true);

    let endLimit = 99999;
    if (LOTOFACIL_YEAR_START[selectedYear + 1]) {
       endLimit = LOTOFACIL_YEAR_START[selectedYear + 1] - 1;
    } else if (latestResult) {
       endLimit = latestResult.concurso;
    }

    // Stop if we exceeded the year's range
    if (historyCursor > endLimit) {
        setIsLoadingHistory(false);
        return;
    }

    try {
        const batchEnd = Math.min(historyCursor + 49, endLimit);
        const results = await fetchResultsRange('lotofacil', historyCursor, batchEnd);
        
        setWinningHistory(prev => {
            const combined = [...prev, ...results];
            // Sort Ascending
            return combined.sort((a, b) => a.concurso - b.concurso);
        });
        setHistoryCursor(batchEnd + 1);

    } catch(e) {
        console.error(e);
    } finally {
        setIsLoadingHistory(false);
    }
  };

  const handleWhatsAppShare = () => {
    if (generatedGames.length === 0) return;
    const targetNumber = "5599984252028";
    const nextDate = latestResult?.dataProximoConcurso || "Em breve";
    const filteredGames = generatedGames.filter(game => {
      const stats = getStats(game);
      const odds = Number(stats.odds);
      const sum = Number(stats.sum);
      return (odds >= 7 && odds <= 9) && (sum >= 170 && sum <= 225);
    });
    const gamesToSend = filteredGames.length > 0 ? filteredGames : generatedGames;
    
    let message = `🤖 *LotoSmart AI - Top 200 Stats*\n`;
    message += `📅 Próximo Sorteio: ${nextDate}\n\n`;
    gamesToSend.forEach((game, index) => {
      const line = game.map(n => n.toString().padStart(2, '0')).join(' ');
      message += `*Jogo ${(index + 1).toString().padStart(2, '0')}.* ${line}\n`;
    });
    message += `\n🍀 Boa sorte!`;
    const url = `https://wa.me/${targetNumber}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  const calculateHits = (game: number[], targetResultSet?: Set<number>) => {
    const targets = targetResultSet || resultNumbers;
    if (targets.size === 0) return 0;
    return game.filter(n => targets.has(n)).length;
  };

  const getHitStyle = (hits: number) => {
    if (hits === 15) return "bg-gradient-to-r from-yellow-500 to-purple-600 border-yellow-300 text-white shadow-[0_0_15px_rgba(234,179,8,0.5)]";
    if (hits === 14) return "bg-gradient-to-r from-orange-500 to-red-600 border-orange-300 text-white shadow-[0_0_10px_rgba(249,115,22,0.4)]";
    if (hits === 13) return "bg-gradient-to-r from-yellow-400 to-orange-400 border-yellow-200 text-slate-900 font-bold";
    if (hits === 12) return "bg-emerald-600 border-emerald-400 text-white";
    if (hits === 11) return "bg-cyan-700 border-cyan-500 text-cyan-50";
    return "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-750";
  };

  const selectionCount = selectedNumbers.size;
  let possibleGamesText = "";
  if (selectionCount >= 15) {
    if (selectionCount > 18) {
       possibleGamesText = "25 (Matriz Alta Precisão)";
    } else {
       const count = selectionCount === 15 ? 1 : 
                     selectionCount === 16 ? 16 : 
                     selectionCount === 17 ? 136 : 816;
       possibleGamesText = count.toString();
    }
  }

  // --- RENDER HELPERS ---
  const renderGameDetails = () => {
    if (!viewingGame) return null;
    
    // Find previous game to calculate "Repetidos"
    const prevGame = winningHistory.find(g => g.concurso === viewingGame.concurso - 1);
    const prevNumbers = prevGame ? prevGame.dezenas.map(d => parseInt(d, 10)) : undefined;

    const stats = calculateDetailedStats(viewingGame.dezenas.map(d => parseInt(d, 10)), prevNumbers, GAMES.lotofacil);
    
    return (
      <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-fade-in">
        <div className="bg-white w-full max-w-lg rounded-xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            {/* Header Roxo */}
            <div className="bg-[#a04e8a] text-white p-4 flex justify-between items-center relative shadow-lg">
                <h3 className="font-bold text-center w-full text-lg">
                    Análise do Resultado {viewingGame.concurso} da Lotofácil
                </h3>
                <button 
                  onClick={() => setViewingGame(null)} 
                  className="absolute right-3 w-8 h-8 flex items-center justify-center bg-white/20 hover:bg-white/30 rounded-full transition-colors font-bold"
                >
                  ✕
                </button>
            </div>
            
            <div className="overflow-y-auto p-0 text-slate-800 text-sm">
                
                {/* Stats Table (Zebrada) */}
                <div className="flex justify-between px-4 py-2 border-b border-gray-200 bg-white">
                    <span>Números Pares:</span><span className="font-bold">{stats.pares}</span>
                </div>
                <div className="flex justify-between px-4 py-2 border-b border-gray-200 bg-gray-50">
                    <span>Números Ímpares:</span><span className="font-bold">{stats.impares}</span>
                </div>
                <div className="flex justify-between px-4 py-2 border-b border-gray-200 bg-white">
                    <span>Números Primos:</span><span className="font-bold">{stats.primos}</span>
                </div>
                <div className="flex justify-between px-4 py-2 border-b border-gray-200 bg-gray-50">
                    <span>Repetidos no Concurso Anterior:</span>
                    <span className={`font-bold ${stats.repetidos === '-' ? 'text-gray-400' : ''}`}>{stats.repetidos}</span>
                </div>
                <div className="flex justify-between px-4 py-2 border-b border-gray-200 bg-white">
                    <span>Soma dos Números:</span><span className="font-bold">{stats.soma}</span>
                </div>
                <div className="flex justify-between px-4 py-2 border-b border-gray-200 bg-gray-50">
                    <span>Média Aritmética:</span><span className="font-bold">{stats.media}</span>
                </div>
                <div className="flex justify-between px-4 py-2 border-b border-gray-200 bg-white">
                    <span>Desvio Padrão:</span><span className="font-bold">{stats.desvioPadrao}</span>
                </div>
                <div className="flex justify-between px-4 py-2 border-b border-gray-200 bg-gray-50">
                    <span>Múltiplos de 3:</span><span className="font-bold">{stats.multiplos3}</span>
                </div>
                <div className="flex justify-between px-4 py-2 border-b border-gray-200 bg-white">
                    <span>Números de Fibonacci:</span><span className="font-bold">{stats.fibonacci}</span>
                </div>
                <div className="flex justify-between px-4 py-2 border-b border-gray-200 bg-gray-50">
                   <span>Números Triangulares:</span><span className="font-bold">{stats.triangulares}</span>
                </div>
                <div className="flex justify-between px-4 py-2 border-b border-gray-200 bg-white">
                    <span>Números na Moldura:</span><span className="font-bold">{stats.moldura}</span>
                </div>
                <div className="flex justify-between px-4 py-2 border-b border-gray-200 bg-gray-50">
                    <span>Números no Centro:</span><span className="font-bold">{stats.centro}</span>
                </div>

                {/* Prize Table Header */}
                <div className="bg-[#a04e8a] text-white p-3 flex text-center text-sm font-bold mt-4 shadow-sm items-center">
                    <div className="flex-1">Acertos</div>
                    <div className="flex-1">Ganhadores</div>
                    <div className="flex-1 text-right pr-4">Prêmio (R$)</div>
                </div>

                {/* Prize List */}
                <div className="text-sm text-slate-800 pb-2">
                    {viewingGame.premiacoes.map((p, idx) => (
                        <div key={p.faixa} className={`flex text-center py-2.5 border-b border-gray-200 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                            <div className="flex-1 font-bold text-slate-600">{p.faixa}</div>
                            <div className="flex-1">{p.ganhadores}</div>
                            <div className="flex-1 font-medium text-[#a04e8a] text-right pr-4">{p.valor.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</div>
                        </div>
                    ))}
                </div>

                {/* Numbers */}
                <div className="p-4 bg-gray-100 border-t border-gray-200">
                    <div className="text-center text-xs text-gray-500 mb-2 uppercase tracking-wider font-bold">Dezenas Sorteadas</div>
                    <div className="flex flex-wrap justify-center gap-1.5">
                        {viewingGame.dezenas.map(d => (
                            <span key={d} className="w-8 h-8 rounded-full bg-[#a04e8a] text-white text-sm flex items-center justify-center font-bold shadow-md border border-purple-800/20">
                                {d}
                            </span>
                        ))}
                    </div>
                    <div className="text-center text-xs text-gray-400 mt-2">{viewingGame.data}</div>
                </div>
            </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-900 pb-36">
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
            <div className="w-8 h-8 bg-gradient-to-tr from-purple-500 to-pink-500 rounded-lg flex items-center justify-center font-bold text-white text-lg">L</div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-400">LotoSmart AI</h1>
          </div>
          <button 
            onClick={() => setShowSavedGamesModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-full text-xs font-bold text-slate-200 transition-colors border border-slate-600"
          >
            <span>📁</span>
            {savedBatches.length > 0 && (
              <span className="bg-purple-500 text-white w-4 h-4 flex items-center justify-center rounded-full text-[9px] ml-1">{savedBatches.length}</span>
            )}
          </button>
        </div>
      </header>

      <main className="max-w-lg mx-auto p-4 space-y-6">
        
        {/* Latest Result Card */}
        {isResultLoading ? (
          <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700 animate-pulse">
            <div className="h-4 bg-slate-700 rounded w-1/3 mb-4"></div>
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
                  <div className="text-sm font-bold">{latestResult.acumulou ? 'ACUMULOU!' : 'PREMIADO'}</div>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 justify-center sm:justify-start mb-4">
                {latestResult.dezenas.map((n) => (
                  <span key={n} className="w-7 h-7 flex items-center justify-center bg-gradient-to-br from-emerald-600/30 to-slate-800 border border-emerald-500/40 rounded-full text-xs font-bold text-emerald-100 shadow-sm">{n}</span>
                ))}
              </div>
              {latestResult.dataProximoConcurso && <CountdownTimer targetDateStr={latestResult.dataProximoConcurso} />}
            </div>
          </div>
        ) : null}

        {/* Buttons Group */}
        <div className="grid grid-cols-2 gap-3">
          <button 
            onClick={handleGenerateTop200}
            disabled={status !== AppStatus.IDLE && status !== AppStatus.SUCCESS}
            className="w-full py-3 bg-gradient-to-br from-indigo-900 to-indigo-700 border border-indigo-500/50 rounded-xl text-indigo-100 font-bold flex flex-col items-center justify-center gap-1 active:scale-95 transition-all shadow-lg shadow-indigo-900/20"
          >
            {status === AppStatus.GENERATING ? (
               <span className="text-xs animate-pulse">Processando...</span>
            ) : (
              <>
                <span className="text-lg">🔥</span>
                <span className="text-xs text-center">Estratégia Top 200<br/>(Garante 12+)</span>
              </>
            )}
          </button>
          
          <button 
            onClick={handleOpenGalleries}
            className="w-full py-3 bg-slate-800 border border-slate-700 rounded-xl text-slate-300 font-bold flex flex-col items-center justify-center gap-1 active:bg-slate-700 transition-colors"
          >
             <span className="text-lg">🏆</span>
             <span className="text-xs">Resultados por Ano</span>
          </button>

          <button 
            onClick={handleHistoricalStrategy}
            disabled={status !== AppStatus.IDLE && status !== AppStatus.SUCCESS}
            className="col-span-2 py-3 bg-gradient-to-r from-amber-600 to-amber-700 border border-amber-500/50 rounded-xl text-amber-100 font-bold flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg"
          >
            {status === AppStatus.GENERATING ? (
              <span className="text-xs animate-pulse">Analisando 3000+ concursos...</span>
            ) : (
              <>
                <span className="text-lg">🏛️</span>
                <span>Análise Histórica (Desde o #1)</span>
              </>
            )}
          </button>
        </div>

        {/* YEAR GALLERY MODAL - LIST VIEW */}
        {showGalleriesModal && (
           <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
              <div className="bg-slate-900 w-full max-w-4xl h-[95vh] rounded-xl border border-slate-700 shadow-2xl flex flex-col overflow-hidden">
                  
                  {/* Header */}
                  <div className="p-3 bg-purple-900/20 border-b border-purple-500/20 flex justify-between items-center">
                      <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <span className="text-purple-400">📅</span> 
                        Histórico por Ano
                      </h3>
                      <button onClick={() => setShowGalleriesModal(false)} className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center border border-slate-700">✕</button>
                  </div>

                  <div className="flex flex-1 overflow-hidden">
                    {/* Sidebar Years */}
                    <div className="w-20 sm:w-24 border-r border-slate-800 overflow-y-auto bg-slate-900/50 no-scrollbar">
                        {availableYears.map(year => (
                           <button
                             key={year}
                             onClick={() => handleYearSelect(year)}
                             className={`w-full py-4 text-xs sm:text-sm font-bold border-b border-slate-800 transition-all ${
                               selectedYear === year 
                               ? "bg-purple-600 text-white border-l-4 border-l-purple-300" 
                               : "text-slate-500 hover:bg-slate-800 hover:text-slate-300"
                             }`}
                           >
                             {year}
                           </button>
                        ))}
                    </div>

                    {/* Content Area - List of Clickable Cards */}
                    <div className="flex-1 overflow-y-auto bg-slate-950 p-2 sm:p-4 scroll-smooth">
                        {isLoadingHistory && winningHistory.length === 0 ? (
                           <div className="flex flex-col items-center justify-center h-full text-slate-500">
                             <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mb-2"></div>
                             Carregando {selectedYear}...
                           </div>
                        ) : (
                           <div className="space-y-3">
                              {winningHistory.length === 0 ? (
                                <div className="text-center py-10 text-slate-500">Nenhum resultado carregado.</div>
                              ) : (
                                winningHistory.map((game) => (
                                   <button 
                                     key={game.concurso} 
                                     onClick={() => setViewingGame(game)}
                                     className="w-full text-left bg-slate-800 hover:bg-slate-750 p-3 rounded-lg border border-slate-700 hover:border-purple-500/50 transition-all active:scale-95 group shadow-sm flex flex-col gap-2"
                                   >
                                      <div className="flex justify-between items-center w-full border-b border-slate-700 pb-2 mb-1">
                                         <div>
                                            <span className="text-purple-400 font-bold text-sm block">Concurso {game.concurso}</span>
                                            <span className="text-[10px] text-slate-500">{game.data}</span>
                                         </div>
                                         <div className="text-[10px] bg-slate-700 text-slate-300 px-2 py-1 rounded-full group-hover:bg-purple-600 group-hover:text-white transition-colors font-bold">
                                            Ver Detalhes →
                                         </div>
                                      </div>
                                      
                                      <div className="flex flex-wrap gap-1 justify-center sm:justify-start opacity-80 group-hover:opacity-100">
                                         {game.dezenas.map(d => (
                                            <span key={d} className="w-6 h-6 rounded-full bg-slate-900 border border-slate-600 text-[10px] flex items-center justify-center font-bold text-slate-300">
                                              {d}
                                            </span>
                                         ))}
                                      </div>
                                   </button>
                                ))
                              )}

                              {/* Load More Trigger */}
                              <div className="pt-4 pb-10">
                                <button 
                                  onClick={handleLoadMoreInYear}
                                  disabled={isLoadingHistory}
                                  className="w-full py-3 bg-slate-800 text-slate-400 rounded-lg font-bold border border-slate-700 hover:bg-slate-700 transition-colors"
                                >
                                  {isLoadingHistory ? 'Carregando...' : `Carregar Mais de ${selectedYear}`}
                                </button>
                              </div>
                           </div>
                        )}
                    </div>
                  </div>
              </div>
           </div>
        )}

        {/* DETAILED GAME MODAL (Overlay) */}
        {renderGameDetails()}

        {/* Saved Games Modal */}
        {showSavedGamesModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
             <div className="bg-slate-800 w-full max-w-lg max-h-[85vh] rounded-xl border border-slate-700 shadow-2xl flex flex-col">
                <div className="p-4 border-b border-slate-700 flex justify-between items-center">
                   <h3 className="text-lg font-bold text-white">📁 Jogos Salvos</h3>
                   <button onClick={() => setShowSavedGamesModal(false)} className="w-8 h-8 rounded-full bg-slate-700 text-slate-300 hover:text-white">✕</button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {savedBatches.length === 0 ? (
                    <div className="text-center py-10 text-slate-500"><p>Nenhum jogo salvo.</p></div>
                  ) : (
                    savedBatches.map((batch, idx) => (
                        <div key={batch.id || idx} className="bg-slate-900/50 rounded-lg border border-slate-700 p-3 shadow-sm">
                          <div className="flex justify-between items-start mb-3 border-b border-slate-700/50 pb-2">
                            <div>
                               <div className="text-sm font-bold text-white flex items-center gap-2">
                                  <span>Conc: {batch.targetConcurso}</span>
                                  {latestResult && latestResult.concurso === batch.targetConcurso && (
                                     <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-500/30">Atual</span>
                                  )}
                                </div>
                               <div className="text-[10px] text-slate-500">{batch.createdAt} • {batch.games.length} jogos</div>
                            </div>
                            <button 
                              type="button"
                              onClick={(e) => handleDeleteBatch(e, batch.id)} 
                              className="bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 rounded-lg px-4 py-1.5 transition-colors flex items-center gap-1.5 text-xs font-bold shadow-sm active:scale-95 z-20"
                            >
                              <span>🗑️</span> Excluir Grupo
                            </button>
                          </div>
                          <div className="space-y-3">
                            {batch.games.map((gameObj, gameIdx) => {
                              if (!gameObj || !gameObj.numbers) return null;

                              let hits = 0;
                              let statusLabel = <span className="text-slate-500 text-[10px]">Aguardando...</span>;
                              let styleClass = "bg-slate-800 border-slate-700";

                              if (latestResult && latestResult.concurso === batch.targetConcurso) {
                                  hits = calculateHits(gameObj.numbers);
                                  styleClass = getHitStyle(hits);
                                  
                                  if (hits >= 11) statusLabel = <span className={`font-bold text-[10px] ${hits >= 14 ? 'text-white' : 'text-slate-900'}`}>{hits} PONTOS!</span>;
                                  else statusLabel = <span className="text-slate-400 text-[10px]">{hits} acertos</span>;
                              } else if (latestResult && latestResult.concurso > batch.targetConcurso) {
                                  statusLabel = <span className="text-slate-500 text-[10px] line-through">Expirado</span>;
                              }
                              
                              const isWinner = hits >= 11;

                              return (
                                <div key={gameObj.id} className={`flex flex-col p-3 rounded mb-1 border transition-all ${styleClass} ${isWinner ? 'shadow-[0_0_10px_rgba(255,215,0,0.15)]' : ''}`}>
                                   <div className="flex justify-between items-center mb-2 pb-1 border-b border-white/5">
                                      <div className="flex items-center gap-2">
                                         <span className="text-xs font-bold opacity-70">Jogo {gameObj.gameNumber}</span>
                                         {isWinner && (
                                            <span className="text-[10px] bg-yellow-400 text-black px-1.5 rounded-full font-bold flex items-center gap-1 shadow-sm">
                                              🏆 {hits}
                                            </span>
                                         )}
                                      </div>
                                      <button 
                                        onClick={(e) => handleDeleteSpecificGame(e, batch.id, gameObj.id, gameObj.gameNumber)}
                                        className="w-5 h-5 flex items-center justify-center text-red-400 hover:text-white hover:bg-red-500 rounded transition-colors"
                                        title={`Apagar Jogo ${gameObj.gameNumber}`}
                                      >
                                        ✕
                                      </button>
                                   </div>
                                   <div className="flex justify-between items-center">
                                       <div className="flex gap-1 flex-wrap">
                                          {gameObj.numbers.map(n => {
                                            const isHit = resultNumbers.has(n);
                                            return (
                                              <span key={n} className={`text-[10px] w-6 h-6 flex items-center justify-center rounded-full font-mono font-bold ${isHit ? 'bg-white text-black font-bold' : 'bg-black/20 text-current opacity-80'}`}>
                                                 {n.toString().padStart(2, '0')}
                                              </span>
                                            );
                                          })}
                                       </div>
                                       <div className="ml-2 min-w-[60px] text-right">{statusLabel}</div>
                                   </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                    ))
                  )}
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
            <div className="bg-purple-500 h-full transition-all duration-300" style={{ width: `${(selectionCount / MAX_SELECTION) * 100}%` }}></div>
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

        {/* Generated Games Section */}
        {generatedGames.length > 0 && (
          <div className="space-y-3">
             <div className="flex flex-col space-y-2">
                <h3 className="text-lg font-bold text-white flex items-center">
                  Jogos Gerados ({generatedGames.length})
                </h3>
                <div className="text-xs text-slate-400 mb-2">
                   Toque no cartão para <span className="text-white font-bold">COPIAR</span>. Use o botão 💾 para salvar.
                </div>
                {/* Actions */}
                <div className="flex w-full gap-2">
                    <button onClick={handleSaveBatch} className="flex-1 px-4 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/50 text-blue-200 text-xs font-bold rounded-lg">Salvar Todos</button>
                    <button onClick={handleWhatsAppShare} className="flex-1 px-4 py-1.5 bg-green-600 hover:bg-green-500 text-white text-xs font-bold rounded-lg">Enviar WhatsApp</button>
                </div>
            </div>
            
            <div className="space-y-2">
              {generatedGames.map((game, idx) => {
                const hits = calculateHits(game);
                const isCopied = copiedGameIndex === idx;
                
                // Calculate Stats for visual feedback
                const stats = getStats(game);
                const evens = Number(stats.evens);
                const sum = Number(stats.sum);
                const isOptimized = evens >= 6 && evens <= 9 && sum >= 170 && sum <= 225;
                
                // CALCULATE DETAILED STATS ON THE FLY
                // Uses latestResult as previousNumbers to calculate Repeats
                const previousNumbers = latestResult ? Array.from(resultNumbers) as number[] : undefined;
                const detailedStats = calculateDetailedStats(game, previousNumbers, GAMES.lotofacil);
                
                const isExpanded = expandedGameStats === idx;

                let styleClass = "bg-slate-800 border-slate-700 hover:bg-slate-750";
                let hitBadge = null;

                if (latestResult) {
                   const currentHits = calculateHits(game);
                   if (currentHits >= 11) {
                      styleClass = getHitStyle(currentHits);
                      hitBadge = <div className="absolute top-0 right-20 px-2 py-1 rounded-b-lg text-[10px] font-bold bg-black/30 text-white shadow-sm z-20">{currentHits} PTS</div>;
                   }
                }
                
                if (isOptimized && !hitBadge && styleClass.includes('bg-slate-800')) {
                   styleClass = "bg-slate-800/80 border-indigo-500/30 shadow-[0_0_15px_rgba(99,102,241,0.1)] hover:bg-slate-750";
                }
                
                return (
                  <button 
                    key={idx} 
                    onClick={() => handleCopyGame(game, idx)}
                    className={`w-full text-left p-3 rounded-lg border flex flex-col space-y-2 relative overflow-hidden transition-all active:scale-95 group ${styleClass}`}
                  >
                    {isCopied && (
                      <div className="absolute inset-0 z-20 bg-emerald-600/90 flex items-center justify-center animate-fade-in">
                        <span className="text-white font-bold text-lg flex items-center gap-2">📋 Copiado!</span>
                      </div>
                    )}
                    
                    <div className="absolute inset-0 z-10 bg-black/0 hover:bg-black/10 transition-colors pointer-events-none"></div>

                    {hitBadge}

                    {/* ACTIONS ROW */}
                    <div className="absolute top-2 right-2 flex gap-2 z-20">
                      <div 
                        onClick={(e) => toggleGameStats(e, idx)}
                        className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors shadow-lg border border-white/10 ${isExpanded ? 'bg-purple-600 text-white' : 'bg-slate-900/50 text-purple-300 hover:bg-purple-600 hover:text-white'}`}
                        title="Ver Estatísticas Detalhadas"
                      >
                        📊
                      </div>
                      <div 
                        onClick={(e) => handleSaveSingleGame(e, game, idx)}
                        className="w-7 h-7 bg-slate-900/50 hover:bg-blue-600 text-white rounded-full flex items-center justify-center border border-white/10 transition-colors shadow-lg"
                        title="Salvar apenas este jogo"
                      >
                        💾
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1 pr-20 mt-1">
                       <div className="absolute -top-1 left-2 text-[9px] font-bold text-slate-500 bg-slate-900 px-1 rounded-b border border-t-0 border-slate-800 flex items-center">
                         Jogo {idx + 1}
                         {isOptimized && <span className="text-yellow-400 ml-1 text-[10px]" title="Estatisticamente Equilibrado">✨</span>}
                       </div>
                      {game.map(n => {
                        const isHit = resultNumbers.has(n);
                        return (
                          <span key={n} className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-mono ${isHit ? 'bg-white text-black font-bold' : 'bg-black/20 text-white/80'}`}>
                            {n.toString().padStart(2, '0')}
                          </span>
                        );
                      })}
                    </div>

                    {/* EXPANDED STATS GRID */}
                    {isExpanded && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3 pt-3 border-t border-white/10 text-[10px] text-slate-300 animate-fade-in relative z-20 cursor-default" onClick={(e) => e.stopPropagation()}>
                         <div className="flex justify-between bg-black/20 px-2 py-1 rounded"><span>Pares:</span> <span className="font-bold text-white">{detailedStats.pares}</span></div>
                         <div className="flex justify-between bg-black/20 px-2 py-1 rounded"><span>Ímpares:</span> <span className="font-bold text-white">{detailedStats.impares}</span></div>
                         <div className="flex justify-between bg-black/20 px-2 py-1 rounded"><span>Primos:</span> <span className="font-bold text-white">{detailedStats.primos}</span></div>
                         <div className="flex justify-between bg-black/20 px-2 py-1 rounded"><span>Repetidos:</span> <span className="font-bold text-white">{detailedStats.repetidos}</span></div>
                         <div className="flex justify-between bg-black/20 px-2 py-1 rounded"><span>Soma:</span> <span className="font-bold text-white">{detailedStats.soma}</span></div>
                         <div className="flex justify-between bg-black/20 px-2 py-1 rounded"><span>Média:</span> <span className="font-bold text-white">{detailedStats.media}</span></div>
                         <div className="flex justify-between bg-black/20 px-2 py-1 rounded"><span>Desvio P.:</span> <span className="font-bold text-white">{detailedStats.desvioPadrao}</span></div>
                         <div className="flex justify-between bg-black/20 px-2 py-1 rounded"><span>Mult. 3:</span> <span className="font-bold text-white">{detailedStats.multiplos3}</span></div>
                         <div className="flex justify-between bg-black/20 px-2 py-1 rounded"><span>Fibonacci:</span> <span className="font-bold text-white">{detailedStats.fibonacci}</span></div>
                         <div className="flex justify-between bg-black/20 px-2 py-1 rounded"><span>Moldura:</span> <span className="font-bold text-white">{detailedStats.moldura}</span></div>
                         <div className="flex justify-between bg-black/20 px-2 py-1 rounded"><span>Centro:</span> <span className="font-bold text-white">{detailedStats.centro}</span></div>
                         <div className="flex justify-between bg-black/20 px-2 py-1 rounded"><span>Triang.:</span> <span className="font-bold text-white">{detailedStats.triangulares}</span></div>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

      </main>

      <footer className="fixed bottom-0 left-0 right-0 bg-slate-800/90 backdrop-blur-md border-t border-slate-700 p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-20">
        <div className="max-w-lg mx-auto flex gap-3">
          <button onClick={handleClear} className="px-4 py-3 rounded-lg bg-slate-700 text-slate-300 font-medium">Limpar</button>
          {selectedNumbers.size === 0 ? (
             <button onClick={handleAiSuggestion} className="flex-1 py-3 rounded-lg bg-indigo-600 text-white font-bold" disabled={status !== AppStatus.IDLE}>
               {status === AppStatus.GENERATING ? '...' : '🔮 Palpite IA'}
             </button>
          ) : (
            <button 
              onClick={handleGenerate}
              disabled={selectionCount < MIN_SELECTION}
              className={`flex-1 py-3 rounded-lg font-bold shadow-lg ${selectionCount < MIN_SELECTION ? 'bg-slate-600' : 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'}`}
            >
              {status === AppStatus.GENERATING ? 'Gerando...' : `Gerar ${possibleGamesText} Jogos`}
            </button>
          )}
        </div>
      </footer>
    </div>
  );
};

export default App;