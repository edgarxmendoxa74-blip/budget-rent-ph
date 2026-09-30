export const TOUR_SEEN_KEY = 'budgetrent_tour_seen';

// Naka-install na app (Capacitor APK) o naka-add sa home screen (PWA)
export const isInstalledApp = () => {
  try {
    return Boolean(window.Capacitor?.isNativePlatform?.())
      || window.matchMedia?.('(display-mode: standalone)').matches
      || window.navigator.standalone === true;
  } catch {
    return false;
  }
};

export const hasSeenTour = () => {
  try {
    return localStorage.getItem(TOUR_SEEN_KEY) === 'true';
  } catch {
    return true;
  }
};

// ?tour=1 sa URL: pilit na ipakita ang tour (pang-test)
export const forceTourFromUrl = () => {
  try {
    return new URLSearchParams(window.location.search).get('tour') === '1';
  } catch {
    return false;
  }
};
