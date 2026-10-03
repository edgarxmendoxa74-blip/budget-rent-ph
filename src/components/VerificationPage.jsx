import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import { ShieldCheck, CheckCircle2, ArrowLeft, Loader2, Zap, AlertCircle, X as XIcon } from 'lucide-react';
import { HeroBudi } from './MascotSplash';
import { PAYMENT_METHODS, fetchPaymentMethods } from '../lib/paymentMethods';
import { fetchPlans } from '../lib/plans';
import { PRO_PLAN, TENANT_PLAN } from '../lib/listingPlan';

// Get Verified (at ang Pro Listings na 6-10 listings) ang tanging may bayad: pumili ng plan, magbayad, mag-upload ng proof dito mismo (walang email)
// mode: 'verify' (Verified badge) o 'listings' (Pro Listings plan)
const VerificationPage = ({ onDone, session, mode = 'verify' }) => {
  const isListings = mode === 'listings';
  const isTenant = mode === 'tenant';
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  // Tatlong detalye lang ang kailangan: pangalan, number, at petsa ng bayad (naka-prefill mula sa account)
  const meta = session?.user?.user_metadata || {};
  const today = new Date().toISOString().slice(0, 10);
  const initialPhone = /^639\d{9}$/.test(meta.phone || '') ? `0${String(meta.phone).slice(2)}` : (meta.phone || '');
  const [formData, setFormData] = useState({ fullName: meta.full_name || '', phone: initialPhone, paidOn: today, reference: '' });
  const [plans, setPlans] = useState([]);
  const [payMethods, setPayMethods] = useState(PAYMENT_METHODS); // galing sa super admin (app_settings)
  useEffect(() => { fetchPaymentMethods().then(setPayMethods); }, []);
  const [planId, setPlanId] = useState(isListings ? PRO_PLAN.id : isTenant ? TENANT_PLAN.id : 'yearly');
  const [error, setError] = useState('');
  const [agreed, setAgreed] = useState(false);
  // Code ng resibo: ginagawa pagbukas ng form, nakasulat din sa request para mahanap ng admin
  const [code] = useState(() => `VR-${Array.from(crypto.getRandomValues(new Uint8Array(4)), (n) => n.toString(16).padStart(2, '0')).join('').toUpperCase()}`);
  const [confirmed, setConfirmed] = useState(false); // "tama na lahat ng detalye sa resibo"

  const [selectedQR, setSelectedQR] = useState(null);

  useEffect(() => {
    if (isListings) setPlans([PRO_PLAN]);
    else if (isTenant) setPlans([TENANT_PLAN]);
    else fetchPlans().then(setPlans);
  }, [isListings, isTenant]);
  const plan = plans.find((p) => p.id === planId) || plans[0];

  // Resibo na nabubuo mula sa form: ito ang ipinapadala at ito rin ang makikita ng admin
  const receiptLines = [
    ['Receipt Code', code],
    ['Name', formData.fullName],
    ['Contact', formData.phone],
    ['For', isListings ? 'Pro Listings' : isTenant ? 'Verified Tenant' : 'Get Verified'],
    plan && ['Plan', `${plan.label} (${plan.note})`],
    plan && ['Amount', `₱${Number(plan.price).toLocaleString()}`],
    ['Date of Payment', formData.paidOn],
    ['Reference No.', formData.reference.trim() || '________']
  ].filter(Boolean);
  const receiptText = () => [
    'BudgetRentPH Payment Receipt',
    ...receiptLines.map(([k, v]) => `${k}: ${v}`),
    'Status: Pending review'
  ].join('\n');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!plan) return setError("Plans haven't loaded yet, please try again.");
    if (!formData.reference.trim()) return setError('Please enter your payment reference number.');
    if (!confirmed) return setError('Please confirm that the receipt details are correct.');
    if (!agreed) return setError('Please agree to the Data Privacy Act consent first.');
    setLoading(true);
    setError('');

    try {
      // Ang buong resibo ang ipinapadala sa admin
      const details = receiptText();

      const { error: insErr } = await supabase
        .from('verification_requests')
        .insert([
          {
            user_id: session?.user?.id,
            full_name: formData.fullName,
            property_name: isTenant ? 'Tenant' : (meta.property_name || 'N/A'),
            contact_number: formData.phone,
            message: details,
            status: 'pending',
            email: session?.user?.email
          }
        ]);

      if (insErr) throw insErr;
      setStep(2);
    } catch (err) {
      console.error('Error submitting verification:', err);
      setError(err.message || 'Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-section animate-fade-in" style={{ backgroundColor: '#f8fafc', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header className="verification-header" style={{ 
        position: 'relative', 
        background: 'white', 
        paddingTop: '50px',
        paddingBottom: '30px',
        display: 'flex', 
        flexDirection: 'column',
        alignItems: 'center', 
        justifyContent: 'center', 
        flexShrink: 0,
        borderBottom: '1px solid #f1f5f9'
      }}>
        <HeroBudi message={isListings ? 'Need to list more than 5 properties? Get Pro Listings for up to 10.' : isTenant ? 'Get verified for only ₱50 a year, so landlords can trust you faster.' : 'Get verified to show the badge and earn more trust from tenants.'} />
        <h1 style={{ fontSize: '2rem', margin: '0 0 6px', fontWeight: '900', color: 'var(--primary)', letterSpacing: '-1px', textTransform: 'uppercase' }}>{isListings ? 'PRO LISTINGS' : 'GET VERIFIED'}</h1>
        <div style={{ background: '#f1f5f9', color: 'var(--primary)', padding: '6px 16px', borderRadius: '100px', fontSize: '0.65rem', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '1.5px', border: '1px solid #e2e8f0' }}>{isTenant ? 'Verified Tenant' : 'Premium Landlord Status'}</div>
      </header>

      <main style={{ 
        flex: 1,
        padding: '24px',
        maxWidth: '450px',
        width: '100%',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {step === 1 ? (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            
            {/* Reminder Note Section - RED VERSION */}
            <div style={{ 
              backgroundColor: '#fff1f2', 
              padding: '12px 14px', 
              borderRadius: '12px', 
              border: '1.5px solid #ef4444',
              marginBottom: '16px',
              display: 'flex',
              gap: '10px',
              alignItems: 'flex-start'
            }}>
              <AlertCircle size={18} color="#ef4444" style={{ flexShrink: 0, marginTop: '2px' }} />
              <p style={{ margin: 0, fontSize: '0.78rem', color: '#991b1b', lineHeight: '1.5', fontWeight: '600' }}>
                <strong style={{ textTransform: 'uppercase', fontSize: '0.65rem', display: 'block', marginBottom: '2px' }}>How it works:</strong> 
                Pay with GCash, Maya, or bank, then fill in the form below. Your receipt is made automatically, check it, tick the box, and send it.{isListings ? 'We’ll review it and unlock listings 6 to 10 for 2 months. Your first 5 listings are always free.' : isTenant ? 'We’ll review it and turn on your Verified badge for 1 year. Everything else in the app is free.' : 'We’ll review it and turn on your Verified badge. Everything else in the app is free.'}
              </p>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="input-group" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: '#64748b', marginBottom: '8px', marginLeft: '4px' }}>FULL LEGAL NAME</label>
                <input type="text" placeholder="Juan Dela Cruz" required value={formData.fullName} onChange={e => setFormData({...formData, fullName: e.target.value})} style={{ width: '100%', padding: '16px', borderRadius: '16px', border: '1.5px solid #e2e8f0', outline: 'none', background: 'white', fontSize: '1rem', color: '#1e293b' }} />
              </div>
              <div className="input-group" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: '#64748b', marginBottom: '8px', marginLeft: '4px' }}>CONTACT NUMBER</label>
                <input type="tel" placeholder="09XX XXX XXXX" required value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} style={{ width: '100%', padding: '16px', borderRadius: '16px', border: '1.5px solid #e2e8f0', outline: 'none', background: 'white', fontSize: '1rem', color: '#1e293b' }} />
              </div>
              {plans.length > 1 && <div className="input-group" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: '#64748b', marginBottom: '8px', marginLeft: '4px' }}>PLAN</label>
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.max(plans.length, 1)}, 1fr)`, gap: '10px' }}>
                  {plans.map((p) => (
                    <button type="button" key={p.id} onClick={() => setPlanId(p.id)} style={{ padding: '12px', borderRadius: '16px', cursor: 'pointer', border: `2px solid ${plan?.id === p.id ? '#003366' : '#e2e8f0'}`, background: plan?.id === p.id ? '#eef4fb' : 'white', color: '#003366' }}>
                      <strong style={{ display: 'block', fontSize: '1rem' }}>{p.label}</strong>
                      <span style={{ fontSize: '0.8rem' }}>₱{p.price} · {p.note}</span>
                    </button>
                  ))}
                </div>
              </div>}

              <div className="input-group" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: '#64748b', marginBottom: '8px', marginLeft: '4px' }}>AMOUNT TO PAY: ₱{plan?.price ?? '—'}</label>
                <button type="button" onClick={() => { fetchPaymentMethods().then(setPayMethods); setShowPaymentModal(true); }} style={{ marginTop: '10px', padding: '12px', borderRadius: '14px', fontWeight: 800, background: 'white', color: '#003366', border: '2px solid #003366', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <Zap size={18} fill="#003366" color="#003366" /> Show where to pay
                </button>
              </div>

              <div className="input-group" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: '#64748b', marginBottom: '8px', marginLeft: '4px' }}>REFERENCE NUMBER</label>
                <input type="text" inputMode="text" autoComplete="off" required maxLength={40} placeholder="e.g. GCash / Maya reference no." value={formData.reference} onChange={e => setFormData({...formData, reference: e.target.value})} style={{ width: '100%', padding: '16px', borderRadius: '16px' }} />
              </div>
              <div className="input-group" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: '#64748b', marginBottom: '8px', marginLeft: '4px' }}>DATE OF PAYMENT</label>
                <input type="date" required max={today} value={formData.paidOn} onChange={e => setFormData({...formData, paidOn: e.target.value})} style={{ width: '100%', padding: '16px', borderRadius: '16px' }} />
              </div>

              {/* Maliit na resibo: nabubuo habang pinupunan ang form; ito ang ipapadala sa admin */}
              <div aria-label="Payment receipt" style={{ padding: '16px', borderRadius: '16px', background: '#fffdf5', border: '1.5px dashed #003366', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
                <div style={{ textAlign: 'center', marginBottom: '10px' }}>
                  <strong style={{ display: 'block', fontSize: '0.85rem', color: '#003366', letterSpacing: '0.04em' }}>BUDGETRENTPH</strong>
                  <small style={{ fontSize: '0.68rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Payment receipt</small>
                </div>
                {receiptLines.map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', padding: '4px 0', borderTop: '1px dotted #cbd5e1', fontSize: '0.78rem' }}>
                    <span style={{ color: '#64748b' }}>{k}</span>
                    <strong style={{ color: '#0f172a', textAlign: 'right', wordBreak: 'break-word', letterSpacing: k === 'Receipt Code' ? '0.06em' : undefined }}>{v}</strong>
                  </div>
                ))}
                <div style={{ textAlign: 'center', marginTop: '10px', fontSize: '0.68rem', color: '#92400e', fontWeight: 700 }}>Status: Pending review</div>
              </div>

              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '12px 14px', borderRadius: '14px', background: '#f0fdf4', border: '1.5px solid rgba(22, 163, 74, 0.35)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => { setConfirmed(e.target.checked); if (e.target.checked) setError(''); }}
                  style={{ width: '20px', height: '20px', marginTop: '1px', flexShrink: 0, accentColor: '#16a34a', cursor: 'pointer' }}
                />
                <span style={{ fontSize: '0.8rem', lineHeight: 1.45, color: '#166534', fontWeight: 600 }}>
                  I checked my receipt above. All details are correct and match my payment.
                </span>
              </label>

              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '12px 14px', borderRadius: '14px', background: '#f5f0ff', border: '1.5px solid rgba(124, 58, 237, 0.3)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => { setAgreed(e.target.checked); if (e.target.checked) setError(''); }}
                  style={{ width: '20px', height: '20px', marginTop: '1px', flexShrink: 0, accentColor: '#7c3aed', cursor: 'pointer' }}
                />
                <span style={{ fontSize: '0.8rem', lineHeight: 1.45, color: '#4c1d95', fontWeight: 600 }}>
                  I agree to the collection and processing of my personal information (name, contact number, and payment details) for verification, in accordance with the Data Privacy Act of 2012 (RA 10173).
                </span>
              </label>

              {error && (
                <p role="alert" style={{ margin: 0, padding: '10px 14px', borderRadius: '12px', background: '#fef2f2', color: '#b91c1c', fontSize: '0.85rem', fontWeight: 700 }}>{error}</p>
              )}

              <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <button type="submit" disabled={loading || !confirmed || !agreed} style={{ width: '100%', padding: '18px', borderRadius: '18px', fontSize: '1.1rem', fontWeight: '900', background: '#003366', color: 'white', border: 'none', cursor: loading || !confirmed || !agreed ? 'not-allowed' : 'pointer', opacity: confirmed && agreed ? 1 : 0.55, transition: 'all 0.3s ease', boxShadow: '0 8px 16px rgba(0, 51, 102, 0.2)' }}>
                  {loading ? <><Loader2 size={24} className="animate-spin" /> Submitting...</> : 'Apply For Verification'}
                </button>

              </div>
            </form>
          </div>
        ) : (
          <div className="animate-slide-up" style={{ padding: '60px 20px', textAlign: 'center', background: 'white', borderRadius: '32px', boxShadow: '0 10px 25px rgba(0,0,0,0.05)', marginTop: '20px' }}>
            <div style={{ width: '90px', height: '90px', background: '#f0fdf4', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 28px' }}>
              <CheckCircle2 size={48} color="#16a34a" />
            </div>
            <h3 style={{ fontSize: '1.6rem', color: '#003366', fontWeight: '900', margin: '0 0 12px' }}>Request Sent!</h3>
            <p style={{ fontSize: '1rem', color: '#64748b', lineHeight: '1.6', marginBottom: '32px' }}>We received your payment details. {isListings ? 'We’ll review it and unlock your extra listings soon. Your first 5 listings stay free.' : isTenant ? 'We’ll review it and turn on your Verified badge for 1 year soon. Everything else in the app stays free.' : 'We’ll review it and turn on your Verified badge soon. Everything else in the app stays free.'}</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button onClick={onDone} style={{ width: '100%', padding: '18px', borderRadius: '18px', fontSize: '1.1rem', fontWeight: '900', background: '#FFD700', color: '#003366', border: 'none', cursor: 'pointer', boxShadow: '0 4px 12px rgba(255, 215, 0, 0.3)' }}>
                Return to Dashboard
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Nasa document.body para laging sakop ang buong screen at nasa ibabaw ng nav */}
      {createPortal(<>
      {/* Payment Modal */}
      {showPaymentModal && (
        <div style={{ 
          position: 'fixed', 
          top: 0, 
          left: 0, 
          right: 0, 
          bottom: 0, 
          background: 'rgba(0, 51, 102, 0.4)', 
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          zIndex: 9999, // Ensure it's above everything
          padding: '16px' 
        }}>
          <div className="animate-fade-in" style={{ 
            background: 'white', 
            width: '92%', 
            maxWidth: '330px', 
            borderRadius: '24px', 
            padding: '18px', 
            position: 'relative', 
            maxHeight: '80vh',
            overflowY: 'auto',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.2)',
            margin: 'auto'
          }}>
            {/* Header with Close Icon */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div>
                <h4 style={{ margin: '0', fontSize: '1.15rem', color: 'var(--primary)', fontWeight: '800' }}>Scan to Pay</h4>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>Amount: <strong style={{color: 'var(--primary)'}}>₱{Number(plan?.price ?? 0).toFixed(2)}</strong></p>
              </div>
              <button 
                onClick={() => setShowPaymentModal(false)} 
                style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <XIcon size={16} />
              </button>
            </div>
            
            <div style={{ display: 'grid', gap: '8px' }}>
              {payMethods.map((pay, pIdx) => (
                <div key={pIdx} style={{ 
                  background: '#fafbfc', 
                  padding: '10px 14px', 
                  borderRadius: '16px', 
                  border: '1px solid #f0f0f0', 
                  display: 'flex', 
                  alignItems: 'center',
                  gap: '12px'
                }}>
                  {pay.qr ? (
                    <img 
                      src={pay.qr} 
                      alt="QR" 
                      onClick={() => setSelectedQR(pay)}
                      style={{ width: '65px', height: '65px', borderRadius: '10px', border: '1px solid #eee', flexShrink: 0, padding: '2px', background: 'white', cursor: 'pointer' }} 
                    />
                  ) : (
                    <div style={{ width: '65px', height: '65px', borderRadius: '10px', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: '700' }}>BANK</div>
                  )}
                  
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                      <span style={{ fontSize: '0.6rem', fontWeight: '900', background: pay.color, color: 'white', padding: '3px 8px', borderRadius: '100px', textTransform: 'uppercase' }}>{pay.method}</span>
                    </div>
                    <strong style={{ fontSize: '1rem', color: 'var(--primary)', display: 'block', letterSpacing: '0.3px' }}>{pay.number}</strong>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '2px' }}>
                      <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '500' }}>{pay.name}</p>
                      {pay.qr && (
                        <button 
                          onClick={() => setSelectedQR(pay)}
                          style={{ 
                            background: 'white', 
                            border: '1px solid #e2e8f0', 
                            borderRadius: '6px', 
                            padding: '3px 8px', 
                            fontSize: '0.65rem', 
                            fontWeight: '700', 
                            color: 'var(--primary)',
                            cursor: 'pointer'
                          }}
                        >
                          View QR
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button 
              onClick={() => setShowPaymentModal(false)} 
              style={{ 
                width: '100%', 
                marginTop: '14px', 
                padding: '14px', 
                borderRadius: '16px', 
                background: 'var(--primary)', 
                color: 'white', 
                fontWeight: '800', 
                fontSize: '0.95rem',
                border: 'none', 
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(0, 51, 102, 0.2)'
              }}
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Large QR View Overlay */}
      {selectedQR && (
        <div 
          onClick={() => setSelectedQR(null)}
          style={{ 
            position: 'fixed', 
            top: 0, 
            left: 0, 
            right: 0, 
            bottom: 0, 
            background: 'rgba(0, 0, 0, 0.85)', 
            display: 'flex', 
            flexDirection: 'column',
            alignItems: 'center', 
            justifyContent: 'center', 
            zIndex: 10000,
            padding: '24px',
            overflowY: 'auto'
          }}
        >
          <div 
            onClick={e => e.stopPropagation()}
            style={{ 
              width: '100%',
              maxWidth: '300px',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxSizing: 'border-box',
              margin: 'auto',
              textAlign: 'center',
              background: 'white',
              padding: '20px',
              borderRadius: '28px',
              boxShadow: '0 20px 60px rgba(0,0,0,0.5)'
            }}
          >
            <span style={{ 
              display: 'inline-block', 
              fontSize: '0.65rem', 
              fontWeight: '900', 
              background: selectedQR.color, 
              color: 'white', 
              padding: '4px 12px', 
              borderRadius: '100px', 
              marginBottom: '14px', 
              textTransform: 'uppercase',
              letterSpacing: '1px'
            }}>
              {selectedQR.method}
            </span>
            
            <img src={selectedQR.qr} alt="Large QR" style={{ display: 'block', width: '100%', maxHeight: '55vh', objectFit: 'contain', borderRadius: '16px', border: '1px solid #f1f5f9' }} />
            
            <div style={{ marginTop: '14px' }}>
              <strong style={{ color: 'var(--primary)', fontSize: '1.1rem', display: 'block' }}>{selectedQR.number}</strong>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '2px', fontWeight: '500' }}>{selectedQR.name}</p>
            </div>
            
            <button 
              onClick={() => setSelectedQR(null)}
              style={{ 
                marginTop: '18px', 
                width: '100%',
                padding: '12px', 
                borderRadius: '14px', 
                background: '#f1f5f9', 
                color: 'var(--primary)', 
                border: 'none', 
                fontWeight: '800', 
                fontSize: '0.85rem',
                cursor: 'pointer' 
              }}
            >
              Close Preview
            </button>
          </div>
        </div>
      )}
      </>, document.body)}
    </div>
  );
};

export default VerificationPage;
