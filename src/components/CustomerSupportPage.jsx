import React, { useState } from 'react';
import { MessageSquare, CheckCircle2, ArrowLeft, Send, Loader2 } from 'lucide-react';

const CustomerSupportPage = ({ onDone }) => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ name: '', phone: '', issue: '' });

  const handleSubmit = (e) => {
    e.preventDefault();
    setLoading(true);
    
    // Create mailto link
    const subject = encodeURIComponent('Customer Support Request');
    const body = encodeURIComponent(`Name: ${formData.name}\nPhone Number: ${formData.phone}\nIssue / Concern:\n${formData.issue}`);
    window.location.href = `mailto:mendozajakong@gmail.com?subject=${subject}&body=${body}`;

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
          <h2>Chat Customer Support</h2>
          <p>We are here to help you</p>
        </div>
      </header>
      <main className="info-page-container" style={{ background: 'white', padding: '32px', borderRadius: '16px', marginTop: '-32px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', position: 'relative', zIndex: 1 }}>
        {step === 1 ? (
          <>
            <div className="verification-intro">
              <MessageSquare size={48} className="text-primary" style={{ margin: '0 auto', display: 'block' }} />
              <h3>Contact Support</h3>
              <p>Please fill up the form below and we will get back to you as soon as possible.</p>
            </div>
            <form onSubmit={handleSubmit} className="verification-form">
              <div className="input-group" style={{ marginBottom: '16px' }}>
                <input type="text" placeholder="Your Name" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid var(--border)', outline: 'none' }} />
              </div>
              <div className="input-group" style={{ marginBottom: '16px' }}>
                <input type="tel" placeholder="Phone Number" required value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid var(--border)', outline: 'none' }} />
              </div>
              <div className="input-group" style={{ marginBottom: '16px' }}>
                <textarea placeholder="Issue / Concern" rows={5} required value={formData.issue} onChange={e => setFormData({...formData, issue: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid var(--border)', fontFamily: 'inherit', outline: 'none' }}></textarea>
              </div>
              <button type="submit" className="submit-btn" disabled={loading} style={{marginTop: '8px', width: '100%', padding: '14px', borderRadius: '12px', fontSize: '1.05rem', fontWeight: '600', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', background: 'var(--primary)', color: 'white', border: 'none', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(0, 51, 102, 0.2)'}}>
                {loading ? <><Loader2 size={20} className="animate-spin" /> Opening Email...</> : <><Send size={20} /> Send to Support</>}
              </button>
            </form>
          </>
        ) : (
          <div className="verification-success">
            <CheckCircle2 size={64} className="text-secondary" style={{ margin: '0 auto 16px', display: 'block' }} />
            <h3>Request Sent!</h3>
            <p>Your email client was opened to send the support ticket. We will respond to your query shortly.</p>
            <button className="submit-btn" onClick={onDone} style={{marginTop: '16px', width: '100%', padding: '14px', borderRadius: '12px', fontSize: '1.05rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', background: 'var(--secondary)', color: 'var(--primary)', border: 'none', cursor: 'pointer', transition: 'all 0.3s ease', boxShadow: '0 4px 15px rgba(255, 215, 0, 0.2)'}}>
              <CheckCircle2 size={20} /> Return Home
            </button>
          </div>
        )}
      </main>
    </div>
  );
};

export default CustomerSupportPage;
