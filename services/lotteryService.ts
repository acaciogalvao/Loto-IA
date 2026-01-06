
import { LotteryResult, PastGameResult, PrizeEntry } from '../types';

const API_URL = 'https://api.guidi.dev.br/loteria';

const mapApiToResult = (data: any, gameSlug: string): LotteryResult => {
  // Mapping logic for Guidi API
  const premios: PrizeEntry[] = (data.listaRateioPremio || []).map((p: any) => {
    let faixa = p.faixa; 
    
    // Tenta extrair número da faixa da descrição se não vier no campo
    if (p.descricaoFaixa) {
        const match = p.descricaoFaixa.match(/(\d+)/);
        if (match) {
            faixa = parseInt(match[1], 10);
        }
    }
    
    return {
        faixa,
        ganhadores: p.numeroDeGanhadores,
        valor: p.valorPremio,
        bilhete: p.descricaoFaixa,
        locais: [] // Inicializa vazio, será preenchido abaixo com dados da raiz
    };
  }).sort((a: PrizeEntry, b: PrizeEntry) => a.faixa - b.faixa); 

  // --- CORREÇÃO DE LOCALIZAÇÃO ---
  // A lista de ganhadores vem na raiz do objeto e refere-se à faixa principal.
  const locaisGanhadores = (data.listaMunicipioUFGanhadores || []).map((m: any) => ({
      cidade: m.municipio,
      uf: m.uf,
      ganhadores: m.ganhadores || 1
  }));

  if (locaisGanhadores.length > 0 && premios.length > 0) {
      // Identifica a faixa principal para atribuir os locais
      let faixaPrincipal: PrizeEntry | undefined;

      if (gameSlug === 'federal') {
          // Na federal, o 1º prêmio (faixa 1) é o principal
          faixaPrincipal = premios.find(p => p.faixa === 1);
      } else {
          // Nas outras (Lotofácil, Mega, etc), a maior faixa numérica é a principal.
          // Como o array 'premios' está ordenado ascendente por faixa, pegamos o último item.
          // (Ex: Lotofácil vai de 11 a 15, o último é 15).
          faixaPrincipal = premios[premios.length - 1];
      }

      if (faixaPrincipal) {
          faixaPrincipal.locais = locaisGanhadores;
      }
  }
  // -------------------------------

  return {
    concurso: data.numero,
    data: data.dataApuracao,
    dezenas: data.listaDezenas,
    acumulou: data.acumulado,
    ganhadores15: premios.find(p => p.faixa === 15)?.ganhadores || 0,
    proximoConcurso: data.numeroConcursoProximo,
    dataProximoConcurso: data.dataProximoConcurso,
    valorEstimadoProximoConcurso: data.valorEstimadoProximoConcurso,
    valorAcumuladoProximoConcurso: data.valorAcumuladoProximoConcurso,
    valorAcumulado: data.valorAcumuladoConcurso_0_5 || 0,
    valorAcumuladoEspecial: data.valorAcumuladoConcursoEspecial || 0,
    valorArrecadado: data.valorArrecadado || 0, // Mapeamento direto
    premiacoes: premios
  };
};

export const fetchLatestResult = async (gameSlug: string): Promise<LotteryResult | null> => {
  try {
    const response = await fetch(`${API_URL}/${gameSlug}/ultimo`);
    if (!response.ok) {
        console.warn(`API responded with status: ${response.status}`);
        throw new Error('Network response was not ok');
    }
    const data = await response.json();
    return mapApiToResult(data, gameSlug);
  } catch (error) {
    console.error("Erro ao buscar último resultado (Possível problema de CORS ou API fora do ar):", error);
    return null;
  }
};

export const fetchResultByConcurso = async (gameSlug: string, concurso: number): Promise<PastGameResult | null> => {
  try {
    const response = await fetch(`${API_URL}/${gameSlug}/${concurso}`);
    if (!response.ok) return null;
    const data = await response.json();
    const result = mapApiToResult(data, gameSlug);
    return {
        concurso: result.concurso,
        data: result.data,
        dezenas: result.dezenas,
        premiacoes: result.premiacoes,
        valorAcumulado: result.valorAcumulado,
        valorEstimadoProximoConcurso: result.valorEstimadoProximoConcurso,
        valorArrecadado: result.valorArrecadado
    };
  } catch (error) {
    console.error(`Erro ao buscar concurso ${concurso}:`, error);
    return null;
  }
};

// CACHE KEY ATUALIZADA PARA V4
export const getFullHistoryWithCache = async (
    gameSlug: string, 
    latestConcurso: number, 
    onProgress?: (percent: number) => void
): Promise<PastGameResult[]> => {
    const CACHE_KEY = `lotosmart_history_v4_${gameSlug}`; // V4 para invalidar caches antigos sem arrecadação
    
    let cachedHistory: PastGameResult[] = [];
    try {
        const stored = localStorage.getItem(CACHE_KEY);
        if (stored) {
            cachedHistory = JSON.parse(stored);
        }
    } catch (e) {
        console.warn("Erro ao ler cache de histórico", e);
    }

    cachedHistory.sort((a, b) => b.concurso - a.concurso);
    const lastCachedConcurso = cachedHistory.length > 0 ? cachedHistory[0].concurso : 0;
    
    if (lastCachedConcurso >= latestConcurso) {
        if(onProgress) onProgress(100);
        return cachedHistory;
    }

    const startFetch = lastCachedConcurso + 1;
    const endFetch = latestConcurso;
    const SAFE_LIMIT = 200;
    const effectiveEnd = Math.min(endFetch, startFetch + SAFE_LIMIT);
    
    const newResults = await fetchResultsRange(gameSlug, startFetch, effectiveEnd, onProgress);
    const combinedHistory = [...newResults, ...cachedHistory].sort((a, b) => b.concurso - a.concurso);
    
    try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(combinedHistory));
    } catch (e) {
        console.error("Storage Full - Could not cache full history", e);
    }

    return combinedHistory;
};

export const fetchResultsRange = async (
    gameSlug: string, 
    startConcurso: number, 
    endConcurso: number,
    onProgress?: (percent: number) => void
): Promise<PastGameResult[]> => {
  const results: PastGameResult[] = [];
  const total = endConcurso - startConcurso + 1;
  let completed = 0;
  const BATCH_SIZE = 5; 
  
  for (let i = startConcurso; i <= endConcurso; i += BATCH_SIZE) {
      const batchPromises = [];
      for (let j = 0; j < BATCH_SIZE; j++) {
          const current = i + j;
          if (current > endConcurso) break;
          batchPromises.push(fetchResultByConcurso(gameSlug, current));
      }
      
      try {
        const batchResults = await Promise.all(batchPromises);
        batchResults.forEach(res => {
            if (res) results.push(res);
        });
      } catch (e) {
        console.error("Erro no lote de requisições", e);
      }
      
      completed += batchPromises.length;
      if (onProgress) onProgress(Math.floor((completed / total) * 100));
      await new Promise(r => setTimeout(r, 150));
  }

  return results.sort((a, b) => b.concurso - a.concurso);
};

export const fetchPastResults = async (gameSlug: string, latestConcurso: number, limit: number): Promise<PastGameResult[]> => {
    const start = Math.max(1, latestConcurso - limit + 1);
    return fetchResultsRange(gameSlug, start, latestConcurso);
};
