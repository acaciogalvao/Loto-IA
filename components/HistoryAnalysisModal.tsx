
import React, { useMemo, useState } from 'react';
import { motion, PanInfo } from 'framer-motion';
import { PastGameResult, GameConfig, HistoricalAnalysis, NumberProbability } from '../types';
import { Dashboard } from './Dashboard';

interface HistoryAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeGame: GameConfig;
  analysisYear: number;
  setAnalysisYear: (year: number) => void;
  analysisTargetPoints: number;
  setAnalysisTargetPoints: (points: number) => void;
  availableYears: number[];
  onRunAnalysis: () => void;
  isAnalysisLoading: boolean;
  analysisProgress: number;
  analysisResults: PastGameResult[];
  backtestResult?: HistoricalAnalysis | null;
  onRunBacktest?: () => void;
  probabilities?: NumberProbability[];
}

const HistoryAnalysisModal: React.FC<HistoryAnalysisModalProps> = ({
  isOpen,
  onClose,
  activeGame,
  analysisYear,
  setAnalysisYear,
  analysisTargetPoints,
  setAnalysisTargetPoints,
  availableYears,
  onRunAnalysis,
  isAnalysisLoading,
  analysisProgress,
  analysisResults,
  backtestResult,
  onRunBacktest,
  probabilities
}) => {
  const [activeTab, setActiveTab] = useState<'history' | 'simulator' | 'dashboard'>('history');

  if (!isOpen) return null;

  const filteredAnalysisResults = useMemo(() => {
    if (!analysisResults || analysisResults.length === 0) return [];
    return analysisResults.filter(game => {
        if (!game || !game.premiacoes) return false;
        if (activeGame.id === 'federal') return true;
        const prize = game.premiacoes.find(p => p.faixa === analysisTargetPoints);
        return prize && prize.ganhadores > 0;
    });
  }, [analysisResults, analysisTargetPoints, activeGame.id]);

  const variants = {
    hidden: { y: "100%", opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { type: "spring", damping: 25, stiffness: 300 } },
    exit: { y: "100%", opacity: 0 }
  };

  const handleDragEnd = (_: any, info: PanInfo) => {
    if (info.offset.y > 100) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <motion.div 
        initial="hidden"
        animate="visible"
        exit="exit"
        variants={variants}
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.5 }}
        onDragEnd={handleDragEnd}
        className="bg-slate-900 w-full max-w-4xl max-h-[85vh] sm:max-h-[90vh] rounded-t-2xl sm:rounded-xl border-t border-x sm:border border-slate-700 shadow-2xl flex flex-col overflow-hidden"
      >
        
        <div className="w-full pt-3 pb-1 cursor-grab active:cursor-grabbing bg-slate-900 flex justify-center" onClick={onClose}>
            <div className="w-12 h-1.5 bg-slate-700 rounded-full"></div>
        </div>

        <div 
            className="p-4 flex justify-between items-center border-b border-white/10"
            style={{ backgroundColor: activeGame.theme.primary, color: activeGame.theme.text }}
        >
            <h3 className="text-lg font-bold flex items-center gap-2">
              <span>🔍</span> 
              Análise Avançada Loto-IA
            </h3>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center border border-white/20 font-bold active:scale-95">✕</button>
        </div>

        {/* Tabs */}
        <div className="flex bg-slate-800 border-b border-slate-700">
            <button 
                onClick={() => setActiveTab('history')}
                className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors ${activeTab === 'history' ? 'bg-slate-700 text-white border-b-2 border-emerald-500' : 'text-slate-400 hover:bg-slate-700/50'}`}
            >
                📜 Histórico
            </button>
            <button 
                onClick={() => setActiveTab('simulator')}
                className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors ${activeTab === 'simulator' ? 'bg-slate-700 text-white border-b-2 border-emerald-500' : 'text-slate-400 hover:bg-slate-700/50'}`}
            >
                💰 Simulador
            </button>
            <button 
                onClick={() => setActiveTab('dashboard')}
                className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors ${activeTab === 'dashboard' ? 'bg-slate-700 text-white border-b-2 border-emerald-500' : 'text-slate-400 hover:bg-slate-700/50'}`}
            >
                📊 Dashboard
            </button>
        </div>

        <div className="flex-1 overflow-y-auto bg-slate-950 cursor-auto" onPointerDownCapture={e => e.stopPropagation()}>
            {activeTab === 'history' && (
                <div className="p-4 space-y-4">
                    <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700 flex flex-col gap-3">
                        <div className="flex flex-col sm:flex-row gap-3">
                            <div className="flex-1">
                                <label className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1 block">Ano</label>
                                <select 
                                value={analysisYear}
                                onChange={(e) => setAnalysisYear(Number(e.target.value))}
                                className="w-full bg-slate-900 text-white border border-slate-600 rounded-lg p-2 text-sm font-bold focus:ring-2 focus:ring-purple-500 outline-none"
                                >
                                    {availableYears && availableYears.map(year => (
                                        <option key={year} value={year}>{year}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex-1">
                                <label className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1 block">Filtrar Bilhetes Premiados</label>
                                <select 
                                value={analysisTargetPoints}
                                onChange={(e) => setAnalysisTargetPoints(Number(e.target.value))}
                                className="w-full bg-slate-900 text-white border border-slate-600 rounded-lg p-2 text-sm font-bold focus:ring-2 focus:ring-purple-500 outline-none"
                                >
                                    {activeGame.id === 'lotofacil' && (
                                        <>
                                        <option value={15}>15 Acertos (Máximo)</option>
                                        <option value={14}>14 Acertos</option>
                                        <option value={13}>13 Acertos</option>
                                        <option value={12}>12 Acertos</option>
                                        <option value={11}>11 Acertos</option>
                                        </>
                                    )}
                                    {activeGame.id === 'megasena' && (
                                        <>
                                        <option value={6}>6 Acertos (Sena)</option>
                                        <option value={5}>5 Acertos (Quina)</option>
                                        <option value={4}>4 Acertos (Quadra)</option>
                                        </>
                                    )}
                                    {activeGame.id === 'quina' && (
                                        <>
                                        <option value={5}>5 Acertos (Quina)</option>
                                        <option value={4}>4 Acertos (Quadra)</option>
                                        <option value={3}>3 Acertos (Terno)</option>
                                        <option value={2}>2 Acertos (Duque)</option>
                                        </>
                                    )}
                                    {activeGame.id === 'lotomania' && (
                                        <>
                                        <option value={20}>20 Acertos</option>
                                        <option value={19}>19 Acertos</option>
                                        <option value={18}>18 Acertos</option>
                                        <option value={17}>17 Acertos</option>
                                        <option value={16}>16 Acertos</option>
                                        <option value={15}>15 Acertos</option>
                                        <option value={0}>0 Acertos</option>
                                        </>
                                    )}
                                    {activeGame.id === 'diadesorte' && (
                                        <>
                                        <option value={7}>7 Acertos</option>
                                        <option value={6}>6 Acertos</option>
                                        <option value={5}>5 Acertos</option>
                                        <option value={4}>4 Acertos</option>
                                        </>
                                    )}
                                    {activeGame.id === 'duplasena' && (
                                        <>
                                        <option value={6}>6 Acertos (Sena)</option>
                                        <option value={5}>5 Acertos (Quina)</option>
                                        <option value={4}>4 Acertos (Quadra)</option>
                                        <option value={3}>3 Acertos (Terno)</option>
                                        </>
                                    )}
                                    {activeGame.id === 'supersete' && (
                                        <>
                                        <option value={7}>7 Acertos</option>
                                        <option value={6}>6 Acertos</option>
                                        <option value={5}>5 Acertos</option>
                                        <option value={4}>4 Acertos</option>
                                        <option value={3}>3 Acertos</option>
                                        </>
                                    )}
                                    {!['lotofacil', 'megasena', 'quina', 'lotomania', 'diadesorte', 'duplasena', 'supersete'].includes(activeGame.id) && (
                                        <option value={activeGame.minSelection}>{activeGame.minSelection} Acertos</option>
                                    )}
                                </select>
                            </div>
                        </div>
                        
                        <button 
                            onClick={onRunAnalysis}
                            disabled={isAnalysisLoading}
                            className={`w-full py-2.5 rounded-lg font-bold text-sm transition-all shadow-lg flex items-center justify-center gap-2 active:scale-95 ${isAnalysisLoading ? 'bg-slate-700 text-slate-400' : `bg-emerald-600 text-white hover:bg-emerald-500 shadow-emerald-900/30`}`}
                        >
                            {isAnalysisLoading ? 'Buscando...' : '🔍 Buscar Resultados'}
                        </button>
                    </div>

                    {isAnalysisLoading ? (
                        <div className="flex flex-col items-center justify-center py-12 gap-4">
                            <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                            <span className="text-emerald-400 font-bold">{analysisProgress}% Carregando...</span>
                        </div>
                    ) : filteredAnalysisResults.length === 0 ? (
                        <div className="text-center py-12 text-slate-500">Nenhum resultado encontrado.</div>
                    ) : (
                        <div className="space-y-3">
                            {filteredAnalysisResults.map((game) => (
                                <div key={game.concurso} className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
                                    <div className="p-3 border-b border-slate-800 flex justify-between items-center">
                                        <span className="font-bold text-emerald-400">Concurso {game.concurso}</span>
                                        <span className="text-xs text-slate-500">{game.data}</span>
                                    </div>
                                    <div className="p-3">
                                        <div className="flex flex-wrap gap-1 mb-2">
                                            {game.dezenas.map(d => (
                                                <span key={d} className="w-7 h-7 rounded-full bg-slate-800 text-white text-xs font-bold flex items-center justify-center border border-slate-700">
                                                    {d}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'simulator' && (
                <div className="p-4 space-y-6">
                    <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700 text-center">
                        <h4 className="text-xl font-bold text-white mb-2">Simulador de Ganhos Reais</h4>
                        <p className="text-slate-400 text-sm mb-6">Teste seus jogos salvos contra todo o histórico da loteria e veja qual seria seu lucro real.</p>
                        <button 
                            onClick={onRunBacktest}
                            disabled={isAnalysisLoading}
                            className="px-8 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-full font-bold shadow-lg transition-all active:scale-95 disabled:opacity-50"
                        >
                            {isAnalysisLoading ? 'Simulando...' : '🚀 Iniciar Backtesting'}
                        </button>
                    </div>

                    {backtestResult && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                                <span className="text-xs text-slate-500 uppercase font-bold">Investimento Total</span>
                                <div className="text-2xl font-mono font-bold text-white">
                                    {backtestResult.totalInvested.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                </div>
                            </div>
                            <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                                <span className="text-xs text-slate-500 uppercase font-bold">Prêmios Acumulados</span>
                                <div className="text-2xl font-mono font-bold text-emerald-400">
                                    {backtestResult.totalPrize.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                </div>
                            </div>
                            <div className={`bg-slate-900 p-4 rounded-xl border ${backtestResult.netProfit >= 0 ? 'border-emerald-500/30' : 'border-red-500/30'} sm:col-span-2`}>
                                <span className="text-xs text-slate-500 uppercase font-bold">Resultado Líquido</span>
                                <div className={`text-3xl font-mono font-bold ${backtestResult.netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                    {backtestResult.netProfit.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                </div>
                                <div className="text-xs mt-1 opacity-70">ROI: {backtestResult.roi.toFixed(2)}%</div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'dashboard' && (
                <div className="p-2">
                    {probabilities && probabilities.length > 0 ? (
                        <Dashboard 
                            probabilities={probabilities} 
                            gameConfig={activeGame} 
                            historyData={analysisResults} 
                        />
                    ) : (
                        <div className="text-center py-20 text-slate-500">
                            Carregue os dados no Histórico primeiro para visualizar o Dashboard.
                        </div>
                    )}
                </div>
            )}
        </div>
      </motion.div>
    </div>
  );
};

export default HistoryAnalysisModal;
