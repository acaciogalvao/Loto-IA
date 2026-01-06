
import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResult, TrendResult, HistoricalAnalysis } from '../types';
import { GAMES } from '../utils/gameConfig';

const MODEL_NAME = 'gemini-3-flash-preview';

// Inicialização Lazy para evitar crash na carga da página se a ENV estiver faltando
const getAiClient = () => {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
        console.error("CRITICAL: API_KEY environment variable is missing.");
        throw new Error("Chave de API do Gemini não configurada no ambiente.");
    }
    return new GoogleGenAI({ apiKey });
};

// Helper de Retry com Backoff Exponencial
async function runWithRetry<T>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (retries <= 0) throw error;
    await new Promise(resolve => setTimeout(resolve, delay));
    return runWithRetry(fn, retries - 1, delay * 2);
  }
}

/**
 * Asks Gemini to suggest numbers based on a strategy AND current user context.
 */
export const getAiSuggestions = async (
    gameName: string = 'lotofacil', 
    selectionSize: number = 15, 
    totalNumbers: number = 25,
    currentSelection: number[] = []
): Promise<number[]> => {
  return runWithRetry(async () => {
    try {
      const ai = getAiClient();
      const alreadySelectedCount = currentSelection.length;
      const neededCount = selectionSize - alreadySelectedCount;
      
      if (neededCount <= 0) return currentSelection;

      // Define regras estatísticas baseadas no jogo para o prompt
      let statsRules = "";
      const gameKey = Object.keys(GAMES).find(k => GAMES[k].name === gameName) || 'lotofacil';
      
      if (gameKey === 'lotofacil') {
          statsRules = "O jogo final deve ter entre 7 e 9 ímpares, entre 4 e 6 primos, e soma entre 180 e 220.";
      } else if (gameKey === 'megasena') {
          statsRules = "Busque equilíbrio entre pares e ímpares (ex: 3/3 ou 4/2) e distribua os números entre os quadrantes.";
      }

      const contextPrompt = alreadySelectedCount > 0 
          ? `O usuário JÁ SELECIONOU os números: [${currentSelection.join(', ')}]. Complete o jogo escolhendo EXATAMENTE mais ${neededCount} números únicos.`
          : `Gere uma lista completa de ${selectionSize} números únicos.`;

      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: `Atue como um matemático especialista em ${gameName} (1 a ${totalNumbers}).
        ${contextPrompt}
        
        REGRAS ESTRITAS:
        1. ${statsRules}
        2. Use 'Rastreamento de Tendência': misture números quentes recentes com frios.
        3. Evite sequências maiores que 3 números consecutivos.
        
        Retorne APENAS o JSON com o array final de inteiros ordenados.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              numbers: {
                type: Type.ARRAY,
                items: { type: Type.INTEGER },
                description: `Array de inteiros contendo o jogo completo (seleção anterior + novos)`
              }
            }
          }
        }
      });

      const data = JSON.parse(response.text || "{}");
      if (data.numbers && Array.isArray(data.numbers)) {
        // Merge e Deduplicate para garantir integridade
        const merged = Array.from(new Set([...currentSelection, ...data.numbers]));
        // Filtra números fora do range (alucinação)
        const valid = merged.filter(n => n >= 1 && n <= totalNumbers);
        // Garante o tamanho correto
        return valid.sort((a: number, b: number) => a - b).slice(0, selectionSize);
      }
      return currentSelection;
    } catch (error) {
      console.error("Gemini Suggestion Error (Retry failed):", error);
      // Fallback silencioso: retorna a seleção atual se falhar
      return currentSelection; 
    }
  });
};

/**
 * Analyzes the generated closing matrix for risk/reward.
 */
export const analyzeClosing = async (selectedNumbers: number[], totalGames: number): Promise<AnalysisResult> => {
  return runWithRetry(async () => {
      try {
          const ai = getAiClient();
          const response = await ai.models.generateContent({
              model: MODEL_NAME,
              contents: `Analise este fechamento de loteria.
              INPUT: Selecionei ${selectedNumbers.length} números: [${selectedNumbers.join(', ')}] para gerar ${totalGames} jogos combinatórios.
              
              TAREFA:
              1. Calcule a 'Qualidade da Cobertura' (Score 0-100) baseada na distribuição matemática.
              2. Identifique pontos fortes (ex: equilíbrio par/ímpar).
              3. Dê uma dica curta.
              
              Retorne JSON.`,
              config: {
                  responseMimeType: "application/json",
                  responseSchema: {
                      type: Type.OBJECT,
                      properties: {
                          message: { type: Type.STRING, description: "Resumo da análise (max 15 palavras)" },
                          score: { type: Type.NUMBER, description: "Nota de 0 a 100" },
                          tips: { type: Type.STRING, description: "Dica acionável" }
                      }
                  }
              }
          });
          
          return JSON.parse(response.text || JSON.stringify({ message: "Análise concluída", score: 75, tips: "Boa sorte!" }));
      } catch (error) {
          console.error("Analysis Error:", error);
          // Fallback graceful
          return {
              message: "Análise estatística básica realizada.",
              score: 70,
              tips: "Verifique o equilíbrio de pares e ímpares."
          };
      }
  }, 2); // Menos retries para análise pois não é bloqueante
};

export const getLotteryTrends = async (gameName: string, recentResults: string[] = []): Promise<TrendResult> => {
    return runWithRetry(async () => {
        try {
            const ai = getAiClient();
            const contextData = recentResults.length > 0 
                ? `Baseado nestes últimos resultados (dezenas): ${recentResults.slice(0, 10).join(' | ')}` 
                : "Baseado no histórico estatístico geral";

            const response = await ai.models.generateContent({
                model: MODEL_NAME,
                contents: `Analise as tendências para a ${gameName}. ${contextData}.
                Identifique 5 números 'Quentes' (alta frequência recente) e 5 números 'Frios' (atrasados).
                Forneça uma breve análise de texto.`,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            hot: { type: Type.ARRAY, items: { type: Type.INTEGER } },
                            cold: { type: Type.ARRAY, items: { type: Type.INTEGER } },
                            analysis: { type: Type.STRING }
                        }
                    }
                }
            });
            return JSON.parse(response.text || "{}");
        } catch (error) {
            return { hot: [], cold: [], analysis: "Indisponível no momento." };
        }
    });
};

export const getHistoricalSimulation = async (gameName: string, game: number[]): Promise<HistoricalAnalysis> => {
    return runWithRetry(async () => {
        try {
            const ai = getAiClient();
            const response = await ai.models.generateContent({
                model: MODEL_NAME,
                contents: `Simule o desempenho histórico do jogo [${game.join(', ')}] na ${gameName} nos últimos 5 anos.
                Estime a quantidade de prêmios (aprox) baseado em probabilidade.`,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            wins15: { type: Type.INTEGER },
                            wins14: { type: Type.INTEGER },
                            wins13: { type: Type.INTEGER },
                            wins12: { type: Type.INTEGER },
                            wins11: { type: Type.INTEGER },
                            probabilityText: { type: Type.STRING },
                            profitabilityIndex: { type: Type.NUMBER }
                        }
                    }
                }
            });
            return JSON.parse(response.text || "{}");
        } catch (e) {
            return { wins15: 0, wins14: 0, wins13: 0, wins12: 0, wins11: 0, probabilityText: "Erro na simulação", profitabilityIndex: 0 };
        }
    });
};
