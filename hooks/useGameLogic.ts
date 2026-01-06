
import { useState, useEffect, useMemo } from 'react';
import { GameConfig, AppStatus, AnalysisResult, TrendResult } from '../types';
import { DEFAULT_GAME } from '../utils/gameConfig';
import { vibrate } from '../utils/uiUtils';
import { generateSmartPatternGames, generateReducedClosing, generateMathematicalClosing } from '../utils/lotteryLogic';
import { getAiSuggestions, analyzeClosing, getLotteryTrends } from '../services/geminiService';

export type ClosingMethod = 'reduced' | 'smart_pattern' | 'guaranteed' | 'free_mode';

export const useGameLogic = (activeGame: GameConfig, latestResult: any) => {
  const [selectedNumbers, setSelectedNumbers] = useState<Set<number>>(new Set());
  const [generatedGames, setGeneratedGames] = useState<number[][]>([]);
  const [generatedHistory, setGeneratedHistory] = useState<Set<string>>(new Set()); 
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [trends, setTrends] = useState<TrendResult | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null); 
  
  // Configurações
  const [generationLimit, setGenerationLimit] = useState<number | string>(10); 
  const [gameSize, setGameSize] = useState<number>(DEFAULT_GAME.minSelection);
  const [closingMethod, setClosingMethod] = useState<ClosingMethod>('smart_pattern'); 
  const [loadingProgress, setLoadingProgress] = useState<number>(0);

  const allNumbers = useMemo((): number[] => {
    if (activeGame.id === 'supersete') {
        const nums: number[] = [];
        for (let val = 0; val <= 9; val++) { 
            for (let col = 0; col < 7; col++) { nums.push(col * 10 + val); }
        }
        return nums;
    }
    if (activeGame.id === 'lotomania') return Array.from({ length: 100 }, (_, i) => i);
    if (activeGame.id === 'federal') return [];
    return Array.from({ length: Number(activeGame.totalNumbers) }, (_, i) => i + 1);
  }, [activeGame]);

  const totalGenerationCost = useMemo(() => {
      if (activeGame.id === 'federal' || generatedGames.length === 0) return 0;
      
      let total = 0;
      generatedGames.forEach(game => {
          const qty = game.length;
          const priceItem = activeGame.priceTable.find(p => p.quantity == qty);
          
          if (priceItem && typeof priceItem.price === 'number') {
              total += priceItem.price;
          } else {
              const basePrice = activeGame.priceTable[0]?.price;
              total += (typeof basePrice === 'number' ? basePrice : 0);
          }
      });
      
      return total;
  }, [generatedGames, activeGame]);

  useEffect(() => {
    handleClear();
    setGameSize(activeGame.minSelection);
    
    // Carregar tendências ao mudar de jogo
    if (latestResult) {
        getLotteryTrends(activeGame.name, latestResult.dezenas).then(setTrends);
    }
  }, [activeGame.id, latestResult]);

  useEffect(() => {
    if (closingMethod === 'free_mode') {
        setGenerationLimit(1);
    }
  }, [closingMethod]);

  const toggleNumber = (num: number, notify: (msg: string, type: 'info') => void) => {
    vibrate(8); 
    const newSelection = new Set(selectedNumbers);
    if (newSelection.has(num)) {
      newSelection.delete(num);
    } else {
      if (newSelection.size >= activeGame.maxSelection) {
          notify(`Máximo de ${activeGame.maxSelection} números.`, 'info');
          return;
      }
      newSelection.add(num);
    }
    setSelectedNumbers(newSelection);
    setGeneratedHistory(new Set()); 
  };

  const handleClear = () => {
    vibrate(20);
    setSelectedNumbers(new Set());
    setGeneratedGames([]);
    setGeneratedHistory(new Set());
    setAnalysis(null);
    setStatus(AppStatus.IDLE);
    setTrends(null);
    setLoadingProgress(0);
    setGameSize(activeGame.minSelection); 
    setClosingMethod('smart_pattern');
    setSelectedTeam(null); // Resetar time
  };
  
  // NOVO: Função para remover jogos específicos (para filtros)
  const removeGames = (indicesToRemove: number[]) => {
      const setIndices = new Set(indicesToRemove);
      const newGames = generatedGames.filter((_, idx) => !setIndices.has(idx));
      setGeneratedGames(newGames);
      vibrate(20);
  };

  const handleGameSizeChangeWithAutoSelect = (newSize: number, notify: (msg: string, type: 'info' | 'success') => void) => {
      vibrate(10);
      setGameSize(newSize);
      setGeneratedHistory(new Set()); 
      notify(`Tamanho alterado para ${newSize}`, 'info');
  };

  const importGame = (numbers: number[], notify: (msg: string, type: 'success' | 'info' | 'error') => void) => {
    vibrate(15);
    const validNumbers = numbers.filter(n => allNumbers.includes(n));
    if (validNumbers.length === 0) {
        notify('Nenhum número válido encontrado para importar.', 'error');
        return;
    }
    let numsToSet = validNumbers;
    if (validNumbers.length > activeGame.maxSelection) {
         notify(`Limitado aos primeiros ${activeGame.maxSelection} números.`, 'info');
         numsToSet = validNumbers.slice(0, activeGame.maxSelection);
    }
    if (numsToSet.length > gameSize) {
        setGameSize(numsToSet.length);
    }
    setSelectedNumbers(new Set(numsToSet));
    setGeneratedHistory(new Set());
    notify(`${numsToSet.length} números importados!`, 'success');
  };

  const handleGenerate = async (notify: (msg: string, type: 'success' | 'error' | 'info') => void) => {
    vibrate(20);
    setStatus(AppStatus.GENERATING);
    setLoadingProgress(0);
    
    const limit = closingMethod === 'free_mode' ? 1 : (Number(generationLimit) || 10);

    // Usa setTimeout para sair da Call Stack atual e permitir que o UI renderize o estado 'GENERATING'
    setTimeout(async () => {
        try {
            let finalGames: number[][] = [];
            const selectedArray = Array.from(selectedNumbers) as number[];
            
            let fixedNumbers: number[] = [];
            let poolNumbers: number[] = [];
            let effectiveSize = gameSize;

            if (selectedArray.length > 0) {
                if (selectedArray.length < gameSize) {
                    fixedNumbers = [...selectedArray];
                    poolNumbers = allNumbers.filter(n => !selectedNumbers.has(n));
                    effectiveSize = gameSize - selectedArray.length;
                } else {
                    fixedNumbers = [];
                    poolNumbers = [...selectedArray];
                    effectiveSize = gameSize;
                }
            } else {
                fixedNumbers = [];
                poolNumbers = [...allNumbers];
                effectiveSize = gameSize;
            }

            const currentHistory = new Set<string>(generatedHistory);

            // Definição da função de geração em lote ASSÍNCRONA
            const generateBatch = async (pool: number[], qty: number, method: ClosingMethod, historyToExclude: Set<string>) => {
                if (qty <= 0) return [];
                
                const progressCallback = (p: number) => setLoadingProgress(p);

                if (method === 'smart_pattern') {
                    const prevResult = latestResult ? latestResult.dezenas.map((d: string) => parseInt(d)) : undefined;
                    return await generateSmartPatternGames(pool, qty, effectiveSize, activeGame, prevResult, historyToExclude, progressCallback);
                } 
                else if (method === 'reduced') {
                    const guarantee = Math.max(2, effectiveSize - 1);
                    return await generateReducedClosing(pool, effectiveSize, guarantee, qty, historyToExclude, progressCallback);
                } 
                else if (method === 'guaranteed') {
                    return await generateMathematicalClosing(pool, effectiveSize, qty, historyToExclude, progressCallback);
                } 
                else {
                    // Modo Livre (Simplificado, não precisa de worker complexo)
                    const games = [];
                    const uniqueSet = new Set<string>();
                    let attempts = 0;
                    const maxAttempts = qty * 500;
                    while(games.length < qty && attempts < maxAttempts) {
                         attempts++;
                         const shuffled = [...pool].sort(() => 0.5 - Math.random());
                         const game = shuffled.slice(0, effectiveSize).sort((a,b)=>a-b);
                         const sig = JSON.stringify(game);
                         if(!uniqueSet.has(sig) && !historyToExclude.has(sig)) {
                             games.push(game);
                             uniqueSet.add(sig);
                         }
                    }
                    return games;
                }
            };

            // 1. Geração Principal
            finalGames = await generateBatch(poolNumbers, limit, closingMethod, currentHistory);

            // 2. Fallback de Preenchimento
            if (finalGames.length < limit && closingMethod !== 'free_mode') {
                 const tempHistory = new Set(currentHistory);
                 finalGames.forEach(g => tempHistory.add(JSON.stringify(g)));
                 const needed = limit - finalGames.length;
                 const extendedPool = [...allNumbers];
                 const supplement = await generateBatch(extendedPool, needed, closingMethod, tempHistory);
                 finalGames = [...finalGames, ...supplement];
            } else if (finalGames.length < limit && closingMethod === 'free_mode') {
                 const needed = limit - finalGames.length;
                 const extendedPool = [...allNumbers];
                 const tempHistory = new Set(currentHistory);
                 finalGames.forEach(g => tempHistory.add(JSON.stringify(g)));
                 const supplement = await generateBatch(extendedPool, needed, closingMethod, tempHistory);
                 finalGames = [...finalGames, ...supplement];
            }

            // Pós-Processamento
            let assembledGames = finalGames.map(g => {
                return [...fixedNumbers, ...g].sort((a, b) => a - b);
            });
            
            const uniqueSet = new Set<string>();
            assembledGames = assembledGames.filter(g => {
                const s = JSON.stringify(g);
                if(uniqueSet.has(s)) return false;
                uniqueSet.add(s);
                return true;
            });

            if (assembledGames.length > limit) {
                 assembledGames = assembledGames.slice(0, limit);
            }
            
            // Loop Final de Segurança
            let loopSafety = 0;
            const allowFill = closingMethod !== 'free_mode' || assembledGames.length === 0;
            while (assembledGames.length < limit && allowFill && loopSafety < 1000) {
                 loopSafety++;
                 const shuffled = [...allNumbers].sort(() => 0.5 - Math.random());
                 const fullGame = shuffled.slice(0, gameSize).sort((a, b) => a - b);
                 const s = JSON.stringify(fullGame);
                 if (!uniqueSet.has(s) && !currentHistory.has(s)) {
                    assembledGames.push(fullGame);
                    uniqueSet.add(s);
                 }
            }

            setGeneratedGames(assembledGames);
            
            const newHistory = new Set(currentHistory);
            assembledGames.forEach(g => newHistory.add(JSON.stringify(g)));
            setGeneratedHistory(newHistory);
            
            // AI Analysis of the generated batch
            if (assembledGames.length > 0) {
                 // Non-blocking analysis
                 analyzeClosing(selectedArray, assembledGames.length).then(aiAnalysis => {
                      setAnalysis(aiAnalysis);
                 });
            } else {
                 setAnalysis({
                    message: "Geração concluída.",
                    score: 100,
                    tips: "Jogos gerados."
                });
            }
            
            setStatus(AppStatus.SUCCESS);
            setLoadingProgress(100);
            notify(`${assembledGames.length} jogos gerados!`, 'success');

        } catch (error) {
            console.error("Erro na geração:", error);
            notify("Erro ao gerar jogos.", 'error');
            setStatus(AppStatus.ERROR);
        }
    }, 50);
  };

  const handleAiSuggestion = async (notify: (msg: string, type: 'info' | 'success' | 'error') => void) => {
    vibrate(20);
    setStatus(AppStatus.GENERATING);
    setLoadingProgress(0);
    
    const progressInterval = setInterval(() => {
        setLoadingProgress(prev => {
            if (prev >= 90) return prev; 
            return prev + Math.floor(Math.random() * 10) + 2;
        });
    }, 250);

    try {
        const currentSelArray = Array.from(selectedNumbers) as number[];
        const suggestion = await getAiSuggestions(
            activeGame.name, 
            activeGame.minSelection, 
            activeGame.totalNumbers,
            currentSelArray // Pass context
        );
        
        clearInterval(progressInterval);
        setLoadingProgress(100);

        if (suggestion && suggestion.length > 0) {
            setSelectedNumbers(new Set(suggestion));
            setGeneratedHistory(new Set()); 
            notify("Sugestão de IA aplicada!", 'success');
        } else {
            notify("Não foi possível obter sugestão da IA.", 'error');
        }
    } catch (error) {
        clearInterval(progressInterval);
        console.error("AI Error", error);
        notify("Erro na inteligência artificial.", 'error');
    } finally {
        setTimeout(() => {
            setStatus(AppStatus.IDLE);
            setLoadingProgress(0);
        }, 500);
    }
  };

  return {
    selectedNumbers,
    generatedGames,
    setGeneratedGames,
    removeGames,
    status,
    setStatus,
    analysis,
    trends,
    generationLimit,
    setGenerationLimit,
    gameSize,
    setGameSize,
    closingMethod,
    setClosingMethod,
    loadingProgress,
    totalGenerationCost,
    allNumbers,
    toggleNumber,
    handleClear,
    handleGameSizeChangeWithAutoSelect,
    handleGenerate,
    handleAiSuggestion,
    importGame,
    selectedTeam, 
    setSelectedTeam 
  };
};
