
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
  const [backtestResult, setBacktestResult] = useState<any | null>(null);

  const availableYears = useMemo(() => activeGame ? getYearsList(activeGame.startYear) : [], [activeGame]);

  const handleOpenHistoryAnalysis = () => {
      vibrate(15);
      setShowHistoryAnalysisModal(true);
      setAnalysisResults([]);
      setAnalysisProgress(0);
      setBacktestResult(null);
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

  const runBacktest = async (userGames: number[][], notify: (msg: string, type: 'success' | 'error') => void) => {
      if (userGames.length === 0) return;
      
      setIsAnalysisLoading(true);
      setAnalysisProgress(10);
      
      try {
          const fullHistory = await getFullHistoryWithCache(
              activeGame.apiSlug, 
              latestResult?.concurso || 0, 
              (prog) => setAnalysisProgress(prog)
          );

          let totalInvested = 0;
          let totalPrize = 0;
          let wins = { 15: 0, 14: 0, 13: 0, 12: 0, 11: 0, 6: 0, 5: 0, 4: 0 };
          
          // Preço base (simplificado para o exemplo, idealmente viria do gameConfig)
          const pricePerGame = typeof activeGame.priceTable[0].price === 'number' ? activeGame.priceTable[0].price : 5;

          fullHistory.forEach(draw => {
              const drawNumbers = draw.dezenas.map(Number);
              userGames.forEach(game => {
                  totalInvested += pricePerGame;
                  const matches = game.filter(n => drawNumbers.includes(n)).length;
                  
                  if (matches >= 11) {
                      // Lógica simplificada de prêmios
                      const prizeMap: Record<number, number> = { 15: 1000000, 14: 1500, 13: 30, 12: 12, 11: 6, 6: 500000, 5: 1000, 4: 10 };
                      totalPrize += prizeMap[matches] || 0;
                      if (matches in wins) (wins as any)[matches]++;
                  }
              });
          });

          const netProfit = totalPrize - totalInvested;
          const roi = totalInvested > 0 ? (netProfit / totalInvested) * 100 : 0;

          setBacktestResult({
              wins15: wins[15] || wins[6] || 0,
              wins14: wins[14] || wins[5] || 0,
              wins13: wins[13] || wins[4] || 0,
              wins12: wins[12] || 0,
              wins11: wins[11] || 0,
              totalInvested,
              totalPrize,
              netProfit,
              roi,
              probabilityText: roi > 0 ? "Estratégia Lucrativa Historicamente" : "Estratégia com ROI Negativo",
              profitabilityIndex: Math.min(100, Math.max(0, 50 + roi / 10))
          });

          notify("Backtesting concluído!", "success");
      } catch (e) {
          notify("Erro ao rodar simulador.", "error");
      } finally {
          setIsAnalysisLoading(false);
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
      backtestResult,
      handleOpenHistoryAnalysis,
      handleRunHistoryAnalysis,
      runBacktest
  };
};
