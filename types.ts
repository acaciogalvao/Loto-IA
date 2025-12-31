export type Game = number[];

export enum AppStatus {
  IDLE = 'IDLE',
  GENERATING = 'GENERATING',
  ANALYZING = 'ANALYZING',
  SIMULATING = 'SIMULATING',
  CHECKING_HISTORY = 'CHECKING_HISTORY',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR'
}

export interface AnalysisResult {
  message: string;
  score: number; // 0-100
  tips: string;
}

export interface PrizeEntry {
  faixa: number; // 11, 12, 13, 14, 15
  ganhadores: number;
  valor: number;
}

export interface LotteryResult {
  concurso: number;
  data: string;
  dezenas: string[]; // API usually returns strings
  acumulou: boolean;
  ganhadores15: number;
  proximoConcurso: number;
  dataProximoConcurso: string;
  valorEstimadoProximoConcurso: number;
  premiacoes: PrizeEntry[]; // New field for detailed winners
}

export interface TrendResult {
  hot: number[];
  cold: number[];
  analysis: string;
}

export interface HistoricalAnalysis {
  wins15: number;
  wins14: number;
  wins13: number;
  wins12: number;
  wins11: number;
  probabilityText: string;
  profitabilityIndex: number; // 0-100
}

export interface PastGameResult {
  concurso: number;
  dezenas: string[];
  data: string;        // Added
  ganhadores15: number; // Added
}

export interface HistoryCheckResult {
  matchesPerGame: Record<number, { concurso: number, hits: number }[]>;
  checkedCount: number;
}

export interface SavedBetBatch {
  id: string;
  createdAt: string;
  targetConcurso: number; // O concurso para o qual o jogo foi gerado
  games: number[][];
}