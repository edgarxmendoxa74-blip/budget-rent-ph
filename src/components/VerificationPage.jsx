import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { ShieldCheck, CheckCircle2, ArrowLeft, Loader2, Zap, AlertCircle, X as XIcon } from 'lucide-react';

const VerificationPage = ({ onDone, session }) => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [formData, setFormData] = useState({ fullName: '', propertyName: '', phone: '', message: '' });

  const [selectedQR, setSelectedQR] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const { error } = await supabase
        .from('verification_requests')
        .insert([
          {
            user_id: session?.user?.id,
            full_name: formData.fullName,
            property_name: formData.propertyName,
            contact_number: formData.phone,
            message: formData.message,
            status: 'pending',
            email: session?.user?.email
          }
        ]);

      if (error) throw error;
      
      const subject = encodeURIComponent(`NEW VERIFICATION REQUEST: ${formData.propertyName}`);
      const emailBody = encodeURIComponent(
        `Budget Rent PH - New Verification Request\n\n` +
        `Owner Name: ${formData.fullName}\n` +
        `Property Name: ${formData.propertyName}\n` +
        `Contact Number: ${formData.phone}\n` +
        `Email Account: ${session?.user?.email}\n` +
        `Message: ${formData.message}\n\n` +
        `REMINDER: Please attach your proof of payment screenshot here.`
      );

      window.location.href = `mailto:mendozajakong@gmail.com?subject=${subject}&body=${emailBody}`;
      setStep(2);
      setShowPaymentModal(true); // Automatically show payment options after submission
    } catch (error) {
      console.error('Error submitting verification:', error);
      alert(`Error: ${error.message || 'Please check your connection.'}`);
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
        <h1 style={{ fontSize: '2rem', margin: '0 0 6px', fontWeight: '900', color: 'var(--primary)', letterSpacing: '-1px', textTransform: 'uppercase' }}>GET VERIFIED</h1>
        <div style={{ background: '#f1f5f9', color: 'var(--primary)', padding: '6px 16px', borderRadius: '100px', fontSize: '0.65rem', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '1.5px', border: '1px solid #e2e8f0' }}>Premium Landlord Status</div>
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
                After clicking Apply, your email client will open. **Scan the payment QR** (which will appear next) and attach the screenshot to your email.
              </p>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="input-group">
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: '#64748b', marginBottom: '8px', marginLeft: '4px' }}>FULL LEGAL NAME</label>
                <input type="text" placeholder="Juan Dela Cruz" required value={formData.fullName} onChange={e => setFormData({...formData, fullName: e.target.value})} style={{ width: '100%', padding: '16px', borderRadius: '16px', border: '1.5px solid #e2e8f0', outline: 'none', background: 'white', fontSize: '1rem', color: '#1e293b' }} />
              </div>
              <div className="input-group">
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: '#64748b', marginBottom: '8px', marginLeft: '4px' }}>PROPERTY NAME</label>
                <input type="text" placeholder="e.g. Budget Apartments" required value={formData.propertyName} onChange={e => setFormData({...formData, propertyName: e.target.value})} style={{ width: '100%', padding: '16px', borderRadius: '16px', border: '1.5px solid #e2e8f0', outline: 'none', background: 'white', fontSize: '1rem', color: '#1e293b' }} />
              </div>
              <div className="input-group">
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: '#64748b', marginBottom: '8px', marginLeft: '4px' }}>CONTACT NUMBER</label>
                <input type="tel" placeholder="09XX XXX XXXX" required value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} style={{ width: '100%', padding: '16px', borderRadius: '16px', border: '1.5px solid #e2e8f0', outline: 'none', background: 'white', fontSize: '1rem', color: '#1e293b' }} />
              </div>
              <div className="input-group">
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: '#64748b', marginBottom: '8px', marginLeft: '4px' }}>ADDITIONAL MESSAGE</label>
                <textarea placeholder="Write something..." rows={3} value={formData.message} onChange={e => setFormData({...formData, message: e.target.value})} style={{ width: '100%', padding: '16px', borderRadius: '16px', border: '1.5px solid #e2e8f0', outline: 'none', background: 'white', resize: 'none', fontSize: '1rem', color: '#1e293b' }}></textarea>
              </div>

              <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <button type="submit" disabled={loading} style={{ width: '100%', padding: '18px', borderRadius: '18px', fontSize: '1.1rem', fontWeight: '900', background: '#003366', color: 'white', border: 'none', cursor: 'pointer', transition: 'all 0.3s ease', boxShadow: '0 8px 16px rgba(0, 51, 102, 0.2)' }}>
                  {loading ? <><Loader2 size={24} className="animate-spin" /> Submitting...</> : 'Apply For Verification'}
                </button>

                <button 
                  type="button"
                  onClick={() => setShowPaymentModal(true)}
                  style={{ width: '100%', padding: '16px', borderRadius: '18px', fontSize: '1rem', fontWeight: '900', background: 'white', color: '#ef4444', border: '2px solid #ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}
                >
                   <Zap size={20} fill="#ef4444" color="#ef4444" /> Choose Payment Option
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
            <p style={{ fontSize: '1rem', color: '#64748b', lineHeight: '1.6', marginBottom: '32px' }}>Check your email app to send the ticket. **Attach your payment proof** to the email.</p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button 
                onClick={() => setShowPaymentModal(true)}
                style={{ width: '100%', padding: '16px', borderRadius: '18px', fontSize: '1rem', fontWeight: '900', background: 'white', color: '#003366', border: '2px solid #003366', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}
              >
                <Zap size={20} fill="#003366" color="#003366" /> Show Payment Options
              </button>
              
              <button onClick={onDone} style={{ width: '100%', padding: '18px', borderRadius: '18px', fontSize: '1.1rem', fontWeight: '900', background: '#FFD700', color: '#003366', border: 'none', cursor: 'pointer', boxShadow: '0 4px 12px rgba(255, 215, 0, 0.3)' }}>
                Return to Dashboard
              </button>
            </div>
          </div>
        )}
      </main>

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
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>Amount: <strong style={{color: 'var(--primary)'}}>₱100.00</strong></p>
              </div>
              <button 
                onClick={() => setShowPaymentModal(false)} 
                style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <XIcon size={16} />
              </button>
            </div>
            
            <div style={{ display: 'grid', gap: '8px' }}>
              {[
                { method: 'GCash', name: 'EDGAR M.', number: '0917 123 4567', color: '#007dfe', qr: 'https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=GCash-09171234567' },
                { method: 'Maya', name: 'EDGAR M.', number: '0917 123 4567', color: '#c335e5', qr: 'https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=Maya-09171234567' },
                { method: 'Bank', name: 'EDGAR M.', number: '1234-5678-90', color: '#1e293b', qr: '' }
              ].map((pay, pIdx) => (
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
            padding: '24px' 
          }}
        >
          <div 
            onClick={e => e.stopPropagation()}
            style={{ 
              width: '100%', 
              maxWidth: '260px', // Reduced from 300px
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
            
            <img src={selectedQR.qr} alt="Large QR" style={{ width: '100%', borderRadius: '16px', border: '1px solid #f1f5f9' }} />
            
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
    </div>
  );
};

export default VerificationPage;
