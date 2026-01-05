
import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResult, TrendResult, HistoricalAnalysis } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
const MODEL_NAME = 'gemini-3-flash-preview';

/**
 * Asks Gemini to suggest numbers based on a strategy.
 */
export const getAiSuggestions = async (gameName: string = 'lotofacil', selectionSize: number = 15, totalNumbers: number = 25): Promise<number[]> => {
  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: `Gere uma lista de ${selectionSize} números únicos para a ${gameName} (entre 1 e ${totalNumbers}) utilizando a técnica de 'Rastreamento de Tendência'. Identifique números quentes recentes e misture com números atrasados para equilíbrio. Retorne apenas o JSON.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            numbers: {
              type: Type.ARRAY,
              items: { type: Type.INTEGER },
              description: `Array of ${selectionSize} unique integers between 1 and ${totalNumbers}`
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
    // Return empty to respect "zeroed logic" instead of mock fallback
    return []; 
  }
};

/**
 * Generates numbers based on TOTAL HISTORY
 */
export const getHistoricalBestNumbers = async (gameName: string = 'lotofacil', selectionSize: number = 15): Promise<number[]> => {
  try {
    const prompt = `
      Atue como um cientista de dados especialista em loterias (${gameName}).
      OBJETIVO: Selecionar ${selectionSize} números baseados na análise estatística de longo prazo para a ${gameName}.
      
      CRITÉRIOS DE ANÁLISE:
      1. Identifique os "Números de Ouro": aqueles que estatisticamente mais aparecem em combinações vencedoras.
      2. Considere a "Lei dos Grandes Números".
      
      Retorne APENAS o JSON com a lista de ${selectionSize} números inteiros únicos.
    `;

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            numbers: {
              type: Type.ARRAY,
              items: { type: Type.INTEGER },
              description: `Array of ${selectionSize} integers`
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
    console.error("Gemini Historical Error:", error);
    return [];
  }
};

/**
 * Generates a smart, reduced closing using AI logic.
 */
export const generateSmartClosing = async (gameName: string, selectedNumbers: number[], gameSize: number): Promise<number[][]> => {
  try {
    const prompt = `
      Atue como um Motor de Otimização Combinatória Avançada para ${gameName}.
      
      INPUT: ${selectedNumbers.length} números escolhidos: [${selectedNumbers.join(', ')}].
      OUTPUT ALVO: Gere uma matriz de fechamento de até 1000 jogos de ${gameSize} números.
      
      ESTRATÉGIA MATEMÁTICA: FECHAMENTO PARA PRÊMIO MÁXIMO (Garantia Principal).
      1. O objetivo é CERCAR o prêmio máximo. Não economize em combinações se isso aumentar a chance do prêmio principal.
      2. Utilize 'Design Combinatório' (Covering Design) para garantir que, se os números sorteados estiverem no INPUT, a probabilidade de ter o jogo vencedor seja maximizada.
      3. Evite combinações improváveis (ex: sequências muito longas), focando em equilíbrio estatístico.
      
      Retorne APENAS o JSON com a matriz de jogos processada.
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
    const games = (data.games || []).map((g: number[]) => g.sort((a: number, b: number) => a - b));
    return games;
  } catch (error) {
    console.error("Gemini Smart Closing Error:", error);
    return [];
  }
};

export const analyzeClosing = async (selectedNumbers: number[], totalGames: number): Promise<AnalysisResult> => {
    // Logic zeroed out as requested - implement real AI call if needed
    return {
      message: "Análise indisponível no momento.",
      score: 0,
      tips: ""
    };
};

export const getLotteryTrends = async (gameName: string): Promise<TrendResult> => {
    return {
        hot: [],
        cold: [],
        analysis: "Dados insuficientes para análise."
    };
};

export const getHistoricalSimulation = async (gameName: string, game: number[]): Promise<HistoricalAnalysis> => {
    return {
        wins15: 0,
        wins14: 0,
        wins13: 0,
        wins12: 0,
        wins11: 0,
        probabilityText: "Histórico não disponível.",
        profitabilityIndex: 0
    };
};
