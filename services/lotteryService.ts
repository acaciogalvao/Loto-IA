
import { LotteryResult, PastGameResult, PrizeEntry } from '../types';

const API_URL = 'https://api.guidi.dev.br/loteria';

const mapApiToResult = (data: any, gameSlug: string): LotteryResult => {
  // Mapping logic for Guidi API
  const premios: PrizeEntry[] = (data.listaRateioPremio || []).map((p: any) => {
    let faixa = p.faixa; 
    
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
        locais: (p.listaMunicipio || []).map((m: any) => ({
            cidade: m.municipio,
            uf: m.uf,
            ganhadores: 1 
        }))
    };
  });

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
    premiacoes: premios
  };
};

export const fetchLatestResult = async (gameSlug: string): Promise<LotteryResult | null> => {
  try {
    const response = await fetch(`${API_URL}/${gameSlug}/ultimo`);
    if (!response.ok) throw new Error('Network response was not ok');
    const data = await response.json();
    return mapApiToResult(data, gameSlug);
  } catch (error) {
    console.error("Erro ao buscar último resultado:", error);
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
        valorEstimadoProximoConcurso: result.valorEstimadoProximoConcurso
    };
  } catch (error) {
    console.error(`Erro ao buscar concurso ${concurso}:`, error);
    return null;
  }
};

/**
 * Busca histórico completo com estratégia de Cache Inteligente (Delta Fetch).
 * 1. Carrega do LocalStorage.
 * 2. Identifica o último concurso salvo.
 * 3. Busca apenas os concursos faltantes até o latestConcurso.
 * 4. Salva e retorna tudo.
 */
export const getFullHistoryWithCache = async (
    gameSlug: string, 
    latestConcurso: number, 
    onProgress?: (percent: number) => void
): Promise<PastGameResult[]> => {
    const CACHE_KEY = `lotosmart_history_v2_${gameSlug}`;
    
    // 1. Tenta carregar do cache
    let cachedHistory: PastGameResult[] = [];
    try {
        const stored = localStorage.getItem(CACHE_KEY);
        if (stored) {
            cachedHistory = JSON.parse(stored);
        }
    } catch (e) {
        console.warn("Erro ao ler cache de histórico", e);
    }

    // Ordena por segurança (decrescente)
    cachedHistory.sort((a, b) => b.concurso - a.concurso);

    // Identifica o gap
    const lastCachedConcurso = cachedHistory.length > 0 ? cachedHistory[0].concurso : 0;
    
    if (lastCachedConcurso >= latestConcurso) {
        if(onProgress) onProgress(100);
        return cachedHistory;
    }

    const startFetch = lastCachedConcurso + 1;
    const endFetch = latestConcurso;
    const totalToFetch = endFetch - startFetch + 1;

    // Se o gap for muito grande, limitamos para não bloquear o app (ex: 200 por vez)
    // O usuário terá que rodar a análise algumas vezes para preencher tudo se estiver muito desatualizado
    const SAFE_LIMIT = 200;
    const effectiveEnd = Math.min(endFetch, startFetch + SAFE_LIMIT);
    
    console.log(`Fetching history gap: ${startFetch} to ${effectiveEnd} (${totalToFetch} missing)`);

    // Busca o Delta usando fetchResultsRange
    const newResults = await fetchResultsRange(gameSlug, startFetch, effectiveEnd, onProgress);
    
    // Merge
    const combinedHistory = [...newResults, ...cachedHistory].sort((a, b) => b.concurso - a.concurso);
    
    // Salva no cache
    try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(combinedHistory));
    } catch (e) {
        console.error("Storage Full - Could not cache full history", e);
        // Se falhar o save, ainda retorna os dados em memória
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
      
      // Delay para rate limiting
      await new Promise(r => setTimeout(r, 150));
  }

  return results.sort((a, b) => b.concurso - a.concurso);
};

export const fetchPastResults = async (gameSlug: string, latestConcurso: number, limit: number): Promise<PastGameResult[]> => {
    // Wrapper simples para fetchResultsRange reverso
    const start = Math.max(1, latestConcurso - limit + 1);
    return fetchResultsRange(gameSlug, start, latestConcurso);
};
