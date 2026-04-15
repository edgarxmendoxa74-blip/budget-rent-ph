import React, { useState } from 'react';
import { CheckCircle2, ArrowLeft, Send, Loader2, User, Phone, MessageSquare, Mail, Info } from 'lucide-react';

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
    
    // Using setTimeout to simulate processing before redirecting
    setTimeout(() => {
      window.location.href = `mailto:mendozajakong@gmail.com?subject=${subject}&body=${body}`;
      setLoading(false);
      setStep(2);
    }, 1200);
  };

  return (
    <div className="page-section animate-fade-in support-page-wrapper">
      <style>{`
        .support-page-wrapper {
          background-color: white;
        }
        .support-card {
          background: white;
          padding: 32px 24px;
          border-radius: 20px;
          margin-top: -40px;
          box-shadow: 0 10px 25px -5px rgba(0, 51, 102, 0.08);
          position: relative;
          z-index: 10;
          width: calc(100% - 32px);
          max-width: 460px;
          margin-left: auto;
          margin-right: auto;
          /* Border removed as per request */
        }
        .support-header {
          text-align: center;
          margin-bottom: 28px;
        }
        .support-header h3 {
          font-size: 1.4rem;
          color: var(--primary);
          margin-bottom: 8px;
        }
        .support-header p {
          color: var(--text-muted);
          font-size: 0.95rem;
          line-height: 1.5;
        }
        .styled-input-group {
          position: relative;
          margin-bottom: 20px;
        }
        .input-icon {
          position: absolute;
          left: 14px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--text-muted);
          pointer-events: none;
          transition: color 0.3s;
        }
        .styled-input-group:focus-within .input-icon {
          color: var(--primary);
        }
        .styled-input, .styled-textarea {
          width: 100%;
          padding: 14px 14px 14px 44px;
          border-radius: 14px;
          border: none; /* Border removed */
          outline: none;
          font-family: inherit;
          font-size: 1rem;
          background: #f1f5f9; /* Subtle background instead of border */
          transition: all 0.3s ease;
          color: var(--text-main);
        }
        .styled-input:focus, .styled-textarea:focus {
          background: white;
          box-shadow: 0 0 0 2px var(--primary); /* Subtle ring instead of border */
        }
        .styled-textarea {
          min-height: 120px;
          resize: vertical;
          padding-top: 14px;
        }
        .textarea-icon {
          top: 24px;
          transform: none;
        }
        .support-submit-btn {
          width: 100%;
          padding: 16px;
          border-radius: 14px;
          font-size: 1rem;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          background: var(--primary);
          color: white;
          border: none;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 4px 15px rgba(0, 51, 102, 0.15);
          margin-top: 8px;
        }
        .support-submit-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(0, 51, 102, 0.2);
          background: #004080;
        }
        .support-submit-btn:active {
          transform: translateY(0);
        }
        .success-box {
          text-align: center;
          padding: 20px 0;
        }
      `}</style>

      <header className="hero branding-hero">
        <div className="hero-content">
          <span className="branding-kicker">Help Center</span>
          <h2>Customer Support</h2>
          <p>Tell us how we can assist you today</p>
        </div>
      </header>

      <main className="support-card animate-slide-up">
        {step === 1 ? (
          <>
            <div className="support-header">
              <h3>Send a Message</h3>
              <p>Fill out the details below so our team can help.</p>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="styled-input-group">
                <User size={18} className="input-icon" />
                <input 
                  type="text" 
                  placeholder="Full Name" 
                  className="styled-input"
                  required 
                  value={formData.name} 
                  onChange={e => setFormData({...formData, name: e.target.value})} 
                />
              </div>

              <div className="styled-input-group">
                <Phone size={18} className="input-icon" />
                <input 
                  type="tel" 
                  placeholder="Contact Number" 
                  className="styled-input"
                  required 
                  value={formData.phone} 
                  onChange={e => setFormData({...formData, phone: e.target.value})} 
                />
              </div>

              <div className="styled-input-group">
                <MessageSquare size={18} className="input-icon textarea-icon" />
                <textarea 
                  placeholder="Describe your issue or concern..." 
                  className="styled-textarea"
                  rows={5} 
                  required 
                  value={formData.issue} 
                  onChange={e => setFormData({...formData, issue: e.target.value})}
                ></textarea>
              </div>

              <button type="submit" className="support-submit-btn" disabled={loading}>
                {loading ? <Loader2 size={20} className="animate-spin" /> : <Mail size={20} />}
                {loading ? ' Submitting...' : ' Submit Ticket'}
              </button>
            </form>
          </>
        ) : (
          <div className="success-box animate-fade-in">
            <CheckCircle2 size={64} color="#16a34a" style={{ margin: '0 auto 16px', display: 'block' }} />
            <h3>Request Processed!</h3>
            <p>Please check your email app to send the request.</p>
            <button className="support-submit-btn" onClick={onDone} style={{ background: 'var(--secondary)', color: 'var(--primary)', marginTop: '24px' }}>
              <ArrowLeft size={20} /> Back to Dashboard
            </button>
          </div>
        )}
      </main>
    </div>
  );
};

export default CustomerSupportPage;

