
export const vibrate = (ms: number = 10) => {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate(ms);
  }
};
