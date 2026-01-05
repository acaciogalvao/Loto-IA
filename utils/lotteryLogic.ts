
import { PastGameResult, DetailedStats, GameConfig, LotteryResult } from "../types";

// --- CONSTANTES ESTATÍSTICAS ---
const PRIMES = new Set([
  2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97
]);

const FIBONACCI = new Set([0, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89]);

const TRIANGULARES = new Set([0, 1, 3, 6, 10, 15, 21, 28, 36, 45, 55, 66, 78, 91]);

const MOLDURA_CACHE: Record<string, Set<number>> = {};

// Helper para converter resultado da API em Set de números para conferência
export const getResultNumbersAsSet = (result: { dezenas: string[] } | null | undefined, gameId: string): Set<number> => {
    const set = new Set<number>();
    if (!result || !result.dezenas) return set;
    
    if (gameId === 'supersete') {
        result.dezenas.forEach((d, colIdx) => {
            const val = parseInt(d, 10);
            if (!isNaN(val)) {
                // Encoding: ColIndex * 10 + Value
                set.add(colIdx * 10 + val);
            }
        });
    } else {
        result.dezenas.forEach(d => {
             const val = parseInt(d, 10);
             if(!isNaN(val)) set.add(val);
        });
    }
    return set;
};

// Verifica se uma faixa de premiação é de valor FIXO (não divide por ganhadores)
export const isFixedPrize = (gameId: string, hits: number): boolean => {
    switch(gameId) {
        case 'lotofacil': 
            // 11, 12, 13 são fixos. 14 e 15 são rateio.
            return [11, 12, 13].includes(hits);
        case 'diadesorte': 
            // 4, 5 são fixos. 6, 7 são rateio.
            return [4, 5].includes(hits);
        case 'supersete': 
            // 3, 4, 5 são fixos. 6, 7 são rateio.
            return [3, 4, 5].includes(hits);
        case 'federal':
            return true; 
        default: 
            return false;
    }
};

// Helper Centralizado de Cálculo de Prêmios (Valor Individual Real)
export const calculatePrizeForHits = (hits: number, result: LotteryResult | PastGameResult, gameId: string): number => {
    const pEntry = result.premiacoes.find(p => p.faixa === hits);
    
    if (pEntry) {
        if (pEntry.ganhadores > 0 || pEntry.valor > 0) {
            return Number(pEntry.valor) || 0;
        }

        if (pEntry.ganhadores === 0) {
            const isMaxTier = (gameId === 'lotofacil' && hits === 15) ||
                              (gameId === 'megasena' && hits === 6) ||
                              (gameId === 'quina' && hits === 5) ||
                              (gameId === 'lotomania' && hits === 20) ||
                              (gameId === 'duplasena' && hits === 6) ||
                              (gameId === 'supersete' && hits === 7);

            if (isMaxTier && result.valorAcumulado && result.valorAcumulado > 0) {
                return result.valorAcumulado;
            }
        }
    }

    return 0;
};

// Helper para sequências
export const hasLongSequence = (numbers: number[], maxAllowed: number = 2): boolean => {
    let sorted = [...numbers].sort((a, b) => a - b);
    let currentSeq = 1;
    for (let i = 1; i < sorted.length; i++) {
        if (sorted[i] === sorted[i-1] + 1) {
            currentSeq++;
            if (currentSeq > maxAllowed) return true;
        } else {
            currentSeq = 1;
        }
    }
    return false;
};

// Helper para similaridade (interseção)
const calculateIntersection = (arr1: number[], arr2: number[]): number => {
    const s2 = new Set(arr2);
    return arr1.filter(x => s2.has(x)).length;
};

