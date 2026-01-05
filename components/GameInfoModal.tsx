
import React from 'react';
import { GameConfig } from '../types';

interface GameInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeGame: GameConfig;
}

const GameInfoModal: React.FC<GameInfoModalProps> = ({ isOpen, onClose, activeGame }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[90] bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
        <div className="bg-slate-800 w-full max-w-lg rounded-t-2xl sm:rounded-xl overflow-hidden shadow-2xl border-t border-x sm:border border-slate-700 max-h-[90vh] flex flex-col">
            <div className="w-12 h-1.5 bg-slate-700 rounded-full mx-auto mt-2 mb-1 sm:hidden"></div>
            <div 
                className="p-4 flex justify-between items-center"
                style={{ backgroundColor: activeGame.theme.primary, color: activeGame.theme.text }}
            >
                <h3 className="font-bold text-lg flex items-center gap-2">
                    ℹ️ Como Jogar: {activeGame.name}
                </h3>
                <button onClick={onClose} className="w-8 h-8 flex items-center justify-center bg-white/20 hover:bg-white/30 rounded-full font-bold">✕</button>
            </div>
            <div className="p-5 overflow-y-auto">
                <p className="text-slate-300 text-sm leading-relaxed mb-6">
                    {activeGame.howToPlay}
                </p>
                <h4 className="font-bold text-white mb-3 text-sm uppercase tracking-wider border-b border-slate-700 pb-2">Tabela de Preços</h4>
                {activeGame.priceTable && activeGame.priceTable.length > 0 ? (
                    <div className="overflow-hidden rounded-lg border border-slate-700">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-700 text-slate-300 text-xs uppercase">
                                <tr>
                                    <th className="px-4 py-3">Números</th>
                                    <th className="px-4 py-3 text-right">Valor</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700">
                                {activeGame.priceTable.map((row, idx) => (
                                    <tr key={idx} className={idx % 2 === 0 ? 'bg-slate-800' : 'bg-slate-800/50'}>
                                        <td className="px-4 py-2.5 text-slate-300 font-bold">{row.quantity}</td>
                                        <td className="px-4 py-2.5 text-right text-emerald-400 font-mono">
                                            {typeof row.price === 'number' 
                                                ? row.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) 
                                                : row.price}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <p className="text-slate-500 italic text-sm">Informações de preço indisponíveis.</p>
                )}
                <div className="mt-4 text-[10px] text-slate-500 text-center">
                    * Valores sujeitos a alteração pela Caixa Econômica Federal.<br/>Sorteios: <span className="text-slate-400 font-bold">{activeGame.drawDays}</span>
                </div>
            </div>
        </div>
    </div>
  );
};

export default GameInfoModal;
