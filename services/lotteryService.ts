
import { LotteryResult, PastGameResult, PrizeEntry } from '../types';

const API_URL = 'https://api.guidi.dev.br/loteria';

const mapApiToResult = (data: any, gameSlug: string): LotteryResult => {
  // Mapping logic for Guidi API
  const premios: PrizeEntry[] = (data.listaRateioPremio || []).map((p: any) => {
    // CORREÇÃO CRÍTICA: A API pode retornar 'faixa' como índice (1, 2, 3...) 
    // mas precisamos do número de acertos (15, 14, 13...).
    // Priorizamos extrair o número da descrição (ex: "15 acertos").
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

export const getFullHistoryWithCache = async (
    gameSlug: string, 
    latestConcurso: number, 
    onProgress?: (percent: number) => void
): Promise<PastGameResult[]> => {
    if (onProgress) onProgress(100);
    return [];
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
  
  // Buscar em lotes para não sobrecarregar a API
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
      
      // Pequeno delay para evitar rate limiting severo
      await new Promise(r => setTimeout(r, 100));
  }

  // Ordenar decrescente (mais recente primeiro)
  return results.sort((a, b) => b.concurso - a.concurso);
};

export const fetchPastResults = async (gameSlug: string, latestConcurso: number, limit: number): Promise<PastGameResult[]> => {
  return [];
};
