
import React, { useState } from 'react';
import LotteryTicket from './LotteryTicket';
import { GameConfig, DetailedStats, AnalysisResult, LotteryResult } from '../types';
import { calculateDetailedStats } from '../utils/lotteryLogic';

interface GeneratedGamesListProps {
  games: number[][];
  activeGame: GameConfig;
  latestResult: LotteryResult | null;
  resultNumbers: Set<number>;
  totalGenerationCost: number;
  analysis: AnalysisResult | null;
  onSaveBatch: () => void;
  onShareBatch: () => void;
  onCopyGame: (game: number[], idx: number) => void;
  onSaveSingleGame: (e: React.MouseEvent, game: number[], idx: number) => void;
  onShareSingleGame: (e: React.MouseEvent, game: number[], idx: number) => void;
  copiedGameIndex: number | null;
}

const GeneratedGamesList: React.FC<GeneratedGamesListProps> = ({
  games,
  activeGame,
  latestResult,
  resultNumbers,
  totalGenerationCost,
  analysis,
  onSaveBatch,
  onShareBatch,
  onCopyGame,
  onSaveSingleGame,
  onShareSingleGame,
  copiedGameIndex
}) => {
  const [expandedGameStats, setExpandedGameStats] = useState<number | null>(null);

  const calculateHits = (game: number[]) => {
    if (resultNumbers.size === 0) return 0;
    return game.filter(n => resultNumbers.has(n)).length;
  };

  const toggleGameStats = (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    setExpandedGameStats(prev => prev === index ? null : index);
  };

  if (games.length === 0) return null;

  return (
    <div className="space-y-4 pt-4 border-t border-slate-800 mb-20">
        <div className="flex flex-col space-y-2">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold text-white flex items-center shadow-black drop-shadow-md">
                {activeGame.id === 'federal' ? 'Palpites de Bilhetes' : `Jogos Gerados (${games.length})`}
                </h3>
                {totalGenerationCost > 0 && (
                    <div className="flex flex-col items-end">
                        <span className="text-[10px] text-emerald-200 uppercase tracking-wide">Custo Total</span>
                        <span className="text-emerald-400 font-mono font-bold text-sm bg-emerald-900/30 px-2 py-0.5 rounded border border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.2)]">
                            {totalGenerationCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </span>
                    </div>
                )}
            </div>
            
            <div className="flex w-full gap-2">
                <button onClick={onSaveBatch} className="flex-1 px-4 py-3 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/50 text-blue-200 text-xs font-bold rounded-lg transition-colors active:scale-95 shadow-[0_0_10px_rgba(37,99,235,0.2)]">Salvar Todos</button>
                <button onClick={onShareBatch} className="flex-1 px-4 py-3 bg-green-600/20 hover:bg-green-600/30 border border-green-500/50 text-green-200 text-xs font-bold rounded-lg transition-colors active:scale-95 flex items-center justify-center gap-1 shadow-[0_0_10px_rgba(22,163,74,0.2)]">
                    <span>📲 Compartilhar Lista</span>
                </button>
            </div>
        </div>

        {/* Analysis Summary */}
        {analysis && (
            <div className="bg-gradient-to-r from-indigo-900/40 to-purple-900/40 border border-indigo-500/30 rounded-xl p-3 flex items-start gap-3 shadow-[0_0_15px_rgba(79,70,229,0.15)]">
                <div className="bg-indigo-500/20 p-2 rounded-full shadow-[0_0_10px_rgba(99,102,241,0.3)]">
                    <span className="text-lg">📊</span>
                </div>
                <div>
                    <h4 className="text-xs font-bold text-indigo-200 uppercase tracking-wider mb-0.5">Análise da Geração</h4>
                    <p className="text-xs text-indigo-100/80 leading-relaxed">{analysis.message}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                        <div className="h-1.5 w-24 bg-indigo-900/50 rounded-full overflow-hidden">
                            <div className="h-full bg-indigo-400 shadow-[0_0_5px_#818cf8]" style={{width: `${analysis.score}%`}}></div>
                        </div>
                        <span className="text-[10px] font-bold text-indigo-300 drop-shadow-md">{analysis.score}/100</span>
                    </div>
                </div>
            </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {games.map((game, idx) => {
                const hits = calculateHits(game);
                const isExpanded = expandedGameStats === idx;
                const stats = isExpanded ? calculateDetailedStats(game, latestResult?.dezenas.map(Number), activeGame) : null;
                
                return (
                    <div key={idx} className="animate-slide-up" style={{animationDelay: `${idx * 50}ms`}}>
                        <LotteryTicket 
                            game={game} 
                            index={idx} 
                            activeGame={activeGame}
                            hits={hits}
                            isCopied={copiedGameIndex === idx}
                            onCopy={() => onCopyGame(game, idx)}
                            onAction={(e) => onSaveSingleGame(e, game, idx)}
                            onToggleStats={(e) => toggleGameStats(e, idx)}
                            onShare={(e) => onShareSingleGame(e, game, idx)}
                            isExpanded={isExpanded}
                            detailedStats={stats}
                            resultNumbers={resultNumbers}
                        />
                    </div>
                );
            })}
        </div>
    </div>
  );
};

export default GeneratedGamesList;
