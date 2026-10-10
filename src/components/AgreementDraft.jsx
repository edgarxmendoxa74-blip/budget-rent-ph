import { useMemo, useState } from 'react';
import { FileText, Download, Loader2, CheckCircle } from 'lucide-react';
import { HeroBudi } from './MascotSplash';
import './AgreementDraft.css';

const DEFAULT_TERMS =
  'Utilities (electricity, water, internet) are shouldered by the tenant unless otherwise stated.';

const AgreementDraft = ({ session }) => {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    tenantName: '',
    landlordName: session?.user?.user_metadata?.full_name || session?.user?.email || '',
    property: '',
    address: '',
    rent: '',
    advance: '1',
    deposit: '2',
    startDate: today,
    duration: '6',
    terms: DEFAULT_TERMS,
  });
  const [generating, setGenerating] = useState(false);
  const [done, setDone] = useState(false);

  const set = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const clauses = useMemo(() => {
    const peso = (v) => (v ? `₱${Number(v).toLocaleString()}` : '________');
    const list = [
      `The tenant agrees to pay a monthly rent of ${peso(form.rent)}, payable on or before each due date.`,
      `An advance payment of ${form.advance || '___'} month(s) and a security deposit of ${form.deposit || '___'} month(s) shall be settled upon move-in.`,
      `The lease shall commence on ${form.startDate || '________'} and shall remain in effect for ${form.duration || '___'} month(s), unless renewed by both parties.`,
      'The tenant shall not sublet or assign the property to a third party without the written consent of the landlord.',
      'The landlord shall keep the property in good and livable condition throughout the duration of the lease.',
      'Either party may terminate this agreement by giving at least thirty (30) days written notice.',
      `Special terms: ${form.terms || 'None'}`,
    ];
    return list;
  }, [form]);

  // Logo bilang data URL para magamit sa PDF (walang logo = tuloy lang)
  const loadLogo = async () => {
    try {
      const blob = await (await fetch('/logo.png')).blob();
      return await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(blob); });
    } catch { return null; }
  };

  // PNG: iginuguhit sa canvas (isang mahabang A4-width na larawan), pwedeng i-share o i-save
  const generatePNG = async () => {
    setGenerating(true);
    try {
      const S = 2;
      const PW = 595;
      const M = 54;
      const innerW = PW - M * 2;
      const NAVY = '#003366';
      const GOLD = '#f59e0b';
      const GRAY = '#475569';
      const INK = '#1e293b';
      const FF = 'Helvetica, Arial, sans-serif';
      const canvas = document.createElement('canvas');
      canvas.width = PW * S;
      canvas.height = 3000 * S;
      const c = canvas.getContext('2d');
      c.scale(S, S);
      c.fillStyle = '#ffffff';
      c.fillRect(0, 0, PW, 3000);
      c.textBaseline = 'alphabetic';

      const font = (size, weight = 'normal', style = 'normal') => { c.font = `${style} ${weight} ${size}px ${FF}`; };
      const wrap = (text, maxW) => {
        const out = [];
        String(text ?? '').split('\n').forEach((para) => {
          let line = '';
          para.split(' ').forEach((w) => {
            const test = line ? `${line} ${w}` : w;
            if (c.measureText(test).width > maxW && line) { out.push(line); line = w; } else line = test;
          });
          out.push(line);
        });
        return out;
      };
      const rr = (x, y, w, h, r) => { c.beginPath(); c.roundRect(x, y, w, h, r); };

      // Header
      c.fillStyle = NAVY; c.fillRect(0, 0, PW, 86);
      c.fillStyle = GOLD; c.fillRect(0, 86, PW, 4);
      const LOGO = 56;
      const logoY = (86 - LOGO) / 2;
      c.fillStyle = '#fff'; rr(M, logoY, LOGO, LOGO, 8); c.fill();
      const logoData = await loadLogo();
      if (logoData) {
        const img = await new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = logoData; });
        if (img) c.drawImage(img, M + 4, logoY + 4, LOGO - 8, LOGO - 8);
      }
      const tx = M + LOGO + 14;
      font(24, 'bold');
      c.fillStyle = '#fff'; c.fillText('Budget', tx, 46);
      const w1 = c.measureText('Budget').width;
      c.fillStyle = GOLD; c.fillText('Rent', tx + w1, 46);
      const w2 = c.measureText('Rent').width;
      c.fillStyle = '#fff'; c.fillText('PH', tx + w1 + w2, 46);
      font(9.5); c.fillText('Affordable rentals, honest deals.', tx, 63);
      font(10, 'bold'); c.textAlign = 'right';
      c.fillText(new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' }), PW - M, 46);

      // Title
      let y = 130;
      c.textAlign = 'center';
      font(18, 'bold'); c.fillStyle = NAVY; c.fillText('TENANCY AGREEMENT DRAFT', PW / 2, y);
      y += 18;
      font(9.5); c.fillStyle = GRAY;
      c.fillText('Draft only - review and sign with both parties before it becomes final.', PW / 2, y);
      y += 26;
      c.textAlign = 'left';

      // Details
      const rows = [
        ['Tenant Name', form.tenantName || '-'],
        ['Landlord Name', form.landlordName || '-'],
        ['Property / Unit', form.property || '-'],
        ['Address', form.address || '-'],
        ['Monthly Rent', form.rent ? `₱${Number(form.rent).toLocaleString()}` : '-'],
        ['Advance / Deposit', `${form.advance || 0} mos / ${form.deposit || 0} mos`],
        ['Lease Start', form.startDate || '-'],
        ['Duration', `${form.duration || 0} month(s)`],
      ];
      rows.forEach(([label, value]) => {
        font(10.5);
        const lines = wrap(value, innerW - 150);
        const h = Math.max(22, lines.length * 13 + 9);
        font(10, 'bold'); c.fillStyle = NAVY; c.fillText(label, M, y + 13);
        font(10.5); c.fillStyle = INK;
        lines.forEach((l, i) => c.fillText(l, M + 150, y + 13 + i * 13));
        c.strokeStyle = '#e2e8f0'; c.lineWidth = 0.6;
        c.beginPath(); c.moveTo(M, y + h - 3); c.lineTo(PW - M, y + h - 3); c.stroke();
        y += h;
      });

      // Clauses
      y += 24;
      font(13, 'bold'); c.fillStyle = NAVY; c.fillText('Terms & Conditions', M, y);
      c.fillStyle = GOLD; c.fillRect(M, y + 6, 54, 2.5);
      y += 26;
      font(10.5); c.fillStyle = '#334155';
      clauses.forEach((cl, i) => {
        const numW = 20;
        wrap(cl, innerW - numW).forEach((line, li) => {
          if (li === 0) c.fillText(`${i + 1}.`, M, y);
          c.fillText(line, M + numW, y);
          y += 15;
        });
        y += 5;
      });

      // Note
      y += 8;
      font(9.5, 'normal', 'italic');
      const noteLines = wrap('This draft was generated via BudgetRentPH and is not a legally binding contract until signed by both parties. It is not legal advice.', innerW - 28);
      const noteH = noteLines.length * 13 + 18;
      c.fillStyle = '#fef3dc'; c.strokeStyle = '#f0be64'; c.lineWidth = 1;
      rr(M, y, innerW, noteH, 6); c.fill(); c.stroke();
      c.fillStyle = NAVY;
      noteLines.forEach((l, i) => c.fillText(l, M + 14, y + 17 + i * 13));
      y += noteH + 26;

      // Signatures
      const colW = (innerW - 50) / 2;
      [['Tenant Signature', form.tenantName], ['Landlord Signature', form.landlordName]].forEach(([label, name], i) => {
        const x = M + i * (colW + 50);
        c.strokeStyle = '#94a3b8'; c.lineWidth = 1;
        c.beginPath(); c.moveTo(x, y + 28); c.lineTo(x + colW, y + 28); c.stroke();
        font(10, 'bold'); c.fillStyle = NAVY; c.fillText(label, x, y + 43);
        font(9.5); c.fillStyle = GRAY;
        const nameLines = wrap(name || '________________', colW);
        nameLines.forEach((l, li) => c.fillText(l, x, y + 56 + li * 12));
        c.fillText('Date: ____________', x, y + 69 + (nameLines.length - 1) * 12);
      });
      y += 110;

      // Footer
      c.fillStyle = NAVY; c.fillRect(0, y, PW, 36);
      font(8.5); c.fillStyle = '#fff'; c.textAlign = 'center';
      c.fillText('Generated by BudgetRentPH - Keep this draft for your records.', PW / 2, y + 22);
      const H = y + 36;

      const out = document.createElement('canvas');
      out.width = PW * S; out.height = H * S;
      out.getContext('2d').drawImage(canvas, 0, 0, PW * S, H * S, 0, 0, PW * S, H * S);

      const safeName = (form.tenantName || 'tenant').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
      const fileName = `agreement-draft-${safeName}-${today}.png`;
      const { Capacitor } = await import('@capacitor/core');
      if (Capacitor.isNativePlatform()) {
        // Android WebView hindi nagda-download ng blob; i-save sa cache at buksan ang share sheet (Save to Files / Drive / Messenger)
        const { Filesystem, Directory } = await import('@capacitor/filesystem');
        const { Share } = await import('@capacitor/share');
        const base64 = out.toDataURL('image/png').split(',')[1];
        const saved = await Filesystem.writeFile({ path: fileName, data: base64, directory: Directory.Cache });
        await Share.share({ title: 'Tenancy Agreement Draft', url: saved.uri, dialogTitle: 'Save or share PNG' });
      } else {
        const a = document.createElement('a');
        a.href = out.toDataURL('image/png');
        a.download = fileName;
        a.click();
      }
      setDone(true);
      setTimeout(() => setDone(false), 4000);
    } catch (err) {
      console.error('PNG generation failed:', err);
      alert('Failed to generate PNG: ' + err.message);
    } finally {
      setGenerating(false);
    }
  };

  const input = (field, label, type = 'text', placeholder = '') => (
    <div className="agr-field">
      <label>{label}</label>
      <input
        type={type}
        value={form[field]}
        placeholder={placeholder}
        onChange={e => set(field, e.target.value)}
      />
    </div>
  );

  return (
    <div className="page-section animate-fade-in">
      <header className="hero branding-hero">
        <HeroBudi message="Fill in the details and I'll draft a contract for your tenant." />
        <div className="hero-content">
          <span className="branding-kicker">Landlord Tools</span>
          <h2>Agreement Draft</h2>
          <p>Create a contract for your tenant and download it as a PNG</p>
        </div>
      </header>

      <main className="agr-container">
        <div className="agr-layout">
          {/* FORM */}
          <section className="agr-form-card">
            <div className="agr-card-title">
              <FileText size={18} />
              <h3>Contract Details</h3>
            </div>

            <div className="agr-grid">
              {input('tenantName', 'Tenant Name', 'text', 'Juan Dela Cruz')}
              {input('landlordName', 'Landlord Name', 'text', 'Your full name')}
              {input('property', 'Property / Unit', 'text', 'Room 101, Budget Dorm')}
              {input('address', 'Address', 'text', 'Brgy. Poblacion, City')}
              {input('rent', 'Monthly Rent (₱)', 'number', '5000')}
              {input('duration', 'Duration (months)', 'number', '6')}
              <div className="agr-field">
                <label>Advance (months)</label>
                <select value={form.advance} onChange={e => set('advance', e.target.value)}>
                  {[0, 1, 2, 3].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div className="agr-field">
                <label>Security Deposit (months)</label>
                <select value={form.deposit} onChange={e => set('deposit', e.target.value)}>
                  {[0, 1, 2, 3].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              {input('startDate', 'Lease Start', 'date')}
            </div>

            <div className="agr-field">
              <label>Special Terms</label>
              <textarea
                rows={3}
                value={form.terms}
                onChange={e => set('terms', e.target.value)}
                placeholder="Any additional rules..."
              />
            </div>

            <button
              className="agr-generate-btn"
              onClick={generatePNG}
              disabled={generating || !form.tenantName}
              title={!form.tenantName ? 'Enter the tenant name first' : 'Generate PNG'}
            >
              {generating ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
              {generating ? 'Generating...' : 'Generate PNG Draft'}
            </button>

            {done && (
              <div className="agr-success">
                <CheckCircle size={16} /> The agreement PNG has been downloaded to your device.
              </div>
            )}
            {!form.tenantName && (
              <p className="agr-hint">Enter the tenant name to enable PNG generation.</p>
            )}
          </section>

          {/* PREVIEW */}
          <section className="agr-preview-wrap">
            <div className="agr-card-title">
              <FileText size={18} />
              <h3>Preview</h3>
            </div>
            <div className="agr-paper">
              <div className="agr-paper-head">
                <span className="agr-brand"><img src="/logo.png" alt="" className="agr-logo" />Budget<span>Rent</span>PH</span>
                <span className="agr-date">{today}</span>
              </div>
              <div className="agr-gold-bar" />
              <h4>TENANCY AGREEMENT DRAFT</h4>
              <p className="agr-sub">Draft only — review and sign with both parties before it becomes final.</p>

              <dl className="agr-info">
                <div><dt>Tenant Name</dt><dd>{form.tenantName || '—'}</dd></div>
                <div><dt>Landlord Name</dt><dd>{form.landlordName || '—'}</dd></div>
                <div><dt>Property / Unit</dt><dd>{form.property || '—'}</dd></div>
                <div><dt>Address</dt><dd>{form.address || '—'}</dd></div>
                <div><dt>Monthly Rent</dt><dd>{form.rent ? `₱${Number(form.rent).toLocaleString()}` : '—'}</dd></div>
                <div><dt>Advance / Deposit</dt><dd>{form.advance} mos / {form.deposit} mos</dd></div>
                <div><dt>Lease Start</dt><dd>{form.startDate || '—'}</dd></div>
                <div><dt>Duration</dt><dd>{form.duration} month(s)</dd></div>
              </dl>

              <h5>Terms & Conditions</h5>
              <ol className="agr-clauses">
                {clauses.map((c, i) => <li key={i}>{c}</li>)}
              </ol>

              <div className="agr-note">
                This draft was generated via BudgetRentPH and is not a legally binding contract
                until signed by both parties.
              </div>

              <div className="agr-sign-row">
                <div className="agr-sign">
                  <span className="agr-sign-line" />
                  <strong>Tenant Signature</strong>
                  <em>{form.tenantName || '________________'} • Date: __________</em>
                </div>
                <div className="agr-sign">
                  <span className="agr-sign-line" />
                  <strong>Landlord Signature</strong>
                  <em>{form.landlordName || '________________'} • Date: __________</em>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
};

export default AgreementDraft;
