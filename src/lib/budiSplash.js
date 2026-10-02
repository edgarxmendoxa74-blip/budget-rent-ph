// Budi loading screen: lumalabas lang pagkatapos mag-login (hindi sa pagbukas ng app).
// Naka-sessionStorage ang flag para gumana rin kahit mag-reload ang page (hal. admin login).
const PENDING_KEY = 'budgetrent_budi_splash';
export const BUDI_SPLASH_EVENT = 'budi:splash';

export function showBudiSplash() {
  try { sessionStorage.setItem(PENDING_KEY, '1'); } catch { /* private mode: okay lang */ }
  window.dispatchEvent(new Event(BUDI_SPLASH_EVENT));
}

// Kinukuha at binubura ang flag — true kung may naka-pending na splash
export function takeBudiSplash() {
  try {
    if (sessionStorage.getItem(PENDING_KEY)) {
      sessionStorage.removeItem(PENDING_KEY);
      return true;
    }
  } catch { /* ignore */ }
  return false;
}
