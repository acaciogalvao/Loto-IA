
import { GameConfig } from "../types";

export const GAMES: Record<string, GameConfig> = {
  lotofacil: {
    id: 'lotofacil',
    name: 'Lotofácil',
    totalNumbers: 25,
    minSelection: 15,
    maxSelection: 20, 
    defaultSelection: 15,
    cols: 5,
    color: 'fuchsia', 
    theme: {
        primary: '#930089', // Roxo Oficial
        secondary: '#6b0064',
        text: '#ffffff',
        background: '#fdf4ff',
        accent: '#d946ef'
    },
    apiSlug: 'lotofacil',
    startYear: 2003,
    minPrize: 1700000,
    howToPlay: "Marque entre 15 e 20 números, dentre os 25 disponíveis no volante.",
    drawDays: "Segunda a Sábado, às 20h.",
    priceTable: [
      { quantity: 15, price: 3.00 },
      { quantity: 16, price: 48.00 },
      { quantity: 17, price: 408.00 },
      { quantity: 18, price: 2448.00 },
      { quantity: 19, price: 11628.00 },
      { quantity: 20, price: 46512.00 },
    ]
  },
  megasena: {
    id: 'megasena',
    name: 'Mega-Sena',
    totalNumbers: 60,
    minSelection: 6,
    maxSelection: 15, 
    defaultSelection: 6,
    cols: 10,
    color: 'emerald',
    theme: {
        primary: '#209869', // Verde Oficial
        secondary: '#135c3f',
        text: '#ffffff',
        background: '#ecfdf5',
        accent: '#34d399'
    },
    apiSlug: 'megasena',
    startYear: 1996,
    minPrize: 3000000,
    howToPlay: "Escolha de 6 a 15 números dentre os 60 disponíveis.",
    drawDays: "Terças, Quintas e Sábados, às 20h.",
    priceTable: [
      { quantity: 6, price: 5.00 },
      { quantity: 7, price: 35.00 },
      { quantity: 8, price: 140.00 },
      { quantity: 9, price: 420.00 },
      { quantity: 10, price: 1050.00 },
      { quantity: 11, price: 2310.00 },
      { quantity: 12, price: 4620.00 },
      { quantity: 13, price: 8580.00 },
      { quantity: 14, price: 15015.00 },
      { quantity: 15, price: 25025.00 },
    ]
  },
  quina: {
    id: 'quina',
    name: 'Quina',
    totalNumbers: 80,
    minSelection: 5,
    maxSelection: 15, 
    defaultSelection: 5,
    cols: 10,
    color: 'violet',
    theme: {
        primary: '#260085', // Azul/Roxo Profundo Oficial
        secondary: '#1a005e',
        text: '#ffffff',
        background: '#eff6ff',
        accent: '#60a5fa'
    },
    apiSlug: 'quina',
    startYear: 1994,
    minPrize: 700000,
    howToPlay: "Marque de 5 a 15 números dentre os 80 disponíveis.",
    drawDays: "Segunda a Sábado, às 20h.",
    priceTable: [
      { quantity: 5, price: 2.50 },
      { quantity: 6, price: 15.00 },
      { quantity: 7, price: 52.50 },
      { quantity: 8, price: 140.00 },
      { quantity: 9, price: 315.00 },
      { quantity: 10, price: 630.00 },
      { quantity: 11, price: 1155.00 },
      { quantity: 12, price: 1980.00 },
      { quantity: 13, price: 3217.50 },
      { quantity: 14, price: 5005.00 },
      { quantity: 15, price: 7507.50 },
    ]
  },
  lotomania: {
    id: 'lotomania',
    name: 'Lotomania',
    totalNumbers: 100, 
    minSelection: 50,
    maxSelection: 50, 
    defaultSelection: 50,
    cols: 10,
    color: 'orange',
    theme: {
        primary: '#F78100', // Laranja Oficial
        secondary: '#c26500',
        text: '#ffffff',
        background: '#fff7ed',
        accent: '#fb923c'
    },
    apiSlug: 'lotomania',
    startYear: 1999,
    minPrize: 500000,
    howToPlay: "Escolha 50 números entre os 100 disponíveis (00 a 99).",
    drawDays: "Segundas, Quartas e Sextas, às 20h.",
    priceTable: [
      { quantity: 50, price: 3.00 },
    ]
  },
  diadesorte: {
    id: 'diadesorte',
    name: 'Dia de Sorte',
    totalNumbers: 31,
    minSelection: 7,
    maxSelection: 15, 
    defaultSelection: 7,
    cols: 10,
    color: 'amber',
    theme: {
        primary: '#CB852B', // Ocre/Marrom Oficial
        secondary: '#8a5a1b',
        text: '#ffffff',
        background: '#fffbeb',
        accent: '#f59e0b'
    },
    apiSlug: 'diadesorte',
    startYear: 2018,
    minPrize: 150000,
    howToPlay: "Escolha de 7 a 15 números dentre os 31 disponíveis e 1 Mês de Sorte.",
    drawDays: "Terças, Quintas e Sábados, às 20h.",
    priceTable: [
      { quantity: 7, price: 2.50 },
      { quantity: 8, price: 20.00 },
      { quantity: 9, price: 90.00 },
      { quantity: 10, price: 300.00 },
      { quantity: 11, price: 825.00 },
      { quantity: 12, price: 1980.00 },
      { quantity: 13, price: 4290.00 },
      { quantity: 14, price: 8580.00 },
      { quantity: 15, price: 16087.50 },
    ]
  },
  duplasena: {
    id: 'duplasena',
    name: 'Dupla Sena',
    totalNumbers: 50,
    minSelection: 6,
    maxSelection: 15, 
    defaultSelection: 6,
    cols: 10,
    color: 'rose',
    theme: {
        primary: '#A61324', // Vermelho/Bordô Oficial
        secondary: '#750b18',
        text: '#ffffff',
        background: '#fff1f2',
        accent: '#f43f5e'
    },
    apiSlug: 'duplasena',
    startYear: 2001,
    minPrize: 200000,
    howToPlay: "Escolha de 6 a 15 números dentre os 50 disponíveis. Concorre a 2 sorteios.",
    drawDays: "Segundas, Quartas e Sextas, às 20h.",
    priceTable: [
      { quantity: 6, price: 2.50 },
      { quantity: 7, price: 17.50 },
      { quantity: 8, price: 70.00 },
      { quantity: 9, price: 210.00 },
      { quantity: 10, price: 525.00 },
      { quantity: 11, price: 1155.00 },
      { quantity: 12, price: 2310.00 },
      { quantity: 13, price: 4290.00 },
      { quantity: 14, price: 7507.50 },
      { quantity: 15, price: 12512.50 },
    ]
  },
  supersete: {
    id: 'supersete',
    name: 'Super Sete',
    totalNumbers: 70, 
    minSelection: 7,
    maxSelection: 21, 
    defaultSelection: 7,
    cols: 7,
    color: 'lime',
    theme: {
        primary: '#A1C615', // Verde Lima Oficial
        secondary: '#74910d',
        text: '#1a2e05', // Texto escuro para contraste
        background: '#f7fee7',
        accent: '#84cc16'
    },
    apiSlug: 'supersete',
    startYear: 2020,
    minPrize: 100000,
    howToPlay: "Escolha números (0-9) em cada uma das 7 colunas.",
    drawDays: "Segundas, Quartas e Sextas, às 20h.",
    priceTable: [
      { quantity: 7, price: 2.50 },
      { quantity: 8, price: 5.00 },
      { quantity: 9, price: 10.00 },
      { quantity: 10, price: 20.00 },
      { quantity: 11, price: 40.00 },
      { quantity: 12, price: 80.00 },
      { quantity: 21, price: "Max" },
    ]
  },
  federal: {
    id: 'federal',
    name: 'Federal',
    totalNumbers: 0, 
    minSelection: 1,
    maxSelection: 1,
    defaultSelection: 1,
    cols: 1,
    color: 'blue',
    theme: {
        primary: '#0066B0', // Azul Oficial
        secondary: '#00477a',
        text: '#ffffff',
        background: '#eff6ff',
        accent: '#3b82f6'
    },
    apiSlug: 'federal',
    startYear: 2015, 
    minPrize: 500000,
    howToPlay: "Concorre com bilhetes de 5 dígitos.",
    drawDays: "Quartas e Sábados, às 19h.",
    priceTable: [
       { quantity: 1, price: "Variável (Fração)" }
    ]
  }
};

export const DEFAULT_GAME = GAMES.lotofacil;
