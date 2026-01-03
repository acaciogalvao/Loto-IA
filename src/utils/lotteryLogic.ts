import { PastGameResult, DetailedStats, GameConfig } from "../types";

/**
 * Combinatorial generator.
 * AMPLIFICADO: Aumentado o limite para permitir geração massiva em memória (Virtual DB)
 */
export const generateCombinations = (sourceNumbers: number[], combinationSize: number): number[][] => {
  const result: number[][] = [];
  const sortedSource = [...sourceNumbers].sort((a, b) => a - b);
  // Limite de segurança aumentado para 500.000 para permitir "Banco de Dados Virtual"
  // O navegador aguenta processar isso na memória, só não aguenta renderizar no HTML.
  const MAX_COMBINATIONS = 500000;
  
  function combine(start: number, currentCombo: number[]) {
    if (result.length >= MAX_COMBINATIONS) return;

    if (currentCombo.length === combinationSize) {
      result.push([...currentCombo]);
      return;
    }

    for (let i = start; i < sortedSource.length; i++) {
      currentCombo.push(sortedSource[i]);
      combine(i + 1, currentCombo);
      currentCombo.pop();
    }
  }

  combine(0, []);
  return result;
};

export const generateBalancedMatrix = (sourceNumbers: number[], totalGames: number, gameSize: number): number[][] => {
  if (sourceNumbers.length < gameSize) return [];
  
  const sortedSource = [...sourceNumbers].sort((a, b) => a - b);
  const games: number[][] = [];
  const numbersCount = sortedSource.length;
  
  const targetOccurrences = Math.ceil((gameSize * totalGames) / numbersCount);
  let pool: number[] = [];
  
  for (let i = 0; i < numbersCount; i++) {
    for (let k = 0; k < targetOccurrences; k++) {
      pool.push(sortedSource[i]);
    }
  }

  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  let poolIndex = 0;
  for (let g = 0; g < totalGames; g++) {
    const gameSet = new Set<number>();
    
    // Safety break
    let safety = 0;
    while (gameSet.size < gameSize && safety < 1000) {
      safety++;
      if (poolIndex >= pool.length) {
        poolIndex = 0; 
        for (let i = sortedSource.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [sortedSource[i], sortedSource[j]] = [sortedSource[j], sortedSource[i]];
        }
      }
      
      const num = pool[poolIndex];
      poolIndex++;
      
      if (!gameSet.has(num)) {
        gameSet.add(num);
      }
    }
    
    games.push(Array.from(gameSet).sort((a, b) => a - b));
  }

  return games;
};

export const calculateHotNumbers = (pastResults: PastGameResult[], topN: number = 20): number[] => {
  const frequency: Record<number, number> = {};

  pastResults.forEach(result => {
    result.dezenas.forEach(d => {
      const num = parseInt(d, 10);
      if (!isNaN(num)) {
        frequency[num] = (frequency[num] || 0) + 1;
      }
    });
  });

  const sortedNumbers = Object.entries(frequency)
    .map(([num, count]) => ({ num: parseInt(num), count }))
    .sort((a, b) => b.count - a.count) 
    .slice(0, topN) 
    .map(obj => obj.num)
    .sort((a, b) => a - b); 

  return sortedNumbers;
};

// --- MATH & STATS HELPERS ---

const PRIMES = new Set([
  2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97
]);

const FIBONACCI = new Set([0, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89]);

const TRIANGULARES = new Set([0, 1, 3, 6, 10, 15, 21, 28, 36, 45, 55, 66, 78, 91]);

const MOLDURA_CACHE: Record<string, Set<number>> = {};

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

export const getStats = (game: number[]): { evens: number; odds: number; sum: number } => {
  const evens = game.filter(n => n % 2 === 0).length;
  const odds = game.length - evens;
  const sum = game.reduce((a, b) => a + b, 0);
  return { evens, odds, sum };
};

