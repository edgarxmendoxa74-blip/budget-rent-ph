// BudgetRentPH notification sound: dalawang malambing na "ding-ding" (pataas), parang masayang tawag ni Budi.
// Gawa sa Web Audio kaya walang audio file na dinadownload.
let ctx = null;

const getCtx = () => {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  return ctx;
};

// Kailangan ng user tap bago makapag-play ang browser; i-unlock sa unang galaw
export const unlockNotifySound = () => {
  const c = getCtx();
  if (c && c.state === 'suspended') c.resume().catch(() => {});
};

const note = (c, freq, start, dur, gain) => {
  const osc = c.createOscillator();
  const sparkle = c.createOscillator();
  const g = c.createGain();
  osc.type = 'sine';
  sparkle.type = 'triangle';
  osc.frequency.value = freq;
  sparkle.frequency.value = freq * 2;
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(gain, start + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(g);
  sparkle.connect(g);
  g.connect(c.destination);
  osc.start(start);
  sparkle.start(start);
  osc.stop(start + dur + 0.05);
  sparkle.stop(start + dur + 0.05);
};

export const playNotifySound = () => {
  try {
    const c = getCtx();
    if (!c) return;
    if (c.state === 'suspended') c.resume().catch(() => {});
    const t = c.currentTime + 0.02;
    note(c, 784, t, 0.35, 0.16);          // G5
    note(c, 1046.5, t + 0.16, 0.55, 0.18); // C6
  } catch { /* walang audio — okay lang */ }
};
