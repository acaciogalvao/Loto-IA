
import React, { useState, useEffect } from 'react';

interface CountdownTimerProps {
  targetDateStr: string; // Format: DD/MM/YYYY
}

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

const CountdownTimer: React.FC<CountdownTimerProps> = ({ targetDateStr }) => {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [status, setStatus] = useState<'ticking' | 'draw_time' | 'expired'>('ticking');

  useEffect(() => {
    if (!targetDateStr) return;

    const calculateTimeLeft = () => {
      const parts = targetDateStr.split('/');
      if (parts.length !== 3) return;
      
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1; 
      const year = parseInt(parts[2], 10);

      // Define o sorteio para as 20:00:00 do dia alvo
      const targetDate = new Date(year, month, day, 20, 0, 0);
      const now = new Date();
      const difference = targetDate.getTime() - now.getTime();

      if (difference > 0) {
        setTimeLeft({
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((difference / 1000 / 60) % 60),
          seconds: Math.floor((difference / 1000) % 60),
        });
        setStatus('ticking');
      } else if (difference > -1000 * 60 * 60) {
         // Se passou menos de 1 hora das 20h, consideramos que está ocorrendo o sorteio
         setStatus('draw_time');
      } else {
         setStatus('expired');
      }
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(timer);
  }, [targetDateStr]);

  if (status === 'draw_time') {
     return (
        <div className="bg-yellow-500/20 border border-yellow-500/50 rounded-lg p-3 flex justify-center items-center animate-pulse">
            <span className="text-xs text-yellow-200 font-bold uppercase tracking-widest flex items-center gap-2">
               ⚠️ Sorteio em andamento / Apuração
            </span>
        </div>
     );
  }

  if (status === 'expired') {
      return (
        <div className="bg-slate-800/50 border border-white/10 rounded-lg p-3 flex justify-center items-center">
            <span className="text-xs text-slate-400 font-bold uppercase tracking-widest">
               Aguardando próximo agendamento
            </span>
        </div>
      );
  }

  return (
    <div className="bg-black/40 border border-white/10 rounded-lg p-3 shadow-inner relative overflow-hidden group">
      {/* Background glow effect */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-1 bg-emerald-500/50 blur-md rounded-b-full"></div>

      <div className="flex justify-between items-center mb-3">
        <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          Próximo Sorteio
        </span>
        <span className="text-[10px] text-white/70 font-mono bg-white/10 px-1.5 py-0.5 rounded">
           {targetDateStr} às 20h
        </span>
      </div>
      
      <div className="flex justify-center gap-2 sm:gap-4 text-center">
         <div className="flex flex-col min-w-[3rem]">
            <span className="text-xl sm:text-2xl font-black text-white font-mono leading-none tracking-tight drop-shadow-md">
                {timeLeft.days}
            </span>
            <span className="text-[8px] text-white/40 uppercase font-bold tracking-wider mt-1">Dias</span>
         </div>

         <div className="text-xl sm:text-2xl font-mono text-white/20 -mt-1">:</div>

         <div className="flex flex-col min-w-[3rem]">
            <span className="text-xl sm:text-2xl font-black text-white font-mono leading-none tracking-tight drop-shadow-md">
                {timeLeft.hours.toString().padStart(2, '0')}
            </span>
            <span className="text-[8px] text-white/40 uppercase font-bold tracking-wider mt-1">Horas</span>
         </div>

         <div className="text-xl sm:text-2xl font-mono text-white/20 -mt-1 animate-pulse">:</div>

         <div className="flex flex-col min-w-[3rem]">
            <span className="text-xl sm:text-2xl font-black text-white font-mono leading-none tracking-tight drop-shadow-md">
                {timeLeft.minutes.toString().padStart(2, '0')}
            </span>
            <span className="text-[8px] text-white/40 uppercase font-bold tracking-wider mt-1">Min</span>
         </div>

         <div className="text-xl sm:text-2xl font-mono text-white/20 -mt-1 animate-pulse">:</div>

         <div className="flex flex-col min-w-[3rem]">
            <span className="text-xl sm:text-2xl font-black text-emerald-400 font-mono leading-none tracking-tight drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]">
                {timeLeft.seconds.toString().padStart(2, '0')}
            </span>
            <span className="text-[8px] text-emerald-500/60 uppercase font-bold tracking-wider mt-1">Seg</span>
         </div>
      </div>
    </div>
  );
};

export default CountdownTimer;
