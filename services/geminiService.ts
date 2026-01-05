
import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResult, TrendResult, HistoricalAnalysis } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
const MODEL_NAME = 'gemini-3-flash-preview';

/**
 * Asks Gemini to suggest numbers based on a strategy AND current user context.
 */
export const getAiSuggestions = async (
    gameName: string = 'lotofacil', 
    selectionSize: number = 15, 
    totalNumbers: number = 25,
    currentSelection: number[] = []
): Promise<number[]> => {
  try {
    const alreadySelectedCount = currentSelection.length;
    const neededCount = selectionSize - alreadySelectedCount;
    
    if (neededCount <= 0) return currentSelection;

    const contextPrompt = alreadySelectedCount > 0 
        ? `O usuário JÁ SELECIONOU os números: [${currentSelection.join(', ')}]. Complete o jogo escolhendo mais ${neededCount} números.`
        : `Gere uma lista completa de ${selectionSize} números.`;

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: `Atue como um especialista em estatística lotérica para a ${gameName} (1 a ${totalNumbers}).
      ${contextPrompt}
      
      ESTRATÉGIA:
      1. Use 'Rastreamento de Tendência': misture números quentes recentes com atrasados (frios).
      2. Mantenha equilíbrio de Pares/Ímpares e Primos.
      3. Evite sequências muito longas (ex: 1,2,3,4,5).
      
      Retorne APENAS o JSON.`,
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
      // Ensure we merge and deduplicate just in case AI missed the context slightly
      const merged = Array.from(new Set([...currentSelection, ...data.numbers]));
      // Trim to size if AI hallucinated extra numbers
      return merged.sort((a: number, b: number) => a - b).slice(0, selectionSize);
    }
    return currentSelection;
  } catch (error) {
    console.error("Gemini Suggestion Error:", error);
    return currentSelection; 
  }
};

/**
 * Analyzes the generated closing matrix for risk/reward.
 */
export const analyzeClosing = async (selectedNumbers: number[], totalGames: number): Promise<AnalysisResult> => {
  try {
      const response = await ai.models.generateContent({
          model: MODEL_NAME,
          contents: `Analise este fechamento de loteria.
          INPUT: Selecionei ${selectedNumbers.length} números: [${selectedNumbers.join(', ')}] para gerar ${totalGames} jogos.
          
          TAREFA:
          1. Calcule superficialmente a 'Cobertura Combinatória' (Score 0-100).
          2. Identifique pontos fortes (ex: cercou bem os primos?).
          3. Dê uma dica curta de otimização.
          
          Retorne JSON.`,
          config: {
              responseMimeType: "application/json",
              responseSchema: {
                  type: Type.OBJECT,
                  properties: {
                      message: { type: Type.STRING, description: "Resumo da análise" },
                      score: { type: Type.NUMBER, description: "Nota de 0 a 100 para a qualidade do fechamento" },
                      tips: { type: Type.STRING, description: "Dica acionável" }
                  }
              }
          }
      });
      
      return JSON.parse(response.text || JSON.stringify({ message: "Erro na análise", score: 0, tips: "" }));
  } catch (error) {
      console.error("Analysis Error:", error);
      return {
          message: "Serviço de análise temporariamente indisponível.",
          score: 50,
          tips: "Tente variar mais suas dezenas."
      };
  }
};

export const getLotteryTrends = async (gameName: string, recentResults: string[] = []): Promise<TrendResult> => {
    try {
        // Mocking recent results if not provided effectively, usually this would come from the context
        const contextData = recentResults.length > 0 
            ? `Baseado nestes últimos resultados (strings de dezenas): ${recentResults.slice(0, 10).join(' | ')}` 
            : "Baseado no conhecimento histórico geral até 2024";

        const response = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: `Analise as tendências para a ${gameName}. ${contextData}.
            Identifique 5 números 'Quentes' (saindo muito) e 5 números 'Frios' (atrasados).
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
        return { hot: [], cold: [], analysis: "Indisponível" };
    }
};

export const getHistoricalSimulation = async (gameName: string, game: number[]): Promise<HistoricalAnalysis> => {
    // This implies a heavy data query. Since we don't have a backend with full history indexed for AI,
    // we ask AI to estimate based on its training data probability.
    try {
        const response = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: `Simule o desempenho histórico do jogo [${game.join(', ')}] na ${gameName} nos últimos 5 anos baseando-se em probabilidade estatística e dados de treinamento.
            Estime quantas vezes ele teria premiado (aprox).`,
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
};
