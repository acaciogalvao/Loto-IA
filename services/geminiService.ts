import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResult, TrendResult, HistoricalAnalysis } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
const MODEL_NAME = 'gemini-3-flash-preview';

/**
 * Asks Gemini to suggest numbers based on a strategy.
 */
export const getAiSuggestions = async (gameName: string = 'lotofacil', selectionSize: number = 15, totalNumbers: number = 25): Promise<number[]> => {
  try {
    const prompt = `
      Atue como um Especialista em Probabilidade Lotérica para a ${gameName}.
      
      TAREFA: Gere uma sugestão estratégica de ${selectionSize} números únicos (entre 1 e ${totalNumbers}).
      
      ESTRATÉGIA OBRIGATÓRIA:
      1. Equilíbrio: Tente manter uma proporção saudável de Pares/Ímpares (ex: 50/50 ou 40/60).
      2. Dispersão: Distribua os números por todo o volante, evitando aglomerados excessivos.
      3. Temperatura: Misture números "Quentes" (frequentes) com "Frios" (atrasados) para aumentar a cobertura estatística.
      
      Retorne APENAS o JSON com a lista final de números.
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
    throw error;
  }
};

/**
 * NEW: Generates numbers based on TOTAL HISTORY
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
    throw error;
  }
};

/**
 * Generates a smart, reduced closing using AI logic.
 */
export const generateSmartClosing = async (gameName: string, selectedNumbers: number[], gameSize: number): Promise<number[][]> => {
  try {
    // Cálculo aproximado de quantos jogos seriam necessários para um fechamento forte
    // A IA decidirá a melhor distribuição, mas damos um teto alto.
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
    throw error;
  }
};

export const analyzeClosing = async (selectedNumbers: number[], totalGames: number): Promise<AnalysisResult> => {
    // Basic stub to prevent breakage, logic remains generic enough
    return {
      message: "Análise concluída (Genérico).",
      score: 75,
      tips: "Jogo equilibrado."
    };
};

export const getLotteryTrends = async (gameName: string): Promise<TrendResult> => {
    return {
        hot: [],
        cold: [],
        analysis: "Análise de tendências simulada."
    };
};

export const getHistoricalSimulation = async (gameName: string, game: number[]): Promise<HistoricalAnalysis> => {
    return {
        wins15: 0,
        wins14: 0,
        wins13: 0,
        wins12: 0,
        wins11: 0,
        probabilityText: "Simulação pendente.",
        profitabilityIndex: 50
    };
};