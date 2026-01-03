import { LotteryResult, PastGameResult, PrizeEntry, WinnerLocation } from '../types';

const BASE_API_URL = 'https://api.guidi.dev.br/loteria';
const HISTORY_CACHE_KEY_PREFIX = 'lotosmart_history_v2_';

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
    
    // Fallbacks baseados no tipo de jogo
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
    
    // Campo específico da Federal
    const bilhete = p.bilhete ? String(parseInt(String(p.bilhete), 10)) : undefined;

    // --- EXTRAÇÃO DE LOCAIS (CIDADES/ESTADOS) ---
    // A API é inconsistente. Aqui tentamos todas as variações conhecidas.
    let locais: WinnerLocation[] = [];
    
    // 1. Lista explicita
    const rawLocais = p.listaMunicipioUFGanhadores || p.locais || p.cidades || [];
    
    if (Array.isArray(rawLocais) && rawLocais.length > 0) {
        locais = rawLocais.map((l: any) => ({
            cidade: (l.municipio || l.nomeMunicipio || l.cidade || l.nome || 'Indefinido').trim(),
            uf: (l.uf || l.siglaUF || l.estado || '--').trim().toUpperCase(),
            ganhadores: parseInt(l.ganhadores || l.quantidade || '1', 10)
        })).filter(l => l.cidade !== '' && l.cidade !== 'Indefinido');
    } 
    // 2. Objeto único no próprio prêmio (comum quando há 1 ganhador)
    else if (p.municipio || p.nomeMunicipio) {
         locais.push({
             cidade: (p.municipio || p.nomeMunicipio).trim(),
             uf: (p.uf || p.siglaUF || '--').trim().toUpperCase(),
             ganhadores: winners // Assume que todos são dessa cidade se não for array, ou 1
         });
    }
    // 3. Campo observação que as vezes contém a cidade (API legado)
    else if (winners > 0 && typeof p.observacao === 'string' && p.observacao.includes('/')) {
         // Tenta extrair "CIDADE/UF" de strings simples
         const parts = p.observacao.split('/');
         if (parts.length === 2 && parts[1].length === 2) {
             locais.push({
                 cidade: parts[0].trim(),
                 uf: parts[1].trim().toUpperCase(),
                 ganhadores: winners
             });
         }
    }

    // Include if it looks like a valid prize tier
    parsed.push({
      faixa: acertos || 0,
      ganhadores: isNaN(winners) ? 0 : winners,
      valor: isNaN(value) ? 0 : value,
      bilhete: bilhete,
      locais: locais.length > 0 ? locais : undefined
    });
  });

  // Sort by highest matches first (descending), except Federal (ascending by faixa/prize)
  if (gameSlug === 'federal') {
      return parsed.sort((a, b) => a.faixa - b.faixa);
  }
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
    
    // FEDERAL: Se 'dezenas' vier vazio (comum na API para Federal), popula com os bilhetes premiados
    if (gameSlug === 'federal' && (!dezenas || dezenas.length === 0)) {
        dezenas = premiacoes.filter(p => p.bilhete).map(p => p.bilhete as string);
    } else if (gameSlug === 'federal' && dezenas.length > 0) {
        // Garante que dezenas da Federal também não tenham zeros a esquerda
        dezenas = dezenas.map((d: string | number) => String(parseInt(String(d), 10)));
    }

    const nextDate = data.data_proximo_concurso || data.dataProximoConcurso || calculateNextDrawDate(dataApuracao);
    const nextConcurso = parseInt(String(data.proximo_concurso || data.proximoConcurso), 10) || (concurso + 1);
    
    const valorEstimado = data.valor_estimado_proximo_concurso || data.valorEstimadoProximoConcurso || 0;
    const valorAcumuladoProx = data.valor_acumulado_proximo_concurso || data.valorAcumuladoProximoConcurso || 0;
    const valorAcumuladoAtual = data.valor_acumulado || data.valorAcumulado || 0;
    const valorAcumuladoEspecial = data.valor_acumulado_concurso_especial || data.valorAcumuladoConcursoEspecial || 0;

    // --- NOVA TENTATIVA DE EXTRAIR LOCAIS DO NÍVEL RAIZ SE NÃO ESTIVEREM NAS PREMIAÇÕES ---
    // Algumas APIs colocam 'locais' na raiz do objeto de retorno, não dentro de 'premiacoes'
    if (data.locais && Array.isArray(data.locais) && premiacoes.length > 0) {
        // Assume que os locais da raiz pertencem à faixa principal (index 0)
        if (!premiacoes[0].locais) {
             premiacoes[0].locais = data.locais.map((l: any) => ({
                cidade: (l.municipio || l.cidade).trim(),
                uf: (l.uf || l.estado).trim().toUpperCase(),
                ganhadores: parseInt(l.ganhadores || '1', 10)
             }));
        }
    }

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
    const timestamp = new Date().getTime();
    const response = await fetch(`${BASE_API_URL}/${gameSlug}/ultimo?t=${timestamp}`);
    
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

