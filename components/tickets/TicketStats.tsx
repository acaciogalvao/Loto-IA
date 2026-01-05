
import React, { useMemo } from 'react';
import { DetailedStats, GameConfig } from '../../types';

interface TicketStatsProps {
  stats: DetailedStats | null;
  activeGame?: GameConfig;
  resultNumbers?: Set<number>;
  gameNumbers?: number[];
}

const TicketStats: React.FC<TicketStatsProps> = ({ stats, activeGame, resultNumbers, gameNumbers }) => {
  if (!stats) return null;

  // Calculate numbers drawn but NOT played (Missed Opportunities)
  const missedNumbers = useMemo(() => {
      if (!resultNumbers || !gameNumbers) return [];
      const playedSet = new Set(gameNumbers);
      return Array.from(resultNumbers)
        .filter(n => !playedSet.has(n))
        .sort((a: number, b: number) => a - b);
  }, [resultNumbers, gameNumbers]);

  // Helper para barra de progresso
  const ProgressBar = ({ value, max, colorClass, label, textValue }: { value: number, max: number, colorClass: string, label: string, textValue?: string }) => {
      const percentage = Math.min(100, Math.max(0, (value / max) * 100));
      return (
          <div className="flex flex-col w-full">
              <div className="flex justify-between items-end mb-0.5">
                  <span className="text-[8px] text-slate-400 uppercase font-bold tracking-wider">{label}</span>
                  <span className="text-[9px] font-bold text-slate-200">{textValue || value}</span>
              </div>
              <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden border border-slate-700/50">
                  <div className={`h-full rounded-full ${colorClass}`} style={{ width: `${percentage}%` }}></div>
              </div>
          </div>
      );
  };

  // Helper para card de estatística
  const StatBadge = ({ icon, label, value, colorClass }: { icon: string, label: string, value: number, colorClass: string }) => (
      <div className="bg-slate-800 rounded p-1.5 border border-slate-700/50 flex flex-col items-center justify-center">
          <span className={`text-xs mb-0.5 ${colorClass}`}>{icon}</span>
          <span className="text-[7px] text-slate-400 uppercase font-bold">{label}</span>
          <span className="text-[10px] font-bold text-white">{value}</span>
      </div>
  );

  const totalNums = stats.pares + stats.impares;

  return (
    <div className="space-y-3">
        {/* ROW 1: EQUILÍBRIO (PARES/IMPARES & SOMA) */}
        <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-800 p-2 rounded border border-slate-700">
                <div className="flex justify-between text-[8px] text-slate-300 mb-1 uppercase font-bold">
                    <span>Pares ({stats.pares})</span>
                    <span>Ímpares ({stats.impares})</span>
                </div>
                <div className="flex h-2 w-full rounded-full overflow-hidden">
                    <div className="bg-blue-500 h-full" style={{ width: `${(stats.pares / totalNums) * 100}%` }}></div>
                    <div className="bg-orange-500 h-full" style={{ width: `${(stats.impares / totalNums) * 100}%` }}></div>
                </div>
            </div>
            
            <div className="bg-slate-800 p-2 rounded border border-slate-700 flex flex-col justify-center">
                 <div className="flex justify-between items-center mb-1">
                     <span className="text-[8px] text-slate-300 uppercase font-bold">Soma Total</span>
                     <span className={`text-[10px] font-bold ${stats.soma > 220 ? 'text-red-400' : (stats.soma < 160 ? 'text-blue-400' : 'text-emerald-400')}`}>{stats.soma}</span>
                 </div>
                 <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden relative">
                     {/* Marcador de posição relativa (simplificado) */}
                     <div className="absolute top-0 bottom-0 bg-slate-600 w-full opacity-20"></div>
                     {/* Faixa Ideal (Visual) */}
                     <div className="absolute top-0 bottom-0 left-[30%] right-[30%] bg-emerald-500/20"></div>
                 </div>
            </div>
        </div>

        {/* ROW 2: DETALHES TÉCNICOS (GRID) */}
        <div className="grid grid-cols-4 gap-2">
            <StatBadge icon="★" label="Primos" value={stats.primos} colorClass="text-purple-400" />
            <StatBadge icon="🌀" label="Fibonacci" value={stats.fibonacci} colorClass="text-pink-400" />
            <StatBadge icon="➗" label="Múlt. 3" value={stats.multiplos3} colorClass="text-cyan-400" />
            <StatBadge icon="🔺" label="Triang." value={stats.triangulares} colorClass="text-yellow-400" />
        </div>

        {/* ROW 3: ESPACIAL (MOLDURA vs CENTRO) */}
        <div className="bg-slate-800 rounded-lg p-2 border border-slate-700 flex gap-4 items-center">
            <div className="flex-1">
                 <ProgressBar value={stats.moldura} max={totalNums} colorClass="bg-indigo-500" label="Na Moldura" />
            </div>
            <div className="h-4 w-px bg-slate-600"></div>
            <div className="flex-1">
                 <ProgressBar value={stats.centro} max={totalNums} colorClass="bg-teal-500" label="No Centro" />
            </div>
        </div>

        {/* ROW 4: ANÁLISE COMPARATIVA E ESTATÍSTICA */}
        <div className="grid grid-cols-2 gap-2 text-[9px]">
            {stats.repetidos !== '-' && (
                <div className="bg-slate-900 p-2 rounded border border-slate-700 flex justify-between items-center">
                    <span className="text-slate-400 font-bold uppercase">Repetidos (Ant.)</span>
                    <span className={`font-mono font-bold text-sm ${(stats.repetidos as number) >= 8 && (stats.repetidos as number) <= 10 ? 'text-emerald-400' : 'text-slate-200'}`}>
                        {stats.repetidos}
                    </span>
                </div>
            )}
            
            <div className="bg-slate-900 p-2 rounded border border-slate-700 flex flex-col justify-center">
                 <div className="flex justify-between">
                    <span className="text-slate-400">Média:</span>
                    <span className="text-slate-200 font-mono">{stats.media}</span>
                 </div>
                 <div className="flex justify-between">
                    <span className="text-slate-400">Desvio P.:</span>
                    <span className="text-slate-200 font-mono">{stats.desvioPadrao}</span>
                 </div>
            </div>
        </div>

        {/* ROW 5: NÚMEROS AUSENTES DO SORTEIO (MISSED NUMBERS) */}
        {missedNumbers.length > 0 && (
            <div className="mt-2 pt-2 border-t border-slate-700/50">
                <span className="text-[9px] text-yellow-500/80 uppercase font-bold tracking-wider mb-2 block flex items-center gap-1">
                    <span>⚠️</span> Sorteados Ausentes neste Jogo ({missedNumbers.length}):
                </span>
                <div className="flex flex-wrap gap-1">
                    {missedNumbers.map(n => (
                        <span 
                            key={n}
                            className="w-5 h-5 flex items-center justify-center rounded-full border border-yellow-500/30 text-[9px] font-bold text-yellow-500/70 bg-yellow-900/10"
                        >
                            {n.toString().padStart(2, '0')}
                        </span>
                    ))}
                </div>
            </div>
        )}
    </div>
  );
};

export default TicketStats;
