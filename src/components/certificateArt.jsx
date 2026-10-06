// Mga eksena (SVG) na may tao: ipinapakita kung ano ang gagawin sa bawat hakbang ng certificate
const SKIN = '#f2c29b';
const HAIR = '#3b2a1a';
const SHIRT = '#002652';
const PANTS = '#475569';
const LINE = '#1b2b45';

// Maliit na bersyon ng certificate (asul na header, ginto na border, linya ng pirma)
const Cert = ({ x: X, y: Y, w: W, h: H, sign = false }) => {
  const [x, y, w, h] = [X, Y, W, H].map(Number);
  return (
  <g>
    <rect x={x} y={y} width={w} height={h} fill="#fffbeb" stroke="#f59e0b" strokeWidth="1.6" />
    <rect x={x} y={y} width={w} height={h * 0.22} fill="#003b7a" />
    <circle cx={x + w / 2} cy={y + h * 0.42} r={h * 0.1} fill="#c98545" />
    <rect x={x + w * 0.22} y={y + h * 0.58} width={w * 0.56} height={h * 0.05} fill="#002652" />
    <rect x={x + w * 0.15} y={y + h * 0.68} width={w * 0.7} height={h * 0.03} fill="#9aa8bd" />
    <rect x={x + w * 0.3} y={y + h * 0.88} width={w * 0.4} height={h * 0.015} fill="#002652" />
    {sign && <path d={`M${x + w * 0.32} ${y + h * 0.86}c${w * 0.06}-${h * 0.12} ${w * 0.1}-${h * 0.12} ${w * 0.12}-${h * 0.02}s${w * 0.06} ${h * 0.05} ${w * 0.1}-${h * 0.03}`} fill="none" stroke="#0066ff" strokeWidth="1.6" strokeLinecap="round" />}
  </g>
  );
};

const Head = ({ x: X, y: Y, smile = true }) => {
  const [x, y] = [X, Y].map(Number);
  return (
  <g>
    <circle cx={x} cy={y} r="14" fill={SKIN} />
    <path d={`M${x - 15} ${y - 2}a15 15 0 0 1 30 0c-6-8-24-8-30 0z`} fill={HAIR} />
    <circle cx={x - 5} cy={y + 1} r="1.6" fill={LINE} />
    <circle cx={x + 5} cy={y + 1} r="1.6" fill={LINE} />
    {smile && <path d={`M${x - 4} ${y + 6}q4 4 8 0`} fill="none" stroke={LINE} strokeWidth="1.5" strokeLinecap="round" />}
  </g>
  );
};

const Floor = () => (
  <>
    <rect width="240" height="160" rx="14" fill="#eaf2ff" />
    <rect y="124" width="240" height="36" fill="#d3e2fb" />
  </>
);

const Legs = ({ x: X }) => {
  const x = Number(X);
  return (
  <g>
    <rect x={x - 11} y="104" width="9" height="40" rx="3" fill={PANTS} />
    <rect x={x + 2} y="104" width="9" height="40" rx="3" fill={PANTS} />
    <rect x={x - 14} y="142" width="13" height="6" rx="3" fill={LINE} />
    <rect x={x + 1} y="142" width="13" height="6" rx="3" fill={LINE} />
  </g>
  );
};

const Body = ({ x }) => <rect x={x - 17} y="62" width="34" height="46" rx="12" fill={SHIRT} />;

// 1: tao na pinipindot ang "Generate PNG" sa phone
const Scene1 = () => (
  <>
    <Floor />
    <Legs x="62" />
    <Body x="62" />
    <Head x="62" y="46" />
    <path d="M76 74l40 -4" stroke={SHIRT} strokeWidth="11" strokeLinecap="round" />
    <path d="M50 76l-6 20" stroke={SHIRT} strokeWidth="11" strokeLinecap="round" />
    <circle cx="43" cy="98" r="5" fill={SKIN} />
    <rect x="112" y="18" width="84" height="122" rx="12" fill="#0f172a" />
    <rect x="117" y="26" width="74" height="106" rx="7" fill="#fff" />
    <Cert x="130" y="33" w="48" h="54" />
    <rect x="123" y="96" width="62" height="24" rx="7" fill="#002652" />
    <text x="154" y="107" textAnchor="middle" fontSize="6" fontWeight="700" fill="#fff">Download Wall</text>
    <text x="154" y="115" textAnchor="middle" fontSize="6" fontWeight="700" fill="#fff">Frame Image (PNG)</text>
    <circle cx="178" cy="116" r="9" fill="none" stroke="#ffb800" strokeWidth="2.5" opacity=".9" />
    <circle cx="178" cy="116" r="14" fill="none" stroke="#ffb800" strokeWidth="1.5" opacity=".5" />
    <circle cx="116" cy="70" r="5.5" fill={SKIN} />
    <path d="M119 66l56 46" stroke={SKIN} strokeWidth="6" strokeLinecap="round" />
  </>
);

