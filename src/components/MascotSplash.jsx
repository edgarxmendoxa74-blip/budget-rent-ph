import React, { useEffect, useState, Suspense, lazy } from 'react';
import './MascotSplash.css';
import { takeBudiSplash, loadBudiScene, BUDI_SPLASH_EVENT } from '../lib/budiSplash';

// three.js is heavy — load it only when the splash actually shows
// Kapag pumalya ang pag-load ng chunk, tawagin ang onFail (SVG fallback) imbes na mag-crash ang buong app

const BudiScene = lazy(() => loadBudiScene().catch((err) => {
  console.warn('[BudiScene] hindi na-load ang 3D chunk', err);
  return { default: function BudiSceneFailed({ onFail }) { useEffect(() => { onFail?.(); }, [onFail]); return null; } };
}));

// Phases: hop -> think -> idea -> exit
const TIMELINE = [
  { phase: 'think', at: 1700 },
  { phase: 'idea', at: 3700 },
  { phase: 'exit', at: 6000 },
];
const DONE_AT = 6500;
const FADE_MS = 450;

const CAPTIONS = {
  hop: 'Hi! I\'m Budi 🐻',
  think: 'Hmm... where can we find an affordable rental?',
  idea: 'Aha! I\'ve got an idea! 💡',
  exit: 'Come on, let\'s start looking!',
};

