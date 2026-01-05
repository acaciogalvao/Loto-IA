
import React from 'react';
import { GameConfig } from '../../types';

interface TicketNumbersProps {
  numbers: number[];
  activeGame: GameConfig;
  resultNumbers?: Set<number>;
}

const TicketNumbers: React.FC<TicketNumbersProps> = ({ numbers, activeGame, resultNumbers }) => {
  const isFederal = activeGame.id === 'federal';
  const isSuperSete = activeGame.id === 'supersete';

  // Renderização Federal (Texto)
  if (isFederal) {
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
            
            // Estilos para bolinha
            // Hit: Gradiente Dourado/Verde (dependendo do jogo) ou cor Primária
            // Miss: Slate Dark but VISIBLE (no longer semi-transparent)
            
            const hitStyle = {
                backgroundColor: isHit ? '#10b981' : 'transparent', // Emerald 500
                color: isHit ? 'white' : '#cbd5e1', // Slate 300 for misses (brighter)
                borderColor: isHit ? '#059669' : '#475569', // Emerald 600 vs Slate 600
                boxShadow: isHit ? '0 0 8px rgba(16, 185, 129, 0.4)' : 'none'
            };

            if (isSuperSete) {
                const colIndex = Math.floor(n / 10) + 1;
                const val = n % 10;
                return (
                    <div key={n} className="flex flex-col items-center">
                        <span className={`text-[7px] font-bold uppercase mb-0.5 ${isHit ? 'text-emerald-400' : 'text-slate-500'}`}>Col {colIndex}</span>
                        <div 
                            className={`w-6 h-7 flex items-center justify-center rounded text-xs font-bold border transition-colors`}
                            style={hitStyle}
                        >
                            {val}
                        </div>
                    </div>
                );
            }

            return (
                <div 
                    key={n} 
                    className={`w-8 h-8 flex items-center justify-center rounded-full border text-xs font-bold transition-all ${isHit ? 'scale-110 z-10' : ''}`}
                    style={isHit ? {
                        background: `linear-gradient(135deg, ${activeGame.theme.primary}, ${activeGame.theme.secondary})`,
                        borderColor: 'white',
                        color: 'white',
                        boxShadow: '0 2px 5px rgba(0,0,0,0.3)'
                    } : {
                        background: '#1e293b', // Slate 800 Solid (Visible)
                        borderColor: '#334155', // Slate 700 (Defined Border)
                        color: '#e2e8f0' // Slate 200 (High Contrast Text)
                    }}
                >
                    {n.toString().padStart(2, '0')}
                </div>
            );
        })}
    </div>
  );
};

export default TicketNumbers;