export const calculateDetailedStats = (numbers: number[], previousNumbers: number[] | undefined, gameConfig: GameConfig): DetailedStats => {
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

/**
 * --- SISTEMA DE PONTUAÇÃO (AI FILTER) ---
 * Analisa um jogo e dá uma nota de 0 a 100 baseada na probabilidade estatística de ser premiado.
 * AGORA EXPORTADA PARA USO NA UI
 */
export const calculateGameScore = (game: number[], gameConfig: GameConfig, previousNumbers?: number[]): number => {
    let score = 95; // Base alta, penaliza desvios
    const stats = calculateDetailedStats(game, previousNumbers, gameConfig);

    // 1. ANÁLISE LOTOFÁCIL (Padrão de Ouro)
    if (gameConfig.id === 'lotofacil') {
        // Pares/Ímpares (Ideal: 7/8 ou 8/7)
        if (stats.impares < 5 || stats.impares > 10) score -= 25;
        if (stats.impares === 7 || stats.impares === 8) score += 5;

        // Soma (Ideal: 180 a 220)
        if (stats.soma < 170 || stats.soma > 230) score -= 15;
        if (stats.soma >= 190 && stats.soma <= 210) score += 5;

        // Primos (Ideal: 4 a 6)
        if (stats.primos < 3 || stats.primos > 7) score -= 10;

        // Repetidos (Ideal: 8 a 10)
        if (typeof stats.repetidos === 'number') {
            if (stats.repetidos < 7 || stats.repetidos > 11) score -= 15;
            if (stats.repetidos >= 8 && stats.repetidos <= 10) score += 5;
        }
    }
    
    // 2. ANÁLISE MEGA SENA
    else if (gameConfig.id === 'megasena') {
        // Pares (Ideal 3/3 ou 4/2)
        if (stats.pares < 2 || stats.pares > 4) score -= 15;
        // Soma (Ideal 150-250)
        if (stats.soma < 120 || stats.soma > 280) score -= 15;
    }

    // Normaliza para 1-99%
    const finalScore = Math.min(99, Math.max(40, score));
    // Adiciona uma pequena variância determinística baseada na soma para não ficarem todos iguais visualmente
    const variance = (stats.soma % 5); 
    
    return Math.min(99, finalScore - variance);
};

/**
 * FILTRO INTELIGENTE
 * Recebe milhares de jogos (Virtual DB) e retorna apenas os melhores.
 */
export const filterBestGames = (
  allGames: number[][], 
  gameConfig: GameConfig, 
  previousNumbers: number[] | undefined,
  limit: number = 20
): { games: number[][], originalCount: number } => {
    
    // 1. Calcula score para todos
    const scoredGames = allGames.map(game => ({
        game,
        score: calculateGameScore(game, gameConfig, previousNumbers)
    }));

    // 2. Ordena pelos melhores scores
    scoredGames.sort((a, b) => b.score - a.score);

    // 3. Pega os 'limit' melhores
    const topGames = scoredGames.slice(0, limit).map(sg => sg.game);

    return {
        games: topGames,
        originalCount: allGames.length
    };
};


// --- YEAR MAPPING ---
export const GAME_YEAR_STARTS: Record<string, Record<number, number>> = {
  lotofacil: {
    2003: 1, 2004: 18, 2005: 71, 2006: 124, 2007: 177, 2008: 285, 2009: 393, 2010: 501, 2011: 609, 2012: 717,
    2013: 864, 2014: 1011, 2015: 1162, 2016: 1315, 2017: 1466, 2018: 1618, 2019: 1769, 2020: 1913,
    2021: 2123, 2022: 2412, 2023: 2703, 2024: 2993, 2025: 3282
  },
  megasena: {
    1996: 1, 1997: 44, 1998: 96, 1999: 148, 2000: 200, 2001: 253, 2002: 331, 2003: 436, 2004: 526, 
    2005: 631, 2006: 733, 2007: 836, 2008: 937, 2009: 1041, 2010: 1146, 2011: 1246, 2012: 1351, 
    2013: 1456, 2014: 1561, 2015: 1666, 2016: 1776, 2017: 1891, 2018: 2001, 2019: 2111, 2020: 2221, 
    2021: 2331, 2022: 2441, 2023: 2551, 2024: 2671, 2025: 2814
  },
  quina: {
    1994: 1, 1995: 57, 1996: 161, 1997: 265, 1998: 368, 1999: 472, 2000: 641, 2001: 809, 2002: 976,
    2003: 1086, 2004: 1241, 2005: 1395, 2006: 1547, 2007: 1700, 2008: 1850, 2009: 2000, 2010: 2185,
    2011: 2486, 2012: 2785, 2013: 3086, 2014: 3385, 2015: 3683, 2016: 3973, 2017: 4273, 2018: 4571,
    2019: 4865, 2020: 5160, 2021: 5456, 2022: 5744, 2023: 6040, 2024: 6330, 2025: 6620
  },
  lotomania: {
    1999: 1, 2000: 16, 2001: 69, 2002: 172, 2003: 275, 2004: 379, 2005: 483, 2006: 586, 2007: 690,
    2008: 793, 2009: 896, 2010: 1000, 2011: 1104, 2012: 1208, 2013: 1312, 2014: 1414, 2015: 1518,
    2016: 1621, 2017: 1724, 2018: 1828, 2019: 1932, 2020: 2036, 2021: 2141, 2022: 2257, 2023: 2413,
    2024: 2568, 2025: 2718
  },
  timemania: {
    2008: 1, 2009: 46, 2010: 98, 2011: 172, 2012: 276, 2013: 380, 2014: 527, 2015: 672, 2016: 825,
    2017: 978, 2018: 1127, 2019: 1276, 2020: 1427, 2021: 1584, 2022: 1733, 2023: 1881, 2024: 2036,
    2025: 2188
  },
  diadesorte: {
    2018: 1, 2019: 98, 2020: 247, 2021: 402, 2022: 551, 2023: 703, 2024: 858, 2025: 1015
  },
  duplasena: {
    2001: 1, 2002: 15, 2003: 114, 2004: 220, 2005: 325, 2006: 428, 2007: 533, 2008: 636,
    2009: 742, 2010: 846, 2011: 950, 2012: 1054, 2013: 1158, 2014: 1261, 2015: 1365,
    2016: 1470, 2017: 1618, 2018: 1765, 2019: 1913, 2020: 2061, 2021: 2197, 2022: 2343,
    2023: 2490, 2024: 2636, 2025: 2780
  },
  maismilionaria: {
    2022: 1, 2023: 32, 2024: 110, 2025: 190
  },
  supersete: {
    2020: 1, 2021: 39, 2022: 190, 2023: 342, 2024: 492, 2025: 642
  }
};

// Export for compatibility
export const LOTOFACIL_YEAR_START = GAME_YEAR_STARTS.lotofacil;

export const getYearsList = (startYear: number = 2003) => {
  const currentYear = new Date().getFullYear();
  const years = [];
  for (let y = startYear; y <= currentYear; y++) {
    years.push(y);
  }
  return years.reverse(); 
};