// 2: nagpiprint ng certificate
const Scene2 = () => (
  <>
    <Floor />
    <Legs x="62" />
    <Body x="62" />
    <Head x="62" y="46" />
    <path d="M78 76l36 12" stroke={SHIRT} strokeWidth="11" strokeLinecap="round" />
    <circle cx="116" cy="89" r="5" fill={SKIN} />
    <path d="M48 76l-6 22" stroke={SHIRT} strokeWidth="11" strokeLinecap="round" />
    <circle cx="41" cy="100" r="5" fill={SKIN} />
    <rect x="100" y="104" width="130" height="8" rx="3" fill="#8a5a2b" />
    <rect x="108" y="112" width="6" height="32" fill="#8a5a2b" />
    <rect x="216" y="112" width="6" height="32" fill="#8a5a2b" />
    <rect x="118" y="84" width="92" height="22" rx="6" fill="#e5e7eb" stroke={LINE} strokeWidth="2" />
    <rect x="128" y="70" width="72" height="16" rx="3" fill="#fff" stroke={LINE} strokeWidth="1.5" />
    <circle cx="196" cy="95" r="3" fill="#22c55e" />
    <rect x="130" y="98" width="60" height="4" rx="2" fill={LINE} />
    <Cert x="136" y="86" w="48" h="62" />
    <text x="160" y="22" textAnchor="middle" fontSize="9" fontWeight="700" fill="#002652">Print on A4 paper</text>
  </>
);

// 3: pumipirma sa certificate
const Scene3 = () => (
  <>
    <Floor />
    <rect x="20" y="102" width="200" height="10" rx="3" fill="#8a5a2b" />
    <rect x="30" y="112" width="8" height="36" fill="#8a5a2b" />
    <rect x="202" y="112" width="8" height="36" fill="#8a5a2b" />
    <rect x="66" y="64" width="34" height="42" rx="12" fill={SHIRT} />
    <Head x="83" y="46" />
    <Cert x="108" y="64" w="84" h="52" sign />
    <path d="M96 78l30 18" stroke={SHIRT} strokeWidth="11" strokeLinecap="round" />
    <circle cx="128" cy="97" r="5" fill={SKIN} />
    <path d="M130 96l12 -16" stroke="#0066ff" strokeWidth="3" strokeLinecap="round" />
    <text x="150" y="30" textAnchor="middle" fontSize="9" fontWeight="700" fill="#002652">Sign with a pen</text>
  </>
);

// 4: nilalagay sa picture frame
const Scene4 = () => (
  <>
    <Floor />
    <Legs x="82" />
    <Body x="82" />
    <Head x="82" y="46" />
    <path d="M66 76l22 14" stroke={SHIRT} strokeWidth="11" strokeLinecap="round" />
    <path d="M98 76l-4 14" stroke={SHIRT} strokeWidth="11" strokeLinecap="round" />
    <rect x="108" y="40" width="96" height="84" rx="3" fill="#b7791f" stroke="#7a4f12" strokeWidth="2" />
    <rect x="116" y="48" width="80" height="68" fill="#fff" />
    <Cert x="121" y="52" w="70" h="60" sign />
    <circle cx="94" cy="92" r="5" fill={SKIN} />
    <circle cx="112" cy="104" r="5" fill={SKIN} />
    <text x="156" y="26" textAnchor="middle" fontSize="9" fontWeight="700" fill="#002652">Put it in a frame</text>
  </>
);

// 5: isinasabit sa dingding
const Scene5 = () => (
  <>
    <Floor />
    <rect x="150" y="96" width="76" height="30" rx="8" fill="#9ec5ff" />
    <rect x="150" y="86" width="76" height="16" rx="8" fill="#7eb0f5" />
    <rect x="20" y="102" width="14" height="24" rx="3" fill="#8a5a2b" />
    <circle cx="27" cy="94" r="12" fill="#4ade80" />
    <path d="M110 6v14" stroke={LINE} strokeWidth="2" />
    <path d="M110 20l-24 16M110 20l24 16" stroke={LINE} strokeWidth="1.6" fill="none" />
    <rect x="80" y="34" width="60" height="52" rx="3" fill="#b7791f" stroke="#7a4f12" strokeWidth="2" />
    <rect x="86" y="40" width="48" height="40" fill="#fff" />
    <Cert x="89" y="43" w="42" h="34" sign />
    <Legs x="56" />
    <Body x="56" />
    <Head x="56" y="46" />
    <path d="M70 70l34 -18" stroke={SHIRT} strokeWidth="11" strokeLinecap="round" />
    <circle cx="106" cy="50" r="5" fill={SKIN} />
    <path d="M42 76l-6 22" stroke={SHIRT} strokeWidth="11" strokeLinecap="round" />
    <circle cx="35" cy="100" r="5" fill={SKIN} />
    <text x="178" y="30" textAnchor="middle" fontSize="9" fontWeight="700" fill="#002652">Hang it on the wall</text>
  </>
);

const SCENES = [null, Scene1, Scene2, Scene3, Scene4, Scene5];

export const StepArt = ({ step }) => {
  const Scene = SCENES[step];
  return (
    <svg viewBox="0 0 240 160" className="cert-step-art" role="img" aria-hidden="true">
      <Scene />
    </svg>
  );
};
