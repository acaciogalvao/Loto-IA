
import { SavedBetBatch, PastGameResult } from '../types';
import { supabase } from './supabaseClient';

// Chaves para armazenamento local (Fallback)
const USER_ID_KEY = 'lotosmart_user_id';
const LOCAL_BATCHES_KEY = 'lotosmart_saved_batches_backup';
const RESULTS_CACHE_KEY_PREFIX = 'lotosmart_results_cache_';

// Helper para identificar o usuário
const getUserId = (): string => {
  let id = localStorage.getItem(USER_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(USER_ID_KEY, id);
  }
  return id;
};

// --- FALLBACK LOCAL STORAGE ---
// Garante que o usuário veja seus jogos mesmo se o banco falhar

const getLocalBatches = (): SavedBetBatch[] => {
    try {
        const data = localStorage.getItem(LOCAL_BATCHES_KEY);
        return data ? JSON.parse(data) : [];
    } catch {
        return [];
    }
};

const saveLocalBatches = (batches: SavedBetBatch[]) => {
    localStorage.setItem(LOCAL_BATCHES_KEY, JSON.stringify(batches));
};

const updateLocalBatchWithNewGames = (
    userId: string, 
    gameType: string, 
    targetConcurso: number, 
    gamesInput: { numbers: number[], gameNumber: number, team?: string }[]
): SavedBetBatch[] => {
    const batches = getLocalBatches();
    const existingIndex = batches.findIndex(b => b.targetConcurso === targetConcurso && b.gameType === gameType);
    
    // Novos jogos formatados
    const newGames = gamesInput.map((g, i) => ({
        id: crypto.randomUUID(),
        numbers: g.numbers,
        gameNumber: g.gameNumber, // Será ajustado se for append
        team: g.team
    }));

    if (existingIndex >= 0) {
        // Atualiza lote existente
        const batch = batches[existingIndex];
        const startNumber = batch.games.length + 1;
        
        // Ajusta numero dos novos jogos
        const adjustedGames = newGames.map((g, i) => ({ ...g, gameNumber: startNumber + i }));
        
        batch.games = [...batch.games, ...adjustedGames];
        batches[existingIndex] = batch;
    } else {
        // Cria novo lote
        const newBatch: SavedBetBatch = {
            id: crypto.randomUUID(),
            createdAt: new Date().toLocaleDateString('pt-BR'),
            targetConcurso,
            gameType,
            games: newGames
        };
        batches.unshift(newBatch); // Adiciona no topo
    }

    saveLocalBatches(batches);
    return batches;
};

// Mapeia o retorno do Banco de Dados
const mapDatabaseToBatch = (dbBatches: any[]): SavedBetBatch[] => {
    return dbBatches.map(b => ({
        id: b.id,
        createdAt: new Date(b.created_at).toLocaleDateString('pt-BR'),
        targetConcurso: b.target_concurso,
        gameType: b.game_type,
        games: (b.games || []).map((g: any) => ({
            id: g.id,
            numbers: g.numbers,
            gameNumber: g.game_number,
            team: g.team
        })).sort((a: any, b: any) => a.gameNumber - b.gameNumber)
    }));
};

// --- FUNÇÕES DE JOGOS SALVOS (HÍBRIDO: NUVEM + LOCAL) ---

export const getSavedBets = async (): Promise<SavedBetBatch[]> => {
  const userId = getUserId();
  
  try {
    // Tenta buscar da Nuvem
    const { data, error } = await supabase
        .from('batches')
        .select(`*, games (*)`)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

    if (error) throw error;
    
    const cloudBatches = mapDatabaseToBatch(data || []);
    
    // Se deu certo, atualiza o backup local
    if (cloudBatches.length > 0) {
        saveLocalBatches(cloudBatches);
    } 
    
    return cloudBatches;
  } catch (error) {
    console.warn("Supabase indisponível ou tabela inexistente. Usando backup local.", error);
    return getLocalBatches();
  }
};

export const saveBets = async (
  gamesInput: { numbers: number[], gameNumber: number, team?: string }[], 
  targetConcurso: number,
  gameType: string = 'lotofacil' 
): Promise<SavedBetBatch[]> => {
  const userId = getUserId();
  
  if (gamesInput.length === 0) return await getSavedBets();

  try {
      // 1. Tenta salvar na Nuvem
      const { data: existingBatch, error: findError } = await supabase
          .from('batches')
          .select('id')
          .eq('user_id', userId)
          .eq('game_type', gameType)
          .eq('target_concurso', targetConcurso)
          .single();
      
      // PGRST116 = JSON object requested, multiple (or no) rows returned. (No rows = ok here)
      if (findError && findError.code !== 'PGRST116') throw findError;

      let batchId = existingBatch?.id;

      if (!batchId) {
          const { data: newBatch, error: batchError } = await supabase
              .from('batches')
              .insert({
                  user_id: userId,
                  game_type: gameType,
                  target_concurso: targetConcurso
              })
              .select()
              .single();
          
          if (batchError) throw batchError;
          batchId = newBatch.id;
      }

      const gamesPayload = gamesInput.map(g => ({
          batch_id: batchId,
          numbers: [...g.numbers].sort((a, b) => a - b),
          game_number: g.gameNumber,
          team: g.team || null
      }));

      const { error: gamesError } = await supabase
          .from('games')
          .insert(gamesPayload);

      if (gamesError) throw gamesError;

      return await getSavedBets();

  } catch (error) {
      console.error("Erro ao salvar na nuvem (Possível falta de tabela 'batches'). Salvando localmente.", error);
      // FALLBACK: Salva localmente se a nuvem falhar
      return updateLocalBatchWithNewGames(userId, gameType, targetConcurso, gamesInput);
  }
};

