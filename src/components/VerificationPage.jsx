import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { ShieldCheck, CheckCircle2, ArrowLeft, Loader2, Zap, AlertCircle } from 'lucide-react';

const VerificationPage = ({ onDone, session }) => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [formData, setFormData] = useState({ fullName: '', propertyName: '', phone: '', message: '' });

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
    } catch (error) {
      console.error('Error submitting verification:', error);
      alert(`Error: ${error.message || 'Please check your connection.'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-section animate-fade-in" style={{ background: 'white', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header className="verification-header" style={{ 
        position: 'relative', 
        background: 'white', 
        paddingTop: '60px',
        paddingBottom: '20px',
        display: 'flex', 
        flexDirection: 'column',
        alignItems: 'center', 
        justifyContent: 'center', 
        flexShrink: 0
      }}>
        <button 
          onClick={onDone} 
          style={{ 
            position: 'absolute', 
            top: '25px', 
            left: '20px', 
            color: '#003366', 
            background: '#f8fafc', 
            border: 'none', 
            borderRadius: '12px', 
            width: '40px', 
            height: '40px', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            cursor: 'pointer',
            zIndex: 10
          }}
        >
          <ArrowLeft size={20} />
        </button>

        {/* Icon at the very top */}
        <div style={{ 
          width: '64px', 
          height: '64px', 
          background: '#fff9e6', 
          borderRadius: '50%', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          marginBottom: '16px',
          border: '2px solid #FFD700'
        }}>
          <ShieldCheck size={32} color="#FFD700" />
        </div>

        <h2 style={{ fontSize: '1.6rem', margin: '0 0 2px', fontWeight: '900', color: '#003366' }}>Get Verified</h2>
        <p style={{ margin: 0, fontSize: '0.7rem', color: '#64748b', fontWeight: '800', letterSpacing: '1px' }}>PREMIUM LANDLORD STATUS</p>
      </header>

      <main style={{ 
        flex: 1,
        padding: '0 24px 40px',
        maxWidth: '450px',
        width: '100%',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {step === 1 ? (
          <div style={{ background: 'white', display: 'flex', flexDirection: 'column' }}>
            
            {/* Reminder Note Section */}
            <div style={{ 
              background: '#fff9e6', 
              padding: '16px', 
              borderRadius: '20px', 
              border: '1.5px solid #FFD700',
              marginBottom: '24px',
              display: 'flex',
              gap: '12px',
              alignItems: 'flex-start'
            }}>
              <AlertCircle size={20} color="#854d0e" style={{ flexShrink: 0, marginTop: '2px' }} />
              <p style={{ margin: 0, fontSize: '0.8rem', color: '#854d0e', lineHeight: '1.5', fontWeight: '600' }}>
                <strong>Important:</strong> Pagkatapos mag-submit, kailangang magbayad gamit ang <strong>Choose Payment Options</strong> button sa ibaba. Siguraduhing i-attach ang <strong>screenshot</strong> ng inyong payment bago ito i-send sa email.
              </p>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="input-group">
                <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '800', color: '#003366', marginBottom: '8px' }}>FULL LEGAL NAME</label>
                <input type="text" placeholder="Juan Dela Cruz" required value={formData.fullName} onChange={e => setFormData({...formData, fullName: e.target.value})} style={{ width: '100%', padding: '14px', borderRadius: '14px', border: '1.5px solid #edf2f7', outline: 'none', background: '#f8fafc', fontSize: '0.95rem' }} />
              </div>
              <div className="input-group">
                <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '800', color: '#003366', marginBottom: '8px' }}>PROPERTY NAME</label>
                <input type="text" placeholder="e.g. Budget Apartments" required value={formData.propertyName} onChange={e => setFormData({...formData, propertyName: e.target.value})} style={{ width: '100%', padding: '14px', borderRadius: '14px', border: '1.5px solid #edf2f7', outline: 'none', background: '#f8fafc', fontSize: '0.95rem' }} />
              </div>
              <div className="input-group">
                <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '800', color: '#003366', marginBottom: '8px' }}>CONTACT NUMBER</label>
                <input type="tel" placeholder="09XX XXX XXXX" required value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} style={{ width: '100%', padding: '14px', borderRadius: '14px', border: '1.5px solid #edf2f7', outline: 'none', background: '#f8fafc', fontSize: '0.95rem' }} />
              </div>
              <div className="input-group">
                <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '800', color: '#003366', marginBottom: '8px' }}>ADDITIONAL MESSAGE</label>
                <textarea placeholder="Write something..." rows={2} value={formData.message} onChange={e => setFormData({...formData, message: e.target.value})} style={{ width: '100%', padding: '14px', borderRadius: '14px', border: '1.5px solid #edf2f7', outline: 'none', background: '#f8fafc', resize: 'none', fontSize: '0.95rem' }}></textarea>
              </div>

              <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <button type="submit" disabled={loading} style={{ width: '100%', padding: '14px', borderRadius: '14px', fontSize: '1rem', fontWeight: '800', background: '#003366', color: 'white', border: 'none', cursor: 'pointer', transition: 'all 0.3s ease', boxShadow: '0 4px 12px rgba(0, 51, 102, 0.15)' }}>
                  {loading ? <><Loader2 size={20} className="animate-spin" /> Sending...</> : 'Submit & Apply'}
                </button>

                <button 
                  type="button"
                  onClick={() => setShowPaymentModal(true)}
                  style={{ width: '100%', padding: '12px', borderRadius: '14px', fontSize: '0.9rem', fontWeight: '700', background: 'white', color: '#003366', border: '1.5px solid #FFD700', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                >
                   <Zap size={18} color="#FFD700" /> Choose Payment Option
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div style={{ padding: '40px 20px', textAlign: 'center' }}>
            <div style={{ width: '80px', height: '80px', background: '#dcfce7', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
              <CheckCircle2 size={40} color="#166534" />
            </div>
            <h3 style={{ fontSize: '1.4rem', color: '#003366', fontWeight: '800', margin: '0 0 12px' }}>Sent to Email!</h3>
            <p style={{ fontSize: '0.9rem', color: '#64748b', lineHeight: '1.6', marginBottom: '32px' }}>Nabuksan na ang iyong email client. Huwag kalimutang i-attach ang payment screenshot bago i-send.</p>
            <button onClick={onDone} style={{ width: '100%', padding: '16px', borderRadius: '16px', fontSize: '1rem', fontWeight: '800', background: '#FFD700', color: '#003366', border: 'none', cursor: 'pointer' }}>
              Return to Profile
            </button>
          </div>
        )}
      </main>

      {/* Payment Modal */}
      {showPaymentModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ background: 'white', width: '100%', maxWidth: '400px', borderRadius: '32px', padding: '24px', position: 'relative', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <h4 style={{ margin: '0 0 4px', fontSize: '1.3rem', color: '#003366', fontWeight: '800' }}>Scan to Pay (₱100)</h4>
              <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>Select preferred option</p>
            </div>
            
            <div style={{ display: 'grid', gap: '12px' }}>
              {[
                { method: 'GCash', name: 'EDGAR M.', number: '0917 123 4567', qr: 'https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=GCash-09171234567' },
                { method: 'Maya', name: 'EDGAR M.', number: '0917 123 4567', qr: 'https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=Maya-09171234567' },
                { method: 'Bank', name: 'EDGAR M.', number: '1234-5678-90', qr: '' }
              ].map((pay, pIdx) => (
                <div key={pIdx} style={{ background: '#f8fafc', padding: '16px', borderRadius: '24px', border: '1px solid #edf2f7', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                    <span style={{ fontSize: '0.6rem', fontWeight: '800', background: pay.method === 'GCash' ? '#007dfe' : pay.method === 'Maya' ? '#c335e5' : '#1e293b', color: 'white', padding: '4px 10px', borderRadius: '6px' }}>{pay.method}</span>
                    <strong style={{ fontSize: '1.1rem', color: '#003366' }}>{pay.number}</strong>
                  </div>
                  {pay.qr && <img src={pay.qr} alt="QR" style={{ width: '120px', height: '120px', borderRadius: '12px', background: 'white', padding: '4px', border: '1px solid #eee', marginBottom: '12px' }} />}
                  <p style={{ margin: '0 0 12px', fontSize: '0.8rem', fontWeight: '700', color: '#64748b' }}>{pay.name}</p>
                  <button onClick={() => pay.qr && window.open(pay.qr, '_blank')} style={{ background: 'white', border: '1.5px solid #003366', color: '#003366', padding: '6px 16px', borderRadius: '10px', fontSize: '0.75rem', fontWeight: '800', cursor: 'pointer' }}>View QR</button>
                </div>
              ))}
            </div>

            <button onClick={() => setShowPaymentModal(false)} style={{ width: '100%', marginTop: '24px', padding: '14px', borderRadius: '16px', background: '#003366', color: 'white', fontWeight: '800', border: 'none', cursor: 'pointer' }}>Close Modal</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default VerificationPage;
