
import { useState, useMemo } from 'react';
import { PastGameResult, GameConfig, LotteryResult } from '../types';
import { vibrate } from '../utils/uiUtils';
import { fetchResultsRange } from '../services/lotteryService';
import { GAME_YEAR_STARTS, getYearsList } from '../utils/lotteryLogic';

export const useHistoricalAnalysis = (activeGame: GameConfig, latestResult: LotteryResult | null) => {
  const [showHistoryAnalysisModal, setShowHistoryAnalysisModal] = useState(false);
  const [analysisYear, setAnalysisYear] = useState<number>(new Date().getFullYear());
  
  // Função para definir o padrão correto ao abrir
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
          case 'maismilionaria': return 1; // Padrão Faixa 1 (6+2)
          default: return activeGame.minSelection;
      }
  };

  const [analysisTargetPoints, setAnalysisTargetPoints] = useState<number>(getDefaultTargetPoints(activeGame.id));
  const [analysisResults, setAnalysisResults] = useState<PastGameResult[]>([]);
  const [isAnalysisLoading, setIsAnalysisLoading] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState<number>(0);

  const availableYears = useMemo(() => activeGame ? getYearsList(activeGame.startYear) : [], [activeGame]);

  const getAnalysisCacheKey = (year: number) => `lotosmart_analysis_${activeGame.id}_${year}`;

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
      const cacheKey = getAnalysisCacheKey(year);
      
      setIsAnalysisLoading(true);
      setAnalysisResults([]);
      setAnalysisProgress(5); 

      try {
          const cachedData = localStorage.getItem(cacheKey);
          if (cachedData) {
              const parsed = JSON.parse(cachedData);
              if (Array.isArray(parsed) && parsed.length > 0) {
                  setAnalysisResults(parsed);
                  setAnalysisProgress(100);
                  setIsAnalysisLoading(false);
                  vibrate(50);
                  notify(`Dados de ${year} carregados do cache!`, 'success');
                  return;
              }
          }
      } catch (e) {
          console.warn("Erro ao ler cache de análise", e);
      }

      const yearMap = GAME_YEAR_STARTS[activeGame.id];
      const startConcurso = yearMap ? yearMap[year] || 1 : 1;
      let endConcurso = 999999;
      
      if (yearMap && yearMap[year + 1]) {
          endConcurso = yearMap[year + 1] - 1;
      } else if (latestResult) {
          endConcurso = latestResult.concurso;
      } else {
          endConcurso = startConcurso + 200; 
      }

      if (latestResult && endConcurso > latestResult.concurso) {
          endConcurso = latestResult.concurso;
      }
      
      if (startConcurso > endConcurso) {
          setIsAnalysisLoading(false);
          setAnalysisProgress(100);
          notify(`Ainda não há dados para ${year}.`, 'error');
          return;
      }

      try {
          const results = await fetchResultsRange(activeGame.apiSlug, startConcurso, endConcurso, (prog) => {
              setAnalysisProgress(prog);
          });
          
          const strictYearResults = results.filter(game => {
              if (!game.data) return false;
              return game.data.includes(`/${year}`);
          }).sort((a, b) => b.concurso - a.concurso);

          setAnalysisResults(strictYearResults);
          
          if (strictYearResults.length > 0) {
              try {
                  localStorage.setItem(cacheKey, JSON.stringify(strictYearResults));
              } catch(e) { console.error("Cache cheio na análise", e); }
          }
          vibrate(50);

      } catch (e) {
          console.error("Erro na analise historica", e);
          notify("Erro ao buscar histórico do ano.", 'error');
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