/**
 * CACHED FULL HISTORY FETCH
 * Verifica o LocalStorage antes de bater na API.
 */
export const getFullHistoryWithCache = async (
    gameSlug: string, 
    latestConcurso: number, 
    onProgress?: (percent: number) => void
): Promise<PastGameResult[]> => {
    
    const cacheKey = `${HISTORY_CACHE_KEY_PREFIX}${gameSlug}`;
    
    // 1. Tentar carregar do cache
    let cachedHistory: PastGameResult[] = [];
    try {
        const raw = localStorage.getItem(cacheKey);
        if (raw) {
            cachedHistory = JSON.parse(raw);
        }
    } catch (e) {
        console.warn("Erro ao ler cache de histórico", e);
    }

    // Ordenar para garantir integridade
    cachedHistory.sort((a, b) => a.concurso - b.concurso);

    // 2. Verificar qual o último concurso que temos
    const lastStoredConcurso = cachedHistory.length > 0 
        ? cachedHistory[cachedHistory.length - 1].concurso 
        : 0;

    // Se já temos tudo (ou até mais, caso a API esteja atrasada em relação ao último), retorna
    if (lastStoredConcurso >= latestConcurso) {
        if (onProgress) onProgress(100);
        return cachedHistory;
    }

    // 3. Buscar apenas o diferencial (delta)
    const startFetch = lastStoredConcurso + 1;
    
    // Se precisar buscar muitos, avisa via callback
    const totalToFetch = latestConcurso - startFetch + 1;
    
    const newResults = await fetchResultsRange(gameSlug, startFetch, latestConcurso, (prog) => {
        if (onProgress) {
            // Normaliza o progresso do fetch (0-100)
            onProgress(prog);
        }
    });

    // 4. Mesclar e Salvar
    const fullHistory = [...cachedHistory, ...newResults].sort((a, b) => a.concurso - b.concurso);
    
    try {
        localStorage.setItem(cacheKey, JSON.stringify(fullHistory));
    } catch (e) {
        console.error("Cache cheio! Não foi possível salvar o histórico completo.", e);
        // Tenta salvar pelo menos os últimos 1000 se falhar
        if (fullHistory.length > 1000) {
             try {
                 const sliced = fullHistory.slice(fullHistory.length - 1000);
                 localStorage.setItem(cacheKey, JSON.stringify(sliced));
             } catch(e2) {}
        }
    }

    return fullHistory;
};

// Optimized Range fetch with higher concurrency
export const fetchResultsRange = async (
    gameSlug: string, 
    startConcurso: number, 
    endConcurso: number,
    onProgress?: (percentage: number) => void
): Promise<PastGameResult[]> => {
  const results: PastGameResult[] = [];
  // AUMENTADO: Concorrência de 5 para 15
  const concurrencyLimit = 15; 
  // REDUZIDO: Delay de 50ms para 10ms
  const delayMs = 10; 
  const timestamp = new Date().getTime();

  // Generate list of IDs to fetch
  const idsToFetch = [];
  for (let i = startConcurso; i <= endConcurso; i++) {
    idsToFetch.push(i);
  }

  const totalBatches = Math.ceil(idsToFetch.length / concurrencyLimit);

  // Process in chunks
  for (let i = 0; i < idsToFetch.length; i += concurrencyLimit) {
    const chunk = idsToFetch.slice(i, i + concurrencyLimit);
    const promises = chunk.map(id => 
       fetch(`${BASE_API_URL}/${gameSlug}/${id}?t=${timestamp}`)
        .then(res => {
          if (!res.ok) return null;
          return res.json();
        })
        .catch(() => null)
    );

    const chunkResults = await Promise.all(promises);
    
    chunkResults.forEach(data => {
      if (data) {
        try {
          const normalized = normalizeResult(data, gameSlug);
          results.push({
            concurso: normalized.concurso,
            dezenas: normalized.dezenas,
            data: normalized.data,
            premiacoes: normalized.premiacoes
          });
        } catch (e) {
          console.warn("Error normalizing data", e);
        }
      }
    });

    if (onProgress) {
        const currentBatch = Math.floor(i / concurrencyLimit) + 1;
        const percent = Math.min(100, Math.round((currentBatch / totalBatches) * 100));
        onProgress(percent);
    }

    // Small delay between chunks to avoid rate limiting
    if (i + concurrencyLimit < idsToFetch.length) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  return results.sort((a, b) => b.concurso - a.concurso);
};

export const fetchPastResults = async (gameSlug: string, latestConcurso: number, limit: number): Promise<PastGameResult[]> => {
  const end = latestConcurso;
  const start = Math.max(1, latestConcurso - limit + 1);
  return fetchResultsRange(gameSlug, start, end);
};