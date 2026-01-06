
import React, { useEffect } from 'react';
import { GameProvider } from './contexts/GameContext';
import MainLayout from './components/layout/MainLayout';
import GameScreen from './components/screens/GameScreen';

const App: React.FC = () => {
  useEffect(() => {
    // Registro do Service Worker
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js')
          .then(registration => {
            console.log('SW registrado com sucesso:', registration.scope);
            
            // Solicitar permissão para notificações
            if ('Notification' in window) {
              Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                  console.log('Permissão de notificação concedida');
                }
              });
            }
          })
          .catch(err => {
            console.log('Falha ao registrar SW:', err);
          });
      });
    }
  }, []);

  return (
    <GameProvider>
      <MainLayout>
        <GameScreen />
      </MainLayout>
    </GameProvider>
  );
};

export default App;
