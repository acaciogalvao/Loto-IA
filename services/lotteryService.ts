import { LotteryResult, PastGameResult, PrizeEntry } from '../types';

const BASE_API_URL = 'https://api.guidi.dev.br/loteria';

// Helper function to calculate next draw date if API fails
const calculateNextDrawDate = (lastDateStr: string): string => {
  if (!lastDateStr) return "";
  
  try {
    const parts = lastDateStr.split('/');
    if (parts.length !== 3) return "";
    
    // Parse DD/MM/YYYY
    const lastDate = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
    const nextDate = new Date(lastDate);
    // Simple approximation: add 1 day (logic varies per game, keeping it simple)
    nextDate.setDate(lastDate.getDate() + 1);

    // Format back to DD/MM/YYYY
    const d = nextDate.getDate().toString().padStart(2, '0');
    const m = (nextDate.getMonth() + 1).toString().padStart(2, '0');
    const y = nextDate.getFullYear();
    
    return `${d}/${m}/${y}`;
  } catch (e) {
    return "";
  }
};

const parsePremiacoes = (data: any, gameSlug: string): PrizeEntry[] => {
  // Support both 'premiacoes' (old API) and 'listaRateioPremio' (new API)
  const items = data.premiacoes || data.listaRateioPremio || [];
  if (!Array.isArray(items)) return [];

  const parsed: PrizeEntry[] = [];
  
  items.forEach((p: any) => {
    let acertos = p.acertos || p.faixa; // New API uses 'faixa' as number of hits for most games
    
    // Tenta extrair de descricao_faixa ou descricaoFaixa
    if (!acertos && (p.descricao_faixa || p.descricaoFaixa)) {
      const desc = p.descricao_faixa || p.descricaoFaixa;
      const match = desc.match(/(\d+)\s*acertos/i);
      if (match) {
        acertos = parseInt(match[1], 10);
      }
    }
    
    // Fallbacks baseados no tipo de jogo se a faixa for numérica simples (1, 2, 3...)
    // E.g. Mega Sena faixa 1 = Sena (6 acertos)
    if (typeof p.faixa === 'number' && !p.acertos) {
        if (gameSlug === 'lotofacil' && p.faixa <= 5) acertos = 16 - p.faixa;
        else if (gameSlug === 'megasena' && p.faixa === 1) acertos = 6;
        else if (gameSlug === 'megasena' && p.faixa === 2) acertos = 5;
        else if (gameSlug === 'megasena' && p.faixa === 3) acertos = 4;
        else if (gameSlug === 'supersete' && p.faixa === 1) acertos = 7;
        else if (gameSlug === 'supersete' && p.faixa === 2) acertos = 6;
        else if (gameSlug === 'supersete' && p.faixa === 3) acertos = 5;
        else if (gameSlug === 'supersete' && p.faixa === 4) acertos = 4;
        else if (gameSlug === 'supersete' && p.faixa === 5) acertos = 3;
        else acertos = p.faixa; // Default assumption for new API
    }

    const rawWinners = p.ganhadores ?? p.vencedores ?? p.numero_ganhadores ?? p.numeroDeGanhadores ?? 0;
    const winners = parseInt(String(rawWinners), 10);

    const rawValue = p.valor_premio ?? p.premio ?? p.valor_total ?? p.valorPremio ?? 0;
    let value = 0;
    if (typeof rawValue === 'string') {
        value = parseFloat(rawValue.replace('R$', '').replace(/\./g, '').replace(',', '.').trim());
    } else {
        value = Number(rawValue);
    }

    // Include if it looks like a valid prize tier
    parsed.push({
      faixa: acertos || 0,
      ganhadores: isNaN(winners) ? 0 : winners,
      valor: isNaN(value) ? 0 : value
    });
  });

  // Sort by highest matches first (descending)
  return parsed.sort((a, b) => b.faixa - a.faixa);
};

