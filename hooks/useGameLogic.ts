
import { useState, useEffect, useMemo } from 'react';
import { GameConfig, AppStatus, AnalysisResult, TrendResult } from '../types';
import { DEFAULT_GAME } from '../utils/gameConfig';
import { vibrate } from '../utils/uiUtils';
import { generateSmartPatternGames, generateReducedClosing, generateMathematicalClosing } from '../utils/lotteryLogic';
import { getAiSuggestions } from '../services/geminiService';

export type ClosingMethod = 'reduced' | 'smart_pattern' | 'guaranteed' | 'free_mode';

export const useGameLogic = (activeGame: GameConfig, latestResult: any) => {
  const [selectedNumbers, setSelectedNumbers] = useState<Set<number>>(new Set());
  const [generatedGames, setGeneratedGames] = useState<number[][]>([]);
  const [generatedHistory, setGeneratedHistory] = useState<Set<string>>(new Set()); // NOVO: Histórico de exclusão
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [trends, setTrends] = useState<TrendResult | null>(null);
  
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

  // CORREÇÃO: Cálculo de custo baseado na quantidade de dezenas de cada jogo
  const totalGenerationCost = useMemo(() => {
      if (activeGame.id === 'federal' || generatedGames.length === 0) return 0;
      
      let total = 0;
      generatedGames.forEach(game => {
          const qty = game.length;
          // Busca o preço na tabela correspondente à quantidade de números deste jogo
          const priceItem = activeGame.priceTable.find(p => p.quantity == qty);
          
          if (priceItem && typeof priceItem.price === 'number') {
              total += priceItem.price;
          } else {
              // Fallback se não encontrar (pega o preço base/mínimo)
              const basePrice = activeGame.priceTable[0]?.price;
              total += (typeof basePrice === 'number' ? basePrice : 0);
          }
      });
      
      return total;
  }, [generatedGames, activeGame]);

  useEffect(() => {
    handleClear();
    setGameSize(activeGame.minSelection);
  }, [activeGame.id]);

  // Efeito para travar limite em 1 no modo livre
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
    setGeneratedHistory(new Set()); // Reset history when selection changes
  };

  const handleClear = () => {
    vibrate(20);
    setSelectedNumbers(new Set());
    setGeneratedGames([]);
    setGeneratedHistory(new Set()); // Reset history
    setAnalysis(null);
    setStatus(AppStatus.IDLE);
    setTrends(null);
    setLoadingProgress(0);
    setGameSize(activeGame.minSelection); 
    setClosingMethod('smart_pattern'); 
  };

  const handleGameSizeChangeWithAutoSelect = (newSize: number, notify: (msg: string, type: 'info' | 'success') => void) => {
      vibrate(10);
      setGameSize(newSize);
      setGeneratedHistory(new Set()); // Reset history when size changes
      notify(`Tamanho alterado para ${newSize}`, 'info');
  };

  const importGame = (numbers: number[], notify: (msg: string, type: 'success' | 'info' | 'error') => void) => {
    vibrate(15);
    
    // Filtra apenas números válidos para o jogo atual
    const validNumbers = numbers.filter(n => allNumbers.includes(n));
    
    if (validNumbers.length === 0) {
        notify('Nenhum número válido encontrado para importar.', 'error');
        return;
    }

    // Se a quantidade de números importados for maior que o máximo permitido, corta
    let numsToSet = validNumbers;
    if (validNumbers.length > activeGame.maxSelection) {
         notify(`Limitado aos primeiros ${activeGame.maxSelection} números.`, 'info');
         numsToSet = validNumbers.slice(0, activeGame.maxSelection);
    }

    // Ajusta o tamanho do jogo se necessário para caber a importação (se for menor que o mínimo não tem problema, mas se for maior que o gameSize atual, ajustamos)
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
    
    // Força limite 1 se for Modo Livre
    const limit = closingMethod === 'free_mode' ? 1 : (Number(generationLimit) || 10);

    // Pequeno delay para UI renderizar o status de carregamento
    requestAnimationFrame(() => {
        try {
            let finalGames: number[][] = [];
            const selectedArray = Array.from(selectedNumbers) as number[];
            
            let fixedNumbers: number[] = [];
            let poolNumbers: number[] = [];
            let effectiveSize = gameSize;

            // Lógica de Pool baseada na seleção
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

            // Clona o histórico atual para usar na geração
            const currentHistory = new Set<string>(generatedHistory);

            // --- LÓGICA DE GERAÇÃO POR MÉTODO ---
            const generateBatch = (pool: number[], qty: number, method: ClosingMethod, historyToExclude: Set<string>) => {
                if (qty <= 0) return [];
                
                if (method === 'smart_pattern') {
                    const prevResult = latestResult ? latestResult.dezenas.map((d: string) => parseInt(d)) : undefined;
                    return generateSmartPatternGames(pool, qty, effectiveSize, activeGame, prevResult, historyToExclude);
                } 
                else if (method === 'reduced') {
                    const guarantee = Math.max(2, effectiveSize - 1);
                    const games = generateReducedClosing(pool, effectiveSize, guarantee, qty, historyToExclude);
                    // Completa se faltar
                    if (games.length < qty) {
                        const uniqueSet = new Set(games.map(g => JSON.stringify(g)));
                        for(let i=games.length; i<qty; i++) {
                            const shuffled = [...pool].sort(() => 0.5 - Math.random());
                            const fallback = shuffled.slice(0, effectiveSize).sort((a,b)=>a-b);
                            const sig = JSON.stringify(fallback);
                            if (!uniqueSet.has(sig) && !historyToExclude.has(sig)) {
                                games.push(fallback);
                                uniqueSet.add(sig);
                            }
                        }
                    }
                    return games;
                } 
                else if (method === 'guaranteed') {
                    return generateMathematicalClosing(pool, effectiveSize, qty, historyToExclude);
                } 
                else {
                    // Modo Livre (Aleatório simples) - Limitado a 1 por vez no UI, mas loop genérico aqui
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

            // 1. Tenta gerar com o pool restrito (seleção do usuário)
            finalGames = generateBatch(poolNumbers, limit, closingMethod, currentHistory);

            // 2. Verifica se atingiu a quantidade. Se não, expande para TODOS os números
            // Isso acontece se o usuário selecionou poucos números ou já esgotou as combinações possíveis no histórico
            if (finalGames.length < limit && closingMethod !== 'free_mode') {
                 // Adiciona os que acabamos de gerar à lista de exclusão temporária para a expansão não repetir
                 const tempHistory = new Set(currentHistory);
                 finalGames.forEach(g => tempHistory.add(JSON.stringify(g)));

                 const needed = limit - finalGames.length;
                 const extendedPool = [...allNumbers];
                 
                 const supplement = generateBatch(extendedPool, needed, closingMethod, tempHistory);
                 finalGames = [...finalGames, ...supplement];
            } else if (finalGames.length < limit && closingMethod === 'free_mode') {
                 // Fallback específico para modo livre se falhar com a seleção estrita (ex: faltam numeros)
                 const needed = limit - finalGames.length;
                 const extendedPool = [...allNumbers];
                 // No modo livre com seleção incompleta, completa com aleatórios globais
                 const tempHistory = new Set(currentHistory);
                 finalGames.forEach(g => tempHistory.add(JSON.stringify(g)));
                 const supplement = generateBatch(extendedPool, needed, closingMethod, tempHistory);
                 finalGames = [...finalGames, ...supplement];
            }

            // Pós-Processamento: Adicionar Fixos e Remover Duplicatas
            let assembledGames = finalGames.map(g => {
                return [...fixedNumbers, ...g].sort((a, b) => a - b);
            });
            
            // Filtro final de segurança
            const uniqueSet = new Set<string>();
            assembledGames = assembledGames.filter(g => {
                const s = JSON.stringify(g);
                if(uniqueSet.has(s)) return false;
                uniqueSet.add(s);
                return true;
            });

            // GARANTIR LIMITE EXATO (Corte)
            if (assembledGames.length > limit) {
                 assembledGames = assembledGames.slice(0, limit);
            }
            
            // Preenchimento final de segurança
            let loopSafety = 0;
            // No modo livre só deve rodar se realmente não tiver gerado nada
            const allowFill = closingMethod !== 'free_mode' || assembledGames.length === 0;
            
            while (assembledGames.length < limit && allowFill && loopSafety < 1000) {
                 loopSafety++;
                 const shuffled = [...allNumbers].sort(() => 0.5 - Math.random());
                 const fullGame = shuffled.sort((a, b) => a - b);
                 const s = JSON.stringify(fullGame);
                 if (!uniqueSet.has(s) && !currentHistory.has(s)) {
                    assembledGames.push(fullGame);
                    uniqueSet.add(s);
                 }
            }

            setGeneratedGames(assembledGames);
            
            // Atualiza o histórico com os novos jogos gerados
            const newHistory = new Set(currentHistory);
            assembledGames.forEach(g => newHistory.add(JSON.stringify(g)));
            setGeneratedHistory(newHistory);

            setStatus(AppStatus.SUCCESS);
            
            const methodLabel = {
                'smart_pattern': 'Padrão Ouro',
                'reduced': 'Fechamento',
                'guaranteed': 'Matemático',
                'free_mode': 'Modo Livre'
            }[closingMethod];

            setAnalysis({
                message: `Geração ${methodLabel} concluída.`,
                score: 100,
                tips: "Jogos gerados com sucesso."
            });
            
            notify(`${assembledGames.length} jogos gerados!`, 'success');

        } catch (error) {
            console.error("Erro na geração:", error);
            notify("Erro ao gerar jogos.", 'error');
            setStatus(AppStatus.ERROR);
        }
    });
  };

  const handleAiSuggestion = async (notify: (msg: string, type: 'info' | 'success' | 'error') => void) => {
    vibrate(20);
    setStatus(AppStatus.GENERATING);
    setLoadingProgress(0); // Reset inicial
    
    // SIMULAÇÃO DE PROGRESSO VISUAL
    const progressInterval = setInterval(() => {
        setLoadingProgress(prev => {
            if (prev >= 90) return prev; 
            return prev + Math.floor(Math.random() * 10) + 2;
        });
    }, 250);

    try {
        const suggestion = await getAiSuggestions(activeGame.name, activeGame.minSelection, activeGame.totalNumbers);
        
        clearInterval(progressInterval);
        setLoadingProgress(100);

        if (suggestion && suggestion.length > 0) {
            setSelectedNumbers(new Set(suggestion));
            setGeneratedHistory(new Set()); // Reset history on AI suggestion
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
    importGame
  };
};
