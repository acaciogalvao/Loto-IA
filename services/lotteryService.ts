
import { LotteryResult, PastGameResult, PrizeEntry } from '../types';
import { getStoredResults, saveStoredResults } from './storageService';
import { supabase } from './supabaseClient'; // Ensure supabase is imported here if used directly, or logic remains in storageService

const API_URL = 'https://api.guidi.dev.br/loteria';

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
    data: data.dataApuracao || '',
    dezenas: Array.isArray(data.listaDezenas) ? data.listaDezenas : [], // Defensive
    acumulou: data.acumulado,
    ganhadores15: premios.find(p => p.faixa === 15)?.ganhadores || 0,
    proximoConcurso: data.numeroConcursoProximo,
    dataProximoConcurso: data.dataProximoConcurso || '',
    valorEstimadoProximoConcurso: data.valorEstimadoProximoConcurso || 0,
    valorAcumuladoProximoConcurso: data.valorAcumuladoProximoConcurso || 0,
    valorAcumulado: data.valorAcumuladoConcurso_0_5 || 0,
    valorAcumuladoEspecial: data.valorAcumuladoConcursoEspecial || 0,
    valorArrecadado: data.valorArrecadado || 0, // Mapeamento direto
    premiacoes: premios,
    timeCoracao: data.nomeTimeCoracao // Mapeamento Timemania
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
    console.error("Erro ao buscar último resultado (Possível problema de CORS ou API fora do ar):", error);
    return null;
  }
};

export const fetchResultByConcurso = async (gameSlug: string, concurso: number): Promise<PastGameResult | null> => {
  try {
    // 1. Tenta buscar no cache do Supabase primeiro (para buscas avulsas)
    const dbResults = await getStoredResults(gameSlug, concurso, concurso);
    if (dbResults.length > 0) {
        return dbResults[0];
    }

    // 2. Se não tem, busca na API
    const response = await fetchWithRetry(`${API_URL}/${gameSlug}/${concurso}`);
    if (!response.ok) return null;
    const data = await response.json();
    const result = mapApiToResult(data, gameSlug);
    
    const pastResult: PastGameResult = {
        concurso: result.concurso,
        data: result.data,
        dezenas: result.dezenas,
        premiacoes: result.premiacoes,
        valorAcumulado: result.valorAcumulado,
        valorEstimadoProximoConcurso: result.valorEstimadoProximoConcurso,
        valorArrecadado: result.valorArrecadado,
        timeCoracao: result.timeCoracao
    };

    // 3. Salva no Supabase para o futuro (Fire & Forget)
    saveStoredResults(gameSlug, [pastResult]);

    return pastResult;
  } catch (error) {
    console.error(`Erro ao buscar concurso ${concurso}:`, error);
    return null;
  }
};

// --- NOVA LÓGICA DE FETCHING OTIMIZADA (STREAMING) ---

const fetchFromApiBatch = async (
    gameSlug: string, 
    concursos: number[], 
    onDataReceived?: (data: PastGameResult[]) => void,
    onProgress?: (percent: number) => void
): Promise<PastGameResult[]> => {
    const results: PastGameResult[] = [];
    let completed = 0;
    const total = concursos.length;

    // PERFORMANCE: Aumentado para 80 para velocidade extrema
    const CHUNK_SIZE = 80; 
    
    for (let i = 0; i < concursos.length; i += CHUNK_SIZE) {
        const chunk = concursos.slice(i, i + CHUNK_SIZE);
        
        // Executa em paralelo real
        const promises = chunk.map(concurso => 
            fetchWithRetry(`${API_URL}/${gameSlug}/${concurso}`, 1, 300)
                .then(res => res.ok ? res.json() : null)
                .catch(() => null)
        );

        const dataChunk = await Promise.all(promises);
        const validChunkResults: PastGameResult[] = [];
        
        dataChunk.forEach(data => {
            if (data) {
                const result = mapApiToResult(data, gameSlug);
                const pastResult = {
                    concurso: result.concurso,
                    data: result.data,
                    dezenas: result.dezenas,
                    premiacoes: result.premiacoes,
                    valorAcumulado: result.valorAcumulado,
                    valorEstimadoProximoConcurso: result.valorEstimadoProximoConcurso,
                    valorArrecadado: result.valorArrecadado,
                    timeCoracao: result.timeCoracao
                };
                validChunkResults.push(pastResult);
                results.push(pastResult);
            }
        });

        // 1. Envia dados para a UI imediatamente (Streaming)
        if (validChunkResults.length > 0 && onDataReceived) {
            onDataReceived(validChunkResults);
        }

        // 2. Salva INCREMENTALMENTE (Background)
        if (validChunkResults.length > 0) {
            saveStoredResults(gameSlug, validChunkResults).catch(err => console.error("Background save failed", err));
        }

        completed += chunk.length;
        if (onProgress) onProgress(Math.floor((completed / total) * 100));
    }
    
    return results;
};

export const fetchResultsRange = async (
    gameSlug: string, 
    startConcurso: number, 
    endConcurso: number,
    onProgress?: (percent: number) => void,
    onNewData?: (data: PastGameResult[]) => void // Novo callback para streaming
): Promise<PastGameResult[]> => {
  
  if (onProgress) onProgress(5);

  // 1. Busca TUDO o que temos no Banco/Local
  const dbResults = await getStoredResults(gameSlug, startConcurso, endConcurso);
  
  // Entrega o que já temos IMEDIATAMENTE
  if (dbResults.length > 0 && onNewData) {
      onNewData(dbResults);
  }

  const dbConcursosSet = new Set(dbResults.map(r => r.concurso));

  // 2. Identifica buracos
  const missingConcursos: number[] = [];
  for (let c = startConcurso; c <= endConcurso; c++) {
      if (!dbConcursosSet.has(c)) {
          missingConcursos.push(c);
      }
  }

  // Se já temos tudo, finaliza
  if (missingConcursos.length === 0) {
      if (onProgress) onProgress(100);
      return dbResults.sort((a, b) => b.concurso - a.concurso);
  }

  // 3. Busca apenas os que faltam na API externa com STREAMING
  const apiResults = await fetchFromApiBatch(
      gameSlug, 
      missingConcursos, 
      (chunkData) => {
          // Repassa chunks da API para a UI assim que chegam
          if (onNewData) onNewData(chunkData);
      },
      (apiProg) => {
          if (onProgress) onProgress(10 + Math.floor(apiProg * 0.90));
      }
  );

  // 5. Retorna combinado (apenas para consistência, pois a UI já foi atualizada via callback)
  const combined = [...dbResults, ...apiResults].sort((a, b) => b.concurso - a.concurso);
  
  if (onProgress) onProgress(100);
  return combined;
};

// Deprecated in favor of fetchResultsRange logic, but kept for compatibility
export const fetchPastResults = async (gameSlug: string, latestConcurso: number, limit: number): Promise<PastGameResult[]> => {
    const start = Math.max(1, latestConcurso - limit + 1);
    return fetchResultsRange(gameSlug, start, latestConcurso);
};
