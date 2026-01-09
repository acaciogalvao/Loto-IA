
import React, { useState, useEffect, useRef } from 'react';
import { SavedBetBatch, LotteryResult, GameConfig } from '../types';
import { getSavedBets, saveBets, deleteBatch, deleteGame } from '../services/storageService';
import { vibrate } from '../utils/uiUtils';
import { getResultNumbersAsSet } from '../utils/lotteryLogic';

export const useSavedGames = (
    activeGame: GameConfig, 
    latestResult: LotteryResult | null,
    onWinDetected?: (hits: number) => void
) => {
  const [savedBatches, setSavedBatches] = useState<SavedBetBatch[]>([]);
  const [showSavedGamesModal, setShowSavedGamesModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Controle para evitar reabrir o modal repetidamente para o mesmo resultado
  const checkedResultsRef = useRef<Set<string>>(new Set());
  
  // Confirmação de deleção
  const [deleteConfirmBatchId, setDeleteConfirmBatchId] = useState<string | null>(null); 
  const [deleteConfirmGameId, setDeleteConfirmGameId] = useState<string | null>(null); 

  // Carregar jogos ao iniciar ou trocar de jogo
  useEffect(() => {
    const loadGames = async () => {
        setIsLoading(true);
        const loaded = await getSavedBets();
        setSavedBatches(loaded);
        setIsLoading(false);
    };
    loadGames();
  }, [activeGame.id]);

  // Conferência Automática
  useEffect(() => {
    if (latestResult && savedBatches.length > 0) {
        checkAutomaticWins(latestResult, savedBatches);
    }
  }, [latestResult, savedBatches.length]);

  const checkAutomaticWins = (result: LotteryResult, batches: SavedBetBatch[]) => {
    if (activeGame.id === 'federal') return;

    // Chave única para este concurso deste jogo
    const checkKey = `${activeGame.id}-${result.concurso}`;
    
    // Se já conferimos e notificamos este concurso, não faz nada
    if (checkedResultsRef.current.has(checkKey)) return;

    let maxHits = 0;
    const relevantBatches = batches.filter(b => b.gameType === activeGame.id || (!b.gameType && activeGame.id === 'lotofacil'));

    relevantBatches.forEach(batch => {
      if (batch.targetConcurso === result.concurso) {
        const resultSet = getResultNumbersAsSet(result, activeGame.id);
        
        batch.games.forEach(gameObj => {
          const hits = gameObj.numbers.filter(n => resultSet.has(n)).length;
          if (hits > maxHits) {
            maxHits = hits;
          }
        });
      }
    });

    let threshold = 0;
    if (activeGame.id === 'lotofacil') threshold = 11;
    else if (activeGame.id === 'megasena') threshold = 4;
    else if (activeGame.id === 'quina') threshold = 2;
    else if (activeGame.id === 'lotomania') threshold = 15;
    else if (activeGame.id === 'supersete') threshold = 3;
    else if (activeGame.id === 'timemania') threshold = 3;
    
    if (maxHits >= threshold && threshold > 0) {
      checkedResultsRef.current.add(checkKey);

      if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate([100, 50, 100, 50, 300]); 
      }

      if (onWinDetected) {
          onWinDetected(maxHits);
      }

      setTimeout(() => {
          setShowSavedGamesModal(true);
      }, 1500);

      return maxHits;
    }
    return 0;
  };

  const handleSaveBatch = async (games: number[][], nextConcurso: number, team: string | null | undefined, notify: (msg: string, type: 'success') => void) => {
    vibrate(20);
    if (games.length === 0) return;
    
    // Calcula o próximo gameNumber baseado no que já existe (aproximação para UI, backend trata ID)
    const existingBatch = savedBatches.find(b => b.targetConcurso === nextConcurso && b.gameType === activeGame.id);
    const startIdx = existingBatch ? existingBatch.games.length : 0;

    const gamesPayload = games.map((g, i) => ({ 
        numbers: g, 
        gameNumber: startIdx + i + 1, 
        team: team || undefined 
    }));

    const updated = await saveBets(gamesPayload, nextConcurso, activeGame.id);
    setSavedBatches(updated);
    notify(`${games.length} jogos salvos na nuvem!`, 'success');
  };

  const handleSaveSingleGame = async (game: number[], originalIndex: number, nextConcurso: number, team: string | null | undefined, notify: (msg: string, type: 'success') => void) => {
    vibrate(10);
    
    // Para single save, tentamos manter o número sequencial correto se possível
    const existingBatch = savedBatches.find(b => b.targetConcurso === nextConcurso && b.gameType === activeGame.id);
    const nextGameNum = existingBatch ? existingBatch.games.length + 1 : 1;

    const updated = await saveBets(
        [{ numbers: game, gameNumber: nextGameNum, team: team || undefined }], 
        nextConcurso, 
        activeGame.id
    );
    setSavedBatches(updated);
    notify(`Jogo salvo na nuvem!`, 'success');
  };

  const handleDeleteBatch = async (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      vibrate(10);
      
      if (deleteConfirmBatchId === id) {
          const updated = await deleteBatch(id);
          setSavedBatches(updated);
          setDeleteConfirmBatchId(null);
          vibrate(50);
      } else {
          setDeleteConfirmBatchId(id);
          setTimeout(() => setDeleteConfirmBatchId(null), 3000);
      }
  };

  const handleDeleteGame = async (e: React.MouseEvent, batchId: string, gameId: string) => {
      e.stopPropagation();
      vibrate(10);

      if (deleteConfirmGameId === gameId) {
          const updated = await deleteGame(batchId, gameId);
          setSavedBatches(updated);
          setDeleteConfirmGameId(null);
          vibrate(50);
      } else {
          setDeleteConfirmGameId(gameId);
          setTimeout(() => setDeleteConfirmGameId(null), 3000);
      }
  };

  return {
    savedBatches,
    showSavedGamesModal,
    setShowSavedGamesModal,
    deleteConfirmBatchId,
    setDeleteConfirmBatchId,
    deleteConfirmGameId,
    setDeleteConfirmGameId,
    handleSaveBatch,
    handleSaveSingleGame,
    handleDeleteBatch,
    handleDeleteGame,
    isLoading
  };
};
