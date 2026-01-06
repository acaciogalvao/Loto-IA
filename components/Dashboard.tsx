
import React, { useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  Cell, PieChart, Pie, LineChart, Line, Legend
} from 'recharts';
import { NumberProbability, GameConfig } from '../types';

interface DashboardProps {
  probabilities: NumberProbability[];
  gameConfig: GameConfig;
  historyData: any[];
}

export const Dashboard: React.FC<DashboardProps> = ({ probabilities, gameConfig, historyData }) => {
  const heatmapData = useMemo(() => {
    return probabilities.sort((a, b) => a.number - b.number);
  }, [probabilities]);

  const sumTrendData = useMemo(() => {
    return historyData.slice(0, 20).map(draw => ({
      concurso: draw.concurso,
      soma: draw.dezenas.reduce((acc: number, curr: string) => acc + Number(curr), 0)
    })).reverse();
  }, [historyData]);

  const frequencyData = useMemo(() => {
    return probabilities
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 10);
  }, [probabilities]);

  const getHeatmapColor = (prob: number) => {
    if (prob > 70) return '#ef4444'; // Hot
    if (prob > 40) return '#f59e0b'; // Neutral
    return '#3b82f6'; // Cold
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4">
      {/* Mapa de Calor */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
        <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-white">Mapa de Calor (Probabilidades)</h3>
        <div className="grid grid-cols-5 gap-2">
          {heatmapData.map((item) => (
            <div 
              key={item.number}
              className="aspect-square flex flex-col items-center justify-center rounded-lg text-white font-bold text-sm transition-transform hover:scale-105"
              style={{ backgroundColor: getHeatmapColor(item.probability) }}
              title={`Probabilidade: ${item.probability}%`}
            >
              <span>{item.number}</span>
              <span className="text-[10px] font-normal">{item.probability}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* Frequência de Dezenas */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
        <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-white">Top 10 Dezenas Frequentes</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={frequencyData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="number" />
              <YAxis />
              <Tooltip 
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              />
              <Bar dataKey="frequency" fill={gameConfig.theme.primary} radius={[4, 4, 0, 0]}>
                {frequencyData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={getHeatmapColor(entry.probability)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tendência de Soma */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 md:col-span-2">
        <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-white">Tendência de Soma (Últimos 20 Concursos)</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={sumTrendData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="concurso" />
              <YAxis domain={['auto', 'auto']} />
              <Tooltip />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="soma" 
                stroke={gameConfig.theme.primary} 
                strokeWidth={3}
                dot={{ r: 4, fill: gameConfig.theme.primary }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
