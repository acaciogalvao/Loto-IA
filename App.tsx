
import React from 'react';
import { GameProvider } from './contexts/GameContext';
import MainLayout from './components/layout/MainLayout';
import GameScreen from './components/screens/GameScreen';

const App: React.FC = () => {
  return (
    <GameProvider>
      <MainLayout>
        <GameScreen />
      </MainLayout>
    </GameProvider>
  );
};

export default App;
