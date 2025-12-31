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
  
  // 1. Preparar os novos jogos (garantir ordenação para comparação consistente)
  const incomingGames = gamesInput.map(g => ({
      ...g,
      numbers: [...g.numbers].sort((a, b) => a - b)
  }));

  // 2. Remover duplicatas INTERNAS do input (caso o gerador tenha criado repetidos no mesmo lote)
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
  
  // Verifica se já existe um grupo para este concurso E para este tipo de jogo
  const existingBatchIndex = existingBatches.findIndex(b => b.targetConcurso === targetConcurso && b.gameType === gameType);

  if (existingBatchIndex >= 0) {
    const currentBatch = existingBatches[existingBatchIndex];
    
    // 3. Remover duplicatas contra o BANCO DE DADOS (o que já está salvo neste grupo)
    // Cria um Set com as assinaturas dos jogos JÁ salvos para busca rápida
    const existingSignatures = new Set(
        currentBatch.games.map(g => JSON.stringify([...g.numbers].sort((a, b) => a - b)))
    );

    const uniqueGames = newGamesToAddPayload.filter(newGame => {
        const signature = JSON.stringify(newGame.numbers); // Já está ordenado do passo 1
        return !existingSignatures.has(signature);
    });

    if (uniqueGames.length > 0) {
      // Adiciona apenas os únicos ao lote existente
      currentBatch.games = [...currentBatch.games, ...uniqueGames].sort((a, b) => a.gameNumber - b.gameNumber);
    }
    existingBatches[existingBatchIndex] = currentBatch;
  } else {
    // Cria novo lote se não existir
    const newBatch: SavedBetBatch = {
      id: generateId(),
      createdAt: new Date().toLocaleDateString('pt-BR'),
      targetConcurso,
      gameType: gameType,
      games: newGamesToAddPayload
    };
    // Adiciona no topo da lista
    existingBatches.unshift(newBatch);
  }
  
  // --- MUDANÇA: REMOVIDO LIMITE ARTIFICIAL DE 100 GRUPOS ---
  // O armazenamento agora cresce indefinidamente até o limite físico do LocalStorage do navegador.
  
  try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(existingBatches));
  } catch (e) {
      console.error("Erro crítico: Armazenamento cheio (LocalStorage Quota Exceeded)", e);
      alert("Atenção: O armazenamento do navegador está cheio. Não foi possível salvar novos jogos. Tente apagar jogos antigos.");
      
      // Fallback de emergência: Tenta salvar removendo o lote mais antigo para não perder o dado atual
      // Isso garante que o app não quebre se o usuário atingir 5MB de dados
      if (existingBatches.length > 1) {
          try {
             const emergencyBatches = [...existingBatches];
             // Remove o último (mais antigo) até caber
             while(emergencyBatches.length > 0) {
                 emergencyBatches.pop();
                 try {
                     localStorage.setItem(STORAGE_KEY, JSON.stringify(emergencyBatches));
                     return emergencyBatches; // Conseguiu salvar sacrificando antigos
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
  const updatedBatches = batches.filter(b => b.id !== batchId);
  syncBets(updatedBatches);
  return updatedBatches;
};

export const deleteGame = (batchId: string, gameId: string): SavedBetBatch[] => {
  const batches = getSavedBets();
  const updatedBatches = batches.map(batch => {
      if (batch.id === batchId) {
          const newGames = batch.games.filter(g => g.id !== gameId);
          return { ...batch, games: newGames };
      }
      return batch;
  }).filter(batch => batch.games.length > 0); 

  syncBets(updatedBatches);
  return updatedBatches;
};