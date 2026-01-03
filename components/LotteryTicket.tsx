import React from 'react';
import NumberBall from './NumberBall';
import { GameConfig, DetailedStats } from '../types';

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
  resultNumbers?: Set<number>; 
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
  resultNumbers
}) => {
  const displayNum = gameNumber || index + 1;
  const isFederal = activeGame.id === 'federal';
  const isSuperSete = activeGame.id === 'supersete';

  let borderClass = `border-${activeGame.color}-500/30`;
  let bgClass = "bg-white";
  let statusBadge = null;

  if (resultNumbers && resultNumbers.size > 0) {
    let isWin = false;
    let isJackpot = false;

    if (activeGame.id === 'lotofacil') { if(hits>=11) isWin=true; if(hits===15) isJackpot=true; }
    else if (activeGame.id === 'megasena') { if(hits>=4) isWin=true; if(hits===6) isJackpot=true; }
    else if (activeGame.id === 'quina') { if(hits>=2) isWin=true; if(hits===5) isJackpot=true; }
    else if (activeGame.id === 'lotomania') { if(hits>=15 || hits===0) isWin=true; if(hits===20) isJackpot=true; }
    else if (activeGame.id === 'supersete') { if(hits>=3) isWin=true; if(hits===7) isJackpot=true; }
    
    if (isJackpot) {
        borderClass = "border-yellow-400 border-2";
        bgClass = "bg-yellow-50";
        statusBadge = <div className="bg-gradient-to-r from-yellow-500 to-amber-600 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-sm flex items-center gap-1">🏆 {hits} PONTOS - PRÊMIO MÁXIMO</div>;
    } else if (isWin) {
        borderClass = "border-emerald-500 border-2";
        bgClass = "bg-emerald-50";
        statusBadge = <div className="bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-sm">💰 {hits} PONTOS - PREMIADO</div>;
    } else if (hits > 0) {
        statusBadge = <div className="bg-slate-200 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded">{hits} acertos</div>;
    }
  }

  return (
    <div 
        onClick={onCopy}
        className={`relative rounded-xl overflow-hidden shadow-lg transition-all duration-200 hover:shadow-xl hover:scale-[1.01] cursor-pointer group ${bgClass} ${isCopied ? 'ring-2 ring-emerald-500' : ''}`}
    >
        <div className={`absolute top-0 bottom-0 left-0 w-1.5 bg-gradient-to-b from-${activeGame.color}-400 to-${activeGame.color}-700`}></div>

        {isCopied && (
            <div className="absolute inset-0 z-50 bg-emerald-600/90 flex items-center justify-center animate-fade-in backdrop-blur-sm">
                <span className="text-white font-bold text-lg flex items-center gap-2 shadow-black drop-shadow-md">📋 Copiado!</span>
            </div>
        )}

        <div className="pl-4 pr-0 py-0 flex flex-col h-full">
            
            <div className="flex justify-between items-center py-2 pr-3 border-b border-dashed border-slate-300 relative">
                <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold uppercase tracking-wider text-${activeGame.color}-700`}>
                        {isFederal ? 'Bilhete' : 'Jogo'} {String(displayNum).padStart(2, '0')}
                    </span>
                    {statusBadge}
                </div>
                
                <div className="flex gap-1 z-20">
                     {!isFederal && onToggleStats && (
                        <button 
                            onClick={onToggleStats}
                            className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors border border-slate-200 ${isExpanded ? `bg-${activeGame.color}-600 text-white` : 'bg-white text-slate-400 hover:bg-slate-100 hover:text-slate-600'}`}
                            title="Ver Estatísticas"
                        >
                            📊
                        </button>
                     )}
                     
                     {onAction && (
                        <button 
                            onClick={onAction}
                            className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors border border-slate-200 ${isSavedView ? 'bg-red-50 text-red-400 hover:bg-red-100' : 'bg-white text-slate-400 hover:bg-blue-50 hover:text-blue-500'}`}
                            title={isSavedView ? "Excluir Jogo" : "Salvar Jogo"}
                        >
                            {isSavedView ? '✕' : '💾'}
                        </button>
                     )}
                </div>

                <div className="absolute -right-1.5 top-full -mt-[5px] w-3 h-3 bg-slate-900 rounded-full z-10"></div>
                <div className="absolute -left-5 top-full -mt-[5px] w-3 h-3 bg-slate-900 rounded-full z-10"></div>
            </div>

            <div className="py-3 pr-3 relative">
                {isFederal ? (
                    <div className="flex items-center justify-center py-2 bg-slate-50 border border-slate-200 rounded-lg">
                        <span className="font-mono text-2xl font-bold text-slate-700 tracking-[0.2em] shadow-sm">
                            {game[0].toString()}
                        </span>
                    </div>
                ) : (
                    <div className="flex flex-wrap gap-1.5 justify-start">
                        {game.map(n => {
                            const isHit = resultNumbers && resultNumbers.has(n);
                            let ballStyle = isHit 
                                ? `bg-${activeGame.color}-600 text-white font-bold scale-110 shadow-md`
                                : `bg-slate-100 text-slate-600 border border-slate-200`;
                            
                            if (isSuperSete) {
                                ballStyle += " rounded-md w-6 h-8"; 
                            } else {
                                ballStyle += " rounded-full w-7 h-7";
                            }

                            return (
                                <span key={n} className={`flex items-center justify-center text-xs font-mono transition-transform ${ballStyle}`}>
                                    {isSuperSete ? (n % 10) : n.toString().padStart(2, '0')}
                                </span>
                            );
                        })}
                    </div>
                )}
            </div>

            {isExpanded && detailedStats && (
                <div className="mr-3 mb-3 mt-1 pt-3 border-t border-slate-100 text-[10px] text-slate-500 animate-fade-in bg-slate-50/50 rounded p-2 grid grid-cols-2 sm:grid-cols-3 gap-y-1 gap-x-2 cursor-default" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-between"><span>Pares:</span> <span className="font-bold text-slate-700">{detailedStats.pares}</span></div>
                    <div className="flex justify-between"><span>Ímpares:</span> <span className="font-bold text-slate-700">{detailedStats.impares}</span></div>
                    <div className="flex justify-between"><span>Primos:</span> <span className="font-bold text-slate-700">{detailedStats.primos}</span></div>
                    <div className="flex justify-between"><span>Soma:</span> <span className="font-bold text-slate-700">{detailedStats.soma}</span></div>
                    <div className="flex justify-between"><span>Repetidos:</span> <span className="font-bold text-slate-700">{detailedStats.repetidos}</span></div>
                    <div className="flex justify-between"><span>Fibonacci:</span> <span className="font-bold text-slate-700">{detailedStats.fibonacci}</span></div>
                    <div className="flex justify-between col-span-2 sm:col-span-3 text-center border-t border-slate-200 pt-1 mt-1 text-[9px] text-slate-400 uppercase tracking-wider">
                        Análise Estatística
                    </div>
                </div>
            )}
        </div>
    </div>
  );
};

export default LotteryTicket;