
import { LotteryResult, PastGameResult, PrizeEntry, WinnerLocation } from '../types';

const API_URL = 'https://api.guidi.dev.br/loteria';
const BACKUP_API_URL = 'https://loteriascaixa-api.herokuapp.com/api';

// Helper robusto para fetch com retry e backoff exponencial
const fetchWithRetry = async (url: string, retries = 3, backoff = 1000): Promise<Response> => {
    try {
        const response = await fetch(url);
        // Tenta novamente se for erro de servidor (5xx) ou Too Many Requests (429)
        if (response.status === 429 || response.status >= 500) {
             throw new Error(`Server returned status ${response.status}`);
        }
        return response;
    } catch (err) {
        if (retries > 0) {
            // Se for erro de rede (Failed to fetch) ou status temporário, espera e tenta de novo
            await new Promise(r => setTimeout(r, backoff));
            return fetchWithRetry(url, retries - 1, backoff * 1.5);
        }
        throw err;
    }
};

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
  const locaisGanhadores: WinnerLocation[] = (data.listaMunicipioUFGanhadores || []).map((m: any) => ({
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
    valorArrecadado: data.valorArrecadado || 0,
    premiacoes: premios
  };
};

/**
 * Mapeia o resultado da API de Backup (Heroku) para o formato interno
 */
const mapBackupApiToResult = (data: any): PastGameResult => {
    const premios: PrizeEntry[] = (data.premiacoes || []).map((p: any) => ({
        faixa: p.faixa,
        ganhadores: p.ganhadores,
        valor: p.valorPremio,
        bilhete: p.descricao,
        locais: []
    }));

    const locaisGanhadores: WinnerLocation[] = (data.localGanhadores || []).map((l: any) => ({
        cidade: l.municipio,
        uf: l.uf,
        ganhadores: l.ganhadores || 1
    }));

    // Atribui locais à faixa principal (geralmente faixa 1 na API Heroku)
    if (locaisGanhadores.length > 0 && premios.length > 0) {
        const principal = premios.find(p => p.faixa === 1) || premios[0];
        if (principal) principal.locais = locaisGanhadores;
    }

    return {
        concurso: data.concurso,
        data: data.data,
        dezenas: data.dezenas,
        premiacoes: premios,
        valorAcumulado: data.valorAcumuladoConcurso_0_5,
        valorEstimadoProximoConcurso: data.valorEstimadoProximoConcurso,
        valorArrecadado: data.valorArrecadado
    };
};

export const fetchLatestResult = async (gameSlug: string): Promise<LotteryResult | null> => {
  try {
    const response = await fetchWithRetry(`${API_URL}/${gameSlug}/ultimo`);
    if (!response.ok) {
        console.warn(`API responded with status: ${response.status}`);
        throw new Error('Network response was not ok');
    }
    const data = await response.json();
    return mapApiToResult(data, gameSlug);
  } catch (error) {
    console.error("Erro ao buscar último resultado:", error);
    return null;
  }
};

export const fetchResultByConcurso = async (gameSlug: string, concurso: number): Promise<PastGameResult | null> => {
  try {
    // Tenta API principal
    const response = await fetchWithRetry(`${API_URL}/${gameSlug}/${concurso}`);
    if (response.ok) {
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
    }
    
    // Fallback para API de Backup
    const backupResponse = await fetchWithRetry(`${BACKUP_API_URL}/${gameSlug}/${concurso}`);
    if (backupResponse.ok) {
        const data = await backupResponse.json();
        return mapBackupApiToResult(data);
    }

    return null;
  } catch (error) {
    console.error(`Erro ao buscar concurso ${concurso}:`, error);
    return null;
  }
};

// CACHE KEY ATUALIZADA PARA V5 (Com suporte a localização aprimorado)
export const getFullHistoryWithCache = async (
    gameSlug: string, 
    latestConcurso: number, 
    onProgress?: (percent: number) => void
): Promise<PastGameResult[]> => {
    const CACHE_KEY = `lotosmart_history_v5_${gameSlug}`;
    
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
    
    // Otimização: Se faltar muito dado, busca em lotes maiores
    const newResults = await fetchResultsRange(gameSlug, startFetch, endFetch, onProgress);
    const combinedHistory = [...newResults, ...cachedHistory].sort((a, b) => b.concurso - a.concurso);
    
    try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(combinedHistory));
    } catch (e) {
        console.error("Storage Full - Could not cache full history", e);
        // Se o cache estiver cheio, mantém apenas os últimos 500 resultados para não quebrar o app
        const limitedHistory = combinedHistory.slice(0, 500);
        try { localStorage.setItem(CACHE_KEY, JSON.stringify(limitedHistory)); } catch(e2) {}
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
  
  // OTIMIZAÇÃO: Aumentado para 10 requisições paralelas
  const BATCH_SIZE = 10; 
  
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
      
      // OTIMIZAÇÃO: Reduzido delay para 50ms (apenas para evitar bloqueio de thread)
      if (i + BATCH_SIZE <= endConcurso) {
          await new Promise(r => setTimeout(r, 50));
      }
  }

  return results.sort((a, b) => b.concurso - a.concurso);
};

export const fetchPastResults = async (gameSlug: string, latestConcurso: number, limit: number): Promise<PastGameResult[]> => {
    const start = Math.max(1, latestConcurso - limit + 1);
    return fetchResultsRange(gameSlug, start, latestConcurso);
};
