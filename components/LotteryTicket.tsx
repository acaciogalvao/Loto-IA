
import React, { useMemo } from 'react';
import { GameConfig, DetailedStats } from '../types';
import TicketNumbers from './tickets/TicketNumbers';
import TicketStats from './tickets/TicketStats';
import { calculateGameScore } from '../utils/lotteryLogic';

interface LotteryTicketProps {
  game: number[];
  index: number; 
  gameNumber?: number; 
  activeGame: GameConfig;
  hits?: number; 
  isSavedView?: boolean; 
  isCopied?: boolean;
  isExpanded?: boolean;
  detailedStats?: DetailedStats | null;
  onCopy?: () => void;
  onAction?: (e: React.MouseEvent) => void; 
  onToggleStats?: (e: React.MouseEvent) => void;
  onShare?: (e: React.MouseEvent) => void; 
  resultNumbers?: Set<number>; 
  team?: string | null; // NOVO: Prop para Time do Coração
}

const LotteryTicket: React.FC<LotteryTicketProps> = ({
  game,
  index,
  gameNumber,
  activeGame,
  hits = 0,
  isSavedView = false,
  isCopied = false,
  isExpanded = false,
  detailedStats,
  onCopy,
  onAction,
  onToggleStats,
  onShare,
  resultNumbers,
  team
}) => {
  const displayNum = gameNumber || index + 1;
  const isFederal = activeGame.id === 'federal';

  // Calculate Price
  const ticketPrice = useMemo(() => {
     const qty = game.length;
     const priceItem = activeGame.priceTable?.find(p => p.quantity == qty);
     return (priceItem && typeof priceItem.price === 'number') ? priceItem.price : 0;
  }, [game.length, activeGame]);

  // Calculate Score (Quality)
  const score = useMemo(() => {
     if (isFederal) return 0;
     return calculateGameScore(game, activeGame);
  }, [game, activeGame, isFederal]);

  // Determine Score Color (Neon Style)
  const getScoreColor = (s: number) => {
      if (s >= 90) return 'text-emerald-400 drop-shadow-[0_0_5px_rgba(52,211,153,0.8)]';
      if (s >= 70) return 'text-cyan-400 drop-shadow-[0_0_5px_rgba(34,211,238,0.8)]';
      if (s >= 50) return 'text-yellow-400';
      return 'text-red-400';
  };

  // --- NEON TIERS LOGIC ---
  const getTierStyles = () => {
      // Default / No Result State (Freshly Generated)
      if (!resultNumbers || resultNumbers.size === 0) {
          return {
              container: "bg-slate-900 border-slate-700 hover:border-slate-500 shadow-lg transition-all",
              barColor: activeGame.theme.primary,
              badge: null,
              glowClass: ''
          };
      }

      // LOTOFÁCIL NEON TIERS (11 to 15)
      if (activeGame.id === 'lotofacil') {
          switch (hits) {
            case 15: // 15 PONTOS: GOLD NEON (Lendário)
                return {
                    container: "bg-slate-950 border-yellow-400 shadow-[0_0_30px_rgba(250,204,21,0.4)] ring-1 ring-yellow-400/50",
                    barColor: '#facc15',
                    badge: (
                        <div className="flex items-center gap-1 bg-yellow-400/20 px-2 py-0.5 rounded text-yellow-300 border border-yellow-400 animate-pulse shadow-[0_0_15px_rgba(250,204,21,0.5)]">
                            <span className="text-xs">👑</span>
                            <span className="text-[10px] font-black uppercase tracking-widest drop-shadow-md">15 PONTOS</span>
                        </div>
                    ),
                    glowClass: 'shadow-[inset_0_0_20px_rgba(250,204,21,0.1)]'
                };
            case 14: // 14 PONTOS: CYAN NEON (Elétrico)
                return {
                    container: "bg-slate-950 border-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.3)] ring-1 ring-cyan-400/30",
                    barColor: '#22d3ee',
                    badge: (
                        <div className="flex items-center gap-1 bg-cyan-400/20 px-2 py-0.5 rounded text-cyan-300 border border-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.4)]">
                            <span className="text-xs">💎</span>
                            <span className="text-[10px] font-black uppercase tracking-widest">14 PONTOS</span>
                        </div>
                    ),
                    glowClass: 'shadow-[inset_0_0_15px_rgba(34,211,238,0.05)]'
                };
            case 13: // 13 PONTOS: MAGENTA NEON (Intenso)
                return {
                    container: "bg-slate-950 border-fuchsia-500 shadow-[0_0_15px_rgba(217,70,239,0.25)]",
                    barColor: '#d946ef',
                    badge: (
                        <div className="flex items-center gap-1 bg-fuchsia-500/20 px-2 py-0.5 rounded text-fuchsia-300 border border-fuchsia-500 shadow-[0_0_8px_rgba(217,70,239,0.3)]">
                            <span className="text-xs">✨</span>
                            <span className="text-[10px] font-black uppercase tracking-widest">13 PONTOS</span>
                        </div>
                    ),
                    glowClass: ''
                };
            case 12: // 12 PONTOS: PURPLE NEON
                return {
                    container: "bg-slate-950 border-violet-500 shadow-[0_0_10px_rgba(139,92,246,0.2)]",
                    barColor: '#8b5cf6',
                    badge: (
                        <div className="flex items-center gap-1 bg-violet-500/10 px-2 py-0.5 rounded text-violet-300 border border-violet-500/50">
                            <span className="text-[10px] font-bold uppercase tracking-wider">12 PONTOS</span>
                        </div>
                    ),
                    glowClass: ''
                };
            case 11: // 11 PONTOS: GREEN TOXIC NEON
                return {
                    container: "bg-slate-950 border-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.2)]",
                    barColor: '#10b981',
                    badge: (
                        <div className="flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5 rounded text-emerald-400 border border-emerald-500/50">
                            <span className="text-[10px] font-bold uppercase tracking-wider">11 PONTOS</span>
                        </div>
                    ),
                    glowClass: ''
                };
            default: // LOSS - IMPROVED VISIBILITY
                return {
                    // Removed opacity-60, changed background to dark slate and border to visible slate
                    container: "bg-slate-900 border-slate-700 hover:border-slate-500 transition-colors",
                    barColor: '#64748b', // slate-500
                    badge: hits > 0 ? (
                        <div className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-600 text-[9px] font-bold">
                            {hits} acertos
                        </div>
                    ) : null,
                    glowClass: ''
                };
          }
      }

      // GENERIC LOGIC FOR OTHER GAMES (Keep Neon Style)
      let isWin = false;
      let isJackpot = false;
      
      if (activeGame.id === 'megasena') { if(hits>=4) isWin=true; if(hits===6) isJackpot=true; }
      else if (activeGame.id === 'quina') { if(hits>=2) isWin=true; if(hits===5) isJackpot=true; }
      else if (activeGame.id === 'lotomania') { if(hits>=15 || hits===0) isWin=true; if(hits===20) isJackpot=true; }
      else if (activeGame.id === 'supersete') { if(hits>=3) isWin=true; if(hits===7) isJackpot=true; }
      else if (activeGame.id === 'timemania') { if(hits>=3) isWin=true; if(hits===7) isJackpot=true; }

      if (isJackpot) {
          return {
            container: "bg-slate-950 border-yellow-400 shadow-[0_0_30px_rgba(250,204,21,0.5)]",
            barColor: '#facc15',
            badge: (
                <div className="flex items-center gap-1 bg-yellow-400/20 px-2 py-0.5 rounded text-yellow-300 border border-yellow-400 animate-pulse shadow-[0_0_15px_rgba(250,204,21,0.5)]">
                    <span className="text-xs">🏆</span>
                    <span className="text-[9px] font-black uppercase tracking-wider">JACKPOT</span>
                </div>
            ),
            glowClass: 'shadow-[inset_0_0_20px_rgba(250,204,21,0.1)]'
          };
      } 
      if (isWin) {
          return {
            container: "bg-slate-950 border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)]",
            barColor: '#10b981',
            badge: (
                <div className="flex items-center gap-1 bg-emerald-500/20 px-2 py-0.5 rounded text-emerald-300 border border-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.2)]">
                    <span className="text-xs">💰</span>
                    <span className="text-[9px] font-black uppercase tracking-wider">PREMIADO</span>
                </div>
            ),
            glowClass: ''
          };
      }

      // GENERIC LOSS - IMPROVED VISIBILITY
      return {
          container: "bg-slate-900 border-slate-700 hover:border-slate-500 transition-colors",
          barColor: activeGame.theme.primary,
          badge: hits > 0 ? (
            <div className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-600 text-[9px] font-bold">
                {hits} acertos
            </div>
          ) : null,
          glowClass: ''
      };
  };

  const { container: containerClasses, barColor, badge, glowClass } = getTierStyles();

  return (
    <div 
        onClick={onCopy}
        className={`relative rounded-xl border p-0.5 overflow-hidden group cursor-pointer transition-all duration-300 active:scale-[0.98] ${containerClasses} ${isCopied ? 'ring-2 ring-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.5)]' : ''}`}
    >
        {/* Neon Accent Bar */}
        <div 
            className="absolute left-0 top-0 bottom-0 w-1 transition-colors duration-300 shadow-[0_0_10px_currentColor]"
            style={{ backgroundColor: barColor, color: barColor }}
        ></div>

        {/* Inner Content with optional inner glow */}
        <div className={`bg-slate-900/95 rounded-[10px] pl-4 pr-3 py-3 relative z-10 h-full backdrop-blur-md ${glowClass}`}>
            
            {/* Header */}
            <div className="flex justify-between items-start mb-2">
                <div>
                    <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">
                            Jogo {String(displayNum).padStart(2, '0')}
                        </span>
                        {badge}
                    </div>
                    {/* Price Tag & Score */}
                    {!isFederal && (
                        <div className="flex items-center gap-2">
                            {ticketPrice > 0 && (
                                <span className="text-[9px] text-slate-300 font-mono bg-slate-800 px-1.5 rounded border border-slate-700">
                                    {ticketPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                </span>
                            )}
                            <span className={`text-[9px] font-bold flex items-center gap-0.5 ${getScoreColor(score)}`}>
                                <span>⚡</span> Score: {score}
                            </span>
                        </div>
                    )}
                </div>

                <div className="flex gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                     {!isFederal && onToggleStats && (
                        <button 
                            onClick={(e) => { e.stopPropagation(); onToggleStats(e); }}
                            className={`w-6 h-6 flex items-center justify-center rounded-full transition-colors ${isExpanded ? 'bg-indigo-600 text-white shadow-[0_0_10px_#4f46e5]' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white border border-slate-700'}`}
                            title="Estatísticas Detalhadas"
                        >
                            <span className="text-[10px]">📊</span>
                        </button>
                     )}
                     
                     {onAction && (
                        <button 
                            onClick={(e) => { e.stopPropagation(); onAction(e); }}
                            className={`w-6 h-6 flex items-center justify-center rounded-full transition-colors ${isSavedView ? 'bg-red-900/40 text-red-400 border border-red-500/50 hover:bg-red-600 hover:text-white' : 'bg-slate-800 text-slate-400 hover:bg-emerald-600 hover:text-white border border-slate-700'}`}
                            title={isSavedView ? "Excluir" : "Salvar"}
                        >
                            <span className="text-[10px]">{isSavedView ? '✕' : '💾'}</span>
                        </button>
                     )}
                </div>
            </div>

            {/* Numbers */}
            <TicketNumbers 
                numbers={game} 
                activeGame={activeGame} 
                resultNumbers={resultNumbers} 
            />
            
            {/* DISPLAY TIME DO CORAÇÃO */}
            {team && (
                <div className="mt-2 text-[10px] font-bold text-yellow-400 flex items-center gap-1 bg-yellow-900/20 px-2 py-0.5 rounded border border-yellow-500/20 w-fit">
                    <span>♥</span>
                    <span className="tracking-wide uppercase">{team}</span>
                </div>
            )}
            
            {/* Stats Summary - Brighter Text for Visibility */}
            {!isExpanded && !isFederal && detailedStats && (
                <div className="mt-2 pt-2 border-t border-slate-800 flex flex-wrap gap-x-3 gap-y-1 text-[9px] text-slate-400 font-medium opacity-90">
                    <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_5px_#3b82f6]"></span> {detailedStats.pares} Pares</span>
                    <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-orange-500 shadow-[0_0_5px_#f97316]"></span> Soma {detailedStats.soma}</span>
                </div>
            )}

            {isExpanded && (
                <div className="mt-3 pt-2 border-t border-slate-700/50 animate-slide-down">
                    <TicketStats 
                        stats={detailedStats || null} 
                        activeGame={activeGame} 
                        resultNumbers={resultNumbers}
                        gameNumbers={game}
                    />
                </div>
            )}

            {/* NEON SHARE BUTTON */}
            {onShare && (
                <div className="mt-3 pt-2 border-t border-slate-800 flex justify-between items-center">
                    <span className="text-[8px] text-slate-500 font-bold uppercase tracking-widest">LotoSmart AI</span>
                    <button 
                        onClick={(e) => { e.stopPropagation(); onShare(e); }}
                        className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold px-3 py-1.5 rounded shadow-[0_0_10px_rgba(79,70,229,0.5)] transition-all border border-indigo-400 hover:shadow-[0_0_15px_rgba(79,70,229,0.8)] active:scale-95 group/btn"
                    >
                        <span className="group-hover/btn:scale-110 transition-transform text-xs">🚀</span>
                        <span className="tracking-wide">COMPARTILHAR</span>
                    </button>
                </div>
            )}
        </div>

        {/* Copied Overlay */}
        {isCopied && (
            <div className="absolute inset-0 z-20 bg-emerald-900/90 flex items-center justify-center animate-fade-in backdrop-blur-sm">
                <div className="text-emerald-100 font-bold flex flex-col items-center drop-shadow-[0_0_10px_rgba(16,185,129,0.8)]">
                    <span className="text-3xl mb-1">📋</span>
                    <span className="text-sm uppercase tracking-widest">Copiado!</span>
                </div>
            </div>
        )}
    </div>
  );
};

export default LotteryTicket;
