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

  const generatePNG = () => {
    setGenerating(true);
    try {
      const W = 900;
      const pad = 56;
      const innerW = W - pad * 2;
      const navy = '#003366';
      const gold = '#F59E0B';
      const gray = '#475569';
      const lineHeight = 22;

      // --- Pass 1: measure layout ---
      const measure = document.createElement('canvas').getContext('2d');
      measure.font = '400 15px Arial, Helvetica, sans-serif';

      const infoRows = [
        ['Tenant Name', form.tenantName || '—'],
        ['Landlord Name', form.landlordName || '—'],
        ['Property / Unit', form.property || '—'],
        ['Address', form.address || '—'],
        ['Monthly Rent', form.rent ? `₱${Number(form.rent).toLocaleString()}` : '—'],
        ['Advance / Deposit', `${form.advance || 0} mos / ${form.deposit || 0} mos`],
        ['Lease Start', form.startDate || '—'],
        ['Duration', `${form.duration || 0} month(s)`],
      ];

      let clauseLines = [];
      clauses.forEach((c, i) => {
        clauseLines.push({ index: i + 1, text: c });
      });

      // Wrap clauses properly using a measuring helper
      const wrapMeasuring = (text, maxWidth, font) => {
        measure.font = font;
        const words = String(text).split(/\s+/);
        const lines = [];
        let line = '';
        words.forEach(word => {
          const test = line ? `${line} ${word}` : word;
          if (measure.measureText(test).width > maxWidth && line) {
            lines.push(line);
            line = word;
          } else {
            line = test;
          }
        });
        if (line) lines.push(line);
        return lines;
      };

      const clauseRender = clauseLines.flatMap(c =>
        wrapMeasuring(`${c.index}. ${c.text}`, innerW - 10, '400 15px Arial, Helvetica, sans-serif').map(l => l)
      );

      let y = 0;
      y += 118; // header
      y += 6;   // gold bar
      y += 62;  // title block
      y += 14;
      infoRows.forEach(() => { y += 30; });
      y += 34;
      y += 28; // heading
      clauseRender.forEach(() => { y += lineHeight; });
      y += 16;
      y += 40; // special note
      y += 60; // signatures
      y += 70; // footer
      const H = y + 40;

      // --- Pass 2: draw ---
      const canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, W, H);

      // Header band
      ctx.fillStyle = navy;
      ctx.fillRect(0, 0, W, 118);
      ctx.fillStyle = gold;
      ctx.fillRect(0, 118, W, 6);

      ctx.font = 'bold 34px Arial, Helvetica, sans-serif';
      ctx.fillStyle = '#FFFFFF';
      const brandW1 = ctx.measureText('Budget').width;
      const brandW2 = ctx.measureText('Rent').width;
      ctx.fillText('Budget', pad, 66);
      ctx.fillStyle = gold;
      ctx.fillText('Rent', pad + brandW1, 66);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText('PH', pad + brandW1 + brandW2, 66);

      ctx.font = '400 13px Arial, Helvetica, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.fillText('Affordable rentals, honest deals.', pad, 92);

      ctx.font = 'bold 13px Arial, Helvetica, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.textAlign = 'right';
      ctx.fillText(new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' }), W - pad, 66);
      ctx.textAlign = 'left';

      // Title
      let cy = 168;
      ctx.textAlign = 'center';
      ctx.font = 'bold 26px Arial, Helvetica, sans-serif';
      ctx.fillStyle = navy;
      ctx.fillText('TENANCY AGREEMENT DRAFT', W / 2, cy);
      cy += 24;
      ctx.font = '400 13px Arial, Helvetica, sans-serif';
      ctx.fillStyle = gray;
      ctx.fillText('Draft only — review and sign with both parties before it becomes final.', W / 2, cy);
      ctx.textAlign = 'left';
      cy += 24;

      // Info rows
      infoRows.forEach(([label, value]) => {
        ctx.font = 'bold 14px Arial, Helvetica, sans-serif';
        ctx.fillStyle = navy;
        ctx.fillText(label, pad, cy + 14);
        ctx.font = '400 15px Arial, Helvetica, sans-serif';
        ctx.fillStyle = '#1E293B';
        const valueX = pad + 220;
        ctx.fillText(String(value).substring(0, 70), valueX, cy + 14);
        ctx.strokeStyle = '#E2E8F0';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(pad, cy + 24);
        ctx.lineTo(W - pad, cy + 24);
        ctx.stroke();
        cy += 30;
      });

      // Clauses
      cy += 34;
      ctx.font = 'bold 17px Arial, Helvetica, sans-serif';
      ctx.fillStyle = navy;
      ctx.fillText('Terms & Conditions', pad, cy);
      ctx.fillStyle = gold;
      ctx.fillRect(pad, cy + 8, 70, 3);
      cy += 28;

      ctx.font = '400 15px Arial, Helvetica, sans-serif';
      ctx.fillStyle = '#334155';
      clauseRender.forEach(line => {
        ctx.fillText(line, pad, cy + 4);
        cy += lineHeight;
      });

      // Note
      cy += 16;
      const noteH = 40;
      ctx.fillStyle = 'rgba(245,158,11,0.12)';
      ctx.strokeStyle = 'rgba(245,158,11,0.45)';
      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(pad, cy, innerW, noteH, 12);
      } else {
        ctx.rect(pad, cy, innerW, noteH);
      }
      ctx.fill();
      ctx.stroke();
      ctx.font = 'italic 13px Arial, Helvetica, sans-serif';
      ctx.fillStyle = navy;
      ctx.fillText(
        'This draft was generated via BudgetRentPH and is not a legally binding contract until signed by both parties.',
        pad + 16,
        cy + 25
      );
      cy += noteH + 34;

      // Signatures
      const colW = (innerW - 60) / 2;
      const sigLabels = ['Tenant Signature', 'Landlord Signature'];
      const sigNames = [form.tenantName || '________________________', form.landlordName || '________________________'];
      sigLabels.forEach((label, i) => {
        const x = pad + i * (colW + 60);
        ctx.strokeStyle = '#94A3B8';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x, cy + 40);
        ctx.lineTo(x + colW, cy + 40);
        ctx.stroke();
        ctx.font = 'bold 13px Arial, Helvetica, sans-serif';
        ctx.fillStyle = navy;
        ctx.fillText(label, x, cy + 60);
        ctx.font = '400 13px Arial, Helvetica, sans-serif';
        ctx.fillStyle = gray;
        ctx.fillText(`${sigNames[i]}   |   Date: ____________`, x, cy + 80);
      });
      cy += 100;

      // Footer
      ctx.fillStyle = navy;
      ctx.fillRect(0, H - 52, W, 52);
      ctx.font = '400 12px Arial, Helvetica, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.textAlign = 'center';
      ctx.fillText('Generated by BudgetRentPH • budgetrent.ph • Keep this draft for your records.', W / 2, H - 22);
      ctx.textAlign = 'left';

      // Download
      const link = document.createElement('a');
      const safeName = (form.tenantName || 'tenant').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
      link.download = `agreement-draft-${safeName}-${today}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      setDone(true);
      setTimeout(() => setDone(false), 4000);
    } catch (err) {
      console.error('PNG generation failed:', err);
      alert('Failed to generate image: ' + err.message);
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
        <HeroBudi message="Punan ang detalye at gagawa ako ng kontrata para sa tenant mo." />
        <div className="hero-content">
          <span className="branding-kicker">Landlord Tools</span>
          <h2>Agreement Draft</h2>
          <p>Gumawa ng kontrata sa iyong tenant at i-download bilang PNG</p>
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
                placeholder="Kahit anong dagdag na patakaran..."
              />
            </div>

            <button
              className="agr-generate-btn"
              onClick={generatePNG}
              disabled={generating || !form.tenantName}
              title={!form.tenantName ? 'Ilagay muna ang tenant name' : 'Generate PNG'}
            >
              {generating ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
              {generating ? 'Generating...' : 'Generate PNG Draft'}
            </button>

            {done && (
              <div className="agr-success">
                <CheckCircle size={16} /> Na-download na ang agreement PNG sa iyong device.
              </div>
            )}
            {!form.tenantName && (
              <p className="agr-hint">Ilagay ang tenant name para ma-activate ang generation.</p>
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
                <span className="agr-brand">Budget<span>Rent</span>PH</span>
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
