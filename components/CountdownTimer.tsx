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
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    if (!targetDateStr) return;

    const calculateTimeLeft = () => {
      // Parse DD/MM/YYYY
      const parts = targetDateStr.split('/');
      if (parts.length !== 3) return;
      
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed
      const year = parseInt(parts[2], 10);

      // Set target to 20:00:00 of that day (Standard Lotofácil time)
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
        setIsExpired(false);
      } else {
         setIsExpired(true);
      }
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(timer);
  }, [targetDateStr]);

  if (isExpired) {
     return (
        <div className="bg-slate-900/40 border border-slate-600/30 rounded-lg p-2 mt-3 flex justify-between items-center animate-pulse">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Aguardando Apuração</span>
            <span className="text-[10px] text-yellow-400 font-mono">{targetDateStr}</span>
        </div>
     );
  }

  return (
    <div className="bg-gradient-to-r from-slate-800 to-slate-900 border border-slate-700/50 rounded-lg p-3 mt-3 shadow-inner">
      <div className="flex justify-between items-end mb-2 border-b border-slate-700/50 pb-2">
        <span className="text-[10px] text-purple-400 font-bold uppercase tracking-widest flex items-center gap-1">
          ⏳ Próximo Sorteio
        </span>
        <span className="text-[10px] text-slate-300 font-mono bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
           {targetDateStr} - 20h
        </span>
      </div>
      
      <div className="flex justify-center gap-3 text-center">
         <div className="flex flex-col">
            <span className="text-xl font-bold text-white font-mono leading-none">{timeLeft.days}</span>
            <span className="text-[9px] text-slate-500 uppercase">Dias</span>
         </div>
         <span className="text-slate-600 font-bold">:</span>
         <div className="flex flex-col">
            <span className="text-xl font-bold text-white font-mono leading-none">{timeLeft.hours.toString().padStart(2, '0')}</span>
            <span className="text-[9px] text-slate-500 uppercase">Horas</span>
         </div>
         <span className="text-slate-600 font-bold">:</span>
         <div className="flex flex-col">
            <span className="text-xl font-bold text-white font-mono leading-none">{timeLeft.minutes.toString().padStart(2, '0')}</span>
            <span className="text-[9px] text-slate-500 uppercase">Min</span>
         </div>
         <span className="text-slate-600 font-bold">:</span>
         <div className="flex flex-col">
            <span className="text-xl font-bold text-emerald-400 font-mono leading-none">{timeLeft.seconds.toString().padStart(2, '0')}</span>
            <span className="text-[9px] text-slate-500 uppercase">Seg</span>
         </div>
      </div>
    </div>
  );
};

export default CountdownTimer;