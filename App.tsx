import React, { useState, useEffect, useMemo, useRef } from 'react';
import { AnimatePresence, motion, PanInfo } from 'framer-motion';
import { generateCombinations, getStats, generateBalancedMatrix, calculateHotNumbers, getYearsList, GAME_YEAR_STARTS, calculateDetailedStats, filterGamesWithWinners } from './utils/lotteryLogic';
import { getAiSuggestions, analyzeClosing, generateSmartClosing, getHistoricalBestNumbers } from './services/geminiService';
import { fetchLatestResult, fetchPastResults, fetchResultsRange, getFullHistoryWithCache } from './services/lotteryService';
import { saveBets, getSavedBets, deleteBatch, deleteGame } from './services/storageService';
import NumberBall from './components/NumberBall';
import CountdownTimer from './components/CountdownTimer';
import HistoryAnalysisModal from './components/HistoryAnalysisModal';
import { GAMES, DEFAULT_GAME } from './utils/gameConfig';
import { AppStatus, AnalysisResult, LotteryResult, TrendResult, HistoricalAnalysis, HistoryCheckResult, PastGameResult, SavedBetBatch, DetailedStats, GameConfig } from './types';

// --- HAPTIC FEEDBACK HELPER ---
const vibrate = (ms: number = 10) => {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate(ms);
  }
};