export function Budi({ phase = 'hop', className = '' }) {
  return (
    <svg
      className={`budi ${className}`}
      data-phase={phase}
      viewBox="0 -70 200 300"
      role="img"
      aria-label="Budi, the BudgetRent teddy bear mascot"
    >
      <defs>
        <radialGradient id="fFur" cx="35%" cy="28%" r="80%">
          <stop offset="0" stopColor="#EDB374" /><stop offset=".55" stopColor="#C98545" /><stop offset="1" stopColor="#8A501F" />
        </radialGradient>
        <radialGradient id="fFurDark" cx="35%" cy="30%" r="80%">
          <stop offset="0" stopColor="#D69A5A" /><stop offset=".55" stopColor="#A8642A" /><stop offset="1" stopColor="#6B3D14" />
        </radialGradient>
        <radialGradient id="fEar" cx="50%" cy="40%" r="70%">
          <stop offset="0" stopColor="#F7CFA5" /><stop offset="1" stopColor="#B57A48" />
        </radialGradient>
        <radialGradient id="fMuzzle" cx="40%" cy="30%" r="80%">
          <stop offset="0" stopColor="#FFF3DD" /><stop offset=".6" stopColor="#F6D9B0" /><stop offset="1" stopColor="#D2AA79" />
        </radialGradient>
        <radialGradient id="fBlue" cx="32%" cy="25%" r="85%">
          <stop offset="0" stopColor="#3A7BCB" /><stop offset=".5" stopColor="#003B7A" /><stop offset="1" stopColor="#001B40" />
        </radialGradient>
        <radialGradient id="fYellow" cx="35%" cy="25%" r="90%">
          <stop offset="0" stopColor="#FFE585" /><stop offset=".5" stopColor="#FFB800" /><stop offset="1" stopColor="#C66A05" />
        </radialGradient>
        <radialGradient id="fNose" cx="35%" cy="30%" r="80%">
          <stop offset="0" stopColor="#6B4A2B" /><stop offset="1" stopColor="#1E1206" />
        </radialGradient>
      </defs>
      <ellipse className="budi-shadow" cx="100" cy="220" rx="48" ry="7" fill="rgba(0,0,0,.28)" />

      <g className="budi-body">
        {/* feet */}
        <ellipse cx="68" cy="206" rx="25" ry="15" fill="url(#fFurDark)" />
        <ellipse cx="132" cy="206" rx="25" ry="15" fill="url(#fFurDark)" />
        <ellipse cx="68" cy="209" rx="12" ry="8" fill="url(#fMuzzle)" />
        <ellipse cx="132" cy="209" rx="12" ry="8" fill="url(#fMuzzle)" />

        {/* left arm */}
        <g className="budi-arm budi-arm-l">
          <ellipse cx="50" cy="170" rx="14" ry="27" fill="url(#fBlue)" />
          <ellipse cx="50" cy="183" rx="14.5" ry="5" fill="url(#fYellow)" />
          <circle cx="50" cy="196" r="9" fill="url(#fFurDark)" />
        </g>

        {/* torso / navy sweater */}
        <clipPath id="budi-torso"><ellipse cx="100" cy="168" rx="52" ry="48" /></clipPath>
        <ellipse cx="100" cy="168" rx="52" ry="48" fill="url(#fBlue)" />
        <g clipPath="url(#budi-torso)">
          <rect x="40" y="163" width="120" height="12" fill="url(#fYellow)" />
        </g>
        <ellipse cx="80" cy="150" rx="22" ry="12" fill="#fff" opacity=".14" transform="rotate(-20 80 150)" />
        <path d="M66 146 Q100 168 134 146" stroke="#FFB800" strokeWidth="6" fill="none" strokeLinecap="round" />
        {/* contact shadow of head on torso */}
        <ellipse cx="100" cy="146" rx="46" ry="9" fill="#000" opacity=".28" />
        <circle cx="100" cy="194" r="12" fill="url(#fYellow)" />
        <text x="100" y="200" textAnchor="middle" fontSize="16" fontWeight="800" fill="#003B7A" fontFamily="Arial, sans-serif">₱</text>

        {/* right arm */}
        <g className="budi-arm budi-arm-r">
          <ellipse cx="150" cy="170" rx="14" ry="27" fill="url(#fBlue)" />
          <ellipse cx="150" cy="183" rx="14.5" ry="5" fill="url(#fYellow)" />
          <circle cx="150" cy="196" r="9" fill="url(#fFurDark)" />
        </g>

        {/* head */}
        <g className="budi-head">
          <circle cx="52" cy="46" r="23" fill="url(#fFurDark)" />
          <circle cx="148" cy="46" r="23" fill="url(#fFurDark)" />
          <circle cx="52" cy="46" r="12" fill="url(#fEar)" />
          <circle cx="148" cy="46" r="12" fill="url(#fEar)" />
          <ellipse cx="100" cy="90" rx="64" ry="55" fill="url(#fFur)" />
          <ellipse cx="100" cy="110" rx="27" ry="21" fill="url(#fMuzzle)" />

          {/* fur shine + rim shade for volume */}
          <ellipse cx="72" cy="58" rx="30" ry="14" fill="#fff" opacity=".2" transform="rotate(-25 72 58)" />
          <ellipse cx="100" cy="132" rx="52" ry="9" fill="#000" opacity=".12" />
          <ellipse cx="94" cy="104" rx="13" ry="4" fill="#fff" opacity=".35" />

          {/* cheeks */}
          <circle cx="60" cy="106" r="9" fill="#FF8FA3" opacity=".45" />
          <circle cx="140" cy="106" r="9" fill="#FF8FA3" opacity=".45" />

          {/* eyebrows (thinking) */}
          <path className="budi-brow" d="M64 70 Q76 64 88 70" stroke="#5A3A12" strokeWidth="3.5" fill="none" strokeLinecap="round" />
          <path className="budi-brow budi-brow-r" d="M112 70 Q124 64 136 70" stroke="#5A3A12" strokeWidth="3.5" fill="none" strokeLinecap="round" />

          {/* eyes */}
          <g className="budi-eyes">
            <g className="budi-eye">
              <ellipse cx="76" cy="86" rx="8" ry="9" fill="#2B1A08" />
              <circle cx="79" cy="82" r="3" fill="#fff" />
            </g>
            <g className="budi-eye">
              <ellipse cx="124" cy="86" rx="8" ry="9" fill="#2B1A08" />
              <circle cx="127" cy="82" r="3" fill="#fff" />
            </g>
          </g>
          {/* sparkle eyes (idea) */}
          <g className="budi-star-eyes" fill="#FFB800" stroke="#5A3A12" strokeWidth="1.5">
            <path d="M76 76 L79 84 L87 86 L79 89 L76 97 L73 89 L65 86 L73 84 Z" />
            <path d="M124 76 L127 84 L135 86 L127 89 L124 97 L121 89 L113 86 L121 84 Z" />
          </g>

          {/* nose + mouth */}
          <ellipse cx="100" cy="100" rx="10" ry="7" fill="url(#fNose)" />
          <ellipse cx="97" cy="98" rx="3" ry="1.8" fill="#fff" opacity=".6" />
          <path className="budi-mouth-smile" d="M100 107 L100 112 M100 112 Q92 121 85 113 M100 112 Q108 121 115 113" stroke="#2B1A08" strokeWidth="3" fill="none" strokeLinecap="round" />
          <path className="budi-mouth-hmm" d="M92 115 Q100 111 108 116" stroke="#2B1A08" strokeWidth="3" fill="none" strokeLinecap="round" />
          <g className="budi-mouth-open">
            <path d="M88 112 Q100 134 112 112 Z" fill="#7A2E2E" />
            <path d="M94 121 Q100 118 106 121 Q100 128 94 121 Z" fill="#FF8FA3" />
          </g>
        </g>
      </g>

      {/* thought bubble */}
      <g className="budi-thought">
        <circle cx="132" cy="6" r="4" fill="#fff" />
        <circle cx="142" cy="-8" r="6" fill="#fff" />
        <ellipse cx="160" cy="-34" rx="30" ry="22" fill="#fff" />
        <g fill="#003B7A">
          <circle className="budi-dot budi-dot-1" cx="147" cy="-34" r="4" />
          <circle className="budi-dot budi-dot-2" cx="160" cy="-34" r="4" />
          <circle className="budi-dot budi-dot-3" cx="173" cy="-34" r="4" />
        </g>
      </g>

      {/* idea lightbulb */}
      <g className="budi-bulb">
        <g className="budi-rays" stroke="#FFD34D" strokeWidth="4" strokeLinecap="round">
          <line x1="160" y1="-72" x2="160" y2="-62" />
          <line x1="128" y1="-58" x2="135" y2="-51" />
          <line x1="192" y1="-58" x2="185" y2="-51" />
          <line x1="118" y1="-30" x2="128" y2="-30" />
          <line x1="202" y1="-30" x2="192" y2="-30" />
        </g>
        <circle className="budi-glow" cx="160" cy="-30" r="32" fill="#FFD34D" opacity=".35" />
        <path d="M160 -52 C142 -52 134 -38 138 -26 C141 -18 148 -14 148 -6 L172 -6 C172 -14 179 -18 182 -26 C186 -38 178 -52 160 -52 Z" fill="#FFB800" stroke="#D97706" strokeWidth="2" />
        <path d="M148 -38 Q150 -46 158 -47" stroke="#fff" strokeWidth="3.5" fill="none" strokeLinecap="round" opacity=".8" />
        <path d="M153 -22 L160 -30 L167 -22" stroke="#D97706" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="148" y="-6" width="24" height="7" rx="3" fill="#003B7A" />
        <rect x="152" y="1" width="16" height="5" rx="2.5" fill="#002652" />
      </g>
    </svg>
  );
}

