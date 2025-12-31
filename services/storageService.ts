import { SavedBetBatch, SavedGame } from '../types';

const STORAGE_KEY = 'lotosmart_saved_bets';

const generateId = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
};

export const saveBets = (
  gamesInput: { numbers: number[], gameNumber: number }[], 
  targetConcurso: number,
  gameType: string = 'lotofacil' // Default para compatibilidade
): SavedBetBatch[] => {
  
  const existingBatches = getSavedBets();
  
  // Verifica se já existe um grupo para este concurso E para este jogo
  const existingBatchIndex = existingBatches.findIndex(b => b.targetConcurso === targetConcurso && b.gameType === gameType);

  const newGamesToAdd: SavedGame[] = gamesInput.map((item) => ({
    id: generateId(),
    numbers: item.numbers,
    gameNumber: item.gameNumber
  }));

  if (existingBatchIndex >= 0) {
    const currentBatch = existingBatches[existingBatchIndex];
    const uniqueGames = newGamesToAdd.filter(newGame => 
      !currentBatch.games.some(existingGame => 
        JSON.stringify(existingGame.numbers) === JSON.stringify(newGame.numbers)
      )
    );

    if (uniqueGames.length > 0) {
      currentBatch.games = [...currentBatch.games, ...uniqueGames].sort((a, b) => a.gameNumber - b.gameNumber);
    }
    existingBatches[existingBatchIndex] = currentBatch;
  } else {
    const newBatch: SavedBetBatch = {
      id: generateId(),
      createdAt: new Date().toLocaleDateString('pt-BR'),
      targetConcurso,
      gameType: gameType,
      games: newGamesToAdd
    };
    existingBatches.unshift(newBatch);
  }
  
  if (existingBatches.length > 30) {
    existingBatches.pop();
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(existingBatches));
  return existingBatches;
};

export const getSavedBets = (): SavedBetBatch[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];
    
    let parsed: any[] = JSON.parse(data);
    let hasChanges = false;
    
    const migratedData: SavedBetBatch[] = parsed.map(batch => {
      const batchId = batch.id || generateId();
      if (!batch.id) hasChanges = true;

      // Migration: If gameType is missing, assume lotofacil (legacy)
      const gType = batch.gameType || 'lotofacil'; 
      if (!batch.gameType) hasChanges = true;

      let migratedGames: SavedGame[] = [];
      if (Array.isArray(batch.games)) {
        migratedGames = batch.games.map((g: any, idx: number) => {
          // Garante que todo jogo tenha ID e gameNumber
          if (g && typeof g === 'object' && Array.isArray(g.numbers)) {
             const gId = g.id || generateId();
             const gNum = typeof g.gameNumber === 'number' ? g.gameNumber : (idx + 1);
             
             if (!g.id || typeof g.gameNumber !== 'number') hasChanges = true;

             return { id: gId, numbers: g.numbers, gameNumber: gNum } as SavedGame;
          }
          // Legacy format handling
          if (Array.isArray(g)) {
            hasChanges = true;
            return { id: generateId(), numbers: g, gameNumber: idx + 1 } as SavedGame;
          }
          return null;
        }).filter((g): g is SavedGame => g !== null);
      }

      return {
        ...batch,
        id: batchId,
        gameType: gType,
        games: migratedGames
      };
    });

    // Se houve migração de dados (IDs gerados), salva imediatamente para persistir
    if (hasChanges) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(migratedData));
    }

    return migratedData;
  } catch (error) {
    console.error("Erro ao ler jogos salvos", error);
    return [];
  }
};

export const syncBets = (batches: SavedBetBatch[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(batches));
};

/**
 * Remove um lote inteiro pelo ID e atualiza o LocalStorage
 */
export const deleteBatch = (batchId: string): SavedBetBatch[] => {
  const batches = getSavedBets();
  const updatedBatches = batches.filter(b => b.id !== batchId);
  syncBets(updatedBatches);
  return updatedBatches;
};

/**
 * Remove um jogo específico de um lote e atualiza o LocalStorage
 */
export const deleteGame = (batchId: string, gameId: string): SavedBetBatch[] => {
  const batches = getSavedBets();
  const updatedBatches = batches.map(batch => {
      if (batch.id === batchId) {
          // Remove o jogo com o ID correspondente
          const newGames = batch.games.filter(g => g.id !== gameId);
          return { ...batch, games: newGames };
      }
      return batch;
  }).filter(batch => batch.games.length > 0); // Remove lotes que ficaram vazios

  syncBets(updatedBatches);
  return updatedBatches;
};