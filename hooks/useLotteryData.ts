
import { useState, useEffect, useCallback } from 'react';
import { fetchLatestResult, fetchResultByConcurso } from '../services/lotteryService';
import { LotteryResult, PastGameResult, GameConfig } from '../types';

export const useLotteryData = (activeGame: GameConfig) => {
  const [latestResult, setLatestResult] = useState<LotteryResult | null>(null);
  const [displayedResult, setDisplayedResult] = useState<LotteryResult | null>(null); // Estado para o que é exibido no card principal
  const [isResultLoading, setIsResultLoading] = useState(true);
  
  const [manualSearchConcurso, setManualSearchConcurso] = useState<string>('');
  const [manualSearchResult, setManualSearchResult] = useState<PastGameResult | null>(null);
  const [isManualSearchLoading, setIsManualSearchLoading] = useState(false);

  const loadLatestResult = useCallback(() => {
    setIsResultLoading(true);
    fetchLatestResult(activeGame.apiSlug)
      .then((res) => {
        setLatestResult(res);
        setDisplayedResult(res); // Por padrão, exibe o último
      })
      .finally(() => setIsResultLoading(false));
  }, [activeGame.apiSlug]);

  useEffect(() => {
    setLatestResult(null);
    setDisplayedResult(null);
    loadLatestResult();
  }, [activeGame.id, loadLatestResult]);

  // Função para busca no Card Principal
  const searchAndDisplayResult = async (concurso: number): Promise<boolean> => {
      setIsResultLoading(true);
      try {
          // Reutiliza a lógica de busca por concurso, mas converte para LotteryResult se necessário
          // Como fetchResultByConcurso retorna PastGameResult (que é compatível em estrutura visual básica),
          // precisamos adaptar ou assumir compatibilidade.
          // Na verdade, a API `fetchResultByConcurso` já usa `mapApiToResult` internamente,
          // então podemos adaptar o tipo ou usar casting seguro pois LotteryResult estende a base necessária.
          
          const result = await fetchResultByConcurso(activeGame.apiSlug, concurso);
          if (result) {
              // Convertendo PastGameResult para LotteryResult (Preenchendo campos faltantes com defaults seguros)
              const fullResult: LotteryResult = {
                  ...result,
                  ganhadores15: result.premiacoes[0]?.ganhadores || 0, // Aproximação
                  proximoConcurso: result.concurso + 1,
                  dataProximoConcurso: '',
                  valorEstimadoProximoConcurso: result.valorEstimadoProximoConcurso || 0,
                  valorAcumuladoProximoConcurso: 0,
                  valorAcumulado: result.valorAcumulado || 0,
                  valorAcumuladoEspecial: 0,
                  acumulou: result.premiacoes[0]?.ganhadores === 0
              };
              setDisplayedResult(fullResult);
              return true;
          }
          return false;
      } catch(e) {
          console.error(e);
          return false;
      } finally {
          setIsResultLoading(false);
      }
  };

  const resetDisplayToLatest = () => {
      setDisplayedResult(latestResult);
  };

  // Função para busca no Modal de Jogos Salvos (Mantido para compatibilidade)
  const handleManualSearch = async (): Promise<boolean> => {
      if (!manualSearchConcurso) return false;
      
      setIsManualSearchLoading(true);
      setManualSearchResult(null);

      try {
          const concursoNumber = parseInt(manualSearchConcurso, 10);
          if (isNaN(concursoNumber)) throw new Error("Número inválido");

          const result = await fetchResultByConcurso(activeGame.apiSlug, concursoNumber);
          
          if (result) {
              setManualSearchResult(result);
              return true;
          } else {
              return false;
          }
      } catch (error) {
          console.error("Erro na busca manual:", error);
          return false;
      } finally {
          setIsManualSearchLoading(false);
      }
  };

  const clearManualSearch = () => {
      setManualSearchConcurso('');
      setManualSearchResult(null);
  };

  return {
    latestResult,
    displayedResult,
    isResultLoading,
    loadLatestResult,
    searchAndDisplayResult,
    resetDisplayToLatest,
    manualSearchConcurso,
    setManualSearchConcurso,
    manualSearchResult,
    isManualSearchLoading,
    handleManualSearch,
    clearManualSearch
  };
};