// Helper para quadrantes (Mega-Sena/Quina)
const getQuadrantDistribution = (numbers: number[], totalNumbers: number): number[] => {
    const midCol = 5;
    const midRow = Math.floor((totalNumbers / 10) / 2);
    
    const q = [0, 0, 0, 0];
    numbers.forEach(n => {
        const val = n - 1; // 0-indexed
        const row = Math.floor(val / 10);
        const col = val % 10;
        
        if (row < midRow && col < midCol) q[0]++;
        else if (row < midRow && col >= midCol) q[1]++;
        else if (row >= midRow && col < midCol) q[2]++;
        else q[3]++;
    });
    return q;
};

function combinationsCount(n: number, k: number): number {
    if (k < 0 || k > n) return 0;
    if (k === 0 || k === n) return 1;
    if (k > n / 2) k = n - k;
    let res = 1;
    for (let i = 1; i <= k; i++) {
        res = res * (n - i + 1) / i;
        if (res > 10000000) return 10000000; // Cap
    }
    return res;
}

export const generateCombinations = (sourceNumbers: number[], combinationSize: number, maxLimit: number = 200000): number[][] => {
  const result: number[][] = [];
  const sortedSource = [...sourceNumbers].sort((a, b) => a - b);
  const n = sortedSource.length;

  if (combinationSize > n) return [];
  if (combinationSize === n) return [[...sortedSource]];
  
  const indices = Array.from({ length: combinationSize }, (_, i) => i);
  
  while (result.length < maxLimit) {
      result.push(indices.map(i => sortedSource[i]));
      
      let i = combinationSize - 1;
      while (i >= 0 && indices[i] === i + n - combinationSize) {
          i--;
      }
      
      if (i < 0) break;
      
      indices[i]++;
      for (let j = i + 1; j < combinationSize; j++) {
          indices[j] = indices[j - 1] + 1;
      }
  }

  return result;
};

// --- ASYNC GENERATORS PARA NÃO TRAVAR UI ---

const yieldToMain = () => new Promise(resolve => setTimeout(resolve, 0));

export const generateReducedClosing = async (
    poolNumbers: number[],
    gameSize: number,
    guaranteeThreshold: number,
    maxGames: number = 2000,
    excludedSignatures?: Set<string>,
    onProgress?: (percent: number) => void
): Promise<number[][]> => {
    if (poolNumbers.length <= gameSize) return [[...poolNumbers]];

    const reducedGames: number[][] = [];
    const pool = [...poolNumbers];
    const numberCounts: Record<number, number> = {};
    pool.forEach(n => numberCounts[n] = 0);

    let attempts = 0;
    const maxAttempts = maxGames * 100;

    while (reducedGames.length < maxGames && attempts < maxAttempts) {
        attempts++;
        
        // Yield a cada 200 tentativas para atualizar UI
        if (attempts % 200 === 0) {
            await yieldToMain();
            if (onProgress) onProgress(Math.min(99, Math.floor((reducedGames.length / maxGames) * 100)));
        }

        const weightedPool = [...pool].sort((a, b) => {
             return (numberCounts[a] + Math.random()) - (numberCounts[b] + Math.random());
        });
        
        const candidate = weightedPool.slice(0, gameSize).sort((a, b) => a - b);
        const sig = JSON.stringify(candidate);

        if (excludedSignatures && excludedSignatures.has(sig)) continue;
        if (reducedGames.some(g => JSON.stringify(g) === sig)) continue;

        const stats = getStats(candidate);
        const diff = Math.abs(stats.evens - stats.odds);
        if (gameSize === 15 && diff > 5) continue; 

        let isCovered = false;
        for (const existingGame of reducedGames) {
            let matches = calculateIntersection(existingGame, candidate);
            if (matches >= guaranteeThreshold) {
                isCovered = true;
                break;
            }
        }
        if (!isCovered) {
            reducedGames.push(candidate);
            candidate.forEach(n => numberCounts[n]++);
        }
    }
    
    // Fallback fill
    if (reducedGames.length === 0) {
        let fallbackAttempts = 0;
        while(reducedGames.length < Math.min(10, maxGames) && fallbackAttempts < 100) {
             fallbackAttempts++;
             const rand = [...pool].sort(()=>0.5-Math.random()).slice(0,gameSize).sort((a,b)=>a-b);
             const sig = JSON.stringify(rand);
             if (excludedSignatures && excludedSignatures.has(sig)) continue;
             if (!reducedGames.some(g => JSON.stringify(g) === sig)) {
                 reducedGames.push(rand);
             }
        }
    }
    return reducedGames;
};

