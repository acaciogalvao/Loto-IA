
import React from 'react';

interface FinancialSummaryProps {
  totalInvested: number;
  totalPrize: number;
  netBalance: number;
  resultLabel: string;
  hasSplitPrize?: boolean;
  winnersCount?: number;
}

const FinancialSummary: React.FC<FinancialSummaryProps> = ({ 
  totalInvested, 
  totalPrize, 
  netBalance, 
  resultLabel,
  hasSplitPrize,
  winnersCount
}) => {
  const formatCurrency = (val: number) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-xl mb-4 transition-all">
        <div className="bg-slate-900/50 p-2 text-center border-b border-slate-700">
            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">{resultLabel}</span>
        </div>
        
        <div className="grid grid-cols-2 divide-x divide-slate-700/50 border-b border-slate-700/50">
            <div className="p-3 text-center">
                <span className="text-[10px] text-slate-400 block uppercase font-bold mb-1">Total Investido</span>
                <span className="text-sm font-mono font-bold text-slate-200">{formatCurrency(totalInvested)}</span>
            </div>
            <div className="p-3 text-center bg-slate-800/30">
                <span className="text-[10px] text-emerald-400 block uppercase font-bold mb-1">Seu Prêmio Total</span>
                <span className="text-sm font-mono font-bold text-emerald-300">{formatCurrency(totalPrize)}</span>
            </div>
        </div>

        <div className={`p-3 flex justify-between items-center ${netBalance >= 0 ? 'bg-emerald-900/20' : 'bg-red-900/20'} border-b border-slate-700/50`}>
            <div className="flex flex-col">
                <span className={`text-xs font-bold uppercase tracking-wider ${netBalance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {netBalance >= 0 ? 'Lucro Líquido' : 'Prejuízo'}
                </span>
            </div>
            <span className={`text-xl font-mono font-black ${netBalance >= 0 ? 'text-emerald-400 animate-pulse' : 'text-red-400'}`}>
                {netBalance >= 0 ? '+' : ''}{formatCurrency(netBalance)}
            </span>
        </div>
    </div>
  );
};

export default FinancialSummary;
