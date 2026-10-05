import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, Zap, ArrowLeft, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { PAYMENT_METHODS, fetchPaymentMethods } from '../lib/paymentMethods';
import { ROOM_FEE_PLAN, ROOM_FEE_THRESHOLD } from '../lib/roomFee';

const label = { display: 'block', fontSize: '0.7rem', fontWeight: 800, color: '#64748b', marginBottom: '6px' };
const input = { width: '100%', padding: '12px', borderRadius: '12px', border: '1.5px solid #e2e8f0', fontSize: '0.95rem', boxSizing: 'border-box' };

// Lumalabas sa Edit Listing kapag 8+ ang rooms: payment methods + resibo na pupunan
const RoomFeeForm = ({ session, listing, rooms, onSubmitted }) => {
  const meta = session?.user?.user_metadata || {};
  const today = new Date().toISOString().slice(0, 10);
  const phone0 = /^639\d{9}$/.test(meta.phone || '') ? `0${String(meta.phone).slice(2)}` : (meta.phone || '');
  const [form, setForm] = useState({ fullName: meta.full_name || '', phone: phone0, paidOn: today, reference: '' });
  const [payMethods, setPayMethods] = useState(PAYMENT_METHODS);
  const [showPay, setShowPay] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [code] = useState(() => `RF-${Array.from(crypto.getRandomValues(new Uint8Array(4)), (n) => n.toString(16).padStart(2, '0')).join('').toUpperCase()}`);
  useEffect(() => { fetchPaymentMethods().then(setPayMethods); }, []);

  const lines = [
    ['Receipt Code', code],
    ['Name', form.fullName],
    ['Contact', form.phone],
    ['Listing', listing.name],
    ['Rooms', String(rooms)],
    ['Amount', `₱${ROOM_FEE_PLAN.price}`],
    ['Date of Payment', form.paidOn],
    ['Reference No.', form.reference.trim() || '________']
  ];
  const receiptText = () => [
    'BudgetRentPH Payment Receipt',
    ...lines.map(([k, v]) => `${k}: ${v}`),
    `Plan: ${ROOM_FEE_PLAN.label} (${ROOM_FEE_PLAN.note})`,
    `Listing ID: ${listing.id}`,
    'Status: Pending review'
  ].join('\n');

  const submit = async () => {
    if (!form.fullName.trim() || !form.phone.trim()) return setError('Please enter your name and contact number.');
    if (!form.reference.trim()) return setError('Please enter your payment reference number.');
    if (!confirmed) return setError('Please confirm that the receipt details are correct.');
    setLoading(true);
    setError('');
    const { error: err } = await supabase.from('verification_requests').insert([{
      user_id: session?.user?.id,
      full_name: form.fullName,
      property_name: listing.name || 'N/A',
      contact_number: form.phone,
      message: receiptText(),
      status: 'pending',
      email: session?.user?.email
    }]);
    setLoading(false);
    if (err) return setError(err.message || 'Could not send. Please try again.');
    onSubmitted();
  };

  return (
    <div style={{ margin: '12px 0', padding: '14px', borderRadius: '16px', background: '#fff7ed', border: '1.5px solid #fb923c' }}>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', marginBottom: '12px' }}>
        <AlertCircle size={18} color="#ea580c" style={{ flexShrink: 0, marginTop: 2 }} />
        <p style={{ margin: 0, fontSize: '0.8rem', color: '#9a3412', fontWeight: 600, lineHeight: 1.45 }}>
          Listings with {ROOM_FEE_THRESHOLD}+ rooms need a one-time <strong>₱{ROOM_FEE_PLAN.price}</strong> fee. Pay, fill in the receipt below, and send it. You can save this listing once the admin approves it.
        </p>
      </div>

      <button type="button" onClick={() => { fetchPaymentMethods().then(setPayMethods); setShowPay(true); }} style={{ width: '100%', padding: '11px', borderRadius: '12px', fontWeight: 800, background: 'white', color: '#003366', border: '2px solid #003366', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '12px' }}>
        <Zap size={16} fill="#003366" color="#003366" /> Show where to pay · ₱{ROOM_FEE_PLAN.price}
      </button>

      <div style={{ display: 'grid', gap: '10px' }}>
        <div><label style={label}>FULL NAME</label><input style={input} value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></div>
        <div><label style={label}>CONTACT NUMBER</label><input style={input} type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
        <div><label style={label}>REFERENCE NUMBER</label><input style={input} maxLength={40} placeholder="GCash / Maya reference no." value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} /></div>
        <div><label style={label}>DATE OF PAYMENT</label><input style={input} type="date" max={today} value={form.paidOn} onChange={(e) => setForm({ ...form, paidOn: e.target.value })} /></div>
      </div>

      <div aria-label="Payment receipt" style={{ marginTop: '12px', padding: '12px', borderRadius: '14px', background: '#fffdf5', border: '1.5px dashed #003366', fontFamily: 'ui-monospace, Menlo, monospace' }}>
        <div style={{ textAlign: 'center', marginBottom: '8px' }}>
          <strong style={{ display: 'block', fontSize: '0.8rem', color: '#003366' }}>BUDGETRENTPH</strong>
          <small style={{ fontSize: '0.65rem', color: '#64748b', textTransform: 'uppercase' }}>Payment receipt</small>
        </div>
        {lines.map(([k, v]) => (
          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', padding: '3px 0', borderTop: '1px dotted #cbd5e1', fontSize: '0.74rem' }}>
            <span style={{ color: '#64748b' }}>{k}</span>
            <strong style={{ color: '#0f172a', textAlign: 'right', wordBreak: 'break-word' }}>{v}</strong>
          </div>
        ))}
        <div style={{ textAlign: 'center', marginTop: '8px', fontSize: '0.65rem', color: '#92400e', fontWeight: 700 }}>Status: Pending review</div>
      </div>

      <label style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', marginTop: '12px', cursor: 'pointer', fontSize: '0.78rem', color: '#166534', fontWeight: 600 }}>
        <input type="checkbox" checked={confirmed} onChange={(e) => { setConfirmed(e.target.checked); if (e.target.checked) setError(''); }} style={{ width: 18, height: 18, accentColor: '#16a34a', flexShrink: 0 }} />
        I checked my receipt. All details are correct and match my payment.
      </label>

      {error && <p role="alert" style={{ margin: '10px 0 0', padding: '8px 12px', borderRadius: '10px', background: '#fef2f2', color: '#b91c1c', fontSize: '0.8rem', fontWeight: 700 }}>{error}</p>}

      <button type="button" onClick={submit} disabled={loading || !confirmed} style={{ width: '100%', marginTop: '12px', padding: '14px', borderRadius: '14px', fontWeight: 900, background: '#003366', color: 'white', border: 'none', cursor: loading || !confirmed ? 'not-allowed' : 'pointer', opacity: confirmed ? 1 : 0.55 }}>
        {loading ? <Loader2 size={18} className="animate-spin" /> : `Send receipt · ₱${ROOM_FEE_PLAN.price}`}
      </button>

      {showPay && createPortal(
        <div style={{ position: 'fixed', inset: 0, background: '#f8fafc', zIndex: 9999, display: 'flex', flexDirection: 'column' }}>
          <div style={{ background: '#003366', color: 'white', display: 'flex', alignItems: 'center', gap: '12px', padding: 'calc(12px + env(safe-area-inset-top, 0px)) 16px 12px' }}>
            <button type="button" aria-label="Back" onClick={() => setShowPay(false)} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%', width: 36, height: 36, cursor: 'pointer', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ArrowLeft size={20} /></button>
            <div>
              <h4 style={{ margin: 0, fontSize: '1.1rem' }}>Scan to Pay</h4>
              <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.85 }}>Amount: <strong>₱{ROOM_FEE_PLAN.price.toFixed(2)}</strong></p>
            </div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
            <div style={{ display: 'grid', gap: '8px', maxWidth: '480px', margin: '0 auto' }}>
              {payMethods.map((pay, i) => (
                <div key={i} style={{ background: '#fafbfc', padding: '10px 12px', borderRadius: '14px', border: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {pay.qr ? (
                    <img src={pay.qr} alt="QR" style={{ width: 80, height: 80, borderRadius: 10, border: '1px solid #eee', background: 'white', flexShrink: 0, objectFit: 'contain' }} />
                  ) : (
                    <div style={{ width: 65, height: 65, borderRadius: 10, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700, color: '#64748b', flexShrink: 0 }}>BANK</div>
                  )}
                  <div style={{ minWidth: 0 }}>
                    <span style={{ fontSize: '0.6rem', fontWeight: 900, background: pay.color, color: 'white', padding: '3px 8px', borderRadius: '100px', textTransform: 'uppercase' }}>{pay.method}</span>
                    <strong style={{ display: 'block', fontSize: '0.95rem', color: '#003366', marginTop: 3 }}>{pay.number}</strong>
                    <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>{pay.name}</p>
                  </div>
                </div>
              ))}
            </div>
            <button type="button" onClick={() => setShowPay(false)} style={{ display: 'block', width: '100%', maxWidth: '480px', margin: '14px auto 0', padding: '12px', borderRadius: '14px', background: '#003366', color: 'white', fontWeight: 800, border: 'none', cursor: 'pointer' }}>Done</button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default RoomFeeForm;
