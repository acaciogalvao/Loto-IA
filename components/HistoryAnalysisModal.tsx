
import React, { useMemo } from 'react';
import { motion, PanInfo } from 'framer-motion';
import { PastGameResult, GameConfig } from '../types';

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
  analysisResults
}) => {
  if (!isOpen) return null;

  const filteredAnalysisResults = useMemo(() => {
    if (analysisResults.length === 0) return [];
    return analysisResults.filter(game => {
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
        className="bg-slate-900 w-full max-w-2xl max-h-[85vh] sm:max-h-[90vh] rounded-t-2xl sm:rounded-xl border-t border-x sm:border border-slate-700 shadow-2xl flex flex-col overflow-hidden"
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
              Raio-X Histórico
            </h3>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center border border-white/20 font-bold active:scale-95">✕</button>
        </div>

        <div className="p-4 bg-slate-800/50 border-b border-slate-700 flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1">
                    <label className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1 block">Ano</label>
                    <select 
                      value={analysisYear}
                      onChange={(e) => setAnalysisYear(Number(e.target.value))}
                      className="w-full bg-slate-900 text-white border border-slate-600 rounded-lg p-2 text-sm font-bold focus:ring-2 focus:ring-purple-500 outline-none"
                    >
                        {availableYears.map(year => (
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
                              <option value={15}>15 Pontos (Prêmio Máximo)</option>
                              <option value={14}>14 Pontos</option>
                              <option value={13}>13 Pontos</option>
                              <option value={12}>12 Pontos</option>
                              <option value={11}>11 Pontos</option>
                            </>
                        )}
                        {activeGame.id === 'megasena' && (
                            <>
                              <option value={6}>6 Pontos (Sena)</option>
                              <option value={5}>5 Pontos (Quina)</option>
                              <option value={4}>4 Pontos (Quadra)</option>
                            </>
                        )}
                        {!['lotofacil', 'megasena'].includes(activeGame.id) && (
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
        
        {!isAnalysisLoading && analysisResults.length > 0 && (
            <div className="px-4 py-2 bg-slate-900 border-b border-slate-800 flex justify-between items-center text-xs">
                <span className="text-slate-400">
                    Total filtrado em {analysisYear}: <strong className="text-slate-200">{analysisResults.length}</strong>
                </span>
                <span className={`font-bold ${filteredAnalysisResults.length > 0 ? 'text-emerald-400' : 'text-slate-500'}`}>
                    {filteredAnalysisResults.length} sorteios com ganhadores de {analysisTargetPoints} pts
                </span>
            </div>
        )}

        <div className="flex-1 overflow-y-auto bg-slate-950 p-3 sm:p-4 space-y-3 relative min-h-[300px] pb-[calc(20px+env(safe-area-inset-bottom))] cursor-auto" onPointerDownCapture={e => e.stopPropagation()}>
            {isAnalysisLoading ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 z-50 gap-4">
                   <div className="relative">
                       <div className="w-12 h-12 border-4 border-gray-700 rounded-full"></div>
                       <div className="w-12 h-12 border-4 border-yellow-400 rounded-full animate-spin absolute top-0 left-0 border-t-transparent shadow-[0_0_15px_rgba(250,204,21,0.6)]"></div>
                   </div>
                   <div className="text-center space-y-1">
                       <span className="text-white font-bold text-sm block tracking-wide">BUSCANDO DADOS...</span>
                       <span className="text-yellow-400 font-mono text-xl font-bold block">{analysisProgress}%</span>
                   </div>
                   <div className="w-48 h-2 bg-gray-800 rounded-full overflow-hidden border border-gray-600">
                       <div className="h-full bg-yellow-400 transition-all duration-150 ease-linear shadow-[0_0_10px_rgba(250,204,21,0.8)]" style={{width: `${analysisProgress}%`}}></div>
                   </div>
                </div>
            ) : filteredAnalysisResults.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-2 min-h-[200px]">
                    {analysisResults.length === 0 ? (
                        <>
                          <span className="text-4xl opacity-20">📅</span>
                          <p>Clique em "Buscar" para carregar os dados de {analysisYear}.</p>
                        </>
                    ) : (
                        <>
                          <span className="text-2xl opacity-30">📭</span>
                          <p>Nenhum bilhete premiado com <strong>{analysisTargetPoints} pontos</strong> encontrado em {analysisYear}.</p>
                        </>
                    )}
                </div>
            ) : (
                filteredAnalysisResults.map((game) => {
                    const targetPrize = game.premiacoes.find(p => p.faixa === analysisTargetPoints);
                    const winners = targetPrize ? targetPrize.ganhadores : 0;
                    const value = targetPrize ? targetPrize.valor : 0;
                    const locations = targetPrize ? targetPrize.locais : [];
                    const totalPot = value * winners;

                    return (
                        <div key={game.concurso} className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden shadow-md group hover:border-slate-500 transition-colors">
                            <div className="flex justify-between items-center p-3 border-b border-slate-700/50 bg-black/20">
                                <div>
                                    <span className="text-sm font-bold" style={{ color: activeGame.theme.primary }}>Concurso {game.concurso}</span>
                                    <span className="text-[10px] text-slate-500 ml-2">{game.data}</span>
                                </div>
                                
                                <div className={`px-3 py-1 rounded text-xs font-bold border flex flex-col items-end bg-emerald-900/20 border-emerald-500/30 text-emerald-400`}>
                                    <span>{analysisTargetPoints} Pontos</span>
                                    <span className="text-[10px] text-emerald-200/70">
                                        {winners} ganhador(es)
                                    </span>
                                </div>
                            </div>
                            
                            <div className="p-3">
                                <div className="flex flex-wrap gap-1 mb-2">
                                    {game.dezenas.map(d => (
                                        <span 
                                            key={d} 
                                            className="w-6 h-6 rounded-full text-white text-[10px] font-bold flex items-center justify-center border border-white/20"
                                            style={{ backgroundColor: activeGame.theme.primary }}
                                        >
                                            {d}
                                        </span>
                                    ))}
                                </div>
                                
                                {value > 0 && (
                                    <div className="mt-3 pt-3 border-t border-slate-700/50">
                                        <div className="flex justify-between items-center gap-2 mb-3">
                                            <div className="flex flex-col">
                                                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Prêmio por aposta</span>
                                                <span className="text-sm font-mono font-bold text-emerald-300 bg-emerald-900/30 px-2 py-0.5 rounded border border-emerald-500/30 inline-block w-fit">
                                                    {value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                </span>
                                            </div>
                                            
                                            {winners > 1 && (
                                                <div className="flex flex-col items-end opacity-60">
                                                    <span className="text-[9px] text-slate-500 uppercase font-bold tracking-wider">Total Distribuído</span>
                                                    <span className="text-[10px] font-mono text-slate-400">
                                                        {totalPot.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                        
                                        {locations && locations.length > 0 ? (
                                            <div className="bg-slate-900/80 rounded-lg p-3 border border-slate-600 shadow-inner">
                                                <span className="text-[10px] text-yellow-500 uppercase font-extrabold block mb-2 flex items-center gap-1 border-b border-slate-700 pb-1">
                                                    <span>🌍</span> Cidades Ganhadoras:
                                                </span>
                                                <div className="flex flex-wrap gap-2">
                                                    {locations.map((loc, i) => (
                                                        <div key={i} className="text-[11px] bg-blue-600/20 border border-blue-500/40 text-blue-100 px-2 py-1 rounded flex items-center gap-1.5 shadow-sm hover:bg-blue-600/30 transition-colors">
                                                           <span className="text-blue-400">📍</span>
                                                           <span className="font-bold">{loc.cidade}</span>
                                                           <span className="text-blue-300 font-normal">({loc.uf})</span>
                                                           {loc.ganhadores > 1 && <span className="text-[9px] bg-white/20 px-1.5 rounded-full text-white font-bold ml-1">x{loc.ganhadores}</span>}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ) : (
                                            winners > 0 && <div className="text-[10px] text-slate-500 italic mt-1 pl-1 border-l-2 border-slate-700 py-1 bg-black/10">
                                                📍 Cidades não informadas pela API para este concurso.
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })
            )}
        </div>
      </motion.div>
    </div>
  );
};

export default HistoryAnalysisModal;
