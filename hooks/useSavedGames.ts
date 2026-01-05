
import React, { useState, useEffect } from 'react';
import { SavedBetBatch, LotteryResult, GameConfig } from '../types';
import { getSavedBets, saveBets, deleteBatch, deleteGame } from '../services/storageService';
import { vibrate } from '../utils/uiUtils';
import { getResultNumbersAsSet } from '../utils/lotteryLogic';

export const useSavedGames = (activeGame: GameConfig, latestResult: LotteryResult | null) => {
  const [savedBatches, setSavedBatches] = useState<SavedBetBatch[]>([]);
  const [showSavedGamesModal, setShowSavedGamesModal] = useState(false);
  
  // Confirmação de deleção
  const [deleteConfirmBatchId, setDeleteConfirmBatchId] = useState<string | null>(null); 
  const [deleteConfirmGameId, setDeleteConfirmGameId] = useState<string | null>(null); 

  useEffect(() => {
    const loaded = getSavedBets();
    setSavedBatches(loaded);
  }, [activeGame.id]);

  // Conferência Automática
  useEffect(() => {
    if (latestResult && savedBatches.length > 0) {
        checkAutomaticWins(latestResult, savedBatches);
    }
  }, [latestResult, savedBatches.length]);

  const checkAutomaticWins = (result: LotteryResult, batches: SavedBetBatch[]) => {
    if (activeGame.id === 'federal') return;

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
      vibrate(500); 
      setShowSavedGamesModal(true);
      return maxHits;
    }
    return 0;
  };

  const handleSaveBatch = (games: number[][], nextConcurso: number, team: string | null | undefined, notify: (msg: string, type: 'success') => void) => {
    vibrate(20);
    if (games.length === 0) return;
    
    const updated = saveBets(
        games.map((g, i) => ({ numbers: g, gameNumber: i + 1, team: team || undefined })), 
        nextConcurso, 
        activeGame.id
    );
    
    setSavedBatches(updated);
    notify(`${games.length} jogos salvos com sucesso!`, 'success');
  };

  const handleSaveSingleGame = (game: number[], originalIndex: number, nextConcurso: number, team: string | null | undefined, notify: (msg: string, type: 'success') => void) => {
    vibrate(10);
    const updated = saveBets(
        [{ numbers: game, gameNumber: originalIndex + 1, team: team || undefined }], 
        nextConcurso, 
        activeGame.id
    );
    setSavedBatches(updated);
    notify(`Jogo ${originalIndex + 1} salvo!`, 'success');
  };

  // --- LÓGICA DE EXCLUSÃO CORRIGIDA ---

  const handleDeleteBatch = (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      vibrate(10);
      
      if (deleteConfirmBatchId === id) {
          // Segundo clique: Executa a exclusão
          setSavedBatches(deleteBatch(id));
          setDeleteConfirmBatchId(null);
          vibrate(50);
      } else {
          // Primeiro clique: Pede confirmação
          setDeleteConfirmBatchId(id);
          // Reseta a confirmação após 3 segundos se o usuário não confirmar
          setTimeout(() => setDeleteConfirmBatchId(null), 3000);
      }
  };

  const handleDeleteGame = (e: React.MouseEvent, batchId: string, gameId: string) => {
      e.stopPropagation();
      vibrate(10);

      if (deleteConfirmGameId === gameId) {
          // Segundo clique: Executa a exclusão
          setSavedBatches(deleteGame(batchId, gameId));
          setDeleteConfirmGameId(null);
          vibrate(50);
      } else {
          // Primeiro clique: Pede confirmação
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
    handleDeleteGame
  };
};
