
import React, { useMemo } from 'react';
import NumberBall from './NumberBall';
import { GameConfig, AppStatus } from '../types';
import { calculateDetailedStats, calculateGameScore, getBalanceStatus } from '../utils/lotteryLogic';

interface NumberSelectionPanelProps {
  activeGame: GameConfig;
  selectedNumbers: Set<number>;
  onToggleNumber: (num: number) => void;
  gameSize: number;
  onAutoSelectSize: (size: number) => void;
  generationLimit: number | string;
  setGenerationLimit: (limit: number | string) => void;
  closingMethod: 'reduced' | 'smart_pattern' | 'guaranteed' | 'free_mode';
  setClosingMethod: (method: 'reduced' | 'smart_pattern' | 'guaranteed' | 'free_mode') => void;
  status: AppStatus;
  resultNumbers?: Set<number>;
  onOpenAnalysis: () => void;
}

const NumberSelectionPanel: React.FC<NumberSelectionPanelProps> = ({
  activeGame,
  selectedNumbers,
  onToggleNumber,
  gameSize,
  onAutoSelectSize,
  generationLimit,
  setGenerationLimit,
  closingMethod,
  setClosingMethod,
  status,
  resultNumbers,
  onOpenAnalysis
}) => {
  if (activeGame.id === 'federal') return null;

  const allNumbers = useMemo(() => {
    if (activeGame.id === 'supersete') {
        const nums = [];
        for (let val = 0; val <= 9; val++) { 
            for (let col = 0; col < 7; col++) { 
                nums.push(col * 10 + val);
            }
        }
        return nums;
    }
    if (activeGame.id === 'lotomania') {
        return Array.from({ length: 100 }, (_, i) => i);
    }
    return Array.from({ length: activeGame.totalNumbers }, (_, i) => i + 1);
  }, [activeGame.id, activeGame.totalNumbers]);

  const selectionCount = selectedNumbers.size;

  // Real-time Stats Calculation
  const { realTimeStats, optimizationScore } = useMemo(() => {
      if (selectionCount === 0) return { realTimeStats: null, optimizationScore: 0 };
      const nums = (Array.from(selectedNumbers) as number[]).sort((a,b) => a-b);
      const stats = calculateDetailedStats(nums, undefined, activeGame);
      const score = calculateGameScore(nums, activeGame);
      return { realTimeStats: stats, optimizationScore: score };
  }, [selectedNumbers, activeGame, selectionCount]);

  const methods = [
      { id: 'smart_pattern', label: 'Padrão Ouro' },
      { id: 'reduced', label: 'Fechamento' },
      { id: 'guaranteed', label: 'Matemático' },
      { id: 'free_mode', label: 'Modo Livre' }
  ];

  // Helper de Cor para Stats
  const getStatusColor = (status: 'ideal' | 'warn' | 'bad') => {
      if (status === 'ideal') return 'text-emerald-400';
      if (status === 'warn') return 'text-yellow-400';
      return 'text-red-400';
  };

  return (
    <div className="space-y-4">
      {/* ÁREA DE CONTROLES COMPACTA */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-3 shadow-lg">
          
          {/* Seletor de Quantidade de Dezenas */}
          <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Dezenas no Jogo</span>
              <div className="flex bg-slate-900 rounded-lg p-0.5 border border-slate-700 overflow-x-auto max-w-[200px] no-scrollbar">
                {Array.from({ length: activeGame.maxSelection - activeGame.minSelection + 1 }, (_, i) => activeGame.minSelection + i).map(size => {
                    const isActive = gameSize === size;
                    return (
                    <button
                        key={size}
                        onClick={() => onAutoSelectSize(size)}
                        className={`min-w-[28px] h-[24px] rounded text-[10px] font-bold transition-all flex items-center justify-center ${!isActive ? 'text-slate-500 hover:text-slate-300' : 'text-white shadow-sm'}`}
                        style={isActive ? { backgroundColor: activeGame.theme.primary } : {}}
                    >
                        {size}
                    </button>
                )})}
              </div>
          </div>

          <div className="h-px bg-slate-700/50 w-full mb-3"></div>

          {/* Configurações de Geração - Botões e Input */}
          <div className="flex flex-col gap-2">
              <div className="flex justify-between items-center">
                  <span className="text-[9px] text-slate-500 font-bold uppercase">Método de Geração</span>
                  <div className="flex items-center gap-2">
                       <span className="text-[9px] text-slate-500 font-bold uppercase">Qtd. Jogos</span>
                       <input 
                          type="number" 
                          min="1" 
                          max="200"
                          value={generationLimit}
                          onChange={(e) => setGenerationLimit(e.target.value)}
                          disabled={closingMethod === 'free_mode'}
                          className={`w-12 bg-slate-900 text-white text-[10px] font-bold border border-slate-600 rounded-md px-1 py-1 text-center outline-none focus:border-blue-500 transition-opacity ${closingMethod === 'free_mode' ? 'opacity-50 cursor-not-allowed text-slate-400' : ''}`}
                      />
                  </div>
              </div>
              
              <div className="flex flex-wrap gap-2">
                  {methods.map((method) => {
                      const isActive = closingMethod === method.id;
                      return (
                          <button
                              key={method.id}
                              onClick={() => setClosingMethod(method.id as any)}
                              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all border ${isActive 
                                  ? 'text-white border-transparent shadow-md transform scale-105' 
                                  : 'bg-slate-900 text-slate-400 border-slate-700 hover:border-slate-500 hover:text-slate-200'}`}
                              style={isActive ? { backgroundColor: activeGame.theme.primary } : {}}
                          >
                              {method.label}
                          </button>
                      );
                  })}
                  
                  {/* Botão Raio-X Integrado */}
                  <button
                      onClick={onOpenAnalysis}
                      className="px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all border border-indigo-500/50 bg-indigo-900/20 text-indigo-300 hover:bg-indigo-900/40 hover:text-indigo-100 flex items-center gap-1 ml-auto"
                  >
                      <span>🔍</span> Raio-X
                  </button>
              </div>
          </div>
      </div>

      {/* Real-time Stats Dashboard (Medidor de Qualidade) */}
      {realTimeStats && selectionCount > activeGame.minSelection / 2 && (
        <div className="bg-slate-900/80 border border-slate-700 rounded-lg p-3 animate-fade-in backdrop-blur-sm shadow-md">
            
            {/* IO: Índice de Otimização */}
            <div className="mb-2">
                <div className="flex justify-between items-end mb-1">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Qualidade da Seleção (IO)</span>
                    <span className={`text-xs font-black ${optimizationScore > 75 ? 'text-emerald-400' : (optimizationScore > 50 ? 'text-yellow-400' : 'text-red-400')}`}>
                        {optimizationScore}/100
                    </span>
                </div>
                <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden border border-slate-700">
                    <div 
                        className={`h-full transition-all duration-500 ${optimizationScore > 75 ? 'bg-emerald-500' : (optimizationScore > 50 ? 'bg-yellow-500' : 'bg-red-500')}`} 
                        style={{ width: `${optimizationScore}%` }}
                    ></div>
                </div>
            </div>

            <div className="flex items-center justify-between text-[10px] font-mono pt-1 border-t border-slate-800">
                <div className="flex items-center gap-2">
                    <span className="text-slate-500">Pares: <strong className={getStatusColor(getBalanceStatus(realTimeStats.pares, Math.floor(selectionCount/2)-1, Math.ceil(selectionCount/2)+1))}>{realTimeStats.pares}</strong></span>
                    <span className="w-px h-2 bg-slate-700"></span>
                    <span className="text-slate-500">Ímpares: <strong className={getStatusColor(getBalanceStatus(realTimeStats.impares, Math.floor(selectionCount/2)-1, Math.ceil(selectionCount/2)+1))}>{realTimeStats.impares}</strong></span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-slate-500">Soma: <strong className={activeGame.id === 'lotofacil' ? getStatusColor(getBalanceStatus(realTimeStats.soma, 180, 220)) : 'text-slate-200'}>{realTimeStats.soma}</strong></span>
                </div>
            </div>
        </div>
      )}

      {/* O VOLANTE FÍSICO SIMULADO */}
      <div className="relative isolate">
          {/* Shadow Behind */}
          <div className="absolute inset-0 bg-white/5 blur-xl rounded-xl -z-10 translate-y-2"></div>
          
          <div className="bg-slate-100 rounded-xl overflow-hidden shadow-2xl relative border border-slate-300/50">
              
              {/* Header do Volante */}
              <div className="px-4 py-3 flex justify-between items-center bg-white border-b border-slate-200 shadow-sm relative z-20">
                  <div className="flex items-center gap-2">
                      <div 
                        className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold shadow-sm"
                        style={{ backgroundColor: activeGame.theme.primary }}
                      >
                           {activeGame.name[0]}
                      </div>
                      <div>
                          <span className="block text-xs font-bold text-slate-700 leading-none">{activeGame.name}</span>
                          <span className="text-[9px] text-slate-400 font-medium">Selecione os números</span>
                      </div>
                  </div>
                  <div className="flex items-center gap-3">
                       {/* Legenda do Último Sorteio */}
                       {resultNumbers && resultNumbers.size > 0 && (
                          <div className="flex items-center gap-1 bg-yellow-50 px-2 py-0.5 rounded-full border border-yellow-200">
                              <div className="w-2 h-2 rounded-full border-2 border-yellow-400"></div>
                              <span className="text-[8px] font-bold text-yellow-600 uppercase">Último</span>
                          </div>
                       )}
                       
                       <div className="bg-slate-100 px-2 py-1 rounded border border-slate-200">
                           <span className={`text-sm font-mono font-bold ${selectionCount === activeGame.maxSelection ? 'text-red-500' : 'text-slate-600'}`}>
                               {selectionCount}<span className="text-slate-400 text-[10px]">/{activeGame.maxSelection}</span>
                           </span>
                       </div>
                  </div>
              </div>

              {/* A GRADE DE NÚMEROS */}
              <div className="p-4 bg-[#f8fafc] relative">
                  
                  {/* CABEÇALHO DE COLUNAS SUPER SETE */}
                  {activeGame.id === 'supersete' && (
                      <div 
                        className="grid gap-x-1.5 mb-2 relative z-10 mx-auto justify-items-center"
                        style={{ 
                            gridTemplateColumns: `repeat(${activeGame.cols}, minmax(0, 1fr))`,
                            maxWidth: activeGame.cols > 7 ? '100%' : '320px' 
                        }}
                      >
                          {[1,2,3,4,5,6,7].map(c => (
                              <div key={c} className="flex items-center justify-center w-full">
                                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Col {c}</span>
                              </div>
                          ))}
                      </div>
                  )}

                  <div 
                    className="grid gap-x-1.5 gap-y-2 relative z-10 mx-auto justify-items-center"
                    style={{ 
                        gridTemplateColumns: `repeat(${activeGame.cols}, minmax(0, 1fr))`,
                        maxWidth: activeGame.cols > 7 ? '100%' : '320px' 
                    }}
                  >
                    {allNumbers.map(number => (
                      <NumberBall
                        key={number}
                        number={number}
                        label={activeGame.id === 'supersete' ? (number % 10).toString() : undefined}
                        isSelected={selectedNumbers.has(number)}
                        isRecentResult={resultNumbers ? resultNumbers.has(number) : false}
                        onClick={onToggleNumber}
                        activeGame={activeGame}
                        size={activeGame.totalNumbers > 60 ? 'small' : 'medium'}
                      />
                    ))}
                  </div>
              </div>
              
              {/* Footer decorativo do volante */}
              <div className="bg-white p-2 border-t border-slate-200 flex justify-center">
                   <div className="w-16 h-1 bg-slate-200 rounded-full"></div>
              </div>
          </div>
      </div>
    </div>
  );
};

export default NumberSelectionPanel;
