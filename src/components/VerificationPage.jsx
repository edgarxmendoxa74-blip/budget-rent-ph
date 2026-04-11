import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Upload, ShieldCheck, CheckCircle2, ArrowLeft, Send, Loader2 } from 'lucide-react';

const VerificationPage = ({ onDone, session }) => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
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
      
      // Also open email as backup/fallback if user wants
      const subject = encodeURIComponent('Landlord Verification Request');
      const body = encodeURIComponent(`Name: ${formData.fullName}\nProperty Name: ${formData.propertyName}\nContact Number: ${formData.phone}\nMessage: ${formData.message}`);
      // window.location.href = `mailto:edgarmendoxa74@gmail.com?subject=${subject}&body=${body}`;

      setStep(2);
    } catch (error) {
      console.error('Error submitting verification:', error);
      alert(`Error: ${error.message || 'Please make sure verification_requests table exists in your Supabase database.'}`);
    } finally {
      setLoading(false);
    }
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
              <button type="submit" className="submit-btn" disabled={loading} style={{marginTop: '8px', width: '100%', padding: '14px', borderRadius: '12px', fontSize: '1.05rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', background: 'var(--primary)', color: 'white', border: 'none', cursor: 'pointer', transition: 'all 0.3s ease', boxShadow: '0 4px 15px rgba(0, 51, 102, 0.2)'}}>
                {loading ? <><Loader2 size={20} className="animate-spin" /> Submitting...</> : <><Send size={20} /> Submit</>}
              </button>
            </form>
          </>
        ) : (
          <div className="verification-success">
            <CheckCircle2 size={64} className="text-secondary" style={{ margin: '0 auto 16px', display: 'block' }} />
            <h3>Submission Successful!</h3>
            <p>Our team will review your documents within 24-48 hours. You will receive an email once your account is verified.</p>
            <button className="submit-btn" onClick={onDone} style={{marginTop: '16px', width: '100%', padding: '14px', borderRadius: '12px', fontSize: '1.05rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', background: 'var(--secondary)', color: 'var(--primary)', border: 'none', cursor: 'pointer', transition: 'all 0.3s ease', boxShadow: '0 4px 15px rgba(255, 215, 0, 0.2)'}}>
              <CheckCircle2 size={20} /> Done
            </button>
          </div>
        )}
      </main>
    </div>
  );
};

export default VerificationPage;
