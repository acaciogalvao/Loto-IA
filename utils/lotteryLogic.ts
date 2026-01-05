
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
        case 'timemania': 
            // 3, 4, 5 são fixos. 6, 7 são rateio.
            return [3, 4, 5].includes(hits);
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
    
    // Se encontrou a faixa na lista de premiações
    if (pEntry) {
        // CASO 1: Existem ganhadores (ou a API reporta valor na faixa)
        if (pEntry.ganhadores > 0 || pEntry.valor > 0) {
            // CORREÇÃO SOLICITADA: O valor retornado pela API já é considerado o prêmio individual (ou o usuário deseja visualizar o pote total como prêmio)
            // Não realizamos mais a divisão (val / pEntry.ganhadores).
            return Number(pEntry.valor) || 0;
        }

        // CASO 2: ACUMULOU (0 Ganhadores Oficiais e valor zerado na faixa de rateio)
        // O simulador assume que se o usuário jogou e acertou, ele ganharia o prêmio acumulado.
        if (pEntry.ganhadores === 0) {
            // Verifica se é a faixa principal do jogo para pegar o valor acumulado
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
const hasLongSequence = (numbers: number[], maxAllowed: number = 2): boolean => {
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

// Helper simples para fatorial/combinação aproximada
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

export const generateReducedClosing = (
    poolNumbers: number[],
    gameSize: number,
    guaranteeThreshold: number,
    maxGames: number = 2000,
    excludedSignatures?: Set<string>
): number[][] => {
    if (poolNumbers.length <= gameSize) return [[...poolNumbers]];

    const totalCombinationsPossible = combinationsCount(poolNumbers.length, gameSize);
    
    if (totalCombinationsPossible <= 10000) {
        let allCombinations = generateCombinations(poolNumbers, gameSize);
        if (excludedSignatures && excludedSignatures.size > 0) {
            allCombinations = allCombinations.filter(g => !excludedSignatures.has(JSON.stringify(g)));
        }

        allCombinations.sort((a, b) => {
            const statsA = getStats(a);
            const statsB = getStats(b);
            const diffA = Math.abs(statsA.evens - statsA.odds);
            const diffB = Math.abs(statsB.evens - statsB.odds);
            const sumDistA = Math.abs(statsA.sum - 200);
            const sumDistB = Math.abs(statsB.sum - 200);
            return (diffA + sumDistA * 0.1) - (diffB + sumDistB * 0.1);
        });

        const selectedGames: number[][] = [];
        for (let i = 0; i < allCombinations.length; i++) {
            const candidate = allCombinations[i];
            let isCovered = false;
            for (const picked of selectedGames) {
                const hits = calculateIntersection(picked, candidate);
                if (hits >= guaranteeThreshold) {
                    isCovered = true;
                    break;
                }
            }
            if (!isCovered) {
                selectedGames.push(candidate);
                if (selectedGames.length >= maxGames) break;
            }
        }
        return selectedGames;
    }

    const reducedGames: number[][] = [];
    const pool = [...poolNumbers];
    const numberCounts: Record<number, number> = {};
    pool.forEach(n => numberCounts[n] = 0);

    let attempts = 0;
    const maxAttempts = maxGames * 100;

    while (reducedGames.length < maxGames && attempts < maxAttempts) {
        attempts++;
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

export const generateMathematicalClosing = (
    poolNumbers: number[],
    gameSize: number,
    limit: number,
    excludedSignatures?: Set<string>
): number[][] => {
    const games: number[][] = [];
    const usageCounts: Record<number, number> = {};
    poolNumbers.forEach(n => usageCounts[n] = 0);

    const maxPossibilities = combinationsCount(poolNumbers.length, gameSize);
    const alreadyExcludedCount = excludedSignatures ? excludedSignatures.size : 0;
    const remainingPossibilities = Math.max(0, maxPossibilities - alreadyExcludedCount);
    const targetLimit = Math.min(limit, remainingPossibilities);

    let maxOverlapAllowed = Math.max(2, gameSize - 3); 
    if (poolNumbers.length <= gameSize + 2) maxOverlapAllowed = gameSize - 1;
    else if (poolNumbers.length <= gameSize + 4) maxOverlapAllowed = gameSize - 2;

    let attempts = 0;
    const maxAttempts = limit * 500; 

    while (games.length < targetLimit && attempts < maxAttempts) {
        attempts++;
        const candidatesCount = 20; 
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
            const stats = getStats(candidate);
            const oddEvenDiff = Math.abs(stats.evens - stats.odds);
            score -= oddEvenDiff;

            if (score > bestScore) {
                bestScore = score;
                bestCandidate = candidate;
            }
        }

        if (bestCandidate) {
            const sig = JSON.stringify(bestCandidate);
            const isDuplicate = games.some(g => JSON.stringify(g) === sig);
            const isExcluded = excludedSignatures ? excludedSignatures.has(sig) : false;

            if (isDuplicate || isExcluded) continue;

            let maxOverlap = 0;
            if (games.length > 0) {
                 maxOverlap = Math.max(...games.map(g => calculateIntersection(g, bestCandidate!)));
            }

            const relaxRules = attempts > (limit * 20); 
            
            if (maxOverlap <= maxOverlapAllowed || relaxRules) {
                games.push(bestCandidate);
                bestCandidate.forEach(n => usageCounts[n]++);
            } else {
                if (attempts % 50 === 0 && maxOverlapAllowed < gameSize - 1) {
                    maxOverlapAllowed++;
                }
            }
        }
    }

    if (games.length < targetLimit) {
         const remaining = targetLimit - games.length;
         const uniqueSet = new Set(games.map(g => JSON.stringify(g)));
         
         let safetyLoop = 0;
         while(games.length < targetLimit && safetyLoop < (remaining * 200)) {
            safetyLoop++;
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

export const generateGuaranteedClosing = (
    poolNumbers: number[],
    gameSize: number,
    targetHits: number, 
    maxGamesLimit: number = 100 
): number[][] => {
    return generateMathematicalClosing(poolNumbers, gameSize, maxGamesLimit);
};

export const generateSmartPatternGames = (
    sourceNumbers: number[],
    totalGames: number,
    gameSize: number,
    gameConfig: GameConfig,
    previousResultDezenas?: number[],
    excludedSignatures?: Set<string>
): number[][] => {
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

    if (games.length < totalGames) {
        const remaining = totalGames - games.length;
        for(let i=0; i<remaining; i++) {
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

export const calculateGameScore = (game: number[], gameConfig: GameConfig, previousNumbers?: number[]): number => {
    let score = 100; 
    const stats = calculateDetailedStats(game, previousNumbers, gameConfig);

    if (gameConfig.id !== 'lotofacil' && gameConfig.id !== 'lotomania') {
        if (hasLongSequence(game, 2)) score -= 30; 
        if (hasLongSequence(game, 3)) score -= 50; 
    }

    if (gameConfig.id === 'lotofacil') {
        if (stats.impares < 6 || stats.impares > 9) score -= 40; 
        else if (stats.impares === 7 || stats.impares === 8) { score += 5; } 
        else score -= 5;

        if (stats.soma < 180 || stats.soma > 220) score -= 40;
        else if (stats.soma >= 190 && stats.soma <= 210) score += 10; 

        if (typeof stats.repetidos === 'number') {
            if (stats.repetidos === 9) score += 20; 
            else if (stats.repetidos === 8 || stats.repetidos === 10) score += 10; 
            else if (stats.repetidos < 7 || stats.repetidos > 11) score -= 50; 
        }
        if (stats.primos < 4 || stats.primos > 6) score -= 20;
        if (stats.moldura < 8 || stats.moldura > 12) score -= 10;

    } else if (gameConfig.id === 'megasena') {
        if (stats.pares < 2 || stats.pares > 4) score -= 20;
        if (stats.soma < 120 || stats.soma > 250) score -= 30;
        const quads = getQuadrantDistribution(game, 60);
        if (quads.some(q => q > 3)) score -= 30; 
        if (quads.filter(q => q === 0).length >= 2) score -= 20; 
    } else if (gameConfig.id === 'quina') {
        if (stats.soma < 100 || stats.soma > 300) score -= 30;
        if (hasLongSequence(game, 1)) score -= 15; 
    }

    return Math.max(0, Math.min(100, score));
};

export const GAME_YEAR_STARTS: Record<string, Record<number, number>> = {
  lotofacil: { 2003: 1, 2024: 2993, 2025: 3282 },
  megasena: { 1996: 1, 2024: 2671, 2025: 2814 },
  quina: { 1994: 1, 2024: 6330, 2025: 6620 },
  lotomania: { 1999: 1, 2024: 2568, 2025: 2718 },
  timemania: { 2008: 1, 2024: 2036, 2025: 2188 },
  diadesorte: { 2018: 1, 2024: 858, 2025: 1015 },
  duplasena: { 2001: 1, 2024: 2636, 2025: 2780 },
  maismilionaria: { 2022: 1, 2024: 110, 2025: 190 },
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
