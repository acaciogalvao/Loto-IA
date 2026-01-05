
import React, { useState } from 'react';
import CountdownTimer from './CountdownTimer';
import { LotteryResult, GameConfig } from '../types';

interface LatestResultCardProps {
  isLoading: boolean;
  result: LotteryResult | null;
  activeGame: GameConfig;
  onRefresh: () => void;
  onSearch: (concurso: number) => Promise<boolean>;
  onImport: (numbers: number[]) => void;
  isLatest: boolean;
  onReset: () => void;
}

const LatestResultCard: React.FC<LatestResultCardProps> = ({ 
  isLoading, 
  result, 
  activeGame, 
  onRefresh,
  onSearch,
  onImport,
  isLatest,
  onReset
}) => {
  const [isSearching, setIsSearching] = useState(false);
  const [searchConcurso, setSearchConcurso] = useState('');
  const [showPrizes, setShowPrizes] = useState(false); // Toggle para premiação em telas pequenas

  const handleSearchSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!searchConcurso) return;
      const num = parseInt(searchConcurso, 10);
      if (!isNaN(num)) {
          const success = await onSearch(num);
          if (success) setIsSearching(false);
      }
  };

  const handleImport = () => {
      if (!result) return;
      const numbers = result.dezenas.map(d => parseInt(d, 10));
      onImport(numbers);
  };

  if (isLoading) {
    return (
      <div className="relative overflow-hidden rounded-2xl h-[240px] shadow-2xl bg-slate-800 border border-slate-700">
         <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent skew-x-12 translate-x-[-100%] animate-[shimmer_1.5s_infinite]"></div>
         <div className="p-5 flex flex-col h-full justify-between relative z-10">
            <div className="flex justify-between items-center">
               <div className="space-y-2">
                 <div className="h-4 bg-slate-700 rounded w-24"></div>
                 <div className="h-3 bg-slate-700/50 rounded w-32"></div>
               </div>
               <div className="h-8 w-8 bg-slate-700 rounded-full animate-pulse"></div>
            </div>
            <div className="flex gap-2 flex-wrap justify-center py-4">
               {[...Array(5)].map((_,i) => <div key={i} className="w-10 h-10 rounded-full bg-slate-700 animate-pulse"></div>)}
            </div>
            <div className="h-16 bg-slate-700/30 rounded-xl w-full border border-slate-700"></div>
         </div>
      </div>
    );
  }

  if (!result) return null;

  return (
    <div 
      className="rounded-2xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)] relative overflow-hidden text-white transition-all duration-500 group border-t border-white/10"
      style={{ 
        background: `linear-gradient(145deg, ${activeGame.theme.primary} 0%, ${activeGame.theme.secondary} 100%)`,
      }}
    >
      {/* Decorative Elements */}
      <div className="absolute top-[-50px] right-[-50px] w-48 h-48 rounded-full bg-white opacity-5 blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-[-20px] left-[-20px] w-32 h-32 rounded-full bg-black opacity-10 blur-2xl pointer-events-none"></div>

      <div className="relative z-10 p-5">
        {/* Header: Concurso Info & Search */}
        <div className="flex justify-between items-start mb-6">
          <div className="flex-1">
             <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">
                    {isLatest ? 'Resultado Oficial' : 'Resultado Passado'}
                </span>
                {!isLatest && (
                    <button 
                        onClick={onReset}
                        className="bg-white/20 hover:bg-white/30 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase border border-white/20 transition-colors"
                    >
                        Voltar ao Atual
                    </button>
                )}
             </div>
             
             {isSearching ? (
                 <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 mt-1 animate-fade-in">
                     <input 
                        autoFocus
                        type="number"
                        placeholder="Nº"
                        value={searchConcurso}
                        onChange={(e) => setSearchConcurso(e.target.value)}
                        className="w-20 bg-black/20 border border-white/30 rounded px-2 py-0.5 text-lg font-bold font-mono outline-none focus:bg-black/40 transition-colors"
                     />
                     <button type="submit" className="bg-white text-slate-900 px-2 py-1 rounded font-bold text-xs hover:bg-slate-200">Ir</button>
                     <button type="button" onClick={() => setIsSearching(false)} className="text-white/60 hover:text-white px-1">✕</button>
                 </form>
             ) : (
                <div className="flex items-baseline gap-2 group/search cursor-pointer" onClick={() => setIsSearching(true)}>
                    <span className="text-2xl font-black tracking-tight">#{result.concurso}</span>
                    <span className="text-xs opacity-70 font-medium">{result.data}</span>
                    <span className="opacity-0 group-hover/search:opacity-100 transition-opacity text-xs bg-white/20 rounded-full px-1.5 py-0.5">🔍</span>
                </div>
             )}
          </div>

          <div className="text-right flex flex-col items-end gap-2">
             <button 
                  onClick={onRefresh} 
                  disabled={isLoading}
                  className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-all active:scale-95 backdrop-blur-sm border border-white/10"
                  title="Atualizar Resultado"
                >
                   <svg className={`w-4 h-4 text-white ${isLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            </button>
             
             {result.acumulou ? (
                 <span className="text-[10px] font-black bg-yellow-400 text-yellow-900 px-2 py-0.5 rounded shadow-lg transform -rotate-2 uppercase tracking-wide">
                    Acumulou!
                 </span>
             ) : (
                 <span className="text-[10px] font-bold bg-emerald-500/90 text-white px-2 py-0.5 rounded shadow-sm uppercase tracking-wide">
                    Premiado
                 </span>
             )}
          </div>
        </div>

        {/* Balls / Results Display */}
        <div className="mb-6">
            {activeGame.id === 'federal' ? (
                <div className="space-y-1.5 bg-black/20 p-3 rounded-xl border border-white/10 backdrop-blur-sm">
                    {result.dezenas.slice(0, 5).map((bilhete, idx) => (
                        <div key={idx} className="flex justify-between items-center border-b border-white/5 last:border-0 pb-1 last:pb-0">
                             <span className="text-[9px] uppercase font-bold opacity-60">{idx + 1}º Prêmio</span>
                             <span className="font-mono text-base font-bold tracking-widest text-emerald-300 drop-shadow-sm">{bilhete}</span>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                    {result.dezenas.map((n, idx) => (
                        <div 
                            key={idx}
                            className="w-10 h-10 flex items-center justify-center rounded-full bg-white text-slate-900 font-black text-base shadow-[0_4px_10px_rgba(0,0,0,0.3)] border-2 border-white/50"
                        >
                            {activeGame.id === 'supersete' ? parseInt(n, 10) % 10 : n}
                        </div>
                    ))}
                </div>
            )}
        </div>
        
        {/* TABELA DE PREMIAÇÃO (RATEIO) */}
        {result.premiacoes && result.premiacoes.length > 0 && activeGame.id !== 'federal' && (
            <div className="mb-6 bg-black/20 rounded-xl overflow-hidden border border-white/10 backdrop-blur-sm">
                 <button 
                    onClick={() => setShowPrizes(!showPrizes)}
                    className="w-full flex justify-between items-center px-4 py-2 bg-black/20 hover:bg-black/30 transition-colors text-xs font-bold uppercase tracking-widest text-white/80"
                 >
                     <span>🏆 Premiação Detalhada</span>
                     <span>{showPrizes ? '▲' : '▼'}</span>
                 </button>
                 
                 {showPrizes && (
                     <div className="divide-y divide-white/5 animate-slide-down">
                        <div className="grid grid-cols-12 px-4 py-2 bg-white/5 text-[9px] font-black uppercase text-white/50 tracking-wider">
                            <div className="col-span-4">Faixa</div>
                            <div className="col-span-4 text-center">Ganhadores</div>
                            <div className="col-span-4 text-right">Prêmio</div>
                        </div>
                        {result.premiacoes.map((p, idx) => {
                             const isAccumulated = p.ganhadores === 0;
                             return (
                                 <div key={idx} className={`grid grid-cols-12 px-4 py-2 text-xs items-center ${isAccumulated ? 'opacity-60' : ''}`}>
                                     <div className="col-span-4 font-bold">
                                         {p.faixa === 0 ? '0 acertos' : `${p.faixa} acertos`}
                                     </div>
                                     <div className="col-span-4 text-center text-white/80">
                                         {p.ganhadores > 0 ? p.ganhadores : '-'}
                                     </div>
                                     <div className="col-span-4 text-right font-mono font-bold text-emerald-300">
                                         {p.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                     </div>
                                 </div>
                             );
                        })}
                     </div>
                 )}
            </div>
        )}

        {/* Action Bar (Copy to Generator) */}
        {activeGame.id !== 'federal' && (
            <div className="mb-4 flex justify-end">
                 <button 
                    onClick={handleImport}
                    className="flex items-center gap-1.5 bg-white text-slate-900 px-3 py-1.5 rounded-lg text-xs font-bold shadow-lg hover:bg-slate-100 transition-colors active:scale-95"
                 >
                    <span>⚡</span> Usar para Gerar
                 </button>
            </div>
        )}

        {/* Next Draw & Timer Section (Only if latest) */}
        {isLatest && result.dataProximoConcurso && (
            <div className="bg-black/20 backdrop-blur-md rounded-xl p-0.5 border border-white/10 relative overflow-hidden">
                 <div className="px-4 py-3 flex justify-between items-center border-b border-white/5">
                     <div className="flex flex-col">
                         <span className="text-[9px] uppercase font-bold opacity-60 tracking-wider">Estimativa Prêmio</span>
                         <span className="text-xl font-bold font-mono tracking-tight text-emerald-300 drop-shadow-md">
                            {result.valorEstimadoProximoConcurso > 0 
                                ? result.valorEstimadoProximoConcurso.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                                : 'Aguardando...'}
                         </span>
                     </div>
                 </div>
                 <div className="p-3 bg-black/20">
                    <CountdownTimer targetDateStr={result.dataProximoConcurso} />
                 </div>
            </div>
        )}

      </div>
    </div>
  );
};

export default LatestResultCard;
