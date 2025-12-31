import React, { useState, useEffect, useMemo, useRef } from 'react';
import { generateCombinations, getStats, generateBalancedMatrix, calculateHotNumbers, getYearsList, GAME_YEAR_STARTS, calculateDetailedStats } from './utils/lotteryLogic';
import { getAiSuggestions, analyzeClosing, generateSmartClosing, getHistoricalBestNumbers } from './services/geminiService';
import { fetchLatestResult, fetchPastResults, fetchResultsRange } from './services/lotteryService';
import { saveBets, getSavedBets, deleteBatch, deleteGame } from './services/storageService';
import NumberBall from './components/NumberBall';
import CountdownTimer from './components/CountdownTimer';
import { GAMES, DEFAULT_GAME } from './utils/gameConfig';
import { AppStatus, AnalysisResult, LotteryResult, TrendResult, HistoricalAnalysis, HistoryCheckResult, PastGameResult, SavedBetBatch, DetailedStats, GameConfig } from './types';

const App: React.FC = () => {
  // --- STATE MANAGEMENT ---
  const [activeGame, setActiveGame] = useState<GameConfig>(DEFAULT_GAME);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

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
  
  // Galleries State
  const [showGalleriesModal, setShowGalleriesModal] = useState(false);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [winningHistory, setWinningHistory] = useState<PastGameResult[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  // historyCursor agora rastreia o limite INFERIOR do próximo lote (para carregar para trás)
  const [historyCursor, setHistoryCursor] = useState<number>(1); 
  
  // GAME DETAIL STATE
  const [viewingGame, setViewingGame] = useState<PastGameResult | null>(null);

  // Saved Games State
  const [savedBatches, setSavedBatches] = useState<SavedBetBatch[]>([]);
  const [showSavedGamesModal, setShowSavedGamesModal] = useState(false);
  const [notification, setNotification] = useState<{msg: string, type: 'success' | 'info' | 'error'} | null>(null);

  // Clipboard state
  const [copiedGameIndex, setCopiedGameIndex] = useState<number | null>(null);

  // EXPANDED STATS STATE
  const [expandedGameStats, setExpandedGameStats] = useState<number | null>(null);

  // Derived constants based on activeGame
  const allNumbers = useMemo(() => {
    // Super Sete logic handled visually, internal numbers 0-69 mapped to cols
    if (activeGame.id === 'supersete') {
        return Array.from({ length: 70 }, (_, i) => i); // 0 to 69
    }
    // FEDERAL: Returns empty, no grid
    if (activeGame.id === 'federal') {
        return [];
    }
    return Array.from({ length: activeGame.totalNumbers }, (_, i) => i + 1);
  }, [activeGame]);

  const availableYears = useMemo(() => getYearsList(activeGame.startYear), [activeGame]);

  // --- EFFECTS ---

  // Load result whenever game changes
  useEffect(() => {
    handleClear();
    loadLatestResult();
    const loaded = getSavedBets();
    setSavedBatches(loaded);
  }, [activeGame.id]);

  // Check for wins automatically
  useEffect(() => {
    if (latestResult && savedBatches.length > 0) {
      checkAutomaticWins(latestResult, savedBatches);
    }
  }, [latestResult, savedBatches.length]);

  // --- LOGIC ---

  const loadLatestResult = () => {
    setIsResultLoading(true);
    setLatestResult(null);
    fetchLatestResult(activeGame.apiSlug)
      .then((res) => {
        setLatestResult(res);
      })
      .catch((err) => console.error(err))
      .finally(() => setIsResultLoading(false));
  };

  const handleGameChange = (gameId: string) => {
    const newGame = GAMES[gameId];
    if (newGame) {
        setActiveGame(newGame);
        setIsMenuOpen(false);
    }
  };

  const checkAutomaticWins = (result: LotteryResult, batches: SavedBetBatch[]) => {
    // Federal does not support automatic win check (too complex combinations)
    if (activeGame.id === 'federal') return;

    let maxHits = 0;
    // Filter batches for current game type
    const relevantBatches = batches.filter(b => b.gameType === activeGame.id || (!b.gameType && activeGame.id === 'lotofacil'));

    relevantBatches.forEach(batch => {
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

    // Thresholds for notification depend on game
    let threshold = 0;
    if (activeGame.id === 'lotofacil') threshold = 11;
    else if (activeGame.id === 'megasena') threshold = 4;
    else if (activeGame.id === 'quina') threshold = 2;
    else if (activeGame.id === 'lotomania') threshold = 15;
    
    if (maxHits >= threshold && threshold > 0) {
      setNotification({
        msg: `🎉 Parabéns! O sistema detectou ${maxHits} pontos nos seus jogos salvos da ${activeGame.name}!`,
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
    // Federal: Doesn't map well to a Set<number> for grid checking, but we keep it empty safely
    if (activeGame.id === 'federal') return new Set();
    return new Set(latestResult.dezenas.map(d => parseInt(d, 10)));
  }, [latestResult, activeGame.id]);

  const toggleNumber = (num: number) => {
    const newSelection = new Set(selectedNumbers);
    if (newSelection.has(num)) {
      newSelection.delete(num);
    } else {
      if (newSelection.size >= activeGame.maxSelection) {
          setNotification({ msg: `Máximo de ${activeGame.maxSelection} números para este fechamento.`, type: 'info' });
          setTimeout(() => setNotification(null), 2000);
          return;
      }
      // Specific validation for Super Sete (max 3 per column)
      if (activeGame.id === 'supersete') {
          const colIndex = Math.floor(Number(num) / 10);
          const currentInCol = Array.from(newSelection).filter(n => Math.floor(Number(n) / 10) === colIndex).length;
          if (currentInCol >= 3) {
             setNotification({ msg: `Máximo de 3 números por coluna no Super Sete.`, type: 'info' });
             setTimeout(() => setNotification(null), 2000);
             return;
          }
      }
      newSelection.add(num);
    }
    setSelectedNumbers(newSelection);
    
    // Reset state if modified
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

  // --- GENERATION HANDLERS ---

  const handleGenerateTop200 = async () => {
    if (!latestResult) return;
    setStatus(AppStatus.GENERATING);
    setGeneratedGames([]);
    setHistoryCheck(null);
    setExpandedGameStats(null);
    
    try {
      const pastResults = await fetchPastResults(activeGame.apiSlug, latestResult.concurso, 200);
      const hotNumbers = calculateHotNumbers(pastResults, activeGame.maxSelection); // Use max selection as pool
      
      // Select the top N hot numbers based on max allowed selection
      const selectionPool = hotNumbers.slice(0, activeGame.maxSelection);
      setSelectedNumbers(new Set(selectionPool));
      
      // Generate using balanced matrix
      const games = generateBalancedMatrix(selectionPool, 25, activeGame.minSelection); // Use minSelection for game size
      
      setGeneratedGames(games);
      setStatus(AppStatus.SUCCESS);
      
      setNotification({
        msg: `Estratégia Top 200 aplicada para ${activeGame.name}!`,
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
      setNotification({ msg: `Analisando histórico completo da ${activeGame.name}...`, type: 'info' });
      const historicalNumbers = await getHistoricalBestNumbers(activeGame.name, activeGame.minSelection);
      
      if (!historicalNumbers || historicalNumbers.length < activeGame.minSelection) {
        throw new Error("Falha na análise histórica");
      }

      setSelectedNumbers(new Set(historicalNumbers));

      let games: number[][] = [];
      try {
        games = await generateSmartClosing(activeGame.name, historicalNumbers, activeGame.minSelection);
      } catch {
        games = generateBalancedMatrix(historicalNumbers, 25, activeGame.minSelection);
      }

      setGeneratedGames(games);
      setStatus(AppStatus.SUCCESS);

      setNotification({
        msg: 'Fechamento Histórico IA gerado com sucesso!',
        type: 'success'
      });
      setTimeout(() => setNotification(null), 4000);

    } catch (e) {
      console.error(e);
      setNotification({ msg: 'Erro na análise histórica.', type: 'error' });
      setStatus(AppStatus.ERROR);
    }
  };

  // FEDERAL GENERATOR
  const handleGenerateFederal = () => {
      setStatus(AppStatus.GENERATING);
      setTimeout(() => {
          // Generates 5 random 5-digit numbers
          const games: number[][] = [];
          for(let i=0; i<5; i++) {
              const num = Math.floor(Math.random() * 100000); // 0 to 99999
              games.push([num]); // Store as single-element array to fit type
          }
          setGeneratedGames(games);
          setStatus(AppStatus.SUCCESS);
          setNotification({msg: "Bilhetes da sorte gerados!", type: 'success'});
          setTimeout(() => setNotification(null), 2000);
      }, 500);
  };

  const handleGenerate = async () => {
    // Especial: Federal
    if (activeGame.id === 'federal') {
        handleGenerateFederal();
        return;
    }

    if (selectedNumbers.size < activeGame.minSelection) return;

    setStatus(AppStatus.GENERATING);
    setHistorySim(null);
    setHistoryCheck(null);
    setExpandedGameStats(null);
    
    setTimeout(async () => {
      try {
        let finalSelection: number[] = Array.from(selectedNumbers);
        
        let games: number[][] = [];
        const selectionSize = finalSelection.length;
        
        // AI Optimization threshold depends on game complexity
        const useAI = isAiOptimized && selectionSize > activeGame.minSelection;

        if (useAI) {
          try {
             games = await generateSmartClosing(activeGame.name, finalSelection, activeGame.minSelection);
             if (!games || games.length === 0) throw new Error("AI Empty Result");
          } catch (aiError) {
             console.warn("AI Generation failed, falling back to Math", aiError);
             // Fallback to Combinations or Matrix
             if (selectionSize <= activeGame.minSelection + 3) {
                 games = generateCombinations(finalSelection, activeGame.minSelection);
             } else {
                 games = generateBalancedMatrix(finalSelection, 50, activeGame.minSelection); // Cap fallback at 50 games
             }
          }
        } else {
          // If strictly equal to min selection, it's 1 game
          if (selectionSize === activeGame.minSelection) {
              games = [finalSelection.sort((a,b)=>a-b)];
          } else {
              // Standard Combinations (careful with large numbers)
              // If combinations > 500, switch to Balanced Matrix
              // Approx check:
              games = generateCombinations(finalSelection, activeGame.minSelection);
          }
        }
        
        setGeneratedGames(games);
        setStatus(AppStatus.ANALYZING);
        
        // Skip detailed AI analysis for very large sets to save tokens/time
        if (games.length < 50) {
            try {
               const analysisResult = await analyzeClosing(finalSelection, games.length);
               setAnalysis(analysisResult);
            } catch (e) { console.log("Analysis skipped"); }
        }
        
        setStatus(AppStatus.SUCCESS);
      } catch (error) {
        console.error(error);
        setStatus(AppStatus.ERROR);
      }
    }, 100);
  };

  const handleAiSuggestion = async () => {
    setStatus(AppStatus.GENERATING);
    try {
      const suggestions = await getAiSuggestions(activeGame.name, activeGame.minSelection, activeGame.totalNumbers);
      if (suggestions.length > 0) {
        // Validation for numbers range
        const validSuggestions = suggestions.filter(n => n >= 1 && n <= activeGame.totalNumbers);
        const capped = validSuggestions.slice(0, activeGame.maxSelection);
        
        setSelectedNumbers(new Set(capped));
        setGeneratedGames([]);
        setStatus(AppStatus.IDLE);
      }
    } catch (e) {
      console.error(e);
      setNotification({msg: "Erro na IA. Tente novamente.", type: 'error'});
    } finally {
      setStatus(AppStatus.IDLE);
    }
  };

  // --- SAVE & SHARE ---

  const handleSaveBatch = () => {
    if (generatedGames.length === 0 || !latestResult) return;
    const targetConcurso = latestResult.proximoConcurso;
    const gamesPayload = generatedGames.map((g, i) => ({ 
        numbers: g, 
        gameNumber: i + 1 
    }));
    const updatedBatches = saveBets(gamesPayload, targetConcurso, activeGame.id);
    setSavedBatches(updatedBatches);
    setNotification({
      msg: `Todos os ${generatedGames.length} jogos salvos em "Meus Jogos"!`,
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
        targetConcurso,
        activeGame.id
    );
    setSavedBatches(updatedBatches);
    setNotification({
      msg: `Jogo ${originalGameNumber} salvo!`,
      type: 'success'
    });
    setTimeout(() => setNotification(null), 2000);
  };

  const handleCopyGame = (game: number[], index: number) => {
    // Adapt copy for Federal (5 digit string) or Normal
    const text = activeGame.id === 'federal' 
        ? game[0].toString()
        : game.join(', ');

    navigator.clipboard.writeText(text).then(() => {
      setCopiedGameIndex(index);
      setTimeout(() => setCopiedGameIndex(null), 2000);
      setNotification({ msg: 'Copiado!', type: 'success' });
      setTimeout(() => setNotification(null), 1000);
    }).catch(err => {
      console.error('Failed to copy: ', err);
    });
  };

  const handleWhatsAppShare = () => {
    if (generatedGames.length === 0) return;
    const nextDate = latestResult?.dataProximoConcurso || "Em breve";
    
    let message = `🤖 *LotoSmart AI - ${activeGame.name}*\n`;
    message += `📅 Próximo Sorteio: ${nextDate}\n\n`;
    generatedGames.slice(0, 50).forEach((game, index) => {
      const line = activeGame.id === 'federal'
          ? game[0].toString()
          : game.map(n => n.toString().padStart(2, '0')).join(' ');
      message += `*Jogo ${(index + 1).toString().padStart(2, '0')}.* ${line}\n`;
    });
    if (generatedGames.length > 50) message += `\n...e mais ${generatedGames.length - 50} jogos.`;
    message += `\n🍀 Boa sorte!`;
    const url = `https://wa.me/?text=${encodeURIComponent(message)}`; // Generic share
    window.open(url, '_blank');
  };

  // --- DELETE HANDLERS ---

  const handleDeleteBatch = (e: React.MouseEvent, batchId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if(!window.confirm('Apagar grupo de jogos?')) return;
    const updatedBatches = deleteBatch(batchId);
    setSavedBatches(updatedBatches);
  };

  const handleDeleteSpecificGame = (e: React.MouseEvent, batchId: string, gameId: string) => {
    e.preventDefault(); 
    e.stopPropagation(); 
    const updatedBatches = deleteGame(batchId, gameId);
    setSavedBatches(updatedBatches);
  };

  // --- GALLERY LOGIC ---
  
  const handleOpenGalleries = () => {
    setShowGalleriesModal(true);
    handleYearSelect(new Date().getFullYear());
  };

  const handleYearSelect = async (year: number) => {
    setSelectedYear(year);
    setWinningHistory([]);
    setIsLoadingHistory(true);

    const yearMap = GAME_YEAR_STARTS[activeGame.id];
    // Início do ano selecionado
    const startOfSelectedYear = yearMap ? yearMap[year] || 1 : 1;
    
    // Fim do ano selecionado (Início do próximo - 1)
    let endOfSelectedYear = 999999;
    if (yearMap && yearMap[year + 1]) {
       endOfSelectedYear = yearMap[year + 1] - 1;
    } else if (latestResult) {
       endOfSelectedYear = latestResult.concurso;
    }
    
    // Se o ano selecionado é o atual, não pode passar do último sorteio realizado
    if (latestResult && endOfSelectedYear > latestResult.concurso) {
        endOfSelectedYear = latestResult.concurso;
    }

    // Lógica Descendente: Começa do Fim do Ano e volta 50
    const batchSize = 50;
    const fetchEnd = endOfSelectedYear;
    const fetchStart = Math.max(startOfSelectedYear, fetchEnd - batchSize + 1);
    
    // O Cursor guardará onde devemos parar na próxima busca (fetchStart - 1)
    setHistoryCursor(fetchStart - 1); 

    try {
       const results = await fetchResultsRange(activeGame.apiSlug, fetchStart, fetchEnd);
       // Ordena DESCENDENTE (Mais novo no topo)
       setWinningHistory(results.sort((a, b) => b.concurso - a.concurso));
    } catch(e) { console.error(e); } 
    finally { setIsLoadingHistory(false); }
  };

  const handleLoadMoreInYear = async () => {
    if (isLoadingHistory) return;
    setIsLoadingHistory(true);

    const yearMap = GAME_YEAR_STARTS[activeGame.id];
    const startOfSelectedYear = yearMap ? yearMap[selectedYear] || 1 : 1;

    // O Cursor atual é o limite superior do que AINDA NÃO foi carregado (descendo a ladeira)
    // Ex: Carregamos 2000-1950. Cursor agora é 1949.
    const fetchEnd = historyCursor; 
    
    if (fetchEnd < startOfSelectedYear) {
        setIsLoadingHistory(false);
        return;
    }

    const batchSize = 50;
    const fetchStart = Math.max(startOfSelectedYear, fetchEnd - batchSize + 1);

    try {
        const results = await fetchResultsRange(activeGame.apiSlug, fetchStart, fetchEnd);
        setWinningHistory(prev => {
            // Combina: Atuais (Novos) + Carregados agora (Velhos)
            const newSorted = results.sort((a, b) => b.concurso - a.concurso);
            return [...prev, ...newSorted];
        });
        setHistoryCursor(fetchStart - 1);
    } catch(e) { console.error(e); } 
    finally { setIsLoadingHistory(false); }
  };

  // --- RENDER HELPERS ---

  const calculateHits = (game: number[], targetResultSet?: Set<number>) => {
    const targets = targetResultSet || resultNumbers;
    if (targets.size === 0) return 0;
    return game.filter(n => targets.has(n)).length;
  };

  const getHitStyle = (hits: number) => {
    // Dynamic based on game min/max prize tiers
    let isWin = false;
    let isJackpot = false;

    if (activeGame.id === 'lotofacil') { if(hits>=11) isWin=true; if(hits===15) isJackpot=true; }
    else if (activeGame.id === 'megasena') { if(hits>=4) isWin=true; if(hits===6) isJackpot=true; }
    else if (activeGame.id === 'quina') { if(hits>=2) isWin=true; if(hits===5) isJackpot=true; }
    else if (activeGame.id === 'lotomania') { if(hits>=15 || hits===0) isWin=true; if(hits===20) isJackpot=true; }
    else if (activeGame.id === 'supersete') { if(hits>=3) isWin=true; if(hits===7) isJackpot=true; }
    else { if(hits > activeGame.minSelection / 2) isWin=true; }

    if (isJackpot) return "bg-gradient-to-r from-yellow-500/20 to-amber-500/20 border-yellow-500/50 shadow-[0_0_15px_rgba(234,179,8,0.2)]";
    if (isWin) return "bg-emerald-900/30 border-emerald-500/50 shadow-[0_0_10px_rgba(16,185,129,0.2)]";
    return "bg-slate-800 border-slate-700 hover:border-slate-600";
  };

  const renderGameDetails = () => {
    if (!viewingGame) return null;
    const prevGame = winningHistory.find(g => g.concurso === viewingGame.concurso - 1);
    const prevNumbers = prevGame ? prevGame.dezenas.map(d => parseInt(d, 10)) : undefined;
    const stats = calculateDetailedStats(viewingGame.dezenas.map(d => parseInt(d, 10)), prevNumbers, activeGame);
    
    return (
      <div className="fixed inset-0 z-[80] bg-black/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-fade-in">
        <div className="bg-white w-full max-w-lg rounded-xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className={`bg-${activeGame.color}-600 text-white p-4 flex justify-between items-center relative shadow-lg`}>
                <h3 className="font-bold text-center w-full text-lg">Resultado {activeGame.name} #{viewingGame.concurso}</h3>
                <button onClick={() => setViewingGame(null)} className="absolute right-3 w-8 h-8 flex items-center justify-center bg-white/20 hover:bg-white/30 rounded-full font-bold">✕</button>
            </div>
            <div className="overflow-y-auto p-0 text-slate-800 text-sm">
                
                {/* Full Detailed Stats Grid - Hide for Federal */}
                {activeGame.id !== 'federal' && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-px bg-gray-200 border-b border-gray-200">
                    <div className="bg-white p-2 flex justify-between items-center"><span>Pares:</span><strong>{stats.pares}</strong></div>
                    <div className="bg-white p-2 flex justify-between items-center"><span>Ímpares:</span><strong>{stats.impares}</strong></div>
                    <div className="bg-white p-2 flex justify-between items-center"><span>Primos:</span><strong>{stats.primos}</strong></div>
                    
                    <div className="bg-white p-2 flex justify-between items-center"><span>Soma:</span><strong>{stats.soma}</strong></div>
                    <div className="bg-white p-2 flex justify-between items-center"><span>Fibonacci:</span><strong>{stats.fibonacci}</strong></div>
                    <div className="bg-white p-2 flex justify-between items-center"><span>Múlt. 3:</span><strong>{stats.multiplos3}</strong></div>

                    <div className="bg-white p-2 flex justify-between items-center"><span>Média:</span><strong>{stats.media}</strong></div>
                    <div className="bg-white p-2 flex justify-between items-center"><span>Desvio P.:</span><strong>{stats.desvioPadrao}</strong></div>
                    <div className="bg-white p-2 flex justify-between items-center"><span>Triangulares:</span><strong>{stats.triangulares}</strong></div>
                    
                    <div className="bg-white p-2 flex justify-between items-center"><span>Moldura:</span><strong>{stats.moldura}</strong></div>
                    <div className="bg-white p-2 flex justify-between items-center"><span>Centro:</span><strong>{stats.centro}</strong></div>
                    <div className="bg-white p-2 flex justify-between items-center text-red-600"><span>Repetidos:</span><strong>{stats.repetidos}</strong></div>
                </div>
                )}
                
                {/* Prize List */}
                <div className="p-2 bg-gray-50 border-t border-gray-200">
                    <div className="text-center text-xs font-bold text-gray-500 mb-1">Premiação</div>
                    {viewingGame.premiacoes.map((p, idx) => (
                        <div key={idx} className="flex justify-between items-center py-1 border-b border-gray-200 text-xs last:border-0">
                            {/* Ajuste para Federal mostrar 1º Premio, 2º Premio etc */}
                            <span className="font-medium text-slate-600">
                               {activeGame.id === 'federal' 
                                  ? `${p.faixa}º Prêmio` 
                                  : (p.faixa > 20 ? `${p.faixa} acertos` : p.faixa === 0 ? '0 acertos' : `${p.faixa} acertos`)}
                            </span>
                            
                            {/* Federal Bilhete Display in List */}
                            {activeGame.id === 'federal' && p.bilhete && (
                                <span className="font-mono font-bold text-blue-600 bg-blue-50 px-2 rounded border border-blue-100">{p.bilhete}</span>
                            )}

                            <div className="text-right">
                               <div className="font-bold text-slate-800">{p.ganhadores} ganhadores</div>
                               <div className="text-[10px] text-green-600">R$ {p.valor.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Simplified numbers view */}
                <div className="p-4 bg-gray-100 border-t border-gray-200">
                    <div className="text-center text-xs text-gray-500 mb-2 font-bold">{viewingGame.data}</div>
                    
                    {activeGame.id === 'federal' ? (
                         <div className="flex flex-col gap-1 w-full max-w-[200px] mx-auto">
                            {viewingGame.dezenas.map((bilhete, idx) => (
                               <div key={idx} className="flex justify-between text-xs border-b border-gray-300 pb-1">
                                  <span className="font-bold text-slate-500">{idx+1}º</span>
                                  <span className="font-mono font-bold text-slate-800 tracking-widest">{bilhete}</span>
                               </div>
                            ))}
                         </div>
                    ) : (
                        <div className="flex flex-wrap justify-center gap-1.5">
                            {viewingGame.dezenas.map(d => (
                                <span key={d} className={`w-8 h-8 rounded-full bg-${activeGame.color}-600 text-white text-sm flex items-center justify-center font-bold shadow-md`}>{d}</span>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
      </div>
    );
  };

  // Determine grid columns
  const getGridColsClass = () => {
      if (activeGame.cols === 5) return 'grid-cols-5';
      if (activeGame.cols === 7) return 'grid-cols-7'; // Dia de Sorte
      if (activeGame.cols === 10) return 'grid-cols-5 sm:grid-cols-10';
      return 'grid-cols-5';
  };

  const selectionCount = selectedNumbers.size;

  return (
    <div className={`min-h-screen bg-slate-900 pb-36 font-sans text-slate-100`}>
      
      {/* DRAWER MENU */}
      <div className={`fixed inset-0 z-50 bg-black/80 backdrop-blur-sm transition-opacity duration-300 ${isMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`} onClick={() => setIsMenuOpen(false)}>
         <div className={`absolute top-0 left-0 bottom-0 w-64 bg-slate-800 shadow-2xl transform transition-transform duration-300 ${isMenuOpen ? 'translate-x-0' : '-translate-x-full'} overflow-y-auto`} onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-slate-700 flex justify-between items-center bg-gradient-to-r from-purple-900 to-slate-800">
                <h2 className="font-bold text-xl text-white">Jogos</h2>
                <button onClick={() => setIsMenuOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            <div className="p-2 space-y-1">
                {Object.values(GAMES).map(game => (
                    <button 
                        key={game.id}
                        onClick={() => handleGameChange(game.id)}
                        className={`w-full text-left p-3 rounded-lg flex items-center gap-3 transition-colors ${activeGame.id === game.id ? `bg-${game.color}-600 text-white shadow-lg` : 'text-slate-300 hover:bg-slate-700'}`}
                    >
                        <span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold bg-white/10`}>{game.name[0]}</span>
                        <span className="font-medium">{game.name}</span>
                    </button>
                ))}
            </div>
         </div>
      </div>

      {notification && (
        <div className="fixed top-4 left-4 right-4 z-[100] animate-bounce-in">
          <div className={`${notification.type === 'error' ? 'bg-red-600' : (notification.type === 'success' ? 'bg-emerald-600' : 'bg-blue-600')} text-white p-4 rounded-xl shadow-2xl flex items-center justify-between border border-white/20`}>
            <span className="text-sm font-bold pr-2">{notification.msg}</span>
            <button onClick={() => setNotification(null)} className="text-white/80 hover:text-white font-bold">✕</button>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-slate-800 border-b border-slate-700 p-3 sticky top-0 z-40 shadow-md">
        <div className="flex justify-between items-center max-w-lg mx-auto">
          <div className="flex items-center gap-3">
            <button onClick={() => setIsMenuOpen(true)} className="p-2 text-slate-300 hover:text-white bg-slate-700/50 rounded-lg">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
            <div>
                <h1 className={`text-lg font-bold text-${activeGame.color}-400 leading-none`}>{activeGame.name}</h1>
                <span className="text-[10px] text-slate-500 font-bold tracking-wider">LOTOSMART AI</span>
            </div>
          </div>
          <button 
            onClick={() => setShowSavedGamesModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-full text-xs font-bold text-slate-200 border border-slate-600"
          >
            <span>📁</span>
            {savedBatches.filter(b => b.gameType === activeGame.id).length > 0 && (
              <span className={`bg-${activeGame.color}-500 text-white w-4 h-4 flex items-center justify-center rounded-full text-[9px] ml-1`}>
                  {savedBatches.filter(b => b.gameType === activeGame.id).length}
              </span>
            )}
          </button>
        </div>
      </header>

      <main className="max-w-lg mx-auto p-4 space-y-5">
        
        {/* Latest Result Card */}
        {isResultLoading ? (
          <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700 animate-pulse h-32"></div>
        ) : latestResult ? (
          <div className="bg-slate-800/80 rounded-xl border border-slate-700 shadow-md relative overflow-hidden group">
            <div className={`absolute top-0 right-0 w-32 h-32 bg-${activeGame.color}-500/10 rounded-full blur-2xl -mr-10 -mt-10`}></div>
            <div className="p-4 relative z-10">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <span className={`text-[10px] text-${activeGame.color}-300 font-bold uppercase tracking-wider bg-${activeGame.color}-900/30 px-2 py-0.5 rounded-full border border-${activeGame.color}-500/20`}>
                    Concurso {latestResult.concurso}
                  </span>
                  <div className="text-xs text-slate-400 mt-1">{latestResult.data}</div>
                </div>
                <div className={`text-right ${latestResult.acumulou ? 'text-yellow-400' : 'text-emerald-400'}`}>
                  <div className="text-sm font-bold">{latestResult.acumulou ? 'ACUMULOU!' : 'PREMIADO'}</div>
                  {!latestResult.acumulou && latestResult.premiacoes && latestResult.premiacoes[0] && (
                     <div className="text-xs font-mono font-bold mt-0.5 animate-fade-in text-emerald-200">
                        {latestResult.premiacoes[0].valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                     </div>
                  )}
                </div>
              </div>

              {/* FEDERAL SPECIFIC RESULT DISPLAY */}
              {activeGame.id === 'federal' ? (
                  <div className="flex flex-col gap-2 mb-4">
                      {latestResult.dezenas.map((bilhete, idx) => (
                          <div key={idx} className="flex justify-between items-center bg-black/20 p-2 rounded border border-white/5">
                              <span className="text-[10px] text-slate-400 font-bold uppercase">{idx + 1}º Prêmio</span>
                              <span className="font-mono text-lg font-bold text-white tracking-widest">{bilhete}</span>
                          </div>
                      ))}
                  </div>
              ) : (
                <div className="flex flex-wrap gap-1.5 justify-center sm:justify-start mb-4">
                    {latestResult.dezenas.map((n, idx) => (
                    <span key={idx} className={`w-7 h-7 flex items-center justify-center bg-gradient-to-br from-${activeGame.color}-600/30 to-slate-800 border border-${activeGame.color}-500/40 rounded-full text-xs font-bold text-${activeGame.color}-100 shadow-sm`}>{n}</span>
                    ))}
                </div>
              )}

              {latestResult.dataProximoConcurso && <CountdownTimer targetDateStr={latestResult.dataProximoConcurso} />}
              
              {/* Estimated Prize Display */}
              {(latestResult.valorEstimadoProximoConcurso > 0) && (
                  <div className="mt-3 bg-gradient-to-r from-emerald-900/40 to-green-900/40 border border-emerald-500/30 rounded-lg p-3 text-center shadow-lg relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-full h-full bg-emerald-500/5"></div>
                      <div className="relative z-10">
                          <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest mb-0.5">
                              Estimativa de Prêmio
                          </p>
                          <p className="text-2xl font-bold text-white font-mono tracking-tight drop-shadow-md">
                              {latestResult.valorEstimadoProximoConcurso.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </p>
                      </div>
                  </div>
              )}
            </div>
          </div>
        ) : null}

        {/* Buttons Group */}
        <div className="grid grid-cols-2 gap-3">
          {activeGame.id !== 'federal' && (
          <button 
            onClick={handleGenerateTop200}
            disabled={status !== AppStatus.IDLE && status !== AppStatus.SUCCESS}
            className={`w-full py-3 bg-gradient-to-br from-${activeGame.color}-900 to-${activeGame.color}-800 border border-${activeGame.color}-500/50 rounded-xl text-${activeGame.color}-100 font-bold flex flex-col items-center justify-center gap-1 active:scale-95 transition-all shadow-lg`}
          >
            {status === AppStatus.GENERATING ? (
               <span className="text-xs animate-pulse">Processando...</span>
            ) : (
              <>
                <span className="text-lg">🔥</span>
                <span className="text-xs text-center">Top {activeGame.maxSelection} Quentes<br/>(Histórico 200)</span>
              </>
            )}
          </button>
          )}
          
          <button 
            onClick={handleOpenGalleries}
            className={`w-full py-3 bg-slate-800 border border-slate-700 rounded-xl text-slate-300 font-bold flex flex-col items-center justify-center gap-1 active:bg-slate-700 transition-colors ${activeGame.id === 'federal' ? 'col-span-2' : ''}`}
          >
             <span className="text-lg">🏆</span>
             <span className="text-xs">Resultados por Ano</span>
          </button>

          {activeGame.id !== 'federal' && (
          <button 
            onClick={handleHistoricalStrategy}
            disabled={status !== AppStatus.IDLE && status !== AppStatus.SUCCESS}
            className="col-span-2 py-3 bg-gradient-to-r from-amber-600 to-amber-700 border border-amber-500/50 rounded-xl text-amber-100 font-bold flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg"
          >
            {status === AppStatus.GENERATING ? <span className="text-xs animate-pulse">Analisando...</span> : <><span>🏛️</span><span>Análise Histórica IA</span></>}
          </button>
          )}
        </div>

        {/* Status Card (Hidden for Federal) */}
        {activeGame.id !== 'federal' && (
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 sticky top-16 z-30 backdrop-blur-sm">
          <div className="flex justify-between items-center mb-2">
            <span className="text-slate-400 text-sm">Números Selecionados</span>
            <span className={`text-sm font-bold ${selectionCount === activeGame.maxSelection ? 'text-red-400' : `text-${activeGame.color}-400`}`}>
              {selectionCount} / {activeGame.maxSelection}
            </span>
          </div>
          <div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden">
            <div className={`bg-${activeGame.color}-500 h-full transition-all duration-300`} style={{ width: `${Math.min(100, (selectionCount / activeGame.minSelection) * 100)}%` }}></div>
          </div>
          {selectionCount < activeGame.minSelection && (
              <p className="text-[10px] text-center text-slate-500 mt-2">Selecione pelo menos {activeGame.minSelection} números</p>
          )}
        </div>
        )}

        {/* Dynamic Grid */}
        {activeGame.id === 'federal' ? (
            <div className="bg-blue-900/20 border border-blue-500/20 p-6 rounded-xl text-center">
                <span className="text-4xl mb-2 block">🎫</span>
                <p className="text-sm text-blue-200 mb-2 font-bold">Na Federal você concorre com bilhetes inteiros.</p>
                <p className="text-xs text-slate-400">Gere abaixo palpites aleatórios de bilhetes de 5 dígitos para procurar na lotérica.</p>
            </div>
        ) : (
            <div className={`grid ${getGridColsClass()} gap-2 sm:gap-3 justify-items-center pb-4`}>
            {allNumbers.map((num) => (
                <NumberBall
                key={num}
                number={num}
                isSelected={selectedNumbers.has(num)}
                isRecentResult={resultNumbers.has(num)}
                onClick={toggleNumber}
                disabled={status !== AppStatus.IDLE && status !== AppStatus.SUCCESS}
                colorTheme={activeGame.color}
                size={activeGame.totalNumbers > 60 ? 'small' : 'medium'}
                // Super Sete display tweaks (show 0-9)
                label={activeGame.id === 'supersete' ? (num % 10).toString() : undefined} 
                />
            ))}
            </div>
        )}

        {/* Generated Games Section */}
        {generatedGames.length > 0 && (
          <div className="space-y-4 pt-4 border-t border-slate-800">
             <div className="flex flex-col space-y-2">
                <h3 className="text-lg font-bold text-white flex items-center">
                  {activeGame.id === 'federal' ? 'Palpites de Bilhetes' : `Jogos Gerados (${generatedGames.length})`}
                </h3>
                <div className="flex w-full gap-2">
                    <button onClick={handleSaveBatch} className="flex-1 px-4 py-3 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/50 text-blue-200 text-xs font-bold rounded-lg transition-colors">Salvar Todos</button>
                    <button onClick={handleWhatsAppShare} className="flex-1 px-4 py-3 bg-green-600/20 hover:bg-green-600/30 border border-green-500/50 text-green-200 text-xs font-bold rounded-lg transition-colors">Enviar WhatsApp</button>
                </div>
            </div>
            
            <div className="space-y-3">
              {generatedGames.map((game, idx) => {
                const hits = calculateHits(game);
                const isCopied = copiedGameIndex === idx;
                const isExpanded = expandedGameStats === idx;
                
                // On-the-fly Detailed Stats
                const prevNumbers = latestResult ? Array.from(resultNumbers) as number[] : undefined;
                const detailedStats = isExpanded ? calculateDetailedStats(game, prevNumbers, activeGame) : null;

                let styleClass = "bg-slate-800 border-slate-700 hover:border-slate-500";
                if (latestResult && activeGame.id !== 'federal') {
                   styleClass = getHitStyle(hits);
                }
                
                // Special render for Federal (One number, rectangular)
                if (activeGame.id === 'federal') {
                    const ticketNumber = game[0].toString();
                    return (
                        <button
                            key={idx}
                            onClick={() => handleCopyGame(game, idx)}
                            className="w-full text-left p-4 bg-gradient-to-r from-blue-900/40 to-slate-800 border border-blue-500/30 rounded-lg shadow-sm relative overflow-hidden group active:scale-95 transition-all"
                        >
                             {isCopied && (
                                <div className="absolute inset-0 z-20 bg-blue-600/90 flex items-center justify-center animate-fade-in"><span className="text-white font-bold">Copiado!</span></div>
                             )}
                            <div className="flex justify-between items-center">
                                <span className="text-xs text-blue-300 font-bold uppercase tracking-wider">Palpite {idx+1}</span>
                                <div className="font-mono text-xl font-bold text-white tracking-[0.2em] bg-black/20 px-3 py-1 rounded border border-white/5">{ticketNumber}</div>
                            </div>
                        </button>
                    );
                }
                
                return (
                  <button 
                    key={idx} 
                    onClick={() => handleCopyGame(game, idx)}
                    className={`w-full text-left rounded-xl border flex flex-col relative overflow-hidden transition-all active:scale-95 group ${styleClass} shadow-md`}
                  >
                    {isCopied && (
                      <div className="absolute inset-0 z-20 bg-emerald-600/90 flex items-center justify-center animate-fade-in"><span className="text-white font-bold">Copiado!</span></div>
                    )}
                    
                    {/* Header: Game Number & Badges */}
                    <div className="flex justify-between items-center bg-black/20 p-2 border-b border-white/5">
                        <span className={`text-xs font-bold uppercase tracking-wider ${latestResult && hits >= (activeGame.minSelection / 2) ? 'text-white' : 'text-slate-400'}`}>
                           Jogo {String(idx + 1).padStart(2, '0')}
                        </span>
                        
                         <div className="flex gap-2 relative z-20">
                           {/* Quick Actions in Header */}
                            <div onClick={(e) => toggleGameStats(e, idx)} className="px-2 py-0.5 rounded text-[10px] font-bold bg-white/10 hover:bg-white/20 text-white flex items-center gap-1 transition-colors">
                              📊 Stats
                            </div>
                            <div onClick={(e) => handleSaveSingleGame(e, game, idx)} className="px-2 py-0.5 rounded text-[10px] font-bold bg-white/10 hover:bg-blue-600 text-white flex items-center gap-1 transition-colors">
                              💾 Salvar
                            </div>
                        </div>
                    </div>

                    {/* Numbers Area */}
                    <div className="p-3">
                      <div className="flex flex-wrap gap-1.5 justify-center sm:justify-start">
                        {game.map(n => {
                          const isHit = resultNumbers.has(n);
                          // Ball Color Logic
                          let ballClass = `bg-black/20 text-slate-300 opacity-80`;
                          if (isHit) {
                             ballClass = `bg-white text-black font-bold shadow-sm scale-105`;
                          } else if (activeGame.id !== 'supersete') {
                             // Slight coloring for non-hits to look nice
                             ballClass = `bg-${activeGame.color}-900/40 text-${activeGame.color}-100/70 border border-${activeGame.color}-500/20`;
                          }

                          return (
                            <span key={n} className={`w-7 h-7 flex items-center justify-center rounded-full text-xs font-mono transition-transform ${ballClass}`}>
                              {activeGame.id === 'supersete' ? (n % 10) : n.toString().padStart(2, '0')}
                            </span>
                          );
                        })}
                      </div>
                    </div>

                    {/* Hit Banner if Result Matches */}
                    {latestResult && hits > 0 && (
                       <div className={`px-3 py-1 text-[10px] font-bold text-center uppercase tracking-widest ${hits >= (activeGame.id === 'lotofacil' ? 11 : 4) ? 'bg-white/20 text-white' : 'bg-black/20 text-slate-400'}`}>
                           {hits} Acertos
                       </div>
                    )}

                    {isExpanded && detailedStats && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 border-t border-white/10 text-[10px] text-slate-300 animate-fade-in bg-black/10 cursor-default" onClick={(e) => e.stopPropagation()}>
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

      {/* FOOTER ACTIONS */}
      <footer className="fixed bottom-0 left-0 right-0 bg-slate-800/95 backdrop-blur-md border-t border-slate-700 p-3 shadow-lg z-40 safe-area-pb">
        <div className="max-w-lg mx-auto flex gap-3">
          <button onClick={handleClear} className="px-4 py-3 rounded-xl bg-slate-700 text-slate-300 font-bold border border-slate-600">Limpar</button>
          {selectedNumbers.size === 0 && activeGame.id !== 'federal' ? (
             <button onClick={handleAiSuggestion} className={`flex-1 py-3 rounded-xl bg-${activeGame.color}-700 text-white font-bold border border-${activeGame.color}-500 shadow-lg`} disabled={status !== AppStatus.IDLE}>
               {status === AppStatus.GENERATING ? '...' : '🔮 Palpite IA'}
             </button>
          ) : (
            <button 
              onClick={handleGenerate}
              disabled={activeGame.id !== 'federal' && selectionCount < activeGame.minSelection}
              className={`flex-1 py-3 rounded-xl font-bold shadow-lg text-white ${activeGame.id !== 'federal' && selectionCount < activeGame.minSelection ? 'bg-slate-600 opacity-50' : `bg-gradient-to-r from-${activeGame.color}-600 to-${activeGame.color}-500`}`}
            >
              {status === AppStatus.GENERATING ? 'Gerando...' : (activeGame.id === 'federal' ? '🎫 Gerar Palpites' : `Gerar Jogos`)}
            </button>
          )}
        </div>
      </footer>

      {/* SAVED GAMES MODAL */}
      {showSavedGamesModal && (
          <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
             <div className="bg-slate-800 w-full max-w-lg max-h-[85vh] rounded-xl border border-slate-700 shadow-2xl flex flex-col animate-fade-in">
                <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-800 rounded-t-xl">
                   <h3 className="text-lg font-bold text-white flex items-center gap-2">
                       <span>📁</span> Jogos Salvos
                   </h3>
                   <button onClick={() => setShowSavedGamesModal(false)} className="w-8 h-8 rounded-full bg-slate-700 text-slate-300 hover:text-white transition-colors">✕</button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-900/50">
                  {savedBatches.length === 0 ? (
                    <div className="text-center py-10 text-slate-500"><p>Nenhum jogo salvo.</p></div>
                  ) : (
                    // Filter batches by activeGame logic
                    savedBatches.filter(b => b.gameType === activeGame.id || (!b.gameType && activeGame.id === 'lotofacil')).map((batch, idx) => (
                        <div key={batch.id || idx} className="bg-slate-800/80 rounded-xl border border-slate-700 overflow-hidden shadow-lg mb-4">
                          {/* Batch Header */}
                          <div className="bg-gradient-to-r from-slate-900 to-slate-800 p-3 flex justify-between items-center border-b border-slate-700">
                             <div>
                                <div className="text-sm font-bold text-white flex items-center gap-2">
                                  <span>Concurso {batch.targetConcurso}</span>
                                  {latestResult && latestResult.concurso === batch.targetConcurso && (
                                     <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-500/30 font-bold uppercase tracking-wider">Aberto</span>
                                  )}
                                </div>
                                <div className="text-[10px] text-slate-400 font-mono mt-0.5">{batch.createdAt} • {batch.games.length} jogos</div>
                             </div>
                             <button onClick={(e) => handleDeleteBatch(e, batch.id)} className="text-xs text-red-400 hover:text-red-300 border border-red-900/30 bg-red-900/10 px-3 py-1.5 rounded transition-colors font-bold">
                                Excluir Grupo
                             </button>
                          </div>
                          
                          {/* Games List in Batch */}
                          <div className="p-3 space-y-3">
                            {batch.games.map(g => {
                                // Hit Logic for Saved Games
                                let hitCount = 0;
                                let isWinner = false;
                                if (activeGame.id !== 'federal' && latestResult && latestResult.concurso === batch.targetConcurso) {
                                    hitCount = calculateHits(g.numbers);
                                    // Simple win threshold logic
                                    if (activeGame.id === 'lotofacil' && hitCount >= 11) isWinner = true;
                                    if (activeGame.id === 'megasena' && hitCount >= 4) isWinner = true;
                                    if (activeGame.id === 'quina' && hitCount >= 2) isWinner = true;
                                    if (activeGame.id === 'lotomania' && (hitCount >= 15 || hitCount === 0)) isWinner = true;
                                }

                                return (
                                    <div key={g.id} className={`relative overflow-hidden rounded-lg p-3 border transition-all ${isWinner ? `bg-${activeGame.color}-900/10 border-${activeGame.color}-500/50 shadow-[inset_0_0_20px_rgba(0,0,0,0.2)]` : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'}`}>
                                        {/* Winner Glow */}
                                        {isWinner && <div className={`absolute top-0 left-0 w-1 h-full bg-${activeGame.color}-500`}></div>}
                                        
                                        <div className="flex justify-between items-center mb-2 pl-2">
                                            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                                                {activeGame.id === 'federal' ? `Bilhete ${g.gameNumber}` : `Jogo ${g.gameNumber}`}
                                            </span>
                                            <div className="flex items-center gap-3">
                                                {/* Score Badge */}
                                                {activeGame.id !== 'federal' && latestResult && latestResult.concurso === batch.targetConcurso && (
                                                    <div className={`px-2 py-0.5 rounded text-[10px] font-bold border ${isWinner ? `bg-${activeGame.color}-500 text-white border-${activeGame.color}-400 shadow-sm` : 'bg-slate-700 text-slate-400 border-slate-600'}`}>
                                                        {hitCount} pts
                                                    </div>
                                                )}
                                                <button onClick={(e) => handleDeleteSpecificGame(e, batch.id, g.id)} className="text-slate-500 hover:text-red-400 transition-colors">
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                                                </button>
                                            </div>
                                        </div>
                                        
                                        {activeGame.id === 'federal' ? (
                                             <div className="pl-2">
                                                 <span className="font-mono text-lg text-blue-300 font-bold tracking-[0.2em]">{g.numbers[0].toString()}</span>
                                             </div>
                                        ) : (
                                            <div className="flex flex-wrap gap-2 pl-2">
                                                {g.numbers.map(n => {
                                                    const isHit = latestResult && latestResult.concurso === batch.targetConcurso && resultNumbers.has(n);
                                                    return (
                                                        <span key={n} className={`w-8 h-8 flex items-center justify-center rounded-full text-xs font-bold shadow-sm transition-transform ${isHit ? `bg-white text-slate-900 scale-110 z-10 border-2 border-${activeGame.color}-500` : `bg-slate-900 text-${activeGame.color}-200/60 border border-slate-700/50`}`}>
                                                            {activeGame.id === 'supersete' ? (n % 10) : n.toString().padStart(2, '0')}
                                                        </span>
                                                    )
                                                })}
                                            </div>
                                        )}
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

      {/* GALLERY MODAL */}
      {showGalleriesModal && (
           <div className="fixed inset-0 z-[70] bg-black/90 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
              <div className="bg-slate-900 w-full max-w-4xl h-[95vh] rounded-xl border border-slate-700 shadow-2xl flex flex-col overflow-hidden">
                  <div className="p-3 bg-purple-900/20 border-b border-purple-500/20 flex justify-between items-center">
                      <h3 className="text-lg font-bold text-white">Histórico: {activeGame.name}</h3>
                      <button onClick={() => setShowGalleriesModal(false)} className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:text-white">✕</button>
                  </div>
                  <div className="flex flex-1 overflow-hidden">
                    <div className="w-20 border-r border-slate-800 overflow-y-auto bg-slate-900/50 no-scrollbar">
                        {availableYears.map(year => (
                           <button key={year} onClick={() => handleYearSelect(year)} className={`w-full py-3 text-xs font-bold border-b border-slate-800 ${selectedYear === year ? `bg-${activeGame.color}-600 text-white` : "text-slate-500"}`}>{year}</button>
                        ))}
                    </div>
                    <div className="flex-1 overflow-y-auto bg-slate-950 p-2 space-y-2">
                        {isLoadingHistory && winningHistory.length === 0 && <div className="text-center p-4 text-slate-500 animate-pulse">Carregando...</div>}
                        {winningHistory.length > 0 && winningHistory.map(g => (
                            <button key={g.concurso} onClick={() => setViewingGame(g)} className="w-full text-left bg-slate-800 p-3 rounded flex justify-between items-center hover:bg-slate-700 active:scale-95 transition-all">
                                <div><span className={`text-${activeGame.color}-400 font-bold`}>#{g.concurso}</span> <span className="text-slate-500 text-xs ml-2">{g.data}</span></div>
                                <div className="text-xs text-slate-400 font-bold border border-slate-600 px-2 py-1 rounded">Ver Detalhes →</div>
                            </button>
                        ))}
                        {winningHistory.length > 0 && (
                            <button onClick={handleLoadMoreInYear} className="w-full py-3 bg-slate-800 text-slate-400 rounded text-xs uppercase font-bold mt-4 hover:bg-slate-700 transition-colors">
                                {isLoadingHistory ? 'Carregando...' : 'Carregar Mais Antigos'}
                            </button>
                        )}
                        {!isLoadingHistory && winningHistory.length === 0 && (
                            <div className="text-center p-10 text-slate-500">Nenhum resultado encontrado para este ano ainda.</div>
                        )}
                    </div>
                  </div>
              </div>
           </div>
      )}

      {renderGameDetails()}

    </div>
  );
};

export default App;