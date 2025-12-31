import { SavedBetBatch } from '../types';

const STORAGE_KEY = 'lotosmart_saved_bets';

// Função segura para gerar IDs
const generateId = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
};

export const saveBets = (games: number[][], targetConcurso: number): SavedBetBatch => {
  const newBatch: SavedBetBatch = {
    id: generateId(),
    createdAt: new Date().toLocaleDateString('pt-BR'),
    targetConcurso,
    games
  };

  const existing = getSavedBets();
  const updated = [newBatch, ...existing];
  
  if (updated.length > 20) {
    updated.pop();
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return newBatch;
};

export const getSavedBets = (): SavedBetBatch[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];
    
    let parsed: SavedBetBatch[] = JSON.parse(data);
    
    // Auto-correção: Se existirem jogos antigos sem ID (bug anterior), adiciona ID neles e salva
    let needsFix = false;
    parsed = parsed.map(batch => {
      if (!batch.id) {
        needsFix = true;
        return { ...batch, id: generateId() };
      }
      return batch;
    });

    if (needsFix) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
    }

    return parsed;
  } catch (error) {
    console.error("Erro ao ler jogos salvos", error);
    return [];
  }
};

// Agora aceita a lista já filtrada para garantir sincronia exata com a UI
export const syncBets = (batches: SavedBetBatch[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(batches));
};

export const deleteBatch = (id: string): SavedBetBatch[] => {
  const existing = getSavedBets();
  const updated = existing.filter(b => String(b.id) !== String(id));
  syncBets(updated);
  return updated;
};