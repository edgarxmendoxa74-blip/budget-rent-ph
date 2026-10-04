// BudgetRentPH notification sound: paulit-ulit na malambing na "ding-ding" (pataas), parang masayang tawag ni Budi. 5 segundo ang default.
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

// seconds = haba ng tunog (1 "ding-ding" kada segundo); 5 segundo ang default, 10 para sa announcements
export const playNotifySound = (seconds = 5) => {
  const NOTIFY_ROUNDS = Math.max(1, Math.round(seconds));
  try {
    const c = getCtx();
    if (!c) return;
    if (c.state === 'suspended') c.resume().catch(() => {});
    const t = c.currentTime + 0.02;
    // 1 ulit kada segundo; ang huli ay mas mahaba ang tunog para matapos sa mismong haba ng tunog
    for (let i = 0; i < NOTIFY_ROUNDS; i += 1) {
      const start = t + i * 1;
      note(c, 784, start, 0.45, 0.16);                                   // G5
      note(c, 1046.5, start + 0.16, i === NOTIFY_ROUNDS - 1 ? 0.8 : 0.7, 0.18); // C6
    }
  } catch { /* walang audio — okay lang */ }
};
