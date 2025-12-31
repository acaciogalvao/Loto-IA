/**
 * Combinatorial generator for Lotofácil.
 * If user selects N numbers (e.g., 17), we generate combinations of 15.
 */

export const generateCombinations = (sourceNumbers: number[], combinationSize: number = 15): number[][] => {
  const result: number[][] = [];
  
  // Sort numbers for consistency
  const sortedSource = [...sourceNumbers].sort((a, b) => a - b);

  function combine(start: number, currentCombo: number[]) {
    if (currentCombo.length === combinationSize) {
      result.push([...currentCombo]);
      return;
    }

    for (let i = start; i < sortedSource.length; i++) {
      currentCombo.push(sortedSource[i]);
      combine(i + 1, currentCombo);
      currentCombo.pop();
    }
  }

  // Safety limit for client-side performance
  // C(18, 15) = 816 games. C(19, 15) = 3876.
  // We will cap processing at 18 numbers for this demo to ensure UI responsiveness.
  if (sourceNumbers.length > 18) {
    throw new Error("O limite máximo para processamento no navegador é de 18 números.");
  }

  combine(0, []);
  return result;
};

// Helper to check if a number is prime
export const isPrime = (num: number): boolean => {
  if (num <= 1) return false;
  if (num <= 3) return true;
  if (num % 2 === 0 || num % 3 === 0) return false;
  let i = 5;
  while (i * i <= num) {
    if (num % i === 0 || num % (i + 2) === 0) return false;
    i += 6;
  }
  return true;
};

export const getStats = (game: number[]) => {
  const evens = game.filter(n => n % 2 === 0).length;
  const odds = game.length - evens;
  const sum = game.reduce((a, b) => a + b, 0);
  return { evens, odds, sum };
};