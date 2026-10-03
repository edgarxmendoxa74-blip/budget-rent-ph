import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import './ios-theme.css'
import OfflineGate from './components/OfflineGate.jsx'
import MascotSplash from './components/MascotSplash.jsx'
import { preloadBudiScene } from './lib/budiSplash.js'

// Habang idle ang browser, i-load na ang 3D Budi para instant ang splash pagka-login
const idle = window.requestIdleCallback || ((cb) => setTimeout(cb, 1500));
idle(preloadBudiScene);

createRoot(document.getElementById('root')).render(
  <>
    <OfflineGate>
      <App />
    </OfflineGate>
    <MascotSplash />
  </>,
)
