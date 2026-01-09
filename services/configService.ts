
import { GameConfig } from '../types';
import { GAMES } from '../utils/gameConfig';

const CONFIG_STORAGE_KEY = 'lotosmart_game_configs';

export const configService = {
  getGameConfigs: (): Record<string, GameConfig> => {
    try {
      const stored = localStorage.getItem(CONFIG_STORAGE_KEY);
      if (stored) {
        const parsedConfigs = JSON.parse(stored);
        
        // Merge inteligente: Garante que campos novos (como 'theme') existam mesmo se o cache for antigo
        const merged: Record<string, GameConfig> = { ...GAMES };
        
        Object.keys(parsedConfigs).forEach(key => {
            if (merged[key]) {
                // Se a config salva não tem tema (versão antiga), injeta o tema padrão
                if (!parsedConfigs[key].theme) {
                    parsedConfigs[key].theme = merged[key].theme;
                }
                
                // Merge dos dados, garantindo que a estrutura base do GAMES prevaleça para campos estruturais
                merged[key] = { 
                    ...merged[key], 
                    ...parsedConfigs[key],
                    // Força o tema padrão se estiver inválido no merge
                    theme: parsedConfigs[key].theme || merged[key].theme 
                };
            }
        });
        return merged;
      }
    } catch (e) {
      console.error("Erro ao carregar configs", e);
    }
    // Se falhar ou não existir, reseta para o padrão
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(GAMES));
    return GAMES;
  },

  saveGameConfig: (gameId: string, newConfig: GameConfig) => {
    const currentConfigs = configService.getGameConfigs();
    currentConfigs[gameId] = newConfig;
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(currentConfigs));
    return currentConfigs;
  },

  resetToDefault: () => {
    localStorage.removeItem(CONFIG_STORAGE_KEY);
    return GAMES;
  }
};
