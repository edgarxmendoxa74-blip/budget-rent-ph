import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import OfflineGate from './components/OfflineGate.jsx'
import MascotSplash from './components/MascotSplash.jsx'

createRoot(document.getElementById('root')).render(
  <>
    <OfflineGate>
      <App />
    </OfflineGate>
    <MascotSplash />
  </>,
)