export const deleteBatch = async (batchId: string): Promise<SavedBetBatch[]> => {
  try {
      // Tenta deletar da nuvem
      await supabase.from('batches').delete().eq('id', batchId);
      
      // Deleta do local também
      const local = getLocalBatches().filter(b => b.id !== batchId);
      saveLocalBatches(local);

      return await getSavedBets();
  } catch (error) {
      console.error("Erro ao deletar lote (nuvem):", error);
      // Fallback local
      const local = getLocalBatches().filter(b => b.id !== batchId);
      saveLocalBatches(local);
      return local;
  }
};

export const deleteGame = async (batchId: string, gameId: string): Promise<SavedBetBatch[]> => {
  try {
      // Tenta nuvem
      const { error } = await supabase.from('games').delete().eq('id', gameId);
      if (error) throw error;
      
      // Verifica lote vazio na nuvem
      const { count } = await supabase.from('games').select('*', { count: 'exact', head: true }).eq('batch_id', batchId);
      if (count === 0) {
          await supabase.from('batches').delete().eq('id', batchId);
      }

      return await getSavedBets();
  } catch (error) {
      console.error("Erro ao deletar jogo (nuvem):", error);
      
      // Fallback Local
      const batches = getLocalBatches();
      const batchIdx = batches.findIndex(b => b.id === batchId);
      if (batchIdx >= 0) {
          batches[batchIdx].games = batches[batchIdx].games.filter(g => g.id !== gameId);
          if (batches[batchIdx].games.length === 0) {
              batches.splice(batchIdx, 1);
          }
          saveLocalBatches(batches);
      }
      return batches;
  }
};

// --- FUNÇÕES DE CACHE DE RESULTADOS OFICIAIS (HÍBRIDO: SUPABASE + LOCALSTORAGE) ---

const getLocalResults = (gameSlug: string): PastGameResult[] => {
    try {
        const raw = localStorage.getItem(`${RESULTS_CACHE_KEY_PREFIX}${gameSlug}`);
        return raw ? JSON.parse(raw) : [];
    } catch (e) {
        return [];
    }
};

const saveLocalResults = (gameSlug: string, newResults: PastGameResult[]) => {
    try {
        const current = getLocalResults(gameSlug);
        // Cria Map para evitar duplicatas por concurso
        const currentMap = new Map(current.map(r => [r.concurso, r]));
        
        newResults.forEach(r => currentMap.set(r.concurso, r));
        
        const merged = Array.from(currentMap.values()).sort((a,b) => b.concurso - a.concurso);
        localStorage.setItem(`${RESULTS_CACHE_KEY_PREFIX}${gameSlug}`, JSON.stringify(merged));
    } catch (e) {
        console.warn('LocalStorage quota exceeded or error saving results cache', e);
    }
};

export const getStoredResults = async (gameSlug: string, startConcurso: number, endConcurso: number): Promise<PastGameResult[]> => {
    let results: PastGameResult[] = [];
    
    // 1. Tenta Supabase (Fonte da Verdade Compartilhada)
    try {
        const { data, error } = await supabase
            .from('lottery_results')
            .select('content')
            .eq('game_slug', gameSlug)
            .gte('concurso', startConcurso)
            .lte('concurso', endConcurso)
            .limit(5000);

        if (!error && data) {
            results = data.map(row => row.content as PastGameResult);
        }
    } catch (e) {
        // Silencioso
    }

    // 2. Busca Cache Local (Fallback Rápido)
    const localResults = getLocalResults(gameSlug);
    
    // 3. Merge: Prioriza Supabase, mas preenche buracos com LocalStorage
    const resultMap = new Map<number, PastGameResult>();
    
    // Adiciona DB
    results.forEach(r => resultMap.set(r.concurso, r));
    
    // Adiciona Local se faltar
    localResults.forEach(r => {
         if (r.concurso >= startConcurso && r.concurso <= endConcurso) {
             if (!resultMap.has(r.concurso)) {
                 resultMap.set(r.concurso, r);
             }
         }
    });

    return Array.from(resultMap.values()).sort((a,b) => b.concurso - a.concurso);
};

export const saveStoredResults = async (gameSlug: string, results: PastGameResult[]) => {
    if (results.length === 0) return;
    
    // 1. Salva Localmente (Instantâneo e funciona offline)
    saveLocalResults(gameSlug, results);

    // 2. Salva na Nuvem (Assíncrono)
    try {
        const payload = results.map(r => ({
            game_slug: gameSlug,
            concurso: r.concurso,
            content: r
        }));
        
        const { error } = await supabase
            .from('lottery_results')
            .upsert(payload, { onConflict: 'game_slug,concurso', ignoreDuplicates: true });
            
        if (error) {
            if (error.code === '42P01') {
                 console.error("⚠️ Tabela 'lottery_results' não encontrada no Supabase.");
            }
        }
    } catch (e) {
        console.error("Erro ao salvar cache de resultados no Supabase:", e);
    }
};