export const generateMathematicalClosing = async (
    poolNumbers: number[],
    gameSize: number,
    limit: number,
    excludedSignatures?: Set<string>,
    onProgress?: (percent: number) => void
): Promise<number[][]> => {
    const games: number[][] = [];
    const usageCounts: Record<number, number> = {};
    poolNumbers.forEach(n => usageCounts[n] = 0);

    let attempts = 0;
    const maxAttempts = limit * 500; 
    let maxOverlapAllowed = Math.max(2, gameSize - 3); 

    while (games.length < limit && attempts < maxAttempts) {
        attempts++;
        if (attempts % 200 === 0) {
            await yieldToMain();
            if (onProgress) onProgress(Math.min(99, Math.floor((games.length / limit) * 100)));
        }

        const candidatesCount = 10; // Reduzido para performance
        let bestCandidate: number[] | null = null;
        let bestScore = -Infinity;

        for (let c = 0; c < candidatesCount; c++) {
            const weightedPool = [...poolNumbers].map(n => ({
                n,
                weight: (1 / (usageCounts[n] + 1)) + (Math.random() * 0.8) 
            })).sort((a, b) => b.weight - a.weight);

            const candidate = weightedPool.slice(0, gameSize).map(x => x.n).sort((a, b) => a - b);
            const sig = JSON.stringify(candidate);

            if (excludedSignatures && excludedSignatures.has(sig)) continue;
            if (games.some(g => JSON.stringify(g) === sig)) continue;

            let minDistance = gameSize; 
            let maxOverlapFound = 0;

            for (const existingGame of games) {
                const intersection = calculateIntersection(candidate, existingGame);
                if (intersection > maxOverlapFound) maxOverlapFound = intersection;
                const distance = gameSize - intersection;
                if (distance < minDistance) minDistance = distance;
            }

            let score = minDistance * 10;
            if (games.length === 0) score = Math.random();
            if (games.length > 0 && maxOverlapFound > maxOverlapAllowed) score -= 1000; 
            
            if (score > bestScore) {
                bestScore = score;
                bestCandidate = candidate;
            }
        }

        if (bestCandidate) {
            const sig = JSON.stringify(bestCandidate);
            const isDuplicate = games.some(g => JSON.stringify(g) === sig);
            const isExcluded = excludedSignatures ? excludedSignatures.has(sig) : false;

            if (!isDuplicate && !isExcluded) {
                let maxOverlap = 0;
                if (games.length > 0) {
                     maxOverlap = Math.max(...games.map(g => calculateIntersection(g, bestCandidate!)));
                }

                if (maxOverlap <= maxOverlapAllowed || attempts > (limit * 20)) {
                    games.push(bestCandidate);
                    bestCandidate.forEach(n => usageCounts[n]++);
                } else {
                    if (attempts % 50 === 0 && maxOverlapAllowed < gameSize - 1) {
                        maxOverlapAllowed++;
                    }
                }
            }
        }
    }
    
    // Fill remaining if needed
    if (games.length < limit) {
         const remaining = limit - games.length;
         const uniqueSet = new Set(games.map(g => JSON.stringify(g)));
         let safetyLoop = 0;
         while(games.length < limit && safetyLoop < (remaining * 200)) {
            safetyLoop++;
            if (safetyLoop % 50 === 0) await yieldToMain();
            
            const shuffled = [...poolNumbers].sort(() => 0.5 - Math.random());
            const fallback = shuffled.slice(0, gameSize).sort((a,b)=>a-b);
            const sig = JSON.stringify(fallback);
            
            if (!uniqueSet.has(sig) && (!excludedSignatures || !excludedSignatures.has(sig))) {
                games.push(fallback);
                uniqueSet.add(sig);
            }
         }
    }

    return games;
};

