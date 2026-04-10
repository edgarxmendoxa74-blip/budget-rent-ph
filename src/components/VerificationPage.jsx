import React, { useState } from 'react';
import { Upload, ShieldCheck, CheckCircle2, ArrowLeft } from 'lucide-react';

const VerificationPage = ({ onDone }) => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ fullName: '', propertyName: '', phone: '', message: '' });

  const handleSubmit = (e) => {
    e.preventDefault();
    setLoading(true);
    
    // Create mailto link
    const subject = encodeURIComponent('Landlord Verification Request');
    const body = encodeURIComponent(`Name: ${formData.fullName}\nProperty Name: ${formData.propertyName}\nContact Number: ${formData.phone}\nMessage: ${formData.message}`);
    window.location.href = `mailto:edgarmendoxa74@gmail.com?subject=${subject}&body=${body}`;

    setTimeout(() => {
      setLoading(false);
      setStep(2);
    }, 1000);
  };

  return (
    <div className="page-section animate-fade-in">
      <header className="hero" style={{ position: 'relative' }}>
        <button 
          onClick={onDone} 
          style={{ position: 'absolute', top: '16px', left: '16px', color: 'white', background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', backdropFilter: 'blur(4px)' }}
        >
          <ArrowLeft size={24} />
        </button>
        <div className="hero-content">
          <h2>Get Verified</h2>
          <p>Boost your property inquiries with a verified badge</p>
        </div>
      </header>
      <main className="info-page-container" style={{ background: 'white', padding: '32px', borderRadius: '16px', marginTop: '-32px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', position: 'relative', zIndex: 1 }}>
        {step === 1 ? (
          <>
            <div className="verification-intro">
              <ShieldCheck size={48} className="text-primary" style={{ margin: '0 auto', display: 'block' }} />
              <h3>Verify your Landlord Account</h3>
              <p>Verified accounts get a blue checkmark, boosting tenant trust and increasing your property inquiries.</p>
            </div>
            <form onSubmit={handleSubmit} className="verification-form">
              <div className="input-group" style={{ marginBottom: '16px' }}>
                <input type="text" placeholder="Full Name" required value={formData.fullName} onChange={e => setFormData({...formData, fullName: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid var(--border)', outline: 'none' }} />
              </div>
              <div className="input-group" style={{ marginBottom: '16px' }}>
                <input type="text" placeholder="Property / Business Name" required value={formData.propertyName} onChange={e => setFormData({...formData, propertyName: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid var(--border)', outline: 'none' }} />
              </div>
              <div className="input-group" style={{ marginBottom: '16px' }}>
                <input type="tel" placeholder="Contact Number" required value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid var(--border)', outline: 'none' }} />
              </div>
              <div className="input-group" style={{ marginBottom: '16px' }}>
                <textarea placeholder="Additional Information (Optional)" rows={4} value={formData.message} onChange={e => setFormData({...formData, message: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid var(--border)', fontFamily: 'inherit', outline: 'none' }}></textarea>
              </div>
              <button type="submit" className="submit-btn" disabled={loading} style={{marginTop: '8px', width: '100%'}}>
                {loading ? 'Opening Email...' : 'Send Verification Email'}
              </button>
            </form>
          </>
        ) : (
          <div className="verification-success">
            <CheckCircle2 size={64} className="text-secondary" style={{ margin: '0 auto 16px', display: 'block' }} />
            <h3>Submission Successful!</h3>
            <p>Our team will review your documents within 24-48 hours. You will receive an email once your account is verified.</p>
            <button className="submit-btn" onClick={onDone} style={{marginTop: '16px', width: '100%'}}>Done</button>
          </div>
        )}
      </main>
    </div>
  );
};

export default VerificationPage;
