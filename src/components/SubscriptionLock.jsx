import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { PAYMENT_METHODS, PAYMENT_PAGE_ID } from '../lib/paymentMethods';
import { fetchPlans } from '../lib/plans';
import { Lock, Upload, Loader2, CheckCircle2, LogOut, RefreshCw, X as XIcon } from 'lucide-react';

const inputStyle = { width: '100%', padding: '12px 14px', borderRadius: '12px', border: '1.5px solid #e2e8f0', outline: 'none', background: 'white', fontSize: '0.95rem', color: '#1e293b', boxSizing: 'border-box' };
const labelStyle = { display: 'block', fontSize: '0.68rem', fontWeight: 800, color: '#64748b', margin: '0 0 5px 4px', textTransform: 'uppercase' };

const SubscriptionLock = ({ session, expiry, onLogout, onRefresh }) => {
  const meta = session?.user?.user_metadata || {};
  const [plans, setPlans] = useState([]);
  const [plan, setPlan] = useState('yearly');
  useEffect(() => { fetchPlans().then(setPlans); }, []);
  const [form, setForm] = useState({ fullName: meta.full_name || '', phone: meta.phone || '', reference: '' });
  const [method, setMethod] = useState('GCash');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [qr, setQr] = useState(null);

  const selectedPlan = plans.find(p => p.id === plan) || plans[0];

  const pickFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith('image/')) return setError('Only images are allowed (JPG/PNG).');
    if (f.size > 5 * 1024 * 1024) return setError('Image is too large (max 5MB).');
    setError('');
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedPlan) return setError("Plans haven't loaded yet, please try again.");
    if (!file) return setError('Please upload your proof of payment first.');
    setLoading(true);
    setError('');
    try {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      const path = `${session.user.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('payment-proofs').upload(path, file, { contentType: file.type });
      if (upErr) throw upErr;

      const message = `Subscription Renewal Request
Plan: ${selectedPlan.label} (₱${selectedPlan.price})
Name: ${form.fullName}
Phone: ${form.phone}
Email: ${session.user.email}
Payment Method: ${method}
Reference No.: ${form.reference.trim() || 'N/A'}
Proof of Payment (file): ${path}`;

      try { navigator.clipboard?.writeText(message); } catch { /* ignore */ }
      window.open(`https://m.me/${PAYMENT_PAGE_ID}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
      setSent(true);
    } catch (err) {
      setError(err.message || 'Upload failed. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 20000, background: 'rgba(0, 31, 63, 0.92)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', overflowY: 'auto', padding: '16px', display: 'flex' }}>
      <div style={{ background: 'white', width: '100%', maxWidth: '420px', margin: 'auto', borderRadius: '24px', padding: '22px', boxShadow: '0 20px 50px rgba(0,0,0,0.3)' }}>
        <div style={{ textAlign: 'center', marginBottom: '16px' }}>
          <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: '#fff1f2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px' }}>
            <Lock size={28} color="#ef4444" />
          </div>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 900, color: '#003366' }}>Subscription Expired</h2>
          <p style={{ margin: '6px 0 0', fontSize: '0.82rem', color: '#64748b', lineHeight: 1.5 }}>
            Your subscription expired{expiry ? ` on ${new Date(expiry).toLocaleDateString()}` : ''}. Renew to use the app again.
          </p>
        </div>

        {sent ? (
          <div style={{ textAlign: 'center', padding: '10px 0' }}>
            <CheckCircle2 size={48} color="#16a34a" style={{ margin: '0 auto 10px' }} />
            <h3 style={{ margin: '0 0 6px', color: '#003366' }}>Request Sent!</h3>
            <p style={{ fontSize: '0.85rem', color: '#64748b', lineHeight: 1.5 }}>
              Send the message in the BudgetRentPH Messenger chat (it&apos;s also copied to your clipboard in case the chat box is empty). The app will unlock once your payment is verified.
            </p>
            <button onClick={onRefresh} style={{ width: '100%', padding: '13px', borderRadius: '14px', background: '#003366', color: 'white', fontWeight: 800, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '8px' }}>
              <RefreshCw size={16} /> Check Status
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={labelStyle}>Plan</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {plans.map(p => (
                  <button type="button" key={p.id} onClick={() => setPlan(p.id)} style={{ padding: '10px', borderRadius: '12px', cursor: 'pointer', border: `2px solid ${plan === p.id ? '#003366' : '#e2e8f0'}`, background: plan === p.id ? '#eef4fb' : 'white', color: '#003366' }}>
                    <strong style={{ display: 'block' }}>{p.label}</strong>
                    <span style={{ fontSize: '0.8rem' }}>₱{p.price} · {p.note}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label style={labelStyle}>Full Name</label>
              <input style={inputStyle} required value={form.fullName} onChange={e => setForm({ ...form, fullName: e.target.value })} placeholder="Juan Dela Cruz" />
            </div>
            <div>
              <label style={labelStyle}>Contact Number</label>
              <input style={inputStyle} type="tel" required value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="09XX XXX XXXX" />
            </div>

            <div>
              <label style={labelStyle}>Payment Method — Amount: ₱{selectedPlan?.price}</label>
              <div style={{ display: 'grid', gap: '8px' }}>
                {PAYMENT_METHODS.map(pay => (
                  <div key={pay.method} onClick={() => setMethod(pay.method)} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', borderRadius: '14px', cursor: 'pointer', border: `2px solid ${method === pay.method ? pay.color : '#f0f0f0'}`, background: '#fafbfc' }}>
                    {pay.qr ? (
                      <img src={pay.qr} alt="QR" onClick={(e) => { e.stopPropagation(); setQr(pay); }} style={{ width: 56, height: 56, borderRadius: 8, background: 'white', padding: 2, border: '1px solid #eee' }} />
                    ) : (
                      <div style={{ width: 56, height: 56, borderRadius: 8, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 700, color: '#64748b' }}>BANK</div>
                    )}
                    <div style={{ minWidth: 0 }}>
                      <span style={{ fontSize: '0.6rem', fontWeight: 900, background: pay.color, color: 'white', padding: '2px 8px', borderRadius: 100, textTransform: 'uppercase' }}>{pay.method}</span>
                      <strong style={{ display: 'block', color: '#003366' }}>{pay.number}</strong>
                      <span style={{ fontSize: '0.72rem', color: '#64748b' }}>{pay.name}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label style={labelStyle}>Proof of Payment (screenshot) *</label>
              <label style={{ ...inputStyle, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer', borderStyle: 'dashed', color: '#003366', fontWeight: 700 }}>
                <Upload size={16} /> {file ? 'Change image' : 'Upload image'}
                <input type="file" accept="image/*" onChange={pickFile} style={{ display: 'none' }} />
              </label>
              {preview && <img src={preview} alt="Proof preview" style={{ marginTop: 8, width: '100%', maxHeight: 180, objectFit: 'contain', borderRadius: 12, border: '1px solid #e2e8f0', background: '#f8fafc' }} />}
            </div>

            <div>
              <label style={labelStyle}>Reference Number (optional)</label>
              <input style={inputStyle} value={form.reference} onChange={e => setForm({ ...form, reference: e.target.value })} placeholder="e.g. 1234 567 890" />
            </div>

            {error && <p style={{ margin: 0, color: '#b91c1c', fontSize: '0.8rem', fontWeight: 600 }}>{error}</p>}

            <button type="submit" disabled={loading} style={{ padding: '14px', borderRadius: '14px', background: '#003366', color: 'white', fontWeight: 900, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: loading ? 0.7 : 1 }}>
              {loading ? <><Loader2 size={18} className="animate-spin" /> Sending...</> : 'Send via Messenger'}
            </button>
          </form>
        )}

        <button onClick={onLogout} style={{ width: '100%', marginTop: '10px', padding: '10px', background: 'none', border: 'none', color: '#64748b', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
          <LogOut size={14} /> Log out
        </button>
      </div>

      {qr && (
        <div onClick={() => setQr(null)} style={{ position: 'fixed', inset: 0, zIndex: 20001, background: 'rgba(0,0,0,0.85)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <button onClick={() => setQr(null)} style={{ position: 'absolute', top: 16, right: 16, background: 'white', border: 'none', borderRadius: '50%', width: 36, height: 36 }}><XIcon size={18} /></button>
          <div style={{ background: 'white', padding: 16, borderRadius: 20, maxWidth: 300, width: '100%', textAlign: 'center' }}>
            <img src={qr.qr} alt="Large QR" style={{ width: '100%' }} />
            <strong style={{ color: '#003366' }}>{qr.method} · {qr.number}</strong>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubscriptionLock;
