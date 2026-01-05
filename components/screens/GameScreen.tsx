
import React, { useState, useMemo } from 'react';
import { useGameContext } from '../../contexts/GameContext';
import { useGameLogic } from '../../hooks/useGameLogic';
import { useHistoricalAnalysis } from '../../hooks/useHistoricalAnalysis';
import { PastGameResult, SavedBetBatch, SavedGame } from '../../types';
import { getResultNumbersAsSet } from '../../utils/lotteryLogic';

// Components
import LatestResultCard from '../LatestResultCard';
import NumberSelectionPanel from '../NumberSelectionPanel';
import GeneratedGamesList from '../GeneratedGamesList';
import GameControls from '../GameControls';
import GameDetailsModal from '../GameDetailsModal';
import HistoryAnalysisModal from '../HistoryAnalysisModal';

const GameScreen: React.FC = () => {
  const { 
    activeGame, 
    latestResult,
    displayedResult, 
    isResultLoading, 
    refreshResult,
    searchAndDisplayResult, 
    resetDisplayToLatest, 
    notify,
    // Saved Games Logic is now in Context, we only need handlers if passing to dumb components
    handleSaveBatch,
    handleSaveSingleGame
  } = useGameContext();

  // Local View State for History Details
  const [viewingGame, setViewingGame] = useState<PastGameResult | null>(null);

  // --- LOGIC HOOKS ---
  const gameLogic = useGameLogic(activeGame, latestResult);
  const historyLogic = useHistoricalAnalysis(activeGame, latestResult);

  const { selectedNumbers, generatedGames, totalGenerationCost } = gameLogic;

  // Derived State
  const resultNumbers = useMemo<Set<number>>(() => {
    const target = displayedResult || latestResult;
    if (!target) return new Set<number>();
    if (activeGame.id === 'federal') return new Set();
    return getResultNumbersAsSet(target, activeGame.id);
  }, [displayedResult, latestResult, activeGame.id]);

  // Handlers
  const handleCopyGame = (game: number[], index: number) => {
      navigator.clipboard.writeText(game.join(', '));
      notify("Jogo copiado!", 'success');
  };
  
  const handleCardSearch = async (concurso: number): Promise<boolean> => {
      const success = await searchAndDisplayResult(concurso);
      if(!success) notify("Concurso não encontrado.", 'error');
      return success;
  };

  // --- SHARE HELPERS ---
  const formatGameForShare = (numbers: number[]): string => {
      if (activeGame.id === 'supersete') {
          return numbers.map(n => n % 10).join('-');
      }
      return numbers.map(n => n.toString().padStart(2, '0')).join(' ');
  };

  const shareTextContent = async (text: string, title: string) => {
      if (navigator.share) {
          try {
              await navigator.share({
                  title: title,
                  text: text
              });
          } catch (error) {
              console.log('Compartilhamento cancelado', error);
          }
      } else {
          navigator.clipboard.writeText(text);
          notify("Texto copiado para a área de transferência!", 'success');
      }
  };

  const handleShareGeneratedList = async () => {
      if (generatedGames.length === 0) return;
      const header = `🎰 *LotoSmart AI* - ${activeGame.name}\nJogos Gerados:\n\n`;
      const body = generatedGames.map((game, i) => `*Jogo ${i + 1}:* ${formatGameForShare(game)}`).join('\n');
      const footer = `\n\n🍀 Boa sorte!`;
      await shareTextContent(header + body + footer, `Jogos ${activeGame.name}`);
  };

  const handleShareSingleGame = async (e: React.MouseEvent, game: number[], index: number) => {
      e.stopPropagation();
      const line = formatGameForShare(game);
      const text = `🎰 *LotoSmart AI* - ${activeGame.name}\n*Jogo ${index + 1}:* ${line}\n\n🍀 Boa sorte!`;
      await shareTextContent(text, `Jogo ${index + 1}`);
  };

  return (
    <>
      <div 
        className="fixed top-0 left-0 right-0 h-[50vh] opacity-20 pointer-events-none blur-[100px] transition-colors duration-700"
        style={{ background: `linear-gradient(180deg, ${activeGame.theme.primary} 0%, transparent 100%)` }}
      />

      <div className="relative z-10 space-y-6">
        <LatestResultCard 
          isLoading={isResultLoading} 
          result={displayedResult || latestResult} 
          activeGame={activeGame}
          onRefresh={refreshResult}
          onSearch={handleCardSearch}
          onImport={(nums) => gameLogic.importGame(nums, notify)}
          isLatest={displayedResult ? displayedResult.concurso === latestResult?.concurso : true}
          onReset={resetDisplayToLatest}
        />

        <NumberSelectionPanel 
          activeGame={activeGame} 
          selectedNumbers={selectedNumbers} 
          onToggleNumber={(n) => gameLogic.toggleNumber(n, notify)} 
          gameSize={gameLogic.gameSize}
          onAutoSelectSize={(s) => gameLogic.handleGameSizeChangeWithAutoSelect(s, notify)}
          generationLimit={gameLogic.generationLimit}
          setGenerationLimit={gameLogic.setGenerationLimit}
          closingMethod={gameLogic.closingMethod}
          setClosingMethod={gameLogic.setClosingMethod}
          status={gameLogic.status}
          resultNumbers={resultNumbers}
          onOpenAnalysis={historyLogic.handleOpenHistoryAnalysis}
        />

        <GeneratedGamesList 
          games={generatedGames} 
          activeGame={activeGame}
          latestResult={latestResult}
          resultNumbers={resultNumbers}
          totalGenerationCost={totalGenerationCost}
          analysis={gameLogic.analysis}
          onSaveBatch={() => handleSaveBatch(generatedGames, latestResult?.proximoConcurso || 0, notify)}
          onShareBatch={handleShareGeneratedList}
          onCopyGame={handleCopyGame}
          onSaveSingleGame={(e, game, idx) => { e.stopPropagation(); handleSaveSingleGame(game, idx, latestResult?.proximoConcurso || 0, notify); }}
          onShareSingleGame={handleShareSingleGame}
          copiedGameIndex={null}
          onRemoveGames={gameLogic.removeGames}
        />
      </div>

      <GameControls 
        activeGame={activeGame}
        status={gameLogic.status}
        loadingProgress={gameLogic.loadingProgress}
        selectionCount={selectedNumbers.size}
        closingMethod={gameLogic.closingMethod}
        onClear={gameLogic.handleClear}
        onAiSuggestion={() => gameLogic.handleAiSuggestion(notify)}
        onGenerate={() => gameLogic.handleGenerate(notify)}
      />

      <GameDetailsModal
        viewingGame={viewingGame}
        onClose={() => setViewingGame(null)}
        activeGame={activeGame}
        analysisResults={historyLogic.analysisResults}
      />

      <HistoryAnalysisModal
        isOpen={historyLogic.showHistoryAnalysisModal}
        onClose={() => historyLogic.setShowHistoryAnalysisModal(false)}
        activeGame={activeGame}
        analysisYear={historyLogic.analysisYear}
        setAnalysisYear={historyLogic.setAnalysisYear}
        analysisTargetPoints={historyLogic.analysisTargetPoints}
        setAnalysisTargetPoints={historyLogic.setAnalysisTargetPoints}
        availableYears={historyLogic.availableYears}
        onRunAnalysis={() => historyLogic.handleRunHistoryAnalysis(notify)}
        isAnalysisLoading={historyLogic.isAnalysisLoading}
        analysisProgress={historyLogic.analysisProgress}
        analysisResults={historyLogic.analysisResults}
      />
    </>
  );
};

export default GameScreen;
