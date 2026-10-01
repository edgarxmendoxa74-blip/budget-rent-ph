import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Phone, ShieldCheck, X, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { validatePhone } from '../lib/validation';

const STORAGE_KEY = 'budgetrent_customer_info';

const readSaved = () => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch { return {}; }
};

// Hinihingi muna ang pangalan at contact number ng guest bago tumawag sa owner.
// Naka-save ito sa customer_inquiries (admin at owner ng listing lang ang makakabasa) para may record kung sino ang tumawag.
export const CallGateModal = ({ phone, propertyId, ownerEmail, onClose }) => {
  const saved = readSaved();
  const [name, setName] = useState(saved.name || '');
  const [customerPhone, setCustomerPhone] = useState(saved.phone || '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const cleanName = name.trim();
    const phoneCheck = validatePhone(customerPhone);
    if (cleanName.length < 2) return setError('Ilagay ang buong pangalan mo.');
    if (!phoneCheck.isValid) return setError('Maglagay ng valid na PH number (hal. 09171234567).');

    setBusy(true);
    setError('');
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ name: cleanName, phone: phoneCheck.sanitized })); } catch { /* ignore */ }

    // Hindi hinaharangan ang tawag kung pumalya ang pag-save
    try {
      await supabase.from('customer_inquiries').insert({
        property_id: propertyId || null,
        owner_email: ownerEmail || null,
        owner_phone: String(phone || ''),
        customer_name: cleanName.slice(0, 80),
        customer_phone: phoneCheck.sanitized,
        action: 'call'
      });
    } catch { /* ignore */ }

    setBusy(false);
    onClose();
    window.location.href = `tel:${phone}`;
  };

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 20050, background: 'rgba(0, 20, 45, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }} onClick={onClose}>
      <form onSubmit={handleSubmit} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Customer information"
        style={{ position: 'relative', background: '#fff', width: '100%', maxWidth: '400px', borderRadius: '22px', padding: '22px', boxShadow: '0 20px 50px rgba(0,0,0,0.3)' }}>
        <button type="button" aria-label="Isara" onClick={onClose} style={{ position: 'absolute', top: 12, right: 12, border: 'none', background: '#f1f5f9', borderRadius: '50%', width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={16} /></button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <span style={{ width: 40, height: 40, borderRadius: 12, background: '#e0f2fe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ShieldCheck size={22} color="#0369a1" /></span>
          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900, color: '#003366' }}>Customer Information</h3>
        </div>

        <p style={{ margin: '0 0 14px', fontSize: '0.82rem', lineHeight: 1.55, color: '#475569' }}>
          Para sa seguridad ng mga owner at guest, ilagay muna ang iyong pangalan at contact number bago tumawag.
          Makikita lang ito ng admin at ng owner ng listing, at gagamitin lang para sa inquiry na ito. Hindi ito ibabahagi sa iba.
        </p>

        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#003366', marginBottom: 4 }}>Buong pangalan</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoComplete="name" placeholder="Juan Dela Cruz"
          style={{ width: '100%', boxSizing: 'border-box', padding: '11px 12px', borderRadius: 12, border: '1px solid #cbd5e1', fontSize: '0.9rem', marginBottom: 12, fontFamily: 'inherit' }} />

        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#003366', marginBottom: 4 }}>Contact number mo</label>
        <input type="tel" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} maxLength={16} autoComplete="tel" placeholder="09171234567" inputMode="tel"
          style={{ width: '100%', boxSizing: 'border-box', padding: '11px 12px', borderRadius: 12, border: '1px solid #cbd5e1', fontSize: '0.9rem', marginBottom: 6, fontFamily: 'inherit' }} />

        {error && <p style={{ margin: '4px 0 0', color: '#dc2626', fontSize: '0.78rem', fontWeight: 700 }}>{error}</p>}

        <button type="submit" disabled={busy}
          style={{ width: '100%', marginTop: 14, padding: '13px', borderRadius: 14, border: 'none', background: '#003366', color: '#fff', fontWeight: 800, fontSize: '0.9rem', cursor: busy ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontFamily: 'inherit' }}>
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Phone size={16} />} Magpatuloy at Tumawag
        </button>
      </form>
    </div>,
    document.body
  );
};

// Pamalit sa <a href="tel:..."> — bubukas ang CallGateModal bago tumawag
const CallGateLink = ({ phone, propertyId, ownerEmail, className, style, children }) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <a href={`tel:${phone}`} role="button" className={className} style={style}
        onClick={(e) => { e.preventDefault(); setOpen(true); }}>
        {children}
      </a>
      {open && <CallGateModal phone={phone} propertyId={propertyId} ownerEmail={ownerEmail} onClose={() => setOpen(false)} />}
    </>
  );
};

export default CallGateLink;
