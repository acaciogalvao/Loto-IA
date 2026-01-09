
import { useState, useEffect, useMemo } from 'react';
import { GameConfig, AppStatus, AnalysisResult, TrendResult } from '../types';
import { DEFAULT_GAME } from '../utils/gameConfig';
import { vibrate } from '../utils/uiUtils';
import { generateSmartPatternGames, generateReducedClosing, generateMathematicalClosing } from '../utils/lotteryLogic';
import { getAiSuggestions, analyzeClosing } from '../services/geminiService';

export type ClosingMethod = 'reduced' | 'smart_pattern' | 'guaranteed' | 'free_mode';

export const useGameLogic = (activeGame: GameConfig, latestResult: any) => {
  const [selectedNumbers, setSelectedNumbers] = useState<Set<number>>(new Set());
  const [fixedNumbers, setFixedNumbers] = useState<Set<number>>(new Set());
  
  // States para controles avançados
  const [isFixMode, setIsFixMode] = useState(false);
  const [targetFixedCount, setTargetFixedCount] = useState<number>(0); 
  
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
    setTargetFixedCount(0);
    setIsFixMode(false);
  }, [activeGame.id]);

  useEffect(() => {
    if (closingMethod === 'free_mode') {
        setGenerationLimit(1);
    }
  }, [closingMethod]);

  const toggleNumber = (num: number, _isFixModeIgnored: boolean, notify: (msg: string, type: 'info') => void) => {
    vibrate(8); 
    const newSelection = new Set(selectedNumbers);
    const newFixed = new Set(fixedNumbers);

    if (isFixMode) {
        if (newFixed.has(num)) {
            newFixed.delete(num);
            newSelection.delete(num); 
        } else {
            // Verifica limites
            if (targetFixedCount > 0 && newFixed.size >= targetFixedCount) {
                notify(`Você já definiu as ${targetFixedCount} fixas necessárias.`, 'info');
                return;
            }
            const maxFixedAllowed = Math.max(1, gameSize - 1);
            if (newFixed.size >= maxFixedAllowed) {
                notify(`Máximo de ${maxFixedAllowed} fixas permitido.`, 'info');
                return;
            }

            newFixed.add(num);
            newSelection.add(num);
        }
    } else {
        if (newSelection.has(num)) {
            newSelection.delete(num);
            if (newFixed.has(num)) newFixed.delete(num);
        } else {
            if (newSelection.size >= activeGame.maxSelection) {
                notify(`Máximo de ${activeGame.maxSelection} números.`, 'info');
                return;
            }
            newSelection.add(num);
        }
    }

    setSelectedNumbers(newSelection);
    setFixedNumbers(newFixed);
    setGeneratedHistory(new Set()); 
  };

  const handleClear = () => {
    vibrate(20);
    setSelectedNumbers(new Set());
    setFixedNumbers(new Set()); 
    setGeneratedGames([]);
    setGeneratedHistory(new Set());
    setAnalysis(null);
    setStatus(AppStatus.IDLE);
    setTrends(null);
    setLoadingProgress(0);
    setGameSize(activeGame.minSelection); 
    setClosingMethod('smart_pattern');
    setSelectedTeam(null);
  };
  
  const removeGames = (indicesToRemove: number[]) => {
      const setIndices = new Set(indicesToRemove);
      const newGames = generatedGames.filter((_, idx) => !setIndices.has(idx));
      setGeneratedGames(newGames);
      vibrate(20);
  };

  const handleGameSizeChangeWithAutoSelect = (newSize: number, notify: (msg: string, type: 'info' | 'success') => void) => {
      vibrate(10);
      setGameSize(newSize);
      
      if (fixedNumbers.size >= newSize) {
          const newFixed = new Set(Array.from(fixedNumbers).slice(0, newSize - 1));
          setFixedNumbers(newFixed);
      }
      if (targetFixedCount >= newSize) {
          setTargetFixedCount(0);
      }

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
    setFixedNumbers(new Set()); 
    setGeneratedHistory(new Set());
    notify(`${numsToSet.length} números importados!`, 'success');
  };

  const handleGenerate = async (notify: (msg: string, type: 'success' | 'error' | 'info') => void) => {
    vibrate(20);
    setStatus(AppStatus.GENERATING);
    setLoadingProgress(0);
    
    const limit = closingMethod === 'free_mode' ? 1 : (Number(generationLimit) || 10);

    setTimeout(async () => {
        try {
            const selectedArray = Array.from(selectedNumbers) as number[];
            const fixedArray = Array.from(fixedNumbers) as number[];
            
            let poolNumbers: number[] = [];
            
            if (selectedArray.length > gameSize) {
                poolNumbers = selectedArray.filter(n => !fixedNumbers.has(n));
            } else {
                poolNumbers = allNumbers.filter(n => !fixedNumbers.has(n));
            }

            const currentHistory = new Set<string>(generatedHistory);

            const generateBatch = async (pool: number[], qty: number, method: ClosingMethod, historyToExclude: Set<string>) => {
                if (qty <= 0) return [];
                const progressCallback = (p: number) => setLoadingProgress(p);

                if (method === 'smart_pattern') {
                    const prevResult = latestResult ? latestResult.dezenas.map((d: string) => parseInt(d)) : undefined;
                    return await generateSmartPatternGames(pool, qty, gameSize, activeGame, prevResult, historyToExclude, progressCallback, fixedArray);
                } 
                else if (method === 'reduced') {
                    const guarantee = Math.max(2, gameSize - 2); 
                    return await generateReducedClosing(pool, gameSize, guarantee, qty, historyToExclude, progressCallback, fixedArray);
                } 
                else if (method === 'guaranteed') {
                    return await generateMathematicalClosing(pool, gameSize, qty, historyToExclude, progressCallback, fixedArray);
                } 
                else {
                    const games = [];
                    const uniqueSet = new Set<string>();
                    let attempts = 0;
                    const maxAttempts = qty * 500;
                    const neededRandom = gameSize - fixedArray.length;

                    while(games.length < qty && attempts < maxAttempts) {
                         attempts++;
                         const shuffled = [...pool].sort(() => 0.5 - Math.random());
                         const randomPart = shuffled.slice(0, neededRandom);
                         const fullGame = [...fixedArray, ...randomPart].sort((a,b)=>a-b);
                         
                         const sig = JSON.stringify(fullGame);
                         if(!uniqueSet.has(sig) && !historyToExclude.has(sig)) {
                             games.push(fullGame);
                             uniqueSet.add(sig);
                         }
                    }
                    return games;
                }
            };

            let finalGames = await generateBatch(poolNumbers, limit, closingMethod, currentHistory);

            if (finalGames.length < limit) {
                 const tempHistory = new Set(currentHistory);
                 finalGames.forEach(g => tempHistory.add(JSON.stringify(g)));
                 const needed = limit - finalGames.length;
                 const extendedPool = allNumbers.filter(n => !fixedNumbers.has(n));
                 const supplement = await generateBatch(extendedPool, needed, closingMethod, tempHistory);
                 finalGames = [...finalGames, ...supplement];
            }

            setGeneratedGames(finalGames);
            const newHistory = new Set(currentHistory);
            finalGames.forEach(g => newHistory.add(JSON.stringify(g)));
            setGeneratedHistory(newHistory);
            
            if (finalGames.length > 0) {
                 analyzeClosing(selectedArray, finalGames.length).then(aiAnalysis => {
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
            notify(`${finalGames.length} jogos gerados!`, 'success');

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
        setLoadingProgress(prev => (prev >= 90 ? prev : prev + 10));
    }, 250);

    try {
        const currentSelArray = Array.from(selectedNumbers) as number[];
        const fixedArray = Array.from(fixedNumbers) as number[];
        
        const suggestion = await getAiSuggestions(
            activeGame.name, 
            activeGame.minSelection, 
            activeGame.totalNumbers,
            currentSelArray,
            fixedArray 
        );
        
        clearInterval(progressInterval);
        setLoadingProgress(100);

        if (suggestion && suggestion.length > 0) {
            const newSel = new Set([...fixedArray, ...suggestion]);
            setSelectedNumbers(newSel);
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
    fixedNumbers,
    isFixMode,
    setIsFixMode,
    targetFixedCount,
    setTargetFixedCount,
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