export const generateSmartPatternGames = async (
    sourceNumbers: number[],
    totalGames: number,
    gameSize: number,
    gameConfig: GameConfig,
    previousResultDezenas?: number[],
    excludedSignatures?: Set<string>,
    onProgress?: (percent: number) => void
): Promise<number[][]> => {
    const games: number[][] = [];
    const maxAttempts = totalGames * 2000; 
    let attempts = 0;

    const hasPreviousData = previousResultDezenas && previousResultDezenas.length > 0;
    const baseResult = hasPreviousData ? previousResultDezenas! : [];

    const sourceSet = new Set(sourceNumbers);
    const availableFromLast = baseResult.filter(n => sourceSet.has(n));
    const availableOthers = sourceNumbers.filter(n => !baseResult.includes(n));

    const rules = {
        minSum: 180, maxSum: 220,
        minOdd: 7, maxOdd: 9,
        minPrimes: 4, maxPrimes: 6,
        repeats: [8, 9, 10]
    };

    if (gameConfig.id !== 'lotofacil') {
        rules.minSum = 0; rules.maxSum = 9999;
        rules.minOdd = 0; rules.maxOdd = gameSize;
        rules.minPrimes = 0; rules.maxPrimes = gameSize;
        rules.repeats = [];
    }

    while (games.length < totalGames && attempts < maxAttempts) {
        attempts++;
        if (attempts % 200 === 0) {
            await yieldToMain();
            if (onProgress) onProgress(Math.min(99, Math.floor((games.length / totalGames) * 100)));
        }

        let candidate: number[] = [];

        if (gameConfig.id === 'lotofacil' && hasPreviousData) {
            const r = Math.random();
            let targetRepeats = 9;
            if (r < 0.25) targetRepeats = 8;
            else if (r > 0.75) targetRepeats = 10;

            const actualRepeats = Math.min(targetRepeats, availableFromLast.length);
            const neededOthers = gameSize - actualRepeats;

            if (neededOthers <= availableOthers.length && neededOthers >= 0) {
                 const pickedLast = [...availableFromLast].sort(() => 0.5 - Math.random()).slice(0, actualRepeats);
                 const pickedOthers = [...availableOthers].sort(() => 0.5 - Math.random()).slice(0, neededOthers);
                 candidate = [...pickedLast, ...pickedOthers].sort((a, b) => a - b);
            } else {
                candidate = [...sourceNumbers].sort(() => 0.5 - Math.random()).slice(0, gameSize).sort((a, b) => a - b);
            }
        } else {
             candidate = [...sourceNumbers].sort(() => 0.5 - Math.random()).slice(0, gameSize).sort((a, b) => a - b);
        }

        if (candidate.length === gameSize) {
            const sig = JSON.stringify(candidate);
            if (excludedSignatures && excludedSignatures.has(sig)) continue;
            if (games.some(g => JSON.stringify(g) === sig)) continue;

            const stats = getStats(candidate);
            const detailed = calculateDetailedStats(candidate, baseResult, gameConfig);
            let isValid = true;

            if (stats.sum < rules.minSum || stats.sum > rules.maxSum) isValid = false;
            if (isValid && (detailed.impares < rules.minOdd || detailed.impares > rules.maxOdd)) isValid = false;
            
            if (isValid && gameConfig.id === 'lotofacil') {
                if (detailed.primos < rules.minPrimes || detailed.primos > rules.maxPrimes) isValid = false;
            }
            if (isValid && hasLongSequence(candidate, gameConfig.id === 'lotofacil' ? 5 : 2)) isValid = false;

            if (isValid) {
                games.push(candidate);
            }
        }
    }

    // Fill remaining
    if (games.length < totalGames) {
        const remaining = totalGames - games.length;
        for(let i=0; i<remaining; i++) {
             if (i % 20 === 0) await yieldToMain();
             const fallback = [...sourceNumbers].sort(() => 0.5 - Math.random()).slice(0, gameSize).sort((a, b) => a - b);
             const sig = JSON.stringify(fallback);
             if (excludedSignatures && excludedSignatures.has(sig)) continue;
             if (!games.some(g => JSON.stringify(g) === sig)) {
                 games.push(fallback);
             }
        }
    }
    return games;
};

