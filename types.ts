
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

export interface GameTheme {
  primary: string;       // Cor principal (ex: Verde Mega-Sena #209869)
  secondary: string;     // Cor secundária para gradientes ou contrastes
  text: string;          // Cor de texto sobre a cor primária (geralmente white)
  background: string;    // Cor de fundo leve
  accent: string;        // Cor de destaque
}

export interface GameConfig {
  id: string; // 'lotofacil', 'megasena', etc.
  name: string; // 'Lotofácil', 'Mega-Sena'
  totalNumbers: number; // 25, 60, 80...
  minSelection: number; // 15, 6...
  maxSelection: number; // 20, 15...
  defaultSelection: number; // Quantidade padrão para um jogo simples
  cols: number; // Colunas no grid (5 para lotofacil, 10 para lotomania)
  color: string; // Mantido para compatibilidade legacy (removível no futuro)
  theme: GameTheme; // NOVO: Cores reais
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

export interface WinnerLocation {
  cidade: string;
  uf: string;
  ganhadores: number;
}

export interface PrizeEntry {
  faixa: number; // 11, 12, 13, 14, 15
  ganhadores: number;
  valor: number;
  bilhete?: string; // NOVO: Para Loteria Federal
  locais?: WinnerLocation[]; // NOVO: Lista de cidades ganhadoras
}

export interface LotteryResult {
  concurso: number;
  data: string;
  dezenas: string[]; // API usually returns strings
  trevos?: string[]; // NOVO: Trevos da +Milionária
  acumulou: boolean;
  ganhadores15: number;
  proximoConcurso: number;
  dataProximoConcurso: string;
  valorEstimadoProximoConcurso: number;
  valorAcumuladoProximoConcurso: number;
  valorAcumulado: number; // Novo campo para o acumulado atual
  valorAcumuladoEspecial: number; // Novo campo para acumulado especial (ex: Mega da Virada)
  valorArrecadado: number; // NOVO: Arrecadação total
  premiacoes: PrizeEntry[]; // New field for detailed winners
  timeCoracao?: string; // NOVO: Time do Coração para Timemania
}

export interface NumberProbability {
  number: number;
  probability: number; // 0-100
  status: 'hot' | 'cold' | 'neutral';
  lastSeen: number; // concursos atrás
  frequency: number; // % de ocorrência
}

export interface TrendResult {
  hot: number[];
  cold: number[];
  probabilities: NumberProbability[];
  analysis: string;
}

export interface HistoricalAnalysis {
  wins15: number;
  wins14: number;
  wins13: number;
  wins12: number;
  wins11: number;
  totalInvested: number;
  totalPrize: number;
  netProfit: number;
  roi: number;
  probabilityText: string;
  profitabilityIndex: number; // 0-100
}

export interface PastGameResult {
  concurso: number;
  dezenas: string[];
  trevos?: string[]; 
  data: string;        
  premiacoes: PrizeEntry[]; 
  valorAcumulado?: number; 
  valorEstimadoProximoConcurso?: number; 
  timeCoracao?: string; 
  valorArrecadado?: number; // ADICIONADO: Disponível no histórico também
}

export interface HistoryCheckResult {
  matchesPerGame: Record<number, { concurso: number, hits: number }[]>;
  checkedCount: number;
}

export interface SavedGame {
  id: string;
  numbers: number[];
  gameNumber: number; 
  team?: string; 
}

export interface SavedBetBatch {
  id: string;
  createdAt: string;
  targetConcurso: number; 
  gameType: string; 
  games: SavedGame[]; 
}

export interface DetailedStats {
  pares: number;
  impares: number;
  primos: number;
  soma: number;
  media: string;
  desvioPadrao: string; 
  multiplos3: number;
  fibonacci: number;
  moldura: number;
  centro: number;
  triangulares: number;
  repetidos: number | string; 
}
