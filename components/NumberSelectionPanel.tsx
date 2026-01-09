
import React, { useMemo, useState } from 'react';
import { GameConfig, AppStatus } from '../types';

interface NumberSelectionPanelProps {
  activeGame: GameConfig;
  selectedNumbers: Set<number>;
  fixedNumbers?: Set<number>;
  onToggleNumber: (num: number, isFixing: boolean) => void;
  gameSize: number;
  onAutoSelectSize: (size: number) => void;
  generationLimit?: number | string;
  setGenerationLimit?: (limit: number | string) => void;
  closingMethod?: any;
  setClosingMethod?: (method: any) => void;
  status?: AppStatus;
  resultNumbers?: Set<number>;
  onOpenAnalysis?: () => void;
  selectedTeam?: string | null; 
  onSelectTeam?: (team: string) => void;
  isFixMode?: boolean;
  setIsFixMode?: (val: boolean) => void;
  targetFixedCount?: number;
  setTargetFixedCount?: (val: number) => void;
  onAiSuggestion?: () => void;
}

interface VolanteCheckboxProps {
    label: string | number;
    isSelected: boolean;
    onClick: () => void;
    isSmall?: boolean;
    themeColor: string;
}

// Sub-componente seguro
const VolanteCheckbox: React.FC<VolanteCheckboxProps> = ({ 
    label, 
    isSelected, 
    onClick, 
    isSmall = false,
    themeColor
}) => (
    <div 
        onClick={onClick}
        className="flex flex-col items-center cursor-pointer group select-none"
    >
        <div 
            className={`
                border border-solid transition-colors relative flex items-center justify-center
                ${isSmall ? 'w-8 h-5 text-[9px]' : 'w-10 h-6 text-[10px]'}
            `}
            style={{ 
                borderColor: themeColor,
                backgroundColor: isSelected ? '#1e293b' : 'white',
            }}
        >
            <span className={`font-bold ${isSelected ? 'text-white' : 'text-slate-500'}`} style={!isSelected ? { color: themeColor } : {}}>
                {label}
            </span>
            {isSelected && (
                <div className="absolute inset-0 bg-slate-900 flex items-center justify-center">
                     <div className="w-[80%] h-[2px] bg-slate-700 rotate-45 absolute"></div>
                </div>
            )}
        </div>
    </div>
);

