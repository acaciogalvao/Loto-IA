
import { useState, useMemo } from 'react';
import { PastGameResult, GameConfig, LotteryResult } from '../types';
import { vibrate } from '../utils/uiUtils';
import { getFullHistoryWithCache } from '../services/lotteryService';
import { getYearsList } from '../utils/lotteryLogic';

export const useHistoricalAnalysis = (activeGame: GameConfig, latestResult: LotteryResult | null) => {
  const [showHistoryAnalysisModal, setShowHistoryAnalysisModal] = useState(false);
  const [analysisYear, setAnalysisYear] = useState<number>(new Date().getFullYear());
  
  const getDefaultTargetPoints = (id: string) => {
      switch(id) {
          case 'lotofacil': return 15;
          case 'megasena': return 6;
          case 'quina': return 5;
          case 'timemania': return 7; 
          case 'lotomania': return 20;
          case 'diadesorte': return 7;
          case 'duplasena': return 6;
          case 'supersete': return 7;
          case 'maismilionaria': return 1;
          default: return activeGame.minSelection;
      }
  };

  const [analysisTargetPoints, setAnalysisTargetPoints] = useState<number>(getDefaultTargetPoints(activeGame.id));
  const [analysisResults, setAnalysisResults] = useState<PastGameResult[]>([]);
  const [isAnalysisLoading, setIsAnalysisLoading] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState<number>(0);

  const availableYears = useMemo(() => activeGame ? getYearsList(activeGame.startYear) : [], [activeGame]);

  const handleOpenHistoryAnalysis = () => {
      vibrate(15);
      setShowHistoryAnalysisModal(true);
      setAnalysisResults([]);
      setAnalysisProgress(0);
      setAnalysisTargetPoints(getDefaultTargetPoints(activeGame.id));
  };

  const handleRunHistoryAnalysis = async (notify: (msg: string, type: 'success' | 'error') => void) => {
      vibrate(10);
      const year = analysisYear;
      
      setIsAnalysisLoading(true);
      setAnalysisProgress(10);

      try {
          // OTIMIZAÇÃO MESTRA: Usa o cache global de histórico em vez de buscar por ano
          // Isso torna o Raio-X instantâneo se o usuário já navegou pelo app
          if (!latestResult) {
              throw new Error("Último resultado não disponível");
          }

          const fullHistory = await getFullHistoryWithCache(
              activeGame.apiSlug, 
              latestResult.concurso, 
              (prog) => setAnalysisProgress(prog)
          );

          // Filtra o histórico completo pelo ano selecionado
          const yearResults = fullHistory.filter(game => {
              if (!game.data) return false;
              // Formatos comuns: "DD/MM/YYYY" ou "YYYY-MM-DD"
              return game.data.includes(`/${year}`) || game.data.startsWith(`${year}-`);
          });

          setAnalysisResults(yearResults);
          
          if (yearResults.length === 0) {
              notify(`Nenhum dado encontrado para o ano ${year}.`, 'error');
          } else {
              vibrate(50);
              notify(`Análise de ${year} concluída com sucesso!`, 'success');
          }

      } catch (e) {
          console.error("Erro na analise historica:", e);
          notify("Erro ao processar análise histórica.", 'error');
      } finally {
          setIsAnalysisLoading(false);
          setAnalysisProgress(100);
      }
  };

  return {
      showHistoryAnalysisModal,
      setShowHistoryAnalysisModal,
      analysisYear,
      setAnalysisYear,
      analysisTargetPoints,
      setAnalysisTargetPoints,
      availableYears,
      analysisResults,
      isAnalysisLoading,
      analysisProgress,
      handleOpenHistoryAnalysis,
      handleRunHistoryAnalysis
  };
};
