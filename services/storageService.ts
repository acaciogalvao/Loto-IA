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
  gameType: string = 'lotofacil' 
): SavedBetBatch[] => {
  
  const existingBatches = getSavedBets();
  
  if (gamesInput.length === 0) return existingBatches;

  const incomingSize = gamesInput[0].numbers.length;

  const incomingGames = gamesInput.map(g => ({
      ...g,
      numbers: [...g.numbers].sort((a, b) => a - b)
  }));

  const seenInInput = new Set<string>();
  const distinctIncomingGames = incomingGames.filter(g => {
      const signature = JSON.stringify(g.numbers);
      if (seenInInput.has(signature)) return false;
      seenInInput.add(signature);
      return true;
  });

  const newGamesToAddPayload: SavedGame[] = distinctIncomingGames.map((item) => ({
    id: generateId(),
    numbers: item.numbers,
    gameNumber: item.gameNumber
  }));
  
  const existingBatchIndex = existingBatches.findIndex(b => {
      const basicMatch = b.targetConcurso === targetConcurso && b.gameType === gameType;
      if (!basicMatch) return false;

      if (b.games.length > 0) {
          return b.games[0].numbers.length === incomingSize;
      }
      return true;
  });

  if (existingBatchIndex >= 0) {
    const currentBatch = existingBatches[existingBatchIndex];
    
    const existingSignatures = new Set(
        currentBatch.games.map(g => JSON.stringify([...g.numbers].sort((a, b) => a - b)))
    );

    const uniqueGames = newGamesToAddPayload.filter(newGame => {
        const signature = JSON.stringify(newGame.numbers); 
        return !existingSignatures.has(signature);
    });

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
      games: newGamesToAddPayload
    };
    existingBatches.unshift(newBatch);
  }
  
  try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(existingBatches));
  } catch (e) {
      console.error("Erro crítico: Armazenamento cheio", e);
      alert("Atenção: O armazenamento do navegador está cheio.");
      
      if (existingBatches.length > 1) {
          try {
             const emergencyBatches = [...existingBatches];
             while(emergencyBatches.length > 0) {
                 emergencyBatches.pop();
                 try {
                     localStorage.setItem(STORAGE_KEY, JSON.stringify(emergencyBatches));
                     return emergencyBatches; 
                 } catch(err) { continue; }
             }
          } catch (e2) {
             console.error("Falha total de armazenamento", e2);
          }
      }
  }
  return existingBatches;
};

export const getSavedBets = (): SavedBetBatch[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];
    
    let parsed: any[] = JSON.parse(data);
    if (!Array.isArray(parsed)) return [];

    let hasChanges = false;
    
    const migratedData: SavedBetBatch[] = parsed.map(batch => {
      const batchId = batch.id ? String(batch.id) : generateId();
      if (!batch.id || typeof batch.id !== 'string') hasChanges = true;

      const gType = batch.gameType || 'lotofacil'; 
      if (!batch.gameType) hasChanges = true;

      let migratedGames: SavedGame[] = [];
      if (Array.isArray(batch.games)) {
        migratedGames = batch.games.map((g: any, idx: number) => {
          if (g && typeof g === 'object' && Array.isArray(g.numbers)) {
             const gId = g.id ? String(g.id) : generateId();
             const gNum = typeof g.gameNumber === 'number' ? g.gameNumber : (idx + 1);
             
             if (!g.id || typeof g.gameNumber !== 'number') hasChanges = true;

             return { id: gId, numbers: g.numbers, gameNumber: gNum } as SavedGame;
          }
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
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(batches));
  } catch(e) {
    console.error("Erro ao sincronizar bets", e);
  }
};

export const deleteBatch = (batchId: string): SavedBetBatch[] => {
  const batches = getSavedBets();
  const targetId = String(batchId);
  const updatedBatches = batches.filter(b => String(b.id) !== targetId);
  syncBets(updatedBatches);
  return updatedBatches;
};

export const deleteGame = (batchId: string, gameId: string): SavedBetBatch[] => {
  const batches = getSavedBets();
  const targetBatchId = String(batchId);
  const targetGameId = String(gameId);

  const updatedBatches = batches.map(batch => {
      if (String(batch.id) === targetBatchId) {
          const newGames = batch.games.filter(g => String(g.id) !== targetGameId);
          return { ...batch, games: newGames };
      }
      return batch;
  }).filter(batch => batch.games.length > 0); 

  syncBets(updatedBatches);
  return updatedBatches;
};