
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
  // false = Expandido (conteúdo visível), true = Recolhido (só cabeçalho)
  const [isMinimized, setIsMinimized] = useState(false);

  const handleSearchSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!searchConcurso) return;
      const num = parseInt(searchConcurso, 10);
      if (!isNaN(num)) {
          const success = await onSearch(num);
          if (success) {
              setIsSearching(false);
              setSearchConcurso('');
          }
      }
  };

  const handleImport = () => {
      if (!result) return;
      const numbers = result.dezenas.map(d => parseInt(d, 10));
      onImport(numbers);
  };

  if (isLoading) {
    return (
      <div className="relative overflow-hidden rounded-2xl h-[200px] shadow-2xl bg-slate-800 border border-slate-700">
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
         </div>
      </div>
    );
  }

  if (!result) return null;

  // Ordenação da premiação: Federal (Ascendente 1..5), Outros (Descendente: Maior prêmio primeiro)
  const displayPrizes = [...(result.premiacoes || [])];
  if (activeGame.id !== 'federal') {
      displayPrizes.reverse();
  }

  return (
    <div 
      className="rounded-2xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)] relative overflow-hidden text-white transition-all duration-500 group border-t border-white/10"
      style={{ 
        background: `linear-gradient(145deg, ${activeGame.theme.primary} 0%, ${activeGame.theme.secondary} 100%)`,
      }}
    >
      <div className="absolute top-[-50px] right-[-50px] w-48 h-48 rounded-full bg-white opacity-5 blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-[-20px] left-[-20px] w-32 h-32 rounded-full bg-black opacity-10 blur-2xl pointer-events-none"></div>

      <div className="relative z-10 p-5">
        {/* HEADER PRINCIPAL */}
        <div className="flex justify-between items-start gap-4 mb-6">
          
          {/* Lado Esquerdo: Info do Concurso e Busca */}
          <div className="flex-1 min-w-0">
             <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-widest opacity-80 truncate">
                    {isLatest ? 'Resultado Oficial' : 'Resultado Passado'}
                </span>
                {!isLatest && (
                    <button 
                        onClick={onReset}
                        className="bg-white/20 hover:bg-white/30 px-2 py-0.5 rounded text-[9px] font-bold uppercase border border-white/20 transition-colors whitespace-nowrap"
                    >
                        Voltar ao Atual
                    </button>
                )}
             </div>
             
             {isSearching ? (
                 <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 mt-1 animate-fade-in w-full max-w-[200px]">
                     <input 
                        autoFocus
                        type="number"
                        placeholder="Nº Conc."
                        value={searchConcurso}
                        onChange={(e) => setSearchConcurso(e.target.value)}
                        className="w-full bg-black/30 border border-white/30 rounded px-2 py-1 text-base font-bold font-mono outline-none focus:bg-black/50 transition-colors text-white placeholder-white/30"
                     />
                     <button type="submit" className="bg-white text-slate-900 px-3 py-1 rounded font-bold text-xs hover:bg-slate-200">Ir</button>
                     <button type="button" onClick={() => setIsSearching(false)} className="text-white/60 hover:text-white px-1 font-bold">✕</button>
                 </form>
             ) : (
                <div className="flex items-baseline gap-2 group/search cursor-pointer" onClick={() => setIsSearching(true)} title="Clique para buscar um concurso">
                    <span className="text-3xl font-black tracking-tighter drop-shadow-md">#{result.concurso}</span>
                    <span className="text-xs opacity-80 font-medium hidden sm:inline-block">{result.data}</span>
                    <span className="opacity-0 group-hover/search:opacity-100 transition-opacity text-xs bg-white/20 rounded-full w-5 h-5 flex items-center justify-center">🔍</span>
                </div>
             )}
             {/* Data visível em mobile se não estiver buscando */}
             {!isSearching && <div className="text-xs opacity-70 font-medium sm:hidden mt-0.5">{result.data}</div>}
          </div>

          {/* Lado Direito: Botões de Ação e Status */}
          <div className="flex flex-col items-end gap-2 shrink-0">
             <div className="flex items-center gap-2">
                 <button 
                      onClick={onRefresh} 
                      disabled={isLoading}
                      className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-all active:scale-95 backdrop-blur-sm border border-white/10"
                      title="Atualizar Resultado"
                    >
                       <svg className={`w-4 h-4 text-white ${isLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                </button>
             </div>
             
             {result.acumulou ? (
                 <span className="text-[10px] font-black bg-yellow-400 text-yellow-900 px-2 py-0.5 rounded shadow-lg uppercase tracking-wide transform hover:scale-105 transition-transform cursor-help" title="Prêmio Acumulado!">
                    Acumulou!
                 </span>
             ) : (
                 <span className="text-[10px] font-bold bg-emerald-500/90 text-white px-2 py-0.5 rounded shadow-sm uppercase tracking-wide">
                    Premiado
                 </span>
             )}
          </div>
        </div>

        <div className="animate-fade-in space-y-6">
            
            {/* BOLAS DO RESULTADO (SEMPRE VISÍVEIS) */}
            <div>
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
                                className="w-10 h-10 flex items-center justify-center rounded-full bg-white text-slate-900 font-black text-base shadow-lg border-2 border-white/50"
                            >
                                {activeGame.id === 'supersete' ? parseInt(n, 10) % 10 : n}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* BOTÃO DE AÇÃO RÁPIDA (SEMPRE VISÍVEL) */}
            {activeGame.id !== 'federal' && (
                <div className="flex justify-end -mt-2">
                        <button 
                        onClick={handleImport}
                        className="flex items-center gap-1.5 bg-white text-slate-900 px-4 py-2 rounded-lg text-xs font-bold shadow-lg hover:bg-slate-100 transition-colors active:scale-95"
                        >
                        <span>⚡</span> Usar estes números
                        </button>
                </div>
            )}
            
            {/* LISTA DE PREMIAÇÃO (CONTAINER) */}
            {displayPrizes.length > 0 && activeGame.id !== 'federal' && (
                <div className="bg-slate-900/90 rounded-xl border border-white/10 shadow-xl relative overflow-hidden animate-slide-down">
                        {/* CABEÇALHO DO CARD DE PREMIAÇÃO COM TOGGLE */}
                        <div 
                            onClick={() => setIsMinimized(!isMinimized)}
                            className={`p-4 flex justify-between items-center cursor-pointer hover:bg-white/5 transition-colors ${!isMinimized ? 'border-b border-white/5' : ''}`}
                        >
                             <h3 
                                className="text-lg font-bold tracking-tight flex items-center gap-2" 
                                style={{ color: activeGame.theme.primary }}
                             >
                                <span>🏆</span> Premiação
                             </h3>
                             <button className="w-6 h-6 flex items-center justify-center rounded-full bg-white/5 border border-white/10 text-slate-300">
                                {isMinimized ? (
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                ) : (
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                                )}
                             </button>
                        </div>
                        
                        {/* CONTEÚDO EXPANSÍVEL */}
                        {!isMinimized && (
                            <div className="animate-fade-in">
                                <div className="space-y-4 max-h-[240px] overflow-y-auto pr-2 custom-scrollbar p-5 pt-4">
                                    {displayPrizes.map((p, idx) => {
                                            let label = `${p.faixa} acertos`;
                                            if (p.faixa === 0) label = 'Outros';

                                            return (
                                                <div key={idx} className="flex flex-col border-b border-slate-800 pb-2 last:border-0 last:pb-0">
                                                    <div className="flex justify-between items-baseline mb-0.5">
                                                        <div className="text-sm font-bold text-slate-200">
                                                            {label}
                                                        </div>
                                                        {p.ganhadores > 0 && (
                                                        <div className="text-xs font-bold text-emerald-400 font-mono">
                                                            {p.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                        </div>
                                                        )}
                                                    </div>
                                                    <div className="text-[11px] font-medium text-slate-500">
                                                        {p.ganhadores > 0 
                                                        ? `${p.ganhadores} aposta(s) ganhadora(s)`
                                                        : 'Não houve acertador'
                                                        }
                                                    </div>
                                                </div>
                                            );
                                    })}
                                </div>

                                {/* ARRECADAÇÃO TOTAL */}
                                <div className="border-t border-slate-700 bg-black/20 px-5 py-3">
                                    <div className="flex justify-between items-center">
                                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                                        Arrecadação Total
                                        </h3>
                                        <div className="text-sm font-bold text-slate-200 font-mono">
                                            {result.valorArrecadado > 0 
                                            ? result.valorArrecadado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                                            : 'Não divulgado'
                                            }
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                </div>
            )}

            {/* PRÓXIMO SORTEIO (SEMPRE VISÍVEL SE FOR O ÚLTIMO) */}
            {isLatest && result.dataProximoConcurso && (
                <div className="mt-4 bg-black/30 backdrop-blur-md rounded-xl p-0.5 border border-white/10 relative overflow-hidden">
                        <div className="px-4 py-3 flex justify-between items-center border-b border-white/5 bg-white/5">
                            <div className="flex flex-col">
                                <span className="text-[9px] uppercase font-bold opacity-60 tracking-wider">Estimativa Próximo Prêmio</span>
                                <span className="text-xl font-bold font-mono tracking-tight text-emerald-300 drop-shadow-md">
                                {result.valorEstimadoProximoConcurso > 0 
                                    ? result.valorEstimadoProximoConcurso.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                                    : 'Aguardando...'}
                                </span>
                            </div>
                        </div>
                        <div className="p-3">
                        <CountdownTimer targetDateStr={result.dataProximoConcurso} />
                        </div>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default LatestResultCard;