// Naka-mount palagi; nagpe-play lang ang splash kapag tinawag ang showBudiSplash() pagkatapos mag-login
export default function MascotSplash() {
  const [run, setRun] = useState(() => (takeBudiSplash() ? 1 : 0));

  useEffect(() => {
    const onShow = () => { if (takeBudiSplash()) setRun((n) => n + 1); };
    window.addEventListener(BUDI_SPLASH_EVENT, onShow);
    return () => window.removeEventListener(BUDI_SPLASH_EVENT, onShow);
  }, []);

  if (!run) return null;
  return (
    <SplashBoundary key={run}>
      <SplashRun onDone={() => setRun(0)} />
    </SplashBoundary>
  );
}

// Kapag nag-error ang 3D Budi (chunk load / WebGL), SVG Budi na lang — huwag hayaang mag-white screen ang app
class SplashBoundary extends React.Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(err) { console.warn('[MascotSplash]', err); }
  render() {
    if (this.state.failed) return React.cloneElement(this.props.children, { forceSvg: true });
    return this.props.children;
  }
}

function SplashRun({ onDone, forceSvg = false }) {
  const [phase, setPhase] = useState('hop');
  const [webglFailed, setWebglFailed] = useState(forceSvg);
  const [started, setStarted] = useState(forceSvg);
  const [done, setDone] = useState(false);

  // safety net: never let the splash block the app if the 3D chunk fails to load
  useEffect(() => {
    if (started) return undefined;
    const t = setTimeout(() => setDone(true), 8000);
    return () => clearTimeout(t);
  }, [started]);

  // start the timeline only once the 3D scene is actually rendering
  useEffect(() => {
    if (!started) return undefined;
    const timers = TIMELINE.map(({ phase: p, at }) => setTimeout(() => setPhase(p), at));
    timers.push(setTimeout(() => setDone(true), DONE_AT));
    return () => timers.forEach(clearTimeout);
  }, [started]);

  useEffect(() => {
    if (done) onDone();
  }, [done, onDone]);

  if (done) return null;

  const skip = () => {
    if (phase === 'exit') return;
    setPhase('exit');
    setTimeout(() => setDone(true), FADE_MS);
  };

  return (
    <div className="mascot-splash" data-phase={phase} onClick={skip} role="presentation">
      <div className="mascot-stage">
        {webglFailed ? (
          <Budi phase={phase} />
        ) : (
          <Suspense fallback={<SplashFallback phase={phase} onReady={() => setStarted(true)} />}>
            <BudiScene
              phase={phase}
              onReady={() => setStarted(true)}
              onFail={() => { setWebglFailed(true); setStarted(true); }}
            />
          </Suspense>
        )}
        <div className="mascot-brand">
          Budget<span>Rent</span><small>ph</small>
        </div>
        <p className="mascot-caption" key={phase}>{CAPTIONS[phase]}</p>
        <span className="mascot-skip">Tap to skip</span>
      </div>
    </div>
  );
}

// Habang hindi pa handa ang 3D: SVG Budi agad (hindi blangko), at umaandar na ang timeline
function SplashFallback({ phase, onReady }) {
  useEffect(() => { onReady(); }, [onReady]);
  return <Budi phase={phase} />;
}

// Budi sa sulok ng hero: kumakaway pakaliwa at sinasabi kung ano ang gagawin sa section
export function HeroBudi({ message }) {
  const [webglFailed, setWebglFailed] = useState(false);
  return (
    <div className="hero-budi">
      {message && <div className="hero-budi-bubble" key={message} role="status">{message}</div>}
      {webglFailed ? (
        <Budi phase="wave" />
      ) : (
        <Suspense fallback={<div className="budi-3d" />}>
          <BudiScene phase="wave" lite onFail={() => setWebglFailed(true)} />
        </Suspense>
      )}
    </div>
  );
}