const normalizeResult = (data: any, gameSlug: string): LotteryResult => {
    // Mapping for Guidi API vs Legacy API
    // Ensure concurso is an integer to prevent string arithmetic issues
    const concurso = parseInt(String(data.concurso || data.numero), 10);
    const dataApuracao = data.data || data.dataApuracao;
    
    // Normalização das Dezenas
    let dezenas = data.dezenas || data.listaDezenas || data.dezenasSorteadasOrdemSorteio || [];
    
    // Special handling for Super Sete
    // Convert ["1", "0", ...] to IDs ["1", "10", ...]
    if (gameSlug === 'supersete' && Array.isArray(dezenas)) {
        dezenas = dezenas.map((val: string, index: number) => {
             const numVal = parseInt(val, 10);
             const id = index * 10 + numVal;
             return id.toString();
        });
    }

    const acumulou = data.acumulou === true || data.acumulado === true;
    
    const premiacoes = parsePremiacoes(data, gameSlug);
    let ganhadoresMax = 0;
    if (premiacoes.length > 0) {
        ganhadoresMax = premiacoes[0].ganhadores;
    }

    const nextDate = data.data_proximo_concurso || data.dataProximoConcurso || calculateNextDrawDate(dataApuracao);
    const nextConcurso = parseInt(String(data.proximo_concurso || data.proximoConcurso), 10) || (concurso + 1);
    
    const valorEstimado = data.valor_estimado_proximo_concurso || data.valorEstimadoProximoConcurso || 0;
    const valorAcumuladoProx = data.valor_acumulado_proximo_concurso || data.valorAcumuladoProximoConcurso || 0;
    const valorAcumuladoAtual = data.valor_acumulado || data.valorAcumulado || 0;
    const valorAcumuladoEspecial = data.valor_acumulado_concurso_especial || data.valorAcumuladoConcursoEspecial || 0;

    return {
      concurso,
      data: dataApuracao,
      dezenas,
      acumulou,
      ganhadores15: ganhadoresMax,
      proximoConcurso: nextConcurso,
      dataProximoConcurso: nextDate,
      valorEstimadoProximoConcurso: valorEstimado,
      valorAcumuladoProximoConcurso: valorAcumuladoProx,
      valorAcumulado: valorAcumuladoAtual,
      valorAcumuladoEspecial: valorAcumuladoEspecial,
      premiacoes: premiacoes
    };
};

export const fetchLatestResult = async (gameSlug: string): Promise<LotteryResult | null> => {
  try {
    // Guidi API: /loteria/lotofacil/ultimo
    const response = await fetch(`${BASE_API_URL}/${gameSlug}/ultimo`);
    if (!response.ok) {
      throw new Error('Falha ao buscar resultados');
    }
    const data = await response.json();
    return normalizeResult(data, gameSlug);

  } catch (error) {
    console.error(`Erro ao buscar resultado da ${gameSlug}:`, error);
    return null;
  }
};

// Range fetch
export const fetchResultsRange = async (gameSlug: string, startConcurso: number, endConcurso: number): Promise<PastGameResult[]> => {
  const promises = [];
  const results: PastGameResult[] = [];

  for (let i = startConcurso; i <= endConcurso; i++) {
    // Guidi API: /loteria/lotofacil/3000
    const p = fetch(`${BASE_API_URL}/${gameSlug}/${i}`)
      .then(res => {
        if (!res.ok) return null;
        return res.json();
      })
      .catch(err => {
        return null;
      });
    promises.push(p);
  }

  const responses = await Promise.all(promises);

  responses.forEach(data => {
      if (data) {
        const normalized = normalizeResult(data, gameSlug);
        results.push({
          concurso: normalized.concurso,
          dezenas: normalized.dezenas,
          data: normalized.data,
          premiacoes: normalized.premiacoes
        });
      }
  });
  
  return results.sort((a, b) => b.concurso - a.concurso);
};

export const fetchPastResults = async (gameSlug: string, latestConcurso: number, limit: number): Promise<PastGameResult[]> => {
  const end = latestConcurso;
  const start = Math.max(1, latestConcurso - limit + 1);
  return fetchResultsRange(gameSlug, start, end);
};