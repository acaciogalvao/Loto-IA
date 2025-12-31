import { LotteryResult, PastGameResult, PrizeEntry } from '../types';

const API_URL = 'https://loteriascaixa-api.herokuapp.com/api/lotofacil';

// Helper function to calculate next draw date if API fails
// Lotofácil draws are Mon, Tue, Wed, Thu, Fri, Sat (exclude Sundays)
const calculateNextDrawDate = (lastDateStr: string): string => {
  if (!lastDateStr) return "";
  
  try {
    const parts = lastDateStr.split('/');
    if (parts.length !== 3) return "";
    
    // Parse DD/MM/YYYY
    const lastDate = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
    const nextDate = new Date(lastDate);
    const dayOfWeek = lastDate.getDay(); // 0=Sun, 6=Sat

    if (dayOfWeek === 6) { 
      // If Saturday, next is Monday (+2 days)
      nextDate.setDate(lastDate.getDate() + 2);
    } else {
      // Mon-Fri -> Next Day
      nextDate.setDate(lastDate.getDate() + 1);
    }

    // Format back to DD/MM/YYYY
    const d = nextDate.getDate().toString().padStart(2, '0');
    const m = (nextDate.getMonth() + 1).toString().padStart(2, '0');
    const y = nextDate.getFullYear();
    
    return `${d}/${m}/${y}`;
  } catch (e) {
    return "";
  }
};

export const fetchLatestResult = async (): Promise<LotteryResult | null> => {
  try {
    const response = await fetch(`${API_URL}/latest`);
    if (!response.ok) {
      throw new Error('Falha ao buscar resultados');
    }
    const data = await response.json();
    
    // Parse winners for all tiers (11 to 15)
    const premiacoes: PrizeEntry[] = [];
    let ganhadores15 = 0;

    if (data.premiacoes && Array.isArray(data.premiacoes)) {
      data.premiacoes.forEach((p: any) => {
        let faixa = p.acertos;
        
        // Sometimes API returns "faixa": "15 acertos" instead of "acertos": 15
        if (!faixa && typeof p.faixa === 'string') {
           const match = p.faixa.match(/(\d+)/);
           if (match) faixa = parseInt(match[1], 10);
        }

        // Normalize winners count keys (ganhadores or vencedores)
        const winners = p.ganhadores ?? p.vencedores ?? 0;
        
        // Normalize prize value keys
        const value = p.valor_premio ?? p.premio ?? 0;

        if (faixa >= 11 && faixa <= 15) {
          premiacoes.push({
            faixa: faixa,
            ganhadores: winners,
            valor: value
          });

          if (faixa === 15) {
            ganhadores15 = winners;
          }
        }
      });
    }

    // Sort prizes by tier descending (15 -> 11)
    premiacoes.sort((a, b) => b.faixa - a.faixa);

    // Robust Date Handling: If API returns null, calculate based on draw date
    const nextDate = data.data_proximo_concurso || data.data_prox_concurso || calculateNextDrawDate(data.data);

    return {
      concurso: data.concurso,
      data: data.data,
      dezenas: data.dezenas,
      acumulou: data.acumulou,
      ganhadores15: ganhadores15,
      proximoConcurso: data.proximo_concurso || (data.concurso + 1),
      dataProximoConcurso: nextDate,
      valorEstimadoProximoConcurso: data.valor_estimado_proximo_concurso,
      premiacoes: premiacoes
    };
  } catch (error) {
    console.error("Erro ao buscar resultado da loteria:", error);
    return null;
  }
};

export const fetchPastResults = async (latestConcurso: number, limit: number): Promise<PastGameResult[]> => {
  const results: PastGameResult[] = [];
  const promises = [];

  // Limit concurrency/requests to avoid issues. 
  for (let i = 1; i <= limit; i++) {
    const concurso = latestConcurso - i;
    if (concurso < 1) break;
    
    const p = fetch(`${API_URL}/${concurso}`)
      .then(res => {
        if (!res.ok) return null;
        return res.json();
      })
      .catch(err => {
        console.warn(`Failed to fetch concurso ${concurso}`, err);
        return null;
      });
      
    promises.push(p);
  }

  const responses = await Promise.all(promises);
  
  responses.forEach(data => {
    if (data) {
      // Extract 15 pointers
      let ganhadores15 = 0;
      if (data.premiacoes && Array.isArray(data.premiacoes)) {
        data.premiacoes.forEach((p: any) => {
          let faixa = p.acertos;
           if (!faixa && typeof p.faixa === 'string') {
             const match = p.faixa.match(/(\d+)/);
             if (match) faixa = parseInt(match[1], 10);
          }
          if (faixa === 15) {
            ganhadores15 = p.ganhadores ?? p.vencedores ?? 0;
          }
        });
      }

      results.push({
        concurso: data.concurso,
        dezenas: data.dezenas,
        data: data.data,
        ganhadores15: ganhadores15
      });
    }
  });

  return results.sort((a, b) => b.concurso - a.concurso);
};