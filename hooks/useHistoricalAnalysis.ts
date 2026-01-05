
import { useState, useMemo } from 'react';
import { PastGameResult, GameConfig, LotteryResult } from '../types';
import { vibrate } from '../utils/uiUtils';
import { fetchResultsRange } from '../services/lotteryService';
import { GAME_YEAR_STARTS, getYearsList } from '../utils/lotteryLogic';

export const useHistoricalAnalysis = (activeGame: GameConfig, latestResult: LotteryResult | null) => {
  const [showHistoryAnalysisModal, setShowHistoryAnalysisModal] = useState(false);
  const [analysisYear, setAnalysisYear] = useState<number>(new Date().getFullYear());
  const [analysisTargetPoints, setAnalysisTargetPoints] = useState<number>(activeGame.id === 'lotofacil' ? 15 : activeGame.minSelection);
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
      
      // Update default target points based on game
      if (activeGame.id === 'lotofacil') setAnalysisTargetPoints(15);
      else if (activeGame.id === 'megasena') setAnalysisTargetPoints(6);
      else if (activeGame.id === 'quina') setAnalysisTargetPoints(5);
      else setAnalysisTargetPoints(activeGame.minSelection);
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
      
      // Define o final do intervalo
      if (yearMap && yearMap[year + 1]) {
          // Se sabemos onde começa o próximo ano, terminamos um antes
          endConcurso = yearMap[year + 1] - 1;
      } else if (latestResult) {
          // Se é o ano atual ou futuro não mapeado, vai até o último sorteio disponível
          endConcurso = latestResult.concurso;
      } else {
          // Fallback se não tiver latestResult (ex: erro de rede), tenta pegar um range seguro para anos recentes
          // Mas sem latestResult, é difícil saber. Vamos chutar um range pequeno para não travar
          endConcurso = startConcurso + 200; 
      }

      // Segurança: nunca tentar buscar além do último concurso real se disponível
      if (latestResult && endConcurso > latestResult.concurso) {
          endConcurso = latestResult.concurso;
      }
      
      // Segurança: se o start for maior que o end (ex: ano futuro sem dados ainda), aborta
      if (startConcurso > endConcurso) {
          setIsAnalysisLoading(false);
          setAnalysisProgress(100);
          notify(`Ainda não há dados para ${year}.`, 'error');
          return;
      }

      try {
          // Busca TODOS os resultados do intervalo (ano completo)
          const results = await fetchResultsRange(activeGame.apiSlug, startConcurso, endConcurso, (prog) => {
              setAnalysisProgress(prog);
          });
          
          // Filtra estritamente pelo ano na string de data para garantir precisão
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
