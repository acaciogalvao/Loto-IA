
import React from 'react';
import { PastGameResult, GameConfig } from '../types';
import { calculateDetailedStats } from '../utils/lotteryLogic';

interface GameDetailsModalProps {
  viewingGame: PastGameResult | null;
  onClose: () => void;
  activeGame: GameConfig;
  analysisResults: PastGameResult[];
}

const GameDetailsModal: React.FC<GameDetailsModalProps> = ({ viewingGame, onClose, activeGame, analysisResults }) => {
  if (!viewingGame) return null;

  const prevGame = analysisResults.find(g => g.concurso === viewingGame.concurso - 1);
  const prevNumbers = prevGame ? prevGame.dezenas.map(d => parseInt(d, 10)) : undefined;
  const stats = calculateDetailedStats(viewingGame.dezenas.map(d => parseInt(d, 10)), prevNumbers, activeGame);

  return (
    <div className="fixed inset-0 z-[80] bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
      <div className="bg-white w-full max-w-lg rounded-t-2xl sm:rounded-xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
          <div className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mt-2 mb-1 sm:hidden absolute top-0 left-0 right-0 z-50"></div>
          <div 
            className="p-4 pt-5 sm:pt-4 flex justify-between items-center relative shadow-lg"
            style={{ backgroundColor: activeGame.theme.primary, color: activeGame.theme.text }}
          >
              <h3 className="font-bold text-center w-full text-lg">Resultado {activeGame.name} #{viewingGame.concurso}</h3>
              <button onClick={onClose} className="absolute right-3 w-8 h-8 flex items-center justify-center bg-white/20 hover:bg-white/30 rounded-full font-bold">✕</button>
          </div>
          <div className="overflow-y-auto p-0 text-slate-800 text-sm">
              {activeGame.id !== 'federal' && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-px bg-gray-200 border-b border-gray-200">
                  <div className="bg-white p-2 flex justify-between items-center"><span>Pares:</span><strong>{stats.pares}</strong></div>
                  <div className="bg-white p-2 flex justify-between items-center"><span>Ímpares:</span><strong>{stats.impares}</strong></div>
                  <div className="bg-white p-2 flex justify-between items-center"><span>Primos:</span><strong>{stats.primos}</strong></div>
                  <div className="bg-white p-2 flex justify-between items-center"><span>Soma:</span><strong>{stats.soma}</strong></div>
                  <div className="bg-white p-2 flex justify-between items-center"><span>Fibonacci:</span><strong>{stats.fibonacci}</strong></div>
                  <div className="bg-white p-2 flex justify-between items-center"><span>Múlt. 3:</span><strong>{stats.multiplos3}</strong></div>
                  <div className="bg-white p-2 flex justify-between items-center"><span>Média:</span><strong>{stats.media}</strong></div>
                  <div className="bg-white p-2 flex justify-between items-center"><span>Desvio P.:</span><strong>{stats.desvioPadrao}</strong></div>
                  <div className="bg-white p-2 flex justify-between items-center"><span>Triangulares:</span><strong>{stats.triangulares}</strong></div>
                  <div className="bg-white p-2 flex justify-between items-center"><span>Moldura:</span><strong>{stats.moldura}</strong></div>
                  <div className="bg-white p-2 flex justify-between items-center"><span>Centro:</span><strong>{stats.centro}</strong></div>
                  <div className="bg-white p-2 flex justify-between items-center text-red-600"><span>Repetidos:</span><strong>{stats.repetidos}</strong></div>
              </div>
              )}
              <div className="p-2 bg-gray-50 border-t border-gray-200">
                  <div className="text-center text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">Detalhamento da Premiação</div>
                  {viewingGame.premiacoes.map((p, idx) => {
                      const totalPot = p.valor * p.ganhadores;
                      return (
                      <div key={idx} className="flex justify-between items-start py-2 border-b border-gray-200 text-xs last:border-0 hover:bg-gray-100 transition-colors px-2">
                          <div className="flex flex-col">
                              <span className="font-bold text-slate-700 text-sm">
                                {activeGame.id === 'federal' ? `${p.faixa}º Prêmio` : (p.faixa > 20 ? `${p.faixa} acertos` : p.faixa === 0 ? '0 acertos' : `${p.faixa} acertos`)}
                              </span>
                              {activeGame.id === 'federal' && p.bilhete && (
                                  <span className="font-mono font-bold text-blue-600 bg-blue-50 px-2 rounded border border-blue-100 mt-1 w-fit">{p.bilhete}</span>
                              )}
                          </div>
                          
                          <div className="text-right flex flex-col items-end">
                              <div className="font-bold text-slate-800">{p.ganhadores} ganhador(es)</div>
                              
                              {/* Valor Individual (O que eu recebo) */}
                              <div className="font-bold text-emerald-600 text-sm mt-0.5">
                                  {p.valor.toLocaleString('pt-BR', {minimumFractionDigits: 2, style: 'currency', currency: 'BRL'})}
                                  {p.ganhadores > 0 && <span className="text-[9px] text-emerald-600/70 ml-1 font-normal uppercase">(Você recebe)</span>}
                              </div>

                              {/* Valor Total da Faixa (Se houver mais de 1 ganhador) */}
                              {p.ganhadores > 1 && (
                                  <div className="text-[9px] text-slate-400 mt-0.5 border-t border-gray-300/50 pt-0.5">
                                      Total distribuído: {totalPot.toLocaleString('pt-BR', {minimumFractionDigits: 2, style: 'currency', currency: 'BRL'})}
                                  </div>
                              )}
                          </div>
                      </div>
                  )})}
              </div>
              <div className="p-4 bg-gray-100 border-t border-gray-200">
                  <div className="text-center text-xs text-gray-500 mb-2 font-bold">{viewingGame.data}</div>
                  {activeGame.id === 'federal' ? (
                       <div className="flex flex-col gap-1 w-full max-w-[200px] mx-auto">
                          {viewingGame.dezenas.map((bilhete, idx) => (
                             <div key={idx} className="flex justify-between text-xs border-b border-gray-300 pb-1">
                                <span className="font-bold text-slate-500">{idx+1}º</span>
                                <span className="font-mono font-bold text-slate-800 tracking-widest">{bilhete}</span>
                             </div>
                          ))}
                       </div>
                  ) : (
                      <div className="flex flex-wrap justify-center gap-1.5">
                          {viewingGame.dezenas.map(d => (
                              <span 
                                key={d} 
                                className="w-8 h-8 rounded-full text-sm flex items-center justify-center font-bold shadow-md"
                                style={{ backgroundColor: activeGame.theme.primary, color: activeGame.theme.text }}
                              >
                                {d}
                              </span>
                          ))}
                      </div>
                  )}
              </div>
          </div>
      </div>
    </div>
  );
};

export default GameDetailsModal;