export const filterGamesWithWinners = (history: PastGameResult[]): PastGameResult[] => {
  return history.filter(game => {
    if (game.premiacoes && game.premiacoes.length > 0) {
        return game.premiacoes[0].ganhadores > 0;
    }
    return true; 
  });
};

const getMolduraSet = (game: GameConfig): Set<number> => {
  if (MOLDURA_CACHE[game.id]) return MOLDURA_CACHE[game.id];

  const set = new Set<number>();
  const isZeroBased = game.id === 'lotomania' || game.id === 'supersete'; 
  const start = isZeroBased ? 0 : 1;
  const end = isZeroBased ? (game.totalNumbers - 1) : game.totalNumbers;
  const cols = game.cols;
  const totalRows = Math.ceil(game.totalNumbers / cols);

  for (let n = start; n <= end; n++) {
    const offset = isZeroBased ? n : n - 1;
    const row = Math.floor(offset / cols);
    const col = offset % cols;

    const isTop = row === 0;
    const isBottom = row === totalRows - 1;
    const isLeft = col === 0;
    const isRight = col === cols - 1;

    if (isTop || isBottom || isLeft || isRight) {
      set.add(n);
    }
  }

  MOLDURA_CACHE[game.id] = set;
  return set;
};

export const getStats = (game: number[]) => {
  const evens = game.filter(n => n % 2 === 0).length;
  const odds = game.length - evens;
  const sum = game.reduce((a, b) => a + b, 0);
  return { evens, odds, sum };
};

export const calculateDetailedStats = (numbers: number[], previousNumbers: number[] | undefined, gameConfig: GameConfig): DetailedStats => {
  if (gameConfig.id === 'federal') {
      return {
          pares: 0, impares: 0, soma: 0, media: '-', desvioPadrao: '-',
          primos: 0, fibonacci: 0, multiplos3: 0, moldura: 0, centro: 0, triangulares: 0, repetidos: '-'
      };
  }

  const isSuperSete = gameConfig.id === 'supersete';
  const values = isSuperSete ? numbers.map(n => n % 10) : numbers.map(Number);
  
  const sum = values.reduce((a, b) => a + b, 0);
  const evens = values.filter(n => n % 2 === 0).length;
  
  const mean = sum / values.length;
  const variance = values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);
  
  let repetidos: number | string = '-';
  if (previousNumbers && previousNumbers.length > 0) {
     const prevSet = new Set(previousNumbers.map(Number));
     const numsToCheck = numbers.map(Number);
     repetidos = numsToCheck.filter(n => prevSet.has(n)).length;
  }

  const molduraSet = getMolduraSet(gameConfig);
  const countMoldura = numbers.filter(n => molduraSet.has(n)).length;
  const countCentro = numbers.length - countMoldura;

  return {
    pares: evens,
    impares: values.length - evens,
    soma: sum,
    media: mean.toFixed(2).replace('.', ','),
    desvioPadrao: stdDev.toFixed(2).replace('.', ','),
    primos: values.filter(n => PRIMES.has(n)).length,
    fibonacci: values.filter(n => FIBONACCI.has(n)).length,
    multiplos3: values.filter(n => n % 3 === 0).length,
    moldura: countMoldura,
    centro: countCentro,
    triangulares: values.filter(n => TRIANGULARES.has(n)).length,
    repetidos: repetidos
  };
};