const NumberSelectionPanel: React.FC<NumberSelectionPanelProps> = ({
  activeGame,
  selectedNumbers,
  fixedNumbers = new Set(),
  onToggleNumber,
  gameSize,
  onAutoSelectSize,
  isFixMode = false,
  setIsFixMode,
  onAiSuggestion,
  targetFixedCount = 0,
  setTargetFixedCount,
  generationLimit,
  setGenerationLimit,
  closingMethod
}) => {
  // Estados locais visuais (Hooks devem vir antes de qualquer retorno)
  const [teimosinhaSelection, setTeimosinhaSelection] = useState<number | null>(null);
  const [bolaoCotas, setBolaoCotas] = useState<string>('');

  // Cálculos Seguros (Hooks)
  const allNumbers = useMemo(() => {
    if (!activeGame) return [];
    try {
        if (activeGame.id === 'supersete') {
            const nums = [];
            for (let val = 0; val <= 9; val++) { 
                for (let col = 0; col < 7; col++) { nums.push(col * 10 + val); }
            }
            return nums;
        }
        if (activeGame.id === 'lotomania') {
            return Array.from({ length: 100 }, (_, i) => i);
        }
        const total = Number(activeGame.totalNumbers) || 25; 
        return Array.from({ length: total }, (_, i) => i + 1);
    } catch (e) {
        return [];
    }
  }, [activeGame?.id, activeGame?.totalNumbers]);

  // Verificação de Segurança (Agora é seguro retornar, pois os hooks já foram chamados)
  if (!activeGame || activeGame.id === 'federal') return null;

  const selectionCount = selectedNumbers ? selectedNumbers.size : 0;
  
  // Fallback de Tema
  const themeColor = activeGame.theme?.primary || '#6b7280'; 

  // Ranges seguros
  const minSel = activeGame.minSelection || 15;
  const maxSel = activeGame.maxSelection || 18;
  const safeRange = Math.min(20, Math.max(1, maxSel - minSel + 1)); 

  return (
    <div className="w-full flex justify-center py-4 bg-slate-900/50">
      <div 
        className="relative w-full max-w-[400px] bg-[#fffbeb] shadow-2xl overflow-hidden print:shadow-none transition-all"
        style={{ 
            boxShadow: '0 0 15px rgba(0,0,0,0.3)',
            borderLeft: '4px dashed rgba(0,0,0,0.1)',
            borderRight: '4px dashed rgba(0,0,0,0.1)'
        }}
      >
          {/* HEADER */}
          <div 
            className="h-24 relative flex items-center px-6 overflow-hidden"
            style={{ backgroundColor: themeColor }}
          >
              <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
              
              <div className="flex items-center gap-3 relative z-10 w-full">
                   <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-lg transform -rotate-12">
                       <span className="text-2xl font-black" style={{ color: themeColor }}>
                           {activeGame.name ? activeGame.name[0] : 'L'}
                       </span>
                   </div>
                   
                   <div className="flex flex-col text-white flex-1">
                       <h1 className="text-3xl font-black italic tracking-tighter uppercase leading-none shadow-black drop-shadow-md">
                           {activeGame.name || 'LOTERIA'}
                       </h1>
                       <span className="text-[10px] font-medium tracking-widest opacity-90 uppercase">
                           Aposte e Ganhe
                       </span>
                   </div>

                   <div className="flex flex-col items-end">
                       <div className="bg-white/20 px-2 py-1 rounded text-center backdrop-blur-sm border border-white/30">
                           <span className="block text-[9px] uppercase font-bold text-white/80">Marcados</span>
                           <span className="text-xl font-mono font-black text-white leading-none">
                               {selectionCount}
                           </span>
                       </div>
                   </div>
              </div>
          </div>

          {/* INSTRUÇÕES */}
          <div className="px-4 py-2 bg-[#fffbeb]">
             <p className="text-[9px] text-slate-500 font-bold uppercase tracking-tight text-justify leading-tight">
                 MARQUE DE <strong style={{color: themeColor}}>{minSel}</strong> A <strong style={{color: themeColor}}>{maxSel}</strong> NÚMEROS.
                 {isFixMode ? <span className="text-amber-600 ml-1">MODO FIXAR: ATIVADO.</span> : ''}
             </p>
          </div>

          {/* GRADE */}
          <div className="px-3 pb-4">
               {setIsFixMode && (
                   <div className="flex justify-end mb-1">
                       <button 
                          onClick={() => setIsFixMode(!isFixMode)}
                          className="text-[9px] uppercase font-bold flex items-center gap-1 hover:underline"
                          style={{ color: isFixMode ? '#d97706' : '#94a3b8' }}
                       >
                           {isFixMode ? '🔒 Fixar Ativado' : '🔓 Ativar Fixas'}
                       </button>
                   </div>
               )}

               <div 
                    className="grid gap-x-1 gap-y-1.5 mx-auto justify-items-center select-none"
                    style={{ 
                        gridTemplateColumns: `repeat(${activeGame.cols || 5}, 1fr)`,
                    }}
               >
                    {allNumbers.map(number => {
                        const isSelected = selectedNumbers.has(number);
                        const isFixed = fixedNumbers?.has(number);
                        
                        return (
                            <div 
                                key={number}
                                onClick={() => onToggleNumber(number, isFixMode)}
                                className="relative w-full aspect-[1.1/1] cursor-pointer group"
                            >
                                <div 
                                    className="w-full h-full flex items-center justify-center border transition-all duration-100 relative"
                                    style={{
                                        borderColor: themeColor,
                                        backgroundColor: isSelected 
                                            ? (isFixed ? '#d97706' : '#1e293b') 
                                            : 'white',
                                        borderWidth: '1px'
                                    }}
                                >
                                    <span 
                                        className={`text-xs font-bold z-10 ${isSelected ? 'text-white' : ''}`}
                                        style={!isSelected ? { color: themeColor } : {}}
                                    >
                                        {activeGame.id === 'supersete' ? number % 10 : number.toString().padStart(2, '0')}
                                    </span>
                                    
                                    {isSelected && !isFixed && (
                                        <div className="absolute inset-0 bg-slate-800 flex items-center justify-center">
                                            <div className="w-[60%] h-[3px] bg-slate-600 rounded-full rotate-45 absolute"></div>
                                        </div>
                                    )}

                                    {isFixed && (
                                        <span className="absolute -top-1 -right-1 text-[8px]">🔒</span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
               </div>
          </div>

          <div className="border-t border-dashed border-slate-300 mx-2"></div>

          {/* RODAPÉ OPÇÕES */}
          <div className="p-4 space-y-5 bg-yellow-50/50">
              
              {/* QUANTIDADE DE NÚMEROS */}
              <div>
                  <label className="text-[10px] font-bold uppercase block mb-1" style={{ color: themeColor }}>
                      Quantidade de Números por Jogo:
                  </label>
                  <div className="flex flex-wrap gap-2 items-center">
                      {Array.from({ length: safeRange }, (_, i) => minSel + i).map(qty => (
                          <VolanteCheckbox 
                             key={qty}
                             label={qty} 
                             isSelected={gameSize === qty} 
                             onClick={() => onAutoSelectSize(qty)}
                             themeColor={themeColor}
                          />
                      ))}
                  </div>
              </div>

              {/* QUANTIDADE DE JOGOS A GERAR */}
              {closingMethod !== 'free_mode' && setGenerationLimit && (
                   <div>
                       <label className="text-[10px] font-bold uppercase block mb-1" style={{ color: themeColor }}>
                          Quantidade de Jogos a Gerar:
                       </label>
                       <div className="flex flex-wrap gap-2 items-center">
                           {[5, 10, 15, 20, 50, 100].map(limit => (
                               <VolanteCheckbox 
                                   key={limit}
                                   label={limit} 
                                   isSelected={Number(generationLimit) === limit}
                                   onClick={() => setGenerationLimit(limit)}
                                   isSmall
                                   themeColor={themeColor}
                               />
                           ))}
                       </div>
                  </div>
              )}

              {/* SURPRESINHA */}
              {onAiSuggestion && (
                  <div>
                       <label className="text-[10px] font-bold uppercase block mb-1" style={{ color: themeColor }}>
                          Surpresinha (IA):
                       </label>
                       <div className="flex gap-2">
                           <button 
                              onClick={onAiSuggestion}
                              className="flex items-center gap-2 border px-3 py-1 bg-white hover:bg-slate-50 transition-colors"
                              style={{ borderColor: themeColor }}
                           >
                               <div className="w-8 h-4 bg-white border border-slate-300"></div>
                               <span className="text-[9px] font-bold text-slate-600 uppercase">Gerar Palpite</span>
                           </button>
                       </div>
                  </div>
              )}

              {/* TEIMOSINHA */}
              <div>
                   <label className="text-[10px] font-bold uppercase block mb-1" style={{ color: themeColor }}>
                      Teimosinha:
                   </label>
                   <div className="flex gap-2">
                       {[3, 6, 12, 18, 24].map(val => (
                           <VolanteCheckbox 
                               key={val}
                               label={val} 
                               isSelected={teimosinhaSelection === val}
                               onClick={() => setTeimosinhaSelection(prev => prev === val ? null : val)}
                               isSmall
                               themeColor={themeColor}
                           />
                       ))}
                   </div>
              </div>

              {/* BOLÃO */}
              <div>
                   <label className="text-[10px] font-bold uppercase block mb-1" style={{ color: themeColor }}>
                      Bolão - Cotas:
                   </label>
                   <div className="flex items-center gap-2 border p-1 w-24 bg-white" style={{ borderColor: themeColor }}>
                        <input 
                            type="number" 
                            className="w-full text-center font-mono font-bold text-slate-800 outline-none text-sm bg-transparent"
                            placeholder="0"
                            value={bolaoCotas}
                            onChange={(e) => setBolaoCotas(e.target.value)}
                        />
                   </div>
              </div>

          </div>
          
          <div className="bg-slate-200 p-2 flex justify-center items-center gap-2 border-t border-slate-300">
               <div className="w-3 h-3 bg-black"></div>
               <span className="text-[8px] font-mono text-slate-500 uppercase">LotoSmart AI</span>
               <div className="w-3 h-3 bg-black"></div>
          </div>
      </div>
    </div>
  );
};

export default NumberSelectionPanel;
