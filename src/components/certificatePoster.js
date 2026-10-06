import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { Budi } from './MascotSplash';

// Budi bilang static SVG image: tinatanggal ang mga bahaging itinatago lang ng CSS (thought bubble, bulb, star eyes, atbp.)
const budiSvgUrl = () => {
  const raw = renderToStaticMarkup(createElement(Budi, { phase: 'hop' }));
  const doc = new DOMParser().parseFromString(raw, 'image/svg+xml');
  const svg = doc.documentElement;
  ['budi-thought', 'budi-bulb', 'budi-star-eyes', 'budi-mouth-hmm', 'budi-mouth-open', 'budi-brow'].forEach((c) =>
    svg.querySelectorAll(`.${c}`).forEach((n) => n.remove())
  );
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  svg.setAttribute('viewBox', '0 -5 200 245');
  svg.setAttribute('width', '800');
  svg.setAttribute('height', '980');
  return URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' }));
};

const loadImage = (src) => new Promise((resolve, reject) => {
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = reject;
  img.src = src;
});

const wrap = (ctx, text, maxW) => {
  const lines = [];
  let line = '';
  text.split(' ').forEach((w) => {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; } else line = test;
  });
  if (line) lines.push(line);
  return lines;
};

// Portrait (A4 ratio) na larawan na pwedeng i-print at ilagay sa picture frame sa dingding
export async function buildCertificatePoster({ holder, certNo, issued }) {
  const W = 1240, H = 1754;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  ctx.textAlign = 'center';

  ctx.fillStyle = '#fffbeb';
  ctx.fillRect(0, 0, W, H);

  // Header
  const grad = ctx.createLinearGradient(0, 0, 0, 330);
  grad.addColorStop(0, '#003b7a');
  grad.addColorStop(1, '#001b40');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, 330);
  ctx.fillStyle = '#ffb800';
  ctx.font = '800 54px Arial, sans-serif';
  ctx.fillText('BudgetRentPH', W / 2, 120);
  ctx.fillStyle = '#fff';
  ctx.font = '800 76px Arial, sans-serif';
  ctx.fillText('VERIFIED LANDLORD', W / 2, 225);
  ctx.font = '400 30px Arial, sans-serif';
  ctx.fillStyle = '#cfe0ff';
  ctx.fillText('Certificate of Verification', W / 2, 280);

  // Logo sa top left
  try {
    const logo = await loadImage('/logo.png');
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.roundRect(90, 90, 150, 150, 22);
    ctx.fill();
    ctx.drawImage(logo, 100, 100, 130, 130);
  } catch { /* walang logo: tuloy lang */ }

  // Borders
  ctx.strokeStyle = '#002652';
  ctx.lineWidth = 12;
  ctx.strokeRect(36, 36, W - 72, H - 72);
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 4;
  ctx.strokeRect(62, 62, W - 124, H - 124);

  // Budi
  const url = budiSvgUrl();
  try {
    const img = await loadImage(url);
    ctx.drawImage(img, W / 2 - 220, 360, 440, 540);
  } finally {
    URL.revokeObjectURL(url);
  }

  // Name
  ctx.fillStyle = '#666';
  ctx.font = '400 32px Arial, sans-serif';
  ctx.fillText('This certifies that', W / 2, 980);
  ctx.fillStyle = '#002652';
  let size = 86;
  ctx.font = `800 ${size}px Arial, sans-serif`;
  while (ctx.measureText(holder).width > W - 220 && size > 40) { size -= 4; ctx.font = `800 ${size}px Arial, sans-serif`; }
  ctx.fillText(holder, W / 2, 1075);
  ctx.font = '600 40px Arial, sans-serif';
  ctx.fillText('Property Owner', W / 2, 1140);

  ctx.fillStyle = '#444';
  ctx.font = '400 38px Arial, sans-serif';
  const body = 'is a Verified Landlord on BudgetRentPH. Their identity and listings were reviewed — you are renting from a legitimate, trusted owner.';
  wrap(ctx, body, W - 300).forEach((l, i) => ctx.fillText(l, W / 2, 1235 + i * 54));

  // Pirmahan ng landlord (isusulat gamit ang ballpen pagkatapos i-print)
  ctx.strokeStyle = '#002652';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(W / 2 - 260, 1450);
  ctx.lineTo(W / 2 + 260, 1450);
  ctx.stroke();
  ctx.fillStyle = '#444';
  ctx.font = '400 28px Arial, sans-serif';
  ctx.fillText("Landlord's Signature", W / 2, 1490);

  // Footer
  ctx.fillStyle = '#002652';
  ctx.fillRect(120, 1530, W - 240, 4);
  ctx.font = '700 30px Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`Certificate No: ${certNo}`, 130, 1590);
  ctx.textAlign = 'right';
  ctx.fillText(`Issued: ${issued}`, W - 130, 1590);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#777';
  ctx.font = '400 26px Arial, sans-serif';
  ctx.fillText('Verify this landlord in the BudgetRentPH app', W / 2, 1655);

  return c;
}
