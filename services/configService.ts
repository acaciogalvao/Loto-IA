import { GameConfig } from '../types';
import { GAMES } from '../utils/gameConfig';

const CONFIG_STORAGE_KEY = 'lotosmart_game_configs';

export const configService = {
  getGameConfigs: (): Record<string, GameConfig> => {
    try {
      const stored = localStorage.getItem(CONFIG_STORAGE_KEY);
      if (stored) {
        const parsedConfigs = JSON.parse(stored);
        return { ...GAMES, ...parsedConfigs };
      }
    } catch (e) {
      console.error("Erro ao carregar configs", e);
    }
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