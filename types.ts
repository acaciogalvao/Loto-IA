
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

export interface GameConfig {
  id: string; // 'lotofacil', 'megasena', etc.
  name: string; // 'Lotofácil', 'Mega-Sena'
  totalNumbers: number; // 25, 60, 80...
  minSelection: number; // 15, 6...
  maxSelection: number; // 20, 15...
  defaultSelection: number; // Quantidade padrão para um jogo simples
  cols: number; // Colunas no grid (5 para lotofacil, 10 para lotomania)
  color: string; // Cor do tema ('purple', 'green', 'blue')
  apiSlug: string; // Slug para a API ('lotofacil', 'megasena')
  startYear: number; // Ano de início da loteria
  minPrize: number; // Valor mínimo do prêmio para fallback
  // Novos campos informativos
  howToPlay: string;
  drawDays: string;
  priceTable: { quantity: number | string; price: number | string }[];
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
  valorAcumuladoProximoConcurso: number;
  valorAcumulado: number; // Novo campo para o acumulado atual
  valorAcumuladoEspecial: number; // Novo campo para acumulado especial (ex: Mega da Virada)
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
  data: string;        
  premiacoes: PrizeEntry[]; // Alterado para incluir todas as faixas
}

export interface HistoryCheckResult {
  matchesPerGame: Record<number, { concurso: number, hits: number }[]>;
  checkedCount: number;
}

// NOVA ESTRUTURA PARA JOGO INDIVIDUAL COM ID E NUMERAÇÃO
export interface SavedGame {
  id: string;
  numbers: number[];
  gameNumber: number; // Numeração persistente (Ex: 1 para "Jogo 1")
}

export interface SavedBetBatch {
  id: string;
  createdAt: string;
  targetConcurso: number; 
  gameType: string; // 'lotofacil', 'megasena' (NOVO CAMPO)
  games: SavedGame[]; 
}

export interface DetailedStats {
  pares: number;
  impares: number;
  primos: number;
  soma: number;
  media: string;
  desvioPadrao: string; // Novo campo
  multiplos3: number;
  fibonacci: number;
  moldura: number;
  centro: number;
  triangulares: number;
  repetidos: number | string; // Pode ser string se não houver dados do anterior
}