// HELPER: Validação visual de status ideal
export const getBalanceStatus = (val: number, min: number, max: number): 'ideal' | 'warn' | 'bad' => {
    if (val >= min && val <= max) return 'ideal';
    if (val >= min - 1 && val <= max + 1) return 'warn';
    return 'bad';
};

// IO: Índice de Otimização (Score 0-100)
export const calculateGameScore = (game: number[], gameConfig: GameConfig, previousNumbers?: number[]): number => {
    let score = 100; 
    const stats = calculateDetailedStats(game, previousNumbers, gameConfig);

    // Regras Genéricas de Sequência
    if (gameConfig.id !== 'lotofacil' && gameConfig.id !== 'lotomania') {
        if (hasLongSequence(game, 2)) score -= 25; 
        if (hasLongSequence(game, 3)) score -= 50; 
    } else if (gameConfig.id === 'lotofacil') {
        if (hasLongSequence(game, 5)) score -= 30; // Sequências > 5 são raras na lotofácil (mas acontecem)
    }

    if (gameConfig.id === 'lotofacil') {
        // Ímpares: Ideal 7-9
        if (stats.impares < 6 || stats.impares > 9) score -= 30; 
        else if (stats.impares === 7 || stats.impares === 9) { score -= 5; } // 8 é o rei
        else { score += 5; }

        // Soma: Ideal 180-220
        if (stats.soma < 180 || stats.soma > 220) score -= 30;
        else if (stats.soma >= 195 && stats.soma <= 205) score += 5; 

        // Repetidos (se disponível): Ideal 8-10
        if (typeof stats.repetidos === 'number') {
            if (stats.repetidos === 9) score += 10; 
            else if (stats.repetidos === 8 || stats.repetidos === 10) score += 5; 
            else if (stats.repetidos < 7 || stats.repetidos > 11) score -= 40; 
        }

        // Primos: Ideal 4-6
        if (stats.primos < 4 || stats.primos > 6) score -= 20;

        // Moldura: Ideal 9-11
        if (stats.moldura < 8 || stats.moldura > 12) score -= 20;

    } else if (gameConfig.id === 'megasena') {
        // Pares: Ideal 2-4
        if (stats.pares < 2 || stats.pares > 4) score -= 20;
        
        // Soma: Ideal 120-250 (Filtro amplo da Gaussiana)
        if (stats.soma < 120 || stats.soma > 250) score -= 25;
        
        // Quadrantes
        const quads = getQuadrantDistribution(game, 60);
        if (quads.some(q => q > 3)) score -= 20; // Concentração ruim
        if (quads.filter(q => q === 0).length >= 2) score -= 15; // Buracos no volante
    } else if (gameConfig.id === 'quina') {
        if (stats.soma < 100 || stats.soma > 300) score -= 25;
        if (hasLongSequence(game, 1)) score -= 15; 
    }

    return Math.max(0, Math.min(100, score));
};

export const GAME_YEAR_STARTS: Record<string, Record<number, number>> = {
  lotofacil: { 2003: 1, 2024: 2993, 2025: 3282 },
  megasena: { 1996: 1, 2024: 2671, 2025: 2814 },
  quina: { 1994: 1, 2024: 6330, 2025: 6620 },
  lotomania: { 1999: 1, 2024: 2568, 2025: 2718 },
  diadesorte: { 2018: 1, 2024: 858, 2025: 1015 },
  duplasena: { 2001: 1, 2024: 2636, 2025: 2780 },
  supersete: { 2020: 1, 2024: 492, 2025: 642 },
  federal: { 2015: 1, 2024: 5829, 2025: 5930 }
};

export const getYearsList = (startYear: number = 2003) => {
  const currentYear = new Date().getFullYear();
  const years = [];
  for (let y = startYear; y <= currentYear; y++) {
    years.push(y);
  }
  return years.reverse(); 
};
