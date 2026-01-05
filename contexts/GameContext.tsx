
import React, { createContext, useContext, useState, ReactNode, useCallback, useMemo } from 'react';
import { GameConfig, LotteryResult, PastGameResult, SavedBetBatch, SavedGame } from '../types';
import { DEFAULT_GAME, GAMES } from '../utils/gameConfig';
import { useLotteryData } from '../hooks/useLotteryData';
import { useSavedGames } from '../hooks/useSavedGames';
import { vibrate } from '../utils/uiUtils';
import { getResultNumbersAsSet } from '../utils/lotteryLogic';

interface NotificationState {
  msg: string;
  type: 'success' | 'info' | 'error';
}

interface GameContextType {
  activeGame: GameConfig;
  switchGame: (gameId: string) => void;
  
  // Data
  latestResult: LotteryResult | null;
  displayedResult: LotteryResult | null;
  isResultLoading: boolean;
  refreshResult: () => void;
  searchAndDisplayResult: (concurso: number) => Promise<boolean>;
  resetDisplayToLatest: () => void;
  
  // UI States
  isMenuOpen: boolean;
  setIsMenuOpen: (isOpen: boolean) => void;
  notification: NotificationState | null;
  notify: (msg: string, type: 'success' | 'info' | 'error') => void;
  
  // Manual Search Data
  manualSearchConcurso: string;
  setManualSearchConcurso: (val: string) => void;
  manualSearchResult: PastGameResult | null;
  isManualSearchLoading: boolean;
  handleManualSearch: () => Promise<boolean>;
  clearManualSearch: () => void;

  // Saved Games Logic (Moved from GameScreen)
  savedBatches: SavedBetBatch[];
  showSavedGamesModal: boolean;
  setShowSavedGamesModal: (show: boolean) => void;
  handleSaveBatch: (games: number[][], nextConcurso: number, notify: (msg: string, type: 'success') => void) => void;
  handleSaveSingleGame: (game: number[], originalIndex: number, nextConcurso: number, notify: (msg: string, type: 'success') => void) => void;
  // Assinaturas atualizadas para incluir o evento
  handleDeleteBatch: (e: React.MouseEvent, id: string) => void;
  handleDeleteGame: (e: React.MouseEvent, batchId: string, gameId: string) => void;
  deleteConfirmBatchId: string | null;
  deleteConfirmGameId: string | null;
  
  // Calculated Global Data
  grandTotalPrize: number;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

export const GameProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [activeGame, setActiveGame] = useState<GameConfig>(DEFAULT_GAME);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [notification, setNotification] = useState<NotificationState | null>(null);

  // 1. Lottery Data Hook
  const lotteryData = useLotteryData(activeGame);
  
  // 2. Saved Games Hook (Now global)
  const savedLogic = useSavedGames(activeGame, lotteryData.latestResult);

  const notify = useCallback((msg: string, type: 'success' | 'info' | 'error') => {
    setNotification({ msg, type });
    if (type === 'success') setTimeout(() => setNotification(null), 3000);
  }, []);

  const switchGame = (gameId: string) => {
    vibrate(15);
    const newGame = GAMES[gameId];
    if (newGame) {
      setActiveGame(newGame);
      setIsMenuOpen(false);
    }
  };

  // Global Calculation for Grand Total Prize
  const grandTotalPrize = useMemo(() => {
      const activeResultForCalc = lotteryData.manualSearchResult || lotteryData.latestResult;
      if (!activeResultForCalc || savedLogic.savedBatches.length === 0) return 0;
      
      let total = 0;
      const resultSet = getResultNumbersAsSet(activeResultForCalc, activeGame.id);

      savedLogic.savedBatches.forEach(batch => {
          const shouldCheck = lotteryData.manualSearchResult 
                ? batch.gameType === activeGame.id 
                : (batch.gameType === activeGame.id && batch.targetConcurso === activeResultForCalc.concurso);

          if (shouldCheck) {
              batch.games.forEach(gameObj => {
                  const hits = gameObj.numbers.filter(n => resultSet.has(n)).length;
                  const prizeEntry = activeResultForCalc.premiacoes.find(p => p.faixa === hits);
                  if (prizeEntry) {
                      total += prizeEntry.valor;
                  }
              });
          }
      });
      return total;
  }, [lotteryData.latestResult, lotteryData.manualSearchResult, savedLogic.savedBatches, activeGame.id]);

  return (
    <GameContext.Provider value={{
      activeGame,
      switchGame,
      ...lotteryData, // Spread lottery data props
      isMenuOpen,
      setIsMenuOpen,
      notification,
      notify,
      // Saved Games Spread
      savedBatches: savedLogic.savedBatches,
      showSavedGamesModal: savedLogic.showSavedGamesModal,
      setShowSavedGamesModal: savedLogic.setShowSavedGamesModal,
      handleSaveBatch: savedLogic.handleSaveBatch,
      handleSaveSingleGame: savedLogic.handleSaveSingleGame,
      handleDeleteBatch: savedLogic.handleDeleteBatch,
      handleDeleteGame: savedLogic.handleDeleteGame,
      deleteConfirmBatchId: savedLogic.deleteConfirmBatchId,
      deleteConfirmGameId: savedLogic.deleteConfirmGameId,
      grandTotalPrize
    }}>
      {children}
    </GameContext.Provider>
  );
};

export const useGameContext = () => {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGameContext must be used within a GameProvider');
  }
  return context;
};