const App: React.FC = () => {
  // --- STATE MANAGEMENT ---
  const [activeGame, setActiveGame] = useState<GameConfig>(DEFAULT_GAME);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false); 

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
  
  // Generation Settings
  const [generationLimit, setGenerationLimit] = useState<number | string>(10); // Permitir string para digitação
  const [gameSize, setGameSize] = useState<number>(DEFAULT_GAME.minSelection);

  // Progress State for long operations
  const [loadingProgress, setLoadingProgress] = useState<number>(0);
  
  // ANÁLISE HISTÓRICA DETALHADA (Raio-X)
  const [showHistoryAnalysisModal, setShowHistoryAnalysisModal] = useState(false);
  const [analysisYear, setAnalysisYear] = useState<number>(new Date().getFullYear());
  const [analysisTargetPoints, setAnalysisTargetPoints] = useState<number>(15); // Padrão 15 pontos
  const [analysisResults, setAnalysisResults] = useState<PastGameResult[]>([]);
  const [isAnalysisLoading, setIsAnalysisLoading] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState<number>(0); // Barra de progresso da análise

  // GAME DETAIL STATE
  const [viewingGame, setViewingGame] = useState<PastGameResult | null>(null);

  // Saved Games State
  const [savedBatches, setSavedBatches] = useState<SavedBetBatch[]>([]);
  const [showSavedGamesModal, setShowSavedGamesModal] = useState(false);
  const [notification, setNotification] = useState<{msg: string, type: 'success' | 'info' | 'error'} | null>(null);
  
  // DELETE CONFIRMATION STATES
  const [deleteConfirmBatchId, setDeleteConfirmBatchId] = useState<string | null>(null); // ID do lote pendente
  const [deleteConfirmGameId, setDeleteConfirmGameId] = useState<string | null>(null); // ID do jogo individual pendente

  // Clipboard state
  const [copiedGameIndex, setCopiedGameIndex] = useState<number | null>(null);

  // EXPANDED STATS STATE
  const [expandedGameStats, setExpandedGameStats] = useState<number | null>(null);

  // Derived constants based on activeGame
  const allNumbers = useMemo(() => {
    if (activeGame.id === 'supersete') {
        const nums = [];
        for (let val = 0; val <= 9; val++) { // 10 Linhas visuais
            for (let col = 0; col < 7; col++) { // 7 Colunas visuais
                nums.push(col * 10 + val);
            }
        }
        return nums;
    }
    if (activeGame.id === 'lotomania') {
        // Lotomania usa 00-99. Internal logic uses 0-99.
        return Array.from({ length: 100 }, (_, i) => i);
    }
    if (activeGame.id === 'federal') {
        return [];
    }
    return Array.from({ length: activeGame.totalNumbers }, (_, i) => i + 1);
  }, [activeGame]);

  const availableYears = useMemo(() => activeGame ? getYearsList(activeGame.startYear) : [], [activeGame]);

  // Custo Total dos Jogos Gerados
  const totalGenerationCost = useMemo(() => {
      if (activeGame.id === 'federal' || generatedGames.length === 0) return 0;
      return generatedGames.reduce((acc, game) => {
          const qty = game.length;
          // Procura na tabela de preços pelo número de dezenas
          const entry = activeGame.priceTable.find(p => p.quantity == qty);
          if (entry && typeof entry.price === 'number') {
              return acc + entry.price;
          }
          // Fallback para o valor da aposta mínima se não encontrar exato (ex: fechamentos complexos)
          if (qty === activeGame.minSelection && activeGame.priceTable.length > 0) {
               const minPrice = activeGame.priceTable[0].price;
               if (typeof minPrice === 'number') return acc + minPrice;
          }
          return acc;
      }, 0);
  }, [generatedGames, activeGame]);

  // CALCULAR VALOR TOTAL A RECEBER (PREMIAÇÃO)
  const grandTotalPrize = useMemo(() => {
      if (!latestResult || savedBatches.length === 0) return 0;
      
      let total = 0;
      const resultSet = new Set(latestResult.dezenas.map(d => parseInt(d, 10)));

      savedBatches.forEach(batch => {
          // Só soma se for do mesmo tipo de jogo e mesmo concurso do resultado carregado
          if (batch.gameType === activeGame.id && batch.targetConcurso === latestResult.concurso) {
              batch.games.forEach(gameObj => {
                  const hits = gameObj.numbers.filter(n => resultSet.has(n)).length;
                  // Encontra a faixa de premiação correspondente aos acertos
                  const prizeEntry = latestResult.premiacoes.find(p => p.faixa === hits);
                  if (prizeEntry) {
                      total += prizeEntry.valor;
                  }
              });
          }
      });
      return total;
  }, [latestResult, savedBatches, activeGame.id]);

  // --- EFFECTS ---

  useEffect(() => {
    handleClear();
    loadLatestResult();
    const loaded = getSavedBets();
    setSavedBatches(loaded);
    // Garante reset do gameSize ao trocar de jogo para evitar custos acidentais altos
    setGameSize(activeGame.minSelection);
    // Reset Analysis Target Points default
    if (activeGame.id === 'lotofacil') setAnalysisTargetPoints(15);
    else if (activeGame.id === 'megasena') setAnalysisTargetPoints(6);
    else if (activeGame.id === 'quina') setAnalysisTargetPoints(5);
    else setAnalysisTargetPoints(activeGame.minSelection);
  }, [activeGame.id]);

  useEffect(() => {
    if (latestResult && savedBatches.length > 0) {
      checkAutomaticWins(latestResult, savedBatches);
    }
  }, [latestResult, savedBatches.length]);

  // --- LOGIC ---

  const loadLatestResult = () => {
    setIsResultLoading(true);
    // Não limpa latestResult imediatamente para evitar "flicker"
    fetchLatestResult(activeGame.apiSlug)
      .then((res) => {
        if (res) {
          setLatestResult(res);
        } else {
            console.warn("API retornou vazio, mantendo dados anteriores se existirem.");
            setNotification({ msg: "Modo Offline: Resultados não atualizados.", type: 'info' });
        }
      })
      .catch((err) => {
          console.error(err);
          setNotification({ msg: "Erro de conexão. Verifique sua internet.", type: 'error' });
      })
      .finally(() => setIsResultLoading(false));
  };

  const handleGameChange = (gameId: string) => {
    vibrate(15);
    const newGame = GAMES[gameId];
    if (newGame) {
        setActiveGame(newGame);
        setIsMenuOpen(false);
    }
  };

  const getPriceForQty = (qty: number) => {
    const entry = activeGame.priceTable.find(p => p.quantity == qty);
    if (entry && typeof entry.price === 'number') return entry.price;
    return 0;
  };

  const checkAutomaticWins = (result: LotteryResult, batches: SavedBetBatch[]) => {
    if (activeGame.id === 'federal') return;

    let maxHits = 0;
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

    let threshold = 0;
    if (activeGame.id === 'lotofacil') threshold = 11;
    else if (activeGame.id === 'megasena') threshold = 4;
    else if (activeGame.id === 'quina') threshold = 2;
    else if (activeGame.id === 'lotomania') threshold = 15;
    
    if (maxHits >= threshold && threshold > 0) {
      vibrate(500); // Vibração longa para vitória
      setNotification({
        msg: `🎉 Parabéns! O sistema detectou ${maxHits} pontos nos seus jogos salvos da ${activeGame.name}!`,
        type: 'success'
      });
      setTimeout(() => {
        setShowSavedGamesModal(true);
      }, 1500);
    }
  };

  const resultNumbers = useMemo<Set<number>>(() => {
    if (!latestResult) return new Set<number>();
    if (activeGame.id === 'federal') return new Set();
    return new Set(latestResult.dezenas.map(d => parseInt(d, 10)));
  }, [latestResult, activeGame.id]);

  const toggleNumber = (num: number) => {
    vibrate(8); // Vibração curta ao tocar
    const newSelection = new Set(selectedNumbers);
    if (newSelection.has(num)) {
      newSelection.delete(num);
    } else {
      if (newSelection.size >= activeGame.maxSelection) {
          vibrate(50); // Vibração de erro
          setNotification({ msg: `Máximo de ${activeGame.maxSelection} números para este fechamento.`, type: 'info' });
          setTimeout(() => setNotification(null), 2000);
          return;
      }
      if (activeGame.id === 'supersete') {
          const colIndex = Math.floor(Number(num) / 10);
          const currentInCol = Array.from(newSelection).filter(n => Math.floor(Number(n) / 10) === colIndex).length;
          if (currentInCol >= 3) {
             vibrate(50);
             setNotification({ msg: `Máximo de 3 números por coluna no Super Sete.`, type: 'info' });
             setTimeout(() => setNotification(null), 2000);
             return;
          }
      }
      newSelection.add(num);
    }
    setSelectedNumbers(newSelection);
    
    // --- SINCRONIZAÇÃO AUTOMÁTICA DO TAMANHO DO JOGO ---
    const newCount = newSelection.size;
    // Só atualiza se estiver dentro da faixa permitida da loteria
    if (newCount >= activeGame.minSelection && newCount <= activeGame.maxSelection) {
        setGameSize(newCount);
    } else if (newCount < activeGame.minSelection) {
        // Se ficar abaixo do mínimo (ex: limpou tudo), volta para o padrão mínimo
        setGameSize(activeGame.minSelection);
    }
    
    if (generatedGames.length > 0) {
      setGeneratedGames([]);
      setAnalysis(null);
      setHistorySim(null);
      setHistoryCheck(null);
      setExpandedGameStats(null);
      setStatus(AppStatus.IDLE);
    }
  };

  // NOVA FUNÇÃO: Troca o tamanho e preenche automaticamente
  const handleGameSizeChangeWithAutoSelect = async (newSize: number) => {
      vibrate(10);
      setGameSize(newSize);
      
      // Feedback visual imediato
      setNotification({ msg: `Selecionando ${newSize} melhores números...`, type: 'info' });

      try {
          let pool: number[] = [];
          
          if (latestResult) {
              // Busca histórico para pegar os quentes
              const pastResults = await fetchPastResults(activeGame.apiSlug, latestResult.concurso, 50);
              pool = calculateHotNumbers(pastResults, newSize);
          } else {
              // Fallback aleatório
              const max = activeGame.id === 'lotomania' ? 99 : activeGame.totalNumbers;
              const min = activeGame.id === 'lotomania' ? 0 : 1;
              pool = Array.from({length: activeGame.totalNumbers}, (_, i) => i + min)
                  .sort(() => 0.5 - Math.random())
                  .slice(0, newSize);
          }
          
          // Ordena e seleciona
          pool.sort((a, b) => a - b);
          setSelectedNumbers(new Set(pool));
          
          setNotification({ msg: `${newSize} números selecionados automaticamente!`, type: 'success' });
          setTimeout(() => setNotification(null), 1500);

      } catch (e) {
          console.error("Erro no auto-select", e);
      }
  };

  const handleClear = () => {
    vibrate(20);
    setSelectedNumbers(new Set());
    setGeneratedGames([]);
    setAnalysis(null);
    setHistorySim(null);
    setHistoryCheck(null);
    setExpandedGameStats(null);
    setStatus(AppStatus.IDLE);
    setTrends(null);
    setLoadingProgress(0);
    setGameSize(activeGame.minSelection); // Reseta para o tamanho mínimo
  };

  const toggleGameStats = (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    vibrate(10);
    setExpandedGameStats(prev => prev === index ? null : index);
  };

  const handleGenerateTop200 = async () => {
    vibrate(20);
    // Proteção se não tiver resultado carregado
    if (!latestResult) {
        setNotification({ msg: 'Aguarde o carregamento do último resultado.', type: 'error' });
        loadLatestResult();
        return;
    }

    setStatus(AppStatus.GENERATING);
    setGeneratedGames([]);
    setHistoryCheck(null);
    setExpandedGameStats(null);
    setLoadingProgress(0);
    
    const limit = Number(generationLimit) || 10;

    try {
      setNotification({ msg: `Sincronizando histórico (Otimizado)...`, type: 'info' });

      const pastResults = await getFullHistoryWithCache(activeGame.apiSlug, latestResult.concurso, (prog) => {
          setLoadingProgress(prog);
      });
      
      const winnersOnly = filterGamesWithWinners(pastResults);
      const hotNumbers = calculateHotNumbers(winnersOnly, activeGame.maxSelection); 
      
      const selectionPool = hotNumbers.slice(0, activeGame.maxSelection);
      setSelectedNumbers(new Set(selectionPool));
      
      const games = generateBalancedMatrix(selectionPool, limit, gameSize);
      
      setGeneratedGames(games);
      setStatus(AppStatus.SUCCESS);
      setLoadingProgress(0);
      
      vibrate(100);
      setNotification({
        msg: `Estratégia Padrão Ouro: ${winnersOnly.length} concursos vencedores analisados!`,
        type: 'success'
      });
      setTimeout(() => setNotification(null), 4000);

    } catch (e) {
      console.error(e);
      setNotification({ msg: 'Erro ao analisar histórico.', type: 'info' });
      setStatus(AppStatus.ERROR);
      setLoadingProgress(0);
    }
  };

  // --- NOVA LÓGICA DE ANÁLISE HISTÓRICA COM CACHE ---
  
  // Helper para gerar a chave do cache
  const getAnalysisCacheKey = (year: number) => `lotosmart_analysis_${activeGame.id}_${year}`;

  const handleOpenHistoryAnalysis = () => {
      vibrate(15);
      // Apenas abre o modal, limpa resultados e progresso. O usuário deve clicar em buscar.
      setShowHistoryAnalysisModal(true);
      setAnalysisResults([]);
      setAnalysisProgress(0);
  };

  const handleRunHistoryAnalysis = async () => {
      vibrate(10);
      const year = analysisYear;
      const cacheKey = getAnalysisCacheKey(year);
      
      setIsAnalysisLoading(true);
      setAnalysisResults([]);
      setAnalysisProgress(5); // Início

      // 1. TENTA CARREGAR DO CACHE LOCAL PRIMEIRO
      try {
          const cachedData = localStorage.getItem(cacheKey);
          if (cachedData) {
              const parsed = JSON.parse(cachedData);
              if (Array.isArray(parsed) && parsed.length > 0) {
                  setAnalysisResults(parsed);
                  setAnalysisProgress(100);
                  setIsAnalysisLoading(false);
                  vibrate(50);
                  setNotification({ msg: `Dados de ${year} carregados do cache!`, type: 'success' });
                  setTimeout(() => setNotification(null), 1500);
                  return; // Sai se achou no cache
              }
          }
      } catch (e) {
          console.warn("Erro ao ler cache de análise", e);
      }

      // 2. SE NÃO TEM CACHE, BAIXA DA API
      const yearMap = GAME_YEAR_STARTS[activeGame.id];
      const startConcurso = yearMap ? yearMap[year] || 1 : 1;
      let endConcurso = 999999;
      
      if (yearMap && yearMap[year + 1]) {
          endConcurso = yearMap[year + 1] - 1;
      } else if (latestResult) {
          endConcurso = latestResult.concurso;
      }

      if (latestResult && endConcurso > latestResult.concurso) {
          endConcurso = latestResult.concurso;
      }

      try {
          // Busca todos os resultados do range potencial
          const results = await fetchResultsRange(activeGame.apiSlug, startConcurso, endConcurso, (prog) => {
              setAnalysisProgress(prog);
          });
          
          // FILTRO RIGOROSO DE DATA
          const strictYearResults = results.filter(game => {
              if (!game.data) return false;
              return game.data.includes(`/${year}`);
          }).sort((a, b) => b.concurso - a.concurso);

          setAnalysisResults(strictYearResults);
          
          // 3. SALVA NO CACHE SE HOUVER RESULTADOS
          if (strictYearResults.length > 0) {
              try {
                  localStorage.setItem(cacheKey, JSON.stringify(strictYearResults));
              } catch(e) { console.error("Cache cheio na análise", e); }
          }
          vibrate(50);

      } catch (e) {
          console.error("Erro na analise historica", e);
          setNotification({ msg: "Erro ao buscar histórico do ano.", type: 'error' });
      } finally {
          setIsAnalysisLoading(false);
          setAnalysisProgress(100);
      }
  };

  const handleGenerateFederal = () => {
      vibrate(20);
      setStatus(AppStatus.GENERATING);
      const limit = Number(generationLimit) || 5;
      
      setTimeout(() => {
          const games: number[][] = [];
          for(let i=0; i<limit; i++) {
              const num = Math.floor(Math.random() * 100000);
              games.push([num]);
          }
          setGeneratedGames(games);
          setStatus(AppStatus.SUCCESS);
          vibrate(50);
          setNotification({msg: "Bilhetes da sorte gerados!", type: 'success'});
          setTimeout(() => setNotification(null), 2000);
      }, 500);
  };

  const handleGenerate = async () => {
    vibrate(20);
    if (activeGame.id === 'federal') {
        handleGenerateFederal();
        return;
    }

    setStatus(AppStatus.GENERATING);
    setHistorySim(null);
    setHistoryCheck(null);
    setExpandedGameStats(null);
    
    const limit = Number(generationLimit) || 1;

    setTimeout(async () => {
      try {
        let finalSelection: number[] = Array.from(selectedNumbers);
        let games: number[][] = [];
        let allNumbersPool = Array.from({ length: activeGame.totalNumbers }, (_, i) => i + (activeGame.id === 'lotomania' ? 0 : 1));
        
        // --- CENÁRIO 1: GERAÇÃO AUTOMÁTICA (Sem seleção do usuário) ---
        if (finalSelection.length === 0) {
             setNotification({ msg: `Selecionando números automaticamente (Tendências)...`, type: 'info' });
             
             // Usa o gameSize atual para definir quantos selecionar
             let poolSize = gameSize; 
             if (poolSize < activeGame.minSelection) poolSize = activeGame.minSelection;

             try {
                 if (latestResult) {
                    const pastResults = await fetchPastResults(activeGame.apiSlug, latestResult.concurso, 50);
                    finalSelection = calculateHotNumbers(pastResults, poolSize);
                 } 
                 
                 // Fallback Garantido se fetch falhar ou retornar vazio
                 if (finalSelection.length < poolSize) {
                    const remaining = poolSize - finalSelection.length;
                    const randomFill = allNumbersPool
                        .filter(n => !finalSelection.includes(n))
                        .sort(() => 0.5 - Math.random())
                        .slice(0, remaining);
                    finalSelection = [...finalSelection, ...randomFill];
                 }
                 
                 finalSelection.sort((a,b) => a-b);
                 setSelectedNumbers(new Set(finalSelection));
             } catch (e) {
                 console.error("Erro pool auto", e);
                 finalSelection = allNumbersPool.sort(() => 0.5 - Math.random()).slice(0, poolSize);
                 setSelectedNumbers(new Set(finalSelection));
             }
        }

        // --- CENÁRIO 2: AUTO-COMPLETAR SE INSUFICIENTE ---
        // Se o usuário selecionou menos números que o tamanho do jogo configurado
        if (finalSelection.length < gameSize && finalSelection.length > 0) {
             const missing = gameSize - finalSelection.length;
             setNotification({ msg: `Completando com ${missing} números automáticos...`, type: 'info' });
             
             try {
                 // Tenta usar lógica de números quentes se tiver resultado carregado
                 if (latestResult) {
                     const pastResults = await fetchPastResults(activeGame.apiSlug, latestResult.concurso, 50);
                     const hotNumbers = calculateHotNumbers(pastResults, activeGame.totalNumbers);
                     
                     for (const num of hotNumbers) {
                        if (finalSelection.length >= gameSize) break;
                        if (!selectedNumbers.has(num)) {
                            finalSelection.push(num);
                        }
                     }
                 }
                 // Loop de Garantia (caso API falhe ou não preencha tudo)
                 const max = activeGame.id === 'lotomania' ? 99 : activeGame.totalNumbers;
                 while(finalSelection.length < gameSize) {
                     const rnd = Math.floor(Math.random() * max) + (activeGame.id === 'lotomania' ? 0 : 1);
                     if(!finalSelection.includes(rnd)) finalSelection.push(rnd);
                 }
                 
                 finalSelection.sort((a,b) => a-b);
                 setSelectedNumbers(new Set(finalSelection));
             } catch(e) {
                 // Fallback Totalmente Aleatório
                 const max = activeGame.id === 'lotomania' ? 99 : activeGame.totalNumbers;
                 while(finalSelection.length < gameSize) {
                     const rnd = Math.floor(Math.random() * max) + (activeGame.id === 'lotomania' ? 0 : 1);
                     if(!finalSelection.includes(rnd)) finalSelection.push(rnd);
                 }
             }
        }

        // --- LÓGICA PRINCIPAL DE GERAÇÃO ---
        // Agora o gameSize dita o tamanho exato dos jogos gerados.
        // Se o usuário marcou 16 e gameSize é 16, geramos jogos de 16 dezenas.

        if (finalSelection.length === gameSize) {
            // Adiciona o Jogo Principal (A escolha do usuário)
            games.push([...finalSelection].sort((a, b) => a - b));

            // Gera Variações para preencher o limite solicitado, RESPEITANDO O TAMANHO DO JOGO
            if (limit > 1) {
                // Busca números "Quentes" fora da seleção do usuário para usar como variáveis de troca
                let swapPool: number[] = [];
                try {
                    const past = await fetchPastResults(activeGame.apiSlug, latestResult?.concurso || 0, 20);
                    const hot = calculateHotNumbers(past, activeGame.totalNumbers);
                    swapPool = hot.filter(n => !selectedNumbers.has(n));
                } catch (e) {
                    swapPool = allNumbersPool.filter(n => !selectedNumbers.has(n));
                }

                // Se a pool de troca for pequena, completa com aleatórios
                if (swapPool.length < 5) {
                    const remaining = allNumbersPool.filter(n => !selectedNumbers.has(n));
                    swapPool = [...new Set([...swapPool, ...remaining])];
                }

                // Gera variações mantendo a maioria dos números do usuário
                let attempts = 0;
                while (games.length < limit && attempts < 1000) {
                    attempts++;
                    
                    // Estratégia de Variação Inteligente:
                    // Mantém ~85% dos números do usuário (fixos), troca ~15% por números quentes de fora
                    const numToSwap = Math.max(1, Math.floor(gameSize * 0.15)); 
                    const baseGame = [...finalSelection];
                    
                    // Embaralha o jogo base para escolher quais remover aleatoriamente
                    const shuffledBase = baseGame.sort(() => 0.5 - Math.random());
                    const keptNumbers = shuffledBase.slice(0, gameSize - numToSwap);
                    
                    // Escolhe substitutos da pool externa
                    const shuffledPool = swapPool.sort(() => 0.5 - Math.random());
                    const replacements = shuffledPool.slice(0, numToSwap);
                    
                    const newGame = [...keptNumbers, ...replacements].sort((a, b) => a - b);
                    
                    // Verifica duplicidade básica
                    const isDuplicate = games.some(g => JSON.stringify(g) === JSON.stringify(newGame));
                    if (!isDuplicate) {
                        games.push(newGame);
                    }
                }
            }
        } 
        else {
            // FECHAMENTO CLÁSSICO
            const useAI = isAiOptimized && finalSelection.length > gameSize;

            if (useAI) {
                try {
                    games = await generateSmartClosing(activeGame.name, finalSelection, gameSize);
                    if (!games || games.length === 0) throw new Error("AI Empty Result");
                    // Limita aqui para respeitar o pedido
                    if (games.length > limit) {
                        games = games.slice(0, limit);
                    }
                } catch (aiError) {
                    // Fallback
                    const combos = generateCombinations(finalSelection, gameSize);
                    if (combos.length > limit) {
                        games = generateBalancedMatrix(finalSelection, limit, gameSize);
                    } else {
                        games = combos;
                    }
                }
            } else {
                // Matemática Pura
                const estimatedCombos = finalSelection.length <= 18 ? 2000 : 99999;
                if (estimatedCombos < limit) {
                    games = generateCombinations(finalSelection, gameSize);
                } else {
                    games = generateBalancedMatrix(finalSelection, limit, gameSize);
                }
            }
            
            // Garante o limite exato
            if (games.length > limit) {
                games = games.slice(0, limit);
            }
        }
        
        setGeneratedGames(games);
        setStatus(AppStatus.ANALYZING);
        
        if (games.length < 50) {
            try {
               const analysisResult = await analyzeClosing(finalSelection, games.length);
               setAnalysis(analysisResult);
            } catch (e) { console.log("Analysis skipped"); }
        }
        
        vibrate(100);
        setStatus(AppStatus.SUCCESS);
      } catch (error) {
        console.error(error);
        setStatus(AppStatus.ERROR);
      }
    }, 100);
  };

  const handleKeyDownOnLimit = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
        handleGenerate();
    }
  };

  const handleAiSuggestion = async () => {
    vibrate(20);
    setStatus(AppStatus.GENERATING);
    setLoadingProgress(0); // Inicia progresso em 0

    // Simulação de Progresso (já que a chamada é única e não streamada por padrão)
    const fakeProgressInterval = setInterval(() => {
        setLoadingProgress(prev => {
            if (prev >= 90) return prev; // Para em 90% até a resposta chegar
            return prev + Math.floor(Math.random() * 15) + 5;
        });
    }, 400);

    try {
      const suggestions = await getAiSuggestions(activeGame.name, activeGame.minSelection, activeGame.totalNumbers);
      clearInterval(fakeProgressInterval);
      setLoadingProgress(100);

      if (suggestions.length > 0) {
        const validSuggestions = suggestions.filter(n => n >= 1 && n <= activeGame.totalNumbers);
        const capped = validSuggestions.slice(0, activeGame.maxSelection);
        setSelectedNumbers(new Set(capped));
        setGameSize(capped.length); // Sincroniza o tamanho também na sugestão IA
        setGeneratedGames([]);
        setStatus(AppStatus.IDLE);
        vibrate(50);
        setNotification({ msg: "Palpite Inteligente Gerado!", type: 'success' });
        setTimeout(() => setNotification(null), 2000);
      }
    } catch (e) {
      clearInterval(fakeProgressInterval);
      setLoadingProgress(0);
      console.error(e);
      
      // FALLBACK: Geração Matemática se IA falhar
      setNotification({msg: "IA indisponível. Usando estatística local.", type: 'info'});
      try {
          const fallback = [];
          const all = Array.from({ length: activeGame.totalNumbers }, (_, i) => i + 1);
          // Tenta pegar alguns "quentes" se possível
          if (latestResult) {
             const past = await fetchPastResults(activeGame.apiSlug, latestResult.concurso, 20);
             const hot = calculateHotNumbers(past, activeGame.maxSelection);
             fallback.push(...hot);
          }
          
          while(fallback.length < activeGame.maxSelection) {
              const rnd = all[Math.floor(Math.random() * all.length)];
              if(!fallback.includes(rnd)) fallback.push(rnd);
          }
          const finalFallback = fallback.slice(0, activeGame.maxSelection).sort((a, b) => a - b);
          setSelectedNumbers(new Set(finalFallback));
          setGameSize(finalFallback.length);
          setStatus(AppStatus.IDLE);
      } catch (err2) {
          setNotification({msg: "Erro total. Tente novamente.", type: 'error'});
      }

    } finally {
      setStatus(AppStatus.IDLE);
      setTimeout(() => setLoadingProgress(0), 500);
    }
  };

  const handleSaveBatch = () => {
    vibrate(20);
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
    vibrate(10);
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
    vibrate(10);
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

  // --- NATIVE SHARE API FOR BATCH ---
  const handleSmartShare = async () => {
    vibrate(10);
    if (generatedGames.length === 0) return;
    const nextDate = latestResult?.dataProximoConcurso || "Em breve";
    let message = `🤖 *LotoSmart AI - ${activeGame.name}*\n`;
    message += `📅 Próximo Sorteio: ${nextDate}\n\n`;
    
    // Limita para não ficar muito grande no compartilhamento nativo
    generatedGames.slice(0, 50).forEach((game, index) => {
      const line = activeGame.id === 'federal'
          ? game[0].toString()
          : game.map(n => n.toString().padStart(2, '0')).join(' ');
      message += `*Jogo ${(index + 1).toString().padStart(2, '0')}.* ${line}\n`;
    });
    if (generatedGames.length > 50) message += `\n...e mais ${generatedGames.length - 50} jogos.`;
    message += `\n🍀 Boa sorte!`;

    // Tenta API Nativa (Mobile)
    if (navigator.share) {
        try {
            await navigator.share({
                title: `LotoSmart AI - ${activeGame.name}`,
                text: message,
            });
            return;
        } catch (error) {
            console.log('Error sharing:', error);
            // Fallback para WhatsApp Link se cancelar ou falhar
        }
    }

    // Fallback WhatsApp Web
    const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  // --- NATIVE SHARE FOR SAVED BATCH ---
  const handleShareSavedBatch = async (e: React.MouseEvent, batch: SavedBetBatch) => {
    e.stopPropagation();
    vibrate(10);
    
    const gameConfig = GAMES[batch.gameType] || GAMES['lotofacil']; 
    
    let message = `📁 *LotoSmart AI - Jogos Salvos*\n`;
    message += `🎮 ${gameConfig.name}\n`;
    message += `📅 Concurso: ${batch.targetConcurso}\n\n`;

    batch.games.slice(0, 50).forEach((g) => {
        const line = gameConfig.id === 'federal'
            ? g.numbers[0].toString()
            : g.numbers.map(n => n.toString().padStart(2, '0')).join(' ');
        message += `*${String(g.gameNumber).padStart(2, '0')}.* ${line}\n`;
    });
    
    if (batch.games.length > 50) message += `\n...e mais ${batch.games.length - 50} jogos.`;
    
    // Adiciona premiação ao texto se disponível e compatível com a tela atual
    if (latestResult && batch.gameType === activeGame.id && batch.targetConcurso === latestResult.concurso) {
         let batchTotalPrize = 0;
         const rs = new Set(latestResult.dezenas.map(d => parseInt(d, 10)));
         batch.games.forEach(g => {
            const h = g.numbers.filter(n => rs.has(n)).length;
            const pe = latestResult.premiacoes.find(p => p.faixa === h);
            if (pe) batchTotalPrize += pe.valor;
         });
         
         if (batchTotalPrize > 0) {
             message += `\n💰 *Premiação Total:* ${batchTotalPrize.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`;
         }
    }

    message += `\n🍀 Boa sorte!`;

    if (navigator.share) {
        try {
            await navigator.share({
                title: `LotoSmart - ${gameConfig.name}`,
                text: message,
            });
        } catch (error) {
            console.log('Share dismissed');
        }
    } else {
        const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
        window.open(url, '_blank');
    }
  };

  // --- NATIVE SHARE API FOR SINGLE GAME ---
  const handleShareSingleGame = async (e: React.MouseEvent, game: number[], index: number) => {
      e.stopPropagation();
      vibrate(10);
      
      const gameText = activeGame.id === 'federal' 
          ? `Bilhete: ${game[0]}` 
          : `Dezenas: ${game.map(n => n.toString().padStart(2, '0')).join(', ')}`;
      
      const shareData = {
          title: `LotoSmart AI - ${activeGame.name}`,
          text: `🔮 Palpite LotoSmart AI - ${activeGame.name}\n\n${gameText}\n\n🍀 Boa sorte!`
      };

      if (navigator.share) {
          try {
              await navigator.share(shareData);
          } catch (err) {
              console.log('User dismissed share');
          }
      } else {
          // Fallback para WhatsApp
          const url = `https://wa.me/?text=${encodeURIComponent(shareData.text)}`;
          window.open(url, '_blank');
      }
  };

  // --- DELETE LOGIC (2-STEP CONFIRMATION) ---
  
  const handleRequestDeleteBatch = (e: React.MouseEvent, batchId: string) => {
    e.preventDefault();
    e.stopPropagation();
    vibrate(15);
    
    if (deleteConfirmBatchId === batchId) {
        // Confirmed
        const updatedBatches = deleteBatch(batchId);
        setSavedBatches(updatedBatches);
        setDeleteConfirmBatchId(null);
        vibrate(50);
        setNotification({ msg: 'Grupo excluído.', type: 'info' });
        setTimeout(() => setNotification(null), 2000);
    } else {
        // Request
        setDeleteConfirmBatchId(batchId);
        setTimeout(() => setDeleteConfirmBatchId(prev => prev === batchId ? null : prev), 3000);
    }
  };

  const handleDeleteSpecificGame = (e: React.MouseEvent, batchId: string, gameId: string) => {
    e.preventDefault(); 
    e.stopPropagation(); 
    vibrate(10);
    
    if (deleteConfirmGameId === gameId) {
        const updatedBatches = deleteGame(batchId, gameId);
        setSavedBatches(updatedBatches);
        setDeleteConfirmGameId(null);
        vibrate(50);
        setNotification({ msg: 'Jogo removido.', type: 'info' });
        setTimeout(() => setNotification(null), 1500);
    } else {
        setDeleteConfirmGameId(gameId);
        setTimeout(() => setDeleteConfirmGameId(prev => prev === gameId ? null : prev), 3000);
    }
  };

  const calculateHits = (game: number[], targetResultSet?: Set<number>) => {
    const targets = targetResultSet || resultNumbers;
    if (targets.size === 0) return 0;
    return game.filter(n => targets.has(n)).length;
  };

  const getHitStyle = (hits: number) => {
    // Cores específicas e vibrantes para Lotofácil (11 a 15 pontos)
    if (activeGame.id === 'lotofacil') { 
        // 15 PONTOS: OURO/AMBER (Jackpot)
        if (hits === 15) return "bg-gradient-to-r from-yellow-600/60 to-amber-600/60 border-yellow-300 shadow-[0_0_20px_rgba(252,211,77,0.5)] ring-1 ring-yellow-200";
        
        // 14 PONTOS: VERMELHO VIVO (Alto Valor)
        if (hits === 14) return "bg-gradient-to-r from-red-600/50 to-rose-600/50 border-red-400 shadow-[0_0_15px_rgba(248,113,113,0.4)] ring-1 ring-red-400/50";
        
        // 13 PONTOS: MAGENTA/ROXO (Intermediário Alto - Distinto)
        if (hits === 13) return "bg-gradient-to-r from-fuchsia-600/40 to-purple-600/40 border-fuchsia-400 shadow-[0_0_10px_rgba(232,121,249,0.3)]";
        
        // 12 PONTOS: AZUL ROYAL (Intermediário)
        if (hits === 12) return "bg-gradient-to-r from-blue-600/40 to-indigo-600/40 border-blue-400 shadow-[0_0_10px_rgba(96,165,250,0.3)]";
        
        // 11 PONTOS: CIANO/TEAL (Entrada)
        if (hits === 11) return "bg-gradient-to-r from-cyan-600/30 to-teal-600/30 border-cyan-400/50 shadow-[0_0_5px_rgba(34,211,238,0.2)]";
    }

    // Lógica genérica para outros jogos
    let isWin = false;
    let isJackpot = false;
    let isSecondary = false;

    if (activeGame.id === 'megasena') { 
        if(hits>=4) isWin=true; 
        if(hits===6) isJackpot=true;
        if(hits===5) isSecondary=true; 
    }
    else if (activeGame.id === 'quina') { 
        if(hits>=2) isWin=true; 
        if(hits===5) isJackpot=true;
        if(hits===4) isSecondary=true;
    }
    else if (activeGame.id === 'lotomania') { 
        if(hits>=15 || hits===0) isWin=true; 
        if(hits===20) isJackpot=true;
        if(hits===19 || hits===0) isSecondary=true;
    }
    else if (activeGame.id === 'supersete') { 
        if(hits>=3) isWin=true; 
        if(hits===7) isJackpot=true;
        if(hits===6) isSecondary=true;
    }
    else { 
        if(hits > activeGame.minSelection / 2) isWin=true; 
        if(hits === activeGame.minSelection) isJackpot=true;
    }

    if (isJackpot) return "bg-gradient-to-r from-yellow-600/60 to-amber-600/60 border-yellow-300 shadow-[0_0_20px_rgba(252,211,77,0.5)] ring-1 ring-yellow-200";
    if (isSecondary) return "bg-gradient-to-r from-red-600/50 to-rose-600/50 border-red-400 shadow-[0_0_15px_rgba(248,113,113,0.4)]";
    if (isWin) return "bg-gradient-to-r from-blue-600/40 to-indigo-600/40 border-blue-400 shadow-[0_0_10px_rgba(96,165,250,0.3)]";
    
    return "bg-slate-800 border-slate-700 hover:border-slate-600";
  };

  const renderGameInfo = () => {
    if (!showInfoModal) return null;
    return (
        <div className="fixed inset-0 z-[90] bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
            <div className="bg-slate-800 w-full max-w-lg rounded-t-2xl sm:rounded-xl overflow-hidden shadow-2xl border-t border-x sm:border border-slate-700 max-h-[90vh] flex flex-col">
                <div className="w-12 h-1.5 bg-slate-700 rounded-full mx-auto mt-2 mb-1 sm:hidden"></div>
                <div className={`bg-${activeGame.color}-600 p-4 flex justify-between items-center text-white`}>
                    <h3 className="font-bold text-lg flex items-center gap-2">
                        ℹ️ Como Jogar: {activeGame.name}
                    </h3>
                    <button onClick={() => setShowInfoModal(false)} className="w-8 h-8 flex items-center justify-center bg-white/20 hover:bg-white/30 rounded-full font-bold">✕</button>
                </div>
                <div className="p-5 overflow-y-auto">
                    <p className="text-slate-300 text-sm leading-relaxed mb-6">
                        {activeGame.howToPlay}
                    </p>
                    <h4 className="font-bold text-white mb-3 text-sm uppercase tracking-wider border-b border-slate-700 pb-2">Tabela de Preços</h4>
                    {activeGame.priceTable && activeGame.priceTable.length > 0 ? (
                        <div className="overflow-hidden rounded-lg border border-slate-700">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-700 text-slate-300 text-xs uppercase">
                                    <tr>
                                        <th className="px-4 py-3">Números</th>
                                        <th className="px-4 py-3 text-right">Valor</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-700">
                                    {activeGame.priceTable.map((row, idx) => (
                                        <tr key={idx} className={idx % 2 === 0 ? 'bg-slate-800' : 'bg-slate-800/50'}>
                                            <td className="px-4 py-2.5 text-slate-300 font-bold">{row.quantity}</td>
                                            <td className="px-4 py-2.5 text-right text-emerald-400 font-mono">
                                                {typeof row.price === 'number' 
                                                    ? row.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) 
                                                    : row.price}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <p className="text-slate-500 italic text-sm">Informações de preço indisponíveis.</p>
                    )}
                    <div className="mt-4 text-[10px] text-slate-500 text-center">
                        * Valores sujeitos a alteração pela Caixa Econômica Federal.<br/>Sorteios: <span className="text-slate-400 font-bold">{activeGame.drawDays}</span>
                    </div>
                </div>
            </div>
        </div>
    );
  };

  const renderGameDetails = () => {
    if (!viewingGame) return null;
    const prevGame = analysisResults.find(g => g.concurso === viewingGame.concurso - 1);
    const prevNumbers = prevGame ? prevGame.dezenas.map(d => parseInt(d, 10)) : undefined;
    const stats = calculateDetailedStats(viewingGame.dezenas.map(d => parseInt(d, 10)), prevNumbers, activeGame);
    
    return (
      <div className="fixed inset-0 z-[80] bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
        <div className="bg-white w-full max-w-lg rounded-t-2xl sm:rounded-xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mt-2 mb-1 sm:hidden absolute top-0 left-0 right-0 z-50"></div>
            <div className={`bg-${activeGame.color}-600 text-white p-4 pt-5 sm:pt-4 flex justify-between items-center relative shadow-lg`}>
                <h3 className="font-bold text-center w-full text-lg">Resultado {activeGame.name} #{viewingGame.concurso}</h3>
                <button onClick={() => setViewingGame(null)} className="absolute right-3 w-8 h-8 flex items-center justify-center bg-white/20 hover:bg-white/30 rounded-full font-bold">✕</button>
            </div>
            <div className="overflow-y-auto p-0 text-slate-800 text-sm">
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
                <div className="p-2 bg-gray-50 border-t border-gray-200">
                    <div className="text-center text-xs font-bold text-gray-500 mb-1">Premiação</div>
                    {viewingGame.premiacoes.map((p, idx) => (
                        <div key={idx} className="flex justify-between items-center py-1 border-b border-gray-200 text-xs last:border-0">
                            <span className="font-medium text-slate-600">
                               {activeGame.id === 'federal' ? `${p.faixa}º Prêmio` : (p.faixa > 20 ? `${p.faixa} acertos` : p.faixa === 0 ? '0 acertos' : `${p.faixa} acertos`)}
                            </span>
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

  const getGridColsClass = () => {
      // Retorna classes exatas correspondentes aos volantes reais
      if (activeGame.id === 'lotofacil') return 'grid-cols-5';
      if (activeGame.id === 'supersete') return 'grid-cols-7'; // 7 Colunas verticais
      if (activeGame.id === 'diadesorte') return 'grid-cols-10'; // 10 Colunas
      // Mega, Quina, Lotomania, Timemania, Dupla, Milionaria -> 10 Colunas
      return 'grid-cols-10';
  };

  const selectionCount = selectedNumbers.size;

  const handleDragEndSavedGames = (_: any, info: PanInfo) => {
    if (info.offset.y > 100) {
      setShowSavedGamesModal(false);
    }
  };

  return (
    <div className={`min-h-screen bg-slate-900 pb-[calc(90px+env(safe-area-inset-bottom))] font-sans text-slate-100`}>
      <div className={`fixed inset-0 z-50 bg-black/80 backdrop-blur-sm transition-opacity duration-300 ${isMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`} onClick={() => setIsMenuOpen(false)}>
         <div className={`absolute top-0 left-0 bottom-0 w-64 bg-slate-800 shadow-2xl transform transition-transform duration-300 ${isMenuOpen ? 'translate-x-0' : '-translate-x-full'} overflow-y-auto`} onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-slate-700 flex justify-between items-center bg-gradient-to-r from-purple-900 to-slate-800 pt-[calc(20px+env(safe-area-inset-top))]">
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
        <div className="fixed top-4 left-4 right-4 z-[100] animate-bounce-in pt-[env(safe-area-inset-top)]">
          <div className={`${notification.type === 'error' ? 'bg-red-600' : (notification.type === 'success' ? 'bg-emerald-600' : 'bg-blue-600')} text-white p-4 rounded-xl shadow-2xl flex items-center justify-between border border-white/20`}>
            <span className="text-sm font-bold pr-2">{notification.msg}</span>
            <button onClick={() => setNotification(null)} className="text-white/80 hover:text-white font-bold">✕</button>
          </div>
        </div>
      )}

      <header className="bg-slate-800 border-b border-slate-700 p-3 sticky top-0 z-40 shadow-md pt-[calc(12px+env(safe-area-inset-top))]">
        <div className="flex justify-between items-center max-w-lg mx-auto">
          <div className="flex items-center gap-3">
            <button onClick={() => setIsMenuOpen(true)} className="p-2 text-slate-300 hover:text-white bg-slate-700/50 rounded-lg active:scale-95 transition-transform">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
            <div className="flex items-center gap-2">
                <div>
                    <h1 className={`text-lg font-bold text-${activeGame.color}-400 leading-none`}>{activeGame.name}</h1>
                    <span className="text-[10px] text-slate-500 font-bold tracking-wider">LOTOSMART AI</span>
                </div>
                <button onClick={() => setShowInfoModal(true)} className="w-6 h-6 rounded-full bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center text-xs font-bold border border-slate-600 ml-1 active:scale-95" title="Como Jogar">ℹ️</button>
            </div>
          </div>
          <button 
            onClick={() => setShowSavedGamesModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-full text-xs font-bold text-slate-200 border border-slate-600 active:scale-95 transition-transform"
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
        
        {/* LATEST RESULT / SKELETON SCREEN */}
        {isResultLoading ? (
          <div className="bg-slate-800/80 rounded-xl border border-slate-700 shadow-md p-4 animate-pulse relative overflow-hidden h-[180px]">
             {/* Gradient Shine Effect */}
             <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent skew-x-12 translate-x-[-100%] animate-[shimmer_1.5s_infinite]"></div>
             
             {/* Header Skeleton */}
             <div className="flex justify-between mb-6">
                <div>
                   <div className="h-4 bg-slate-700 rounded w-24 mb-2"></div>
                   <div className="h-3 bg-slate-700 rounded w-16"></div>
                </div>
                <div className="h-5 bg-slate-700 rounded w-20"></div>
             </div>
             
             {/* Balls Skeleton */}
             <div className="flex flex-wrap gap-2 mb-6">
                {[...Array(15)].map((_, i) => (
                   <div key={i} className="w-7 h-7 rounded-full bg-slate-700/80"></div>
                ))}
             </div>
             
             {/* Footer Skeleton */}
             <div className="h-8 bg-slate-700/50 rounded-lg w-full mt-auto"></div>
          </div>
        ) : latestResult ? (
          <div className="bg-slate-800/80 rounded-xl border border-slate-700 shadow-md relative overflow-hidden group">
            <div className={`absolute top-0 right-0 w-32 h-32 bg-${activeGame.color}-500/10 rounded-full blur-2xl -mr-10 -mt-10`}></div>
            <div className="p-4 relative z-10">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <div className="flex items-center gap-2">
                      <span className={`text-[10px] text-${activeGame.color}-300 font-bold uppercase tracking-wider bg-${activeGame.color}-900/30 px-2 py-0.5 rounded-full border border-${activeGame.color}-500/20`}>
                        Concurso {latestResult.concurso}
                      </span>
                      {/* Botão de Refresh Manual */}
                      <button 
                        onClick={loadLatestResult} 
                        disabled={isResultLoading}
                        className="bg-white/10 hover:bg-white/20 text-white/80 p-1 rounded-full transition-colors active:rotate-180"
                        title="Atualizar Resultado Agora"
                      >
                         <svg className={`w-3 h-3 ${isResultLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                      </button>
                  </div>
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
                    <span key={idx} className={`w-7 h-7 flex items-center justify-center bg-gradient-to-br from-${activeGame.color}-600/30 to-slate-800 border border-${activeGame.color}-500/40 rounded-full text-xs font-bold text-${activeGame.color}-100 shadow-sm`}>
                        {activeGame.id === 'supersete' ? parseInt(n, 10) % 10 : n}
                    </span>
                    ))}
                </div>
              )}

              {latestResult.dataProximoConcurso && <CountdownTimer targetDateStr={latestResult.dataProximoConcurso} />}
              
              {(latestResult.valorEstimadoProximoConcurso > 0) && (
                  <div className="mt-3 bg-gradient-to-r from-emerald-900/40 to-green-900/40 border border-emerald-500/30 rounded-lg p-3 text-center shadow-lg relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-full h-full bg-emerald-500/5"></div>
                      <div className="relative z-10">
                          <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest mb-0.5">Estimativa de Prêmio</p>
                          <p className="text-2xl font-bold text-white font-mono tracking-tight drop-shadow-md">
                              {latestResult.valorEstimadoProximoConcurso.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </p>
                      </div>
                  </div>
              )}
            </div>
          </div>
        ) : null}

        {/* Buttons */}
        <div className="grid grid-cols-2 gap-3">
          {activeGame.id !== 'federal' && (
          <button 
            onClick={handleGenerateTop200}
            disabled={status !== AppStatus.IDLE && status !== AppStatus.SUCCESS}
            className={`w-full py-3 bg-gradient-to-br from-${activeGame.color}-900 to-${activeGame.color}-800 border border-${activeGame.color}-500/50 rounded-xl text-${activeGame.color}-100 font-bold flex flex-col items-center justify-center gap-1 active:scale-95 transition-all shadow-lg overflow-hidden relative`}
          >
            {status === AppStatus.GENERATING ? (
                <>
                    <span className="text-xs animate-pulse relative z-10">Baixando Histórico... {loadingProgress}%</span>
                    <div className="absolute bottom-0 left-0 h-1 bg-white/20 w-full">
                        <div className="h-full bg-white/50 transition-all duration-300" style={{ width: `${loadingProgress}%` }}></div>
                    </div>
                </>
            ) : <><span className="text-lg">🔥</span><span className="text-xs text-center">Padrão Ouro<br/>(Apenas Jogos Pagos)</span></>}
          </button>
          )}
          
          {activeGame.id !== 'federal' && (
          <button 
            onClick={handleOpenHistoryAnalysis}
            className={`w-full py-3 bg-gradient-to-br from-amber-700 to-amber-600 border border-amber-500/50 rounded-xl text-amber-100 font-bold flex flex-col items-center justify-center gap-1 active:scale-95 transition-all shadow-lg`}
          >
            <span className="text-lg">🔍</span>
            <span className="text-xs text-center">Raio-X Histórico<br/>(Visualização)</span>
          </button>
          )}
        </div>

        {/* NUMBER GRID */}
        {activeGame.id !== 'federal' && (
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 sticky top-16 z-30 backdrop-blur-sm shadow-xl">
          <div className="flex justify-between items-center mb-2">
            <span className="text-slate-400 text-sm">Números Selecionados</span>
            <span className={`text-sm font-bold ${selectionCount === activeGame.maxSelection ? 'text-red-400' : `text-${activeGame.color}-400`}`}>
              {selectionCount} / {activeGame.maxSelection}
            </span>
          </div>
          <div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden mb-3">
            <div className={`bg-${activeGame.color}-500 h-full transition-all duration-300`} style={{ width: `${Math.min(100, (selectionCount / activeGame.minSelection) * 100)}%` }}></div>
          </div>
          
          {/* GENERATION SETTINGS GROUP */}
          <div className="flex flex-col gap-3 pt-2 border-t border-slate-700/50">
             
             {/* GAME SIZE SELECTOR (Com Auto-Select) */}
             <div className="flex justify-between items-center">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Números por Jogo:</span>
                <div className="flex bg-slate-900 rounded-lg p-0.5 border border-slate-700/50 overflow-x-auto max-w-[200px] no-scrollbar">
                    {Array.from({ length: activeGame.maxSelection - activeGame.minSelection + 1 }, (_, i) => activeGame.minSelection + i).map(size => (
                        <button
                            key={size}
                            onClick={() => handleGameSizeChangeWithAutoSelect(size)}
                            className={`min-w-[36px] px-1 py-1 rounded-md text-[10px] font-bold transition-all whitespace-nowrap flex flex-col items-center justify-center leading-none ${gameSize === size ? `bg-${activeGame.color}-600 text-white shadow-sm` : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                        >
                            <span>{size}</span>
                            <span className="text-[7px] opacity-70 mt-0.5 font-mono">
                                {getPriceForQty(size) > 0 ? getPriceForQty(size).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL', maximumFractionDigits: 0}) : '-'}
                            </span>
                        </button>
                    ))}
                </div>
             </div>

             {/* GENERATION QUANTITY (INPUT LIVRE) */}
             <div className="flex justify-between items-center gap-2">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider whitespace-nowrap">Quantidade de Jogos:</span>
                <div className="flex items-center gap-2 flex-1 justify-end">
                    {/* Atalhos Rápidos */}
                    <div className="flex bg-slate-900 rounded-lg p-0.5 border border-slate-700/50">
                        {[5, 15, 50, 100].map(val => (
                            <button 
                                key={val}
                                onClick={() => setGenerationLimit(val)}
                                className={`px-2 py-1 text-[9px] font-bold rounded hover:bg-slate-800 transition-colors ${generationLimit === val ? 'text-white bg-slate-700' : 'text-slate-500'}`}
                            >
                                {val}
                            </button>
                        ))}
                    </div>
                    {/* Input Livre */}
                    <input 
                        type="number" 
                        min="1" 
                        max="1000"
                        value={generationLimit}
                        onChange={(e) => setGenerationLimit(e.target.value)}
                        onKeyDown={handleKeyDownOnLimit}
                        className="w-16 bg-slate-900 border border-slate-600 rounded-lg text-white text-center text-sm font-bold py-1 focus:ring-2 focus:ring-purple-500 outline-none"
                    />
                </div>
             </div>
          </div>

          {selectionCount < activeGame.minSelection && selectionCount > 0 && (
              <p className="text-[10px] text-center text-slate-500 mt-2">
                  <span className="animate-pulse">⚠️</span> Faltam números. O sistema completará automaticamente.
              </p>
          )}
        </div>
        )}

        {activeGame.id === 'federal' ? (
            <div className="bg-blue-900/20 border border-blue-500/20 p-6 rounded-xl text-center">
                <span className="text-4xl mb-2 block">🎫</span>
                <p className="text-sm text-blue-200 mb-2 font-bold">Na Federal você concorre com bilhetes inteiros.</p>
                <p className="text-xs text-slate-400">Gere abaixo palpites aleatórios de bilhetes de 5 dígitos para procurar na lotérica.</p>
            </div>
        ) : (
            // TICKET VISUAL CONTAINER (VOLANTE REAL)
            <div className={`rounded-xl overflow-hidden shadow-2xl border-2 border-${activeGame.color}-600 bg-stone-50 relative`}>
                {/* TICKET HEADER - Imita o topo do volante */}
                <div className={`bg-${activeGame.color}-600 px-4 py-2 flex items-center justify-between shadow-md relative z-10`}>
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm">
                            <span className={`text-${activeGame.color}-700 font-black text-xs tracking-tighter`}>{activeGame.name.substring(0, 2).toUpperCase()}</span>
                        </div>
                        <span className="font-bold text-white uppercase tracking-widest text-sm drop-shadow-md">{activeGame.name}</span>
                    </div>
                    <span className="text-[8px] text-white/80 font-bold uppercase tracking-widest border border-white/30 px-1 rounded">Volante</span>
                </div>
                
                {/* GRID BACKGROUND - White/Paper for simulation */}
                <div className="p-4 bg-stone-50">
                    <div className={`grid ${getGridColsClass()} gap-1 sm:gap-2 justify-items-center ${activeGame.id === 'lotofacil' ? 'max-w-[280px] mx-auto' : ''}`}>
                    
                    {activeGame.id === 'supersete' && Array.from({length: 7}).map((_, i) => (
                        <div key={`col-header-${i}`} className="flex flex-col items-center justify-end w-full pb-2 border-b border-lime-500/20 mb-1">
                            <span className="text-[8px] sm:text-[9px] text-slate-400 uppercase font-bold tracking-tight">Coluna</span>
                            <span className="text-lg sm:text-xl font-bold text-lime-600 leading-none">{i + 1}</span>
                        </div>
                    ))}

                    {allNumbers.map((num) => (
                        <NumberBall
                        key={num}
                        number={num}
                        isSelected={selectedNumbers.has(num)}
                        isRecentResult={resultNumbers.has(num)}
                        onClick={toggleNumber}
                        disabled={status !== AppStatus.IDLE && status !== AppStatus.SUCCESS}
                        colorTheme={activeGame.color}
                        // Usa small para qualquer jogo com 10 ou mais colunas, ou Super Sete
                        size={activeGame.cols >= 7 ? 'small' : 'medium'}
                        label={activeGame.id === 'supersete' ? (num % 10).toString() : (activeGame.id === 'lotomania' ? num.toString().padStart(2, '0') : undefined)} 
                        />
                    ))}
                    </div>
                </div>
            </div>
        )}

        {/* ... (Generated games list remains same) ... */}
        {generatedGames.length > 0 && (
          <div className="space-y-4 pt-4 border-t border-slate-800">
             {/* ... */}
             <div className="flex flex-col space-y-2">
                <div className="flex justify-between items-center">
                    <h3 className="text-lg font-bold text-white flex items-center">
                    {activeGame.id === 'federal' ? 'Palpites de Bilhetes' : `Jogos Gerados (${generatedGames.length})`}
                    </h3>
                    {totalGenerationCost > 0 && (
                        <div className="flex flex-col items-end">
                            <span className="text-[10px] text-emerald-200 uppercase tracking-wide">Custo Total</span>
                            <span className="text-emerald-400 font-mono font-bold text-sm bg-emerald-900/30 px-2 py-0.5 rounded border border-emerald-500/30">
                                {totalGenerationCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </span>
                        </div>
                    )}
                </div>
                <div className="flex w-full gap-2">
                    <button onClick={handleSaveBatch} className="flex-1 px-4 py-3 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/50 text-blue-200 text-xs font-bold rounded-lg transition-colors active:scale-95">Salvar Todos</button>
                    <button onClick={handleSmartShare} className="flex-1 px-4 py-3 bg-green-600/20 hover:bg-green-600/30 border border-green-500/50 text-green-200 text-xs font-bold rounded-lg transition-colors active:scale-95 flex items-center justify-center gap-1">
                        {typeof navigator.share !== 'undefined' ? (
                            <><span>📲</span> Compartilhar</>
                        ) : (
                            <><span>💬</span> WhatsApp</>
                        )}
                    </button>
                </div>
            </div>
            
            <div className="space-y-3">
              {generatedGames.map((game, idx) => {
                const hits = calculateHits(game);
                const isCopied = copiedGameIndex === idx;
                const isExpanded = expandedGameStats === idx;
                
                const prevNumbers = latestResult ? Array.from(resultNumbers) as number[] : undefined;
                const detailedStats = isExpanded ? calculateDetailedStats(game, prevNumbers, activeGame) : null;

                let styleClass = "bg-slate-800 border-slate-700 hover:border-slate-500";
                if (latestResult && activeGame.id !== 'federal') {
                   styleClass = getHitStyle(hits);
                }
                
                // ... (Generated Game Item Rendering) ...
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
                    
                    <div className="flex justify-between items-center bg-black/20 p-2 border-b border-white/5">
                        <span className={`text-xs font-bold uppercase tracking-wider ${latestResult && hits >= (activeGame.minSelection / 2) ? 'text-white' : 'text-slate-400'}`}>
                           Jogo {String(idx + 1).padStart(2, '0')} <span className="opacity-50 text-[9px] ml-1">({game.length} dz)</span>
                        </span>
                        
                         <div className="flex gap-2 relative z-20">
                            {/* SHARE SINGLE GAME */}
                            <div 
                                onClick={(e) => handleShareSingleGame(e, game, idx)}
                                className="px-2 py-0.5 rounded text-[10px] font-bold bg-white/10 hover:bg-green-600 text-white flex items-center gap-1 transition-colors"
                                title="Compartilhar este jogo"
                            >
                              📲
                            </div>
                            <div onClick={(e) => toggleGameStats(e, idx)} className="px-2 py-0.5 rounded text-[10px] font-bold bg-white/10 hover:bg-white/20 text-white flex items-center gap-1 transition-colors">
                              📊 Stats
                            </div>
                            <div onClick={(e) => handleSaveSingleGame(e, game, idx)} className="px-2 py-0.5 rounded text-[10px] font-bold bg-white/10 hover:bg-blue-600 text-white flex items-center gap-1 transition-colors">
                              💾 Salvar
                            </div>
                        </div>
                    </div>

                    <div className="p-3">
                      <div className="flex flex-wrap gap-1.5 justify-center sm:justify-start">
                        {game.map(n => {
                          const isHit = resultNumbers.has(n);
                          let ballClass = `bg-black/20 text-slate-300 opacity-80`;
                          if (isHit) {
                             ballClass = `bg-white text-black font-bold shadow-sm scale-105`;
                          } else if (activeGame.id !== 'supersete') {
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

      <footer className="fixed bottom-0 left-0 right-0 bg-slate-800/95 backdrop-blur-md border-t border-slate-700 p-3 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-40 pb-[calc(12px+env(safe-area-inset-bottom))]">
        <div className="max-w-lg mx-auto flex gap-3">
          <button onClick={handleClear} className="px-4 py-3 rounded-xl bg-slate-700 text-slate-300 font-bold border border-slate-600 active:scale-95 transition-transform">Limpar</button>
          {selectedNumbers.size === 0 && activeGame.id !== 'federal' ? (
             <button onClick={handleAiSuggestion} className={`flex-1 py-3 rounded-xl bg-${activeGame.color}-700 text-white font-bold border border-${activeGame.color}-500 shadow-lg active:scale-95 transition-transform relative overflow-hidden`} disabled={status !== AppStatus.IDLE}>
               {status === AppStatus.GENERATING ? (
                   <>
                       <span className="relative z-10">Analisando... {loadingProgress}%</span>
                       <div className="absolute top-0 left-0 h-full bg-black/20" style={{ width: `${loadingProgress}%`, transition: 'width 0.3s ease' }}></div>
                   </>
               ) : '🔮 Palpite IA'}
             </button>
          ) : (
            <button 
              onClick={handleGenerate}
              disabled={activeGame.id !== 'federal' && selectionCount > 0 && selectionCount < activeGame.minSelection}
              className={`flex-1 py-3 rounded-xl font-bold shadow-lg text-white active:scale-95 transition-transform ${activeGame.id !== 'federal' && selectionCount > 0 && selectionCount < activeGame.minSelection ? 'bg-slate-600 opacity-50' : `bg-gradient-to-r from-${activeGame.color}-600 to-${activeGame.color}-500`}`}
            >
              {status === AppStatus.GENERATING ? 'Gerando...' : (activeGame.id === 'federal' ? '🎫 Gerar Palpites' : (selectionCount === 0 ? '🎲 Gerar Automático' : 'Gerar Jogos'))}
            </button>
          )}
        </div>
      </footer>

      <AnimatePresence>
        <HistoryAnalysisModal 
          isOpen={showHistoryAnalysisModal}
          onClose={() => setShowHistoryAnalysisModal(false)}
          activeGame={activeGame}
          analysisYear={analysisYear}
          setAnalysisYear={setAnalysisYear}
          analysisTargetPoints={analysisTargetPoints}
          setAnalysisTargetPoints={setAnalysisTargetPoints}
          availableYears={availableYears}
          onRunAnalysis={handleRunHistoryAnalysis}
          isAnalysisLoading={isAnalysisLoading}
          analysisProgress={analysisProgress}
          analysisResults={analysisResults}
        />
      </AnimatePresence>

      {renderGameInfo()}

      {renderGameDetails()}

      {/* Saved Games Modal - MOVED TO END WITH HIGHER Z-INDEX */}
      <AnimatePresence>
      {showSavedGamesModal && (
          <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
             <motion.div 
               initial={{ y: "100%" }}
               animate={{ y: 0 }}
               exit={{ y: "100%" }}
               transition={{ type: "spring", damping: 25, stiffness: 300 }}
               drag="y"
               dragConstraints={{ top: 0, bottom: 0 }}
               dragElastic={{ top: 0, bottom: 0.5 }}
               onDragEnd={handleDragEndSavedGames}
               className="bg-slate-800 w-full max-w-lg max-h-[85vh] rounded-t-2xl sm:rounded-xl border border-slate-700 shadow-2xl flex flex-col overflow-hidden"
             >
                {/* Pull Handle for Mobile - Área de "Pega" maior para facilitar o gesto */}
                <div className="w-full pt-3 pb-1 cursor-grab active:cursor-grabbing bg-slate-800 flex justify-center sm:hidden" onClick={() => setShowSavedGamesModal(false)}>
                    <div className="w-12 h-1.5 bg-slate-600 rounded-full"></div>
                </div>

                <div className="p-4 border-b border-slate-700 bg-gradient-to-r from-slate-800 to-slate-900">
                   <div className="flex justify-between items-center mb-1">
                       <h3 className="text-lg font-bold text-white flex items-center gap-2">📁 Meus Jogos Salvos</h3>
                       <button onClick={() => setShowSavedGamesModal(false)} className="w-8 h-8 rounded-full bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center font-bold">✕</button>
                   </div>
                   {/* HEADER DE TOTALIZAÇÃO GERAL */}
                   {grandTotalPrize > 0 && (
                       <div className="mt-2 bg-gradient-to-r from-emerald-900/50 to-green-900/50 border border-emerald-500/40 rounded-lg p-2 flex justify-between items-center shadow-lg animate-bounce-in">
                           <span className="text-xs text-emerald-200 font-bold uppercase tracking-wider pl-1">💰 Total a Receber</span>
                           <span className="text-lg font-mono font-black text-white drop-shadow-md">
                               {grandTotalPrize.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                           </span>
                       </div>
                   )}
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-[calc(20px+env(safe-area-inset-bottom))] cursor-auto" onPointerDownCapture={e => e.stopPropagation()}>
                  {savedBatches.length === 0 ? (
                    <div className="text-center py-10 text-slate-500 flex flex-col items-center gap-2">
                        <span className="text-4xl opacity-20">📂</span>
                        <p>Nenhum jogo salvo.</p>
                        <p className="text-xs">Gere jogos e clique em "Salvar" para vê-los aqui.</p>
                    </div>
                  ) : (
                    <AnimatePresence>
                    {savedBatches.map((batch, idx) => {
                        // Calcula o tamanho da aposta para exibir no card
                        const sizes = batch.games.map(g => g.numbers.length);
                        const uniqueSizes = Array.from(new Set(sizes)) as number[];
                        const sizeLabel = uniqueSizes.length === 1 
                            ? `${uniqueSizes[0]} Dz` 
                            : (uniqueSizes.length > 1 ? 'Misto' : '');
                        
                        const sizeCount = uniqueSizes.length > 0 ? uniqueSizes[0] : 0;
                        let sizeColorClass = "bg-slate-700 text-slate-300";
                        if (sizeCount === 16) sizeColorClass = "bg-blue-600 text-white";
                        if (sizeCount >= 17) sizeColorClass = "bg-purple-600 text-white";
                        if (sizeCount >= 19) sizeColorClass = "bg-amber-500 text-black";

                        // CALCULAR TOTAL DO LOTE ESPECÍFICO
                        let batchTotalPrize = 0;
                        if (latestResult && batch.gameType === activeGame.id && batch.targetConcurso === latestResult.concurso) {
                            const rs = new Set(latestResult.dezenas.map(d => parseInt(d, 10)));
                            batch.games.forEach(g => {
                                const h = g.numbers.filter(n => rs.has(n)).length;
                                const pe = latestResult.premiacoes.find(p => p.faixa === h);
                                if (pe) batchTotalPrize += pe.valor;
                            });
                        }

                        return (
                        <motion.div 
                            key={batch.id || idx}
                            layout
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, x: -100, transition: { duration: 0.2 } }}
                            className={`bg-slate-900/50 rounded-lg border p-3 shadow-sm ${batch.gameType === activeGame.id ? 'border-slate-600 bg-slate-800/80' : 'border-slate-700 opacity-70'}`}
                        >
                          <div className="flex justify-between items-start mb-3 border-b border-slate-700/50 pb-2">
                            <div>
                               <div className="text-sm font-bold text-white flex items-center gap-2 flex-wrap">
                                  <span className="uppercase text-[10px] bg-slate-700 px-1.5 rounded text-slate-300">{batch.gameType || 'lotofacil'}</span>
                                  
                                  {sizeLabel && (
                                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm ${sizeColorClass}`}>
                                          {sizeLabel}
                                      </span>
                                  )}

                                  <span>Conc: {batch.targetConcurso}</span>
                                  {latestResult && batch.gameType === activeGame.id && latestResult.concurso === batch.targetConcurso && (
                                     <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-500/30 font-bold">Atual</span>
                                  )}
                                </div>
                               {/* EXIBIR TOTAL DO LOTE SE HOUVER */}
                               {batchTotalPrize > 0 ? (
                                   <div className="mt-1.5 flex items-center gap-1.5">
                                       <span className="text-[10px] text-slate-400">Total do Lote:</span>
                                       <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-900/30 px-1.5 rounded border border-emerald-500/30">
                                           {batchTotalPrize.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                       </span>
                                   </div>
                               ) : (
                                   <div className="text-[10px] text-slate-500 mt-1">{batch.createdAt} • {batch.games.length} jogos</div>
                               )}
                            </div>
                            
                            <div className="flex gap-2">
                                <button 
                                  type="button"
                                  onClick={(e) => handleShareSavedBatch(e, batch)}
                                  className="bg-green-600/10 hover:bg-green-600/20 text-green-400 border border-green-500/20 rounded-lg px-3 py-1.5 transition-all flex items-center gap-1 text-[10px] font-bold shadow-sm active:scale-95"
                                  title="Compartilhar Lote"
                                >
                                  <span>📲</span>
                                </button>

                                <button 
                                  type="button"
                                  onClick={(e) => handleRequestDeleteBatch(e, batch.id)} 
                                  className={`${deleteConfirmBatchId === batch.id ? 'bg-red-600 text-white animate-pulse' : 'bg-red-500/10 hover:bg-red-500/20 text-red-400'} border border-red-500/20 rounded-lg px-3 py-1.5 transition-all flex items-center gap-1 text-[10px] font-bold shadow-sm active:scale-95`}
                                >
                                  <span>🗑️</span> {deleteConfirmBatchId === batch.id ? 'Confirmar?' : 'Apagar'}
                                </button>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <AnimatePresence>
                            {batch.games.map((gameObj) => {
                              if (!gameObj || !gameObj.numbers) return null;

                              let hits = 0;
                              let prizeValue = 0;
                              let statusLabel = <span className="text-slate-500 text-[9px]">--</span>;
                              let styleClass = "bg-black/20 border-transparent";

                              // Só calcula hits se for o jogo ativo E tiver resultado carregado
                              if (latestResult && batch.gameType === activeGame.id) {
                                  if (latestResult.concurso === batch.targetConcurso) {
                                      hits = calculateHits(gameObj.numbers);
                                      
                                      // BUSCA O VALOR DO PRÊMIO
                                      const prizeEntry = latestResult.premiacoes.find(p => p.faixa === hits);
                                      if (prizeEntry) prizeValue = prizeEntry.valor;

                                      if (hits > 0) statusLabel = <span className="text-slate-300 text-[10px] font-bold">{hits} pts</span>;
                                      
                                      // Highlight Wins
                                      let minWin = 11; // Default Loto
                                      if (activeGame.id === 'megasena') minWin = 4;
                                      if (activeGame.id === 'quina') minWin = 2;
                                      
                                      if (hits >= minWin) {
                                          styleClass = "bg-emerald-900/20 border-emerald-500/40 shadow-emerald-500/10 shadow";
                                          statusLabel = (
                                              <div className="flex flex-col items-end">
                                                  <span className="text-emerald-400 text-[10px] font-black flex items-center gap-1">🏆 {hits} PTS</span>
                                                  {prizeValue > 0 && (
                                                      <span className="text-[10px] text-white font-mono bg-emerald-600 px-1.5 rounded shadow-sm mt-0.5">
                                                          {prizeValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                      </span>
                                                  )}
                                              </div>
                                          );
                                      }
                                  } else if (latestResult.concurso > batch.targetConcurso) {
                                      statusLabel = <span className="text-slate-600 text-[9px]">Passado</span>;
                                  }
                              }

                              return (
                                <motion.div 
                                    key={gameObj.id} 
                                    layout
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, x: -50, height: 0, marginBottom: 0, transition: { duration: 0.2 } }}
                                    className={`flex flex-col p-2 rounded border transition-all overflow-hidden ${styleClass}`}
                                >
                                   <div className="flex justify-between items-center">
                                       <div className="flex items-center gap-2">
                                           <span className="text-[9px] font-bold text-slate-500 w-8">#{gameObj.gameNumber}</span>
                                           <div className="flex gap-1 flex-wrap">
                                              {gameObj.numbers.map(n => {
                                                const isHit = latestResult && batch.gameType === activeGame.id && batch.targetConcurso === latestResult.concurso && resultNumbers.has(n);
                                                return (
                                                  <span key={n} className={`text-[10px] w-5 h-5 flex items-center justify-center rounded-full font-mono font-bold leading-none ${isHit ? 'bg-white text-black scale-110 shadow-sm' : 'bg-slate-700 text-slate-400'}`}>
                                                     {n.toString().padStart(2, '0')}
                                                  </span>
                                                );
                                              })}
                                           </div>
                                       </div>
                                       <div className="flex items-center gap-3">
                                           {statusLabel}
                                           <button 
                                            onClick={(e) => handleDeleteSpecificGame(e, batch.id, gameObj.id)}
                                            className={`${deleteConfirmGameId === gameObj.id ? 'text-red-500 font-bold bg-red-500/10 px-2 py-0.5 rounded text-[10px]' : 'text-slate-600 hover:text-red-400 px-1 font-bold'}`}
                                           >
                                            {deleteConfirmGameId === gameObj.id ? 'Apagar?' : '✕'}
                                           </button>
                                       </div>
                                   </div>
                                </motion.div>
                              );
                            })}
                            </AnimatePresence>
                          </div>
                        </motion.div>
                    );
                    })
                    }
                    </AnimatePresence>
                  )}
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};

export default App;