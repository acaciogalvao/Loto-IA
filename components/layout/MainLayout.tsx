
import React, { useState } from 'react';
import { useGameContext } from '../../contexts/GameContext';
import SidebarMenu from '../SidebarMenu';
import Header from '../Header';
import NotificationToast from '../NotificationToast';
import GameInfoModal from '../GameInfoModal';
import SavedGamesModal from '../SavedGamesModal';
import { AnimatePresence } from 'framer-motion';

interface MainLayoutProps {
  children: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const { 
    activeGame, 
    isMenuOpen, 
    setIsMenuOpen, 
    switchGame, 
    notification, 
    notify,
    setShowSavedGamesModal
  } = useGameContext();

  const [showInfoModal, setShowInfoModal] = useState(false);

  return (
    <div className="min-h-screen bg-slate-900 pb-[calc(90px+env(safe-area-inset-bottom))] font-sans text-slate-100">
      
      {/* GLOBAL UI ELEMENTS */}
      <SidebarMenu 
        isOpen={isMenuOpen} 
        onClose={() => setIsMenuOpen(false)} 
        activeGameId={activeGame.id}
        onGameChange={switchGame} 
      />

      {notification && (
        <NotificationToast 
          msg={notification.msg} 
          type={notification.type} 
          onClose={() => notify('', 'info')} 
        />
      )}

      <Header 
        activeGame={activeGame} 
        onOpenMenu={() => setIsMenuOpen(true)} 
        onOpenInfo={() => setShowInfoModal(true)}
        onOpenSaved={() => setShowSavedGamesModal(true)}
      />

      {/* MAIN CONTENT INJECTION */}
      <main className="max-w-lg mx-auto p-4 space-y-5">
        {children}
      </main>

      {/* GLOBAL MODALS */}
      <GameInfoModal 
        isOpen={showInfoModal} 
        onClose={() => setShowInfoModal(false)}
        activeGame={activeGame}
      />

      <AnimatePresence>
         <SavedGamesModal />
      </AnimatePresence>

    </div>
  );
};

export default MainLayout;
