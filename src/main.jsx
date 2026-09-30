import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import MascotSplash from './components/MascotSplash.jsx'

createRoot(document.getElementById('root')).render(
  <>
    <App />
    <MascotSplash />
  </>,
)
