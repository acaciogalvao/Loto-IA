
import React from 'react';
import { GameConfig } from '../../types';

interface TicketNumbersProps {
  numbers: number[];
  activeGame: GameConfig;
  resultNumbers?: Set<number>;
}

const TicketNumbers: React.FC<TicketNumbersProps> = ({ 
  numbers, 
  activeGame, 
  resultNumbers
}) => {
  const isSuperSete = activeGame.id === 'supersete';

  // Renderização Federal (Texto Simples)
  if (activeGame.id === 'federal') {
    return (
        <div className="font-mono text-xl font-bold text-slate-200 tracking-[0.3em] pl-1 drop-shadow-md">
            {numbers[0].toString()}
        </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-1.5 sm:gap-2">
        {numbers.map(n => {
            const isHit = resultNumbers && resultNumbers.has(n);
            
            // Estilo específico para Super Sete (Coluna/Valor)
            if (isSuperSete) {
                const colIndex = Math.floor(n / 10) + 1;
                const val = n % 10;
                return (
                    <div key={n} className="flex flex-col items-center">
                        <span className={`text-[7px] font-bold uppercase mb-0.5 ${isHit ? 'text-emerald-400' : 'text-slate-500'}`}>Col {colIndex}</span>
                        <div 
                            className={`w-6 h-7 flex items-center justify-center rounded text-xs font-bold border transition-colors ${isHit ? 'bg-emerald-600 text-white border-emerald-500' : 'bg-slate-800 text-slate-300 border-slate-600'}`}
                        >
                            {val}
                        </div>
                    </div>
                );
            }

            // Estilo Padrão (Bolinhas)
            return (
                <div 
                    key={n} 
                    className={`
                        w-8 h-8 flex items-center justify-center rounded-full border text-xs font-bold shadow-sm transition-all
                        ${isHit 
                            ? 'bg-emerald-600 text-white border-emerald-500 scale-110 z-10 shadow-emerald-900/50' 
                            : 'bg-slate-800 text-slate-300 border-slate-700'
                        }
                    `}
                >
                    {n.toString().padStart(2, '0')}
                </div>
            );
        })}
    </div>
  );
};

export default TicketNumbers;
