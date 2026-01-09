
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

  const handleOpenHistoryAnalysis = () => {
      vibrate(15);
      setShowHistoryAnalysisModal(true);
      setAnalysisResults([]);
      setAnalysisProgress(0);
      setAnalysisTargetPoints(getDefaultTargetPoints(activeGame.id));
  };

  const handleRunHistoryAnalysis = async (notify: (msg: string, type: 'success' | 'error' | 'info') => void) => {
      vibrate(10);
      const year = analysisYear;
      
      setIsAnalysisLoading(true);
      setAnalysisResults([]); // Limpa para nova busca
      setAnalysisProgress(1);

      const yearMap = GAME_YEAR_STARTS[activeGame.id];
      
      let startConcurso = 1;
      let endConcurso = 999999;

      if (yearMap && yearMap[year]) {
          startConcurso = yearMap[year];
      } else {
          if (year !== activeGame.startYear) {
               console.warn(`Ano ${year} não mapeado em GAME_YEAR_STARTS para ${activeGame.id}`);
          }
      }

      if (yearMap && yearMap[year + 1]) {
          endConcurso = yearMap[year + 1] - 1;
      } else if (latestResult) {
          endConcurso = latestResult.concurso;
      } else {
          endConcurso = startConcurso + 400; 
      }

      if (latestResult && endConcurso > latestResult.concurso) {
          endConcurso = latestResult.concurso;
      }
      
      if (startConcurso > endConcurso) {
          setIsAnalysisLoading(false);
          setAnalysisProgress(100);
          notify(`Dados de ${year} ainda não disponíveis.`, 'info');
          return;
      }

      try {
          // Set temporário para evitar duplicatas visuais durante o streaming
          const uniqueConcursos = new Set<number>();

          await fetchResultsRange(
              activeGame.apiSlug, 
              startConcurso, 
              endConcurso, 
              (prog) => setAnalysisProgress(prog),
              (newData) => {
                  // CALLBACK DE STREAMING: Executa a cada chunk recebido (do banco ou da API)
                  setAnalysisResults(prev => {
                      const filteredNewData = newData.filter(game => {
                          if (uniqueConcursos.has(game.concurso)) return false;
                          
                          // Filtra pelo ano visualmente
                          if (!game.data || !game.data.includes(`/${year}`)) return false;
                          
                          uniqueConcursos.add(game.concurso);
                          return true;
                      });

                      if (filteredNewData.length === 0) return prev;

                      // Merge e ordena
                      return [...prev, ...filteredNewData].sort((a, b) => b.concurso - a.concurso);
                  });
              }
          );
          
          vibrate(50);

      } catch (e) {
          console.error("Erro na analise historica", e);
          notify("Erro ao buscar histórico. Tente novamente.", 'error');
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
