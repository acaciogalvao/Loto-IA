import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResult, TrendResult, HistoricalAnalysis } from '../types';

// Initialize Gemini
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const MODEL_NAME = 'gemini-3-flash-preview';

/**
 * Asks Gemini to suggest numbers based on a strategy.
 */
export const getAiSuggestions = async (): Promise<number[]> => {
  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: "Gere uma lista de 17 números únicos para a Lotofácil (entre 1 e 25) baseados em uma estratégia de equilíbrio entre pares e ímpares e distribuição espacial no volante. Retorne apenas o JSON.",
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            numbers: {
              type: Type.ARRAY,
              items: { type: Type.INTEGER },
              description: "Array of 17 unique integers between 1 and 25"
            }
          }
        }
      }
    });

    const data = JSON.parse(response.text || "{}");
    if (data.numbers && Array.isArray(data.numbers)) {
      return data.numbers.sort((a: number, b: number) => a - b);
    }
    return [];
  } catch (error) {
    console.error("Gemini Suggestion Error:", error);
    throw error;
  }
};

/**
 * Generates a smart, reduced closing using AI logic.
 */
export const generateSmartClosing = async (selectedNumbers: number[]): Promise<number[][]> => {
  try {
    const prompt = `
      Atue como um matemático especialista em Lotofácil.
      O usuário selecionou os números: [${selectedNumbers.join(', ')}].
      Gere um fechamento combinatório DE ALTA PRECISÃO (Foco no Prêmio Máximo).
      Objetivo: Maximizar as chances de acertar 14 e 15 pontos.
      Estratégia: Utilize filtros avançados (somas, primos, repetidas) para selecionar as combinações mais promissoras dentro do universo selecionado.
      Gere entre 12 e 18 jogos de 15 números cada.
      Retorne APENAS o JSON com a matriz de jogos.
    `;

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            games: {
              type: Type.ARRAY,
              items: {
                type: Type.ARRAY,
                items: { type: Type.INTEGER }
              }
            }
          }
        }
      }
    });

    const data = JSON.parse(response.text || "{}");
    // Sort numbers in each game
    const games = (data.games || []).map((g: number[]) => g.sort((a, b) => a - b));
    return games;
  } catch (error) {
    console.error("Gemini Smart Closing Error:", error);
    throw error;
  }
};

/**
 * Requests lottery trends (hot/cold numbers) from AI.
 */
export const getLotteryTrends = async (): Promise<TrendResult> => {
  try {
    const prompt = `
      Atue como um estatístico de loterias.
      Com base no histórico da Lotofácil, identifique:
      1. Os 5 números que MAIS saem (números quentes).
      2. Os 5 números que MENOS saem (números frios).
      3. Uma breve análise de 1 frase sobre o padrão recente.
      
      Retorne estritamente em JSON.
    `;

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            hot: { 
              type: Type.ARRAY, 
              items: { type: Type.INTEGER },
              description: "Top 5 most frequent numbers"
            },
            cold: { 
              type: Type.ARRAY, 
              items: { type: Type.INTEGER },
              description: "Top 5 least frequent numbers"
            },
            analysis: { type: Type.STRING }
          }
        }
      }
    });

    const data = JSON.parse(response.text || "{}");
    return {
      hot: data.hot || [],
      cold: data.cold || [],
      analysis: data.analysis || "Análise baseada em dados históricos."
    };
  } catch (error) {
    console.error("Gemini Trends Error:", error);
    throw error;
  }
};

/**
 * Simulate historical performance over 100 games
 */
export const getHistoricalSimulation = async (selectedNumbers: number[]): Promise<HistoricalAnalysis> => {
  try {
    const prompt = `
      Analise a combinação de números: [${selectedNumbers.join(', ')}].
      Com base no histórico estatístico dos últimos 100 concursos da Lotofácil:
      1. Estime quantas vezes essa combinação (ou subconjuntos dela de 11 a 15 números) teria sido premiada.
      2. Calcule uma probabilidade qualitativa.
      3. Gere um índice de rentabilidade (0-100).
      
      Retorne APENAS o JSON.
    `;

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            wins15: { type: Type.INTEGER, description: "Estimated 15 hits in last 100 games" },
            wins14: { type: Type.INTEGER, description: "Estimated 14 hits" },
            wins13: { type: Type.INTEGER },
            wins12: { type: Type.INTEGER },
            wins11: { type: Type.INTEGER },
            probabilityText: { type: Type.STRING, description: "Short text explaining the probability" },
            profitabilityIndex: { type: Type.INTEGER, description: "0 to 100 score" }
          }
        }
      }
    });

    const data = JSON.parse(response.text || "{}");
    return {
      wins15: data.wins15 || 0,
      wins14: data.wins14 || 0,
      wins13: data.wins13 || 0,
      wins12: data.wins12 || 0,
      wins11: data.wins11 || 0,
      probabilityText: data.probabilityText || "Análise baseada em padrões.",
      profitabilityIndex: data.profitabilityIndex || 50
    };
  } catch (error) {
    console.error("Historical Sim Error:", error);
    return {
      wins15: 0, wins14: 0, wins13: 0, wins12: 0, wins11: 0,
      probabilityText: "Não foi possível simular.",
      profitabilityIndex: 0
    };
  }
};

/**
 * Analyzes a set of games.
 */
export const analyzeClosing = async (selectedNumbers: number[], totalGames: number): Promise<AnalysisResult> => {
  try {
    const prompt = `
      Analise este fechamento de Lotofácil.
      Números selecionados pelo usuário: [${selectedNumbers.join(', ')}].
      Total de jogos gerados: ${totalGames}.
      Forneça uma análise curta sobre o equilíbrio matemático dessa seleção (pares/ímpares, primos).
      Dê uma nota de 0 a 100 baseada na probabilidade teórica (simulada).
    `;

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            message: { type: Type.STRING },
            score: { type: Type.INTEGER },
            tips: { type: Type.STRING }
          }
        }
      }
    });

    const data = JSON.parse(response.text || "{}");
    return {
      message: data.message || "Análise concluída.",
      score: data.score || 50,
      tips: data.tips || "Boa sorte!"
    };

  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return {
      message: "Não foi possível analisar no momento.",
      score: 0,
      tips: "Tente novamente mais tarde."
    };
  }
};