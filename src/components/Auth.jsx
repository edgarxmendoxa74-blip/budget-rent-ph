import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Mail, Lock, User, ArrowRight, Loader2, Building2, Users, Phone, MessageCircle, Globe, X, Heart, Eye, EyeOff } from 'lucide-react';
import './Auth.css';

const Auth = ({ onAuthSuccess }) => {
  const [view, setView] = useState('tenant'); // 'tenant' or 'landlord'
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [termsAgreed, setTermsAgreed] = useState(false);
  const [isHowToUseOpen, setIsHowToUseOpen] = useState(false);
  const [howToUseTab, setHowToUseTab] = useState('tenant');
  const [showPassword, setShowPassword] = useState(false);
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    fullName: '',
    phone: '',
    propertyName: '',
    socialLink: '',
    whatsapp: ''
  });

  const handleLandlordAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email: formData.email,
          password: formData.password,
        });
        if (error) throw error;
      } else {
        if (!termsAgreed) {
          throw new Error('You must agree to the Terms and Policies to register.');
        }
        const { error } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: {
            data: {
              full_name: formData.fullName,
              phone: formData.phone,
              property_name: formData.propertyName,
              social_link: formData.socialLink,
              whatsapp: formData.whatsapp,
              user_role: 'landlord'
            }
          }
        });
        if (error) throw error;
        alert('Landlord Account Created! Please verify your email.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  if (view === 'tenant') {
    return (
      <div className="auth-container">
        <div className="auth-card animate-fade-in text-center">
          <div className="auth-header">
            <div className="auth-logo">
              <img src="/logo.png" alt="BudgetRentPH" />
            </div>
            <h2>Welcome!</h2>
            <p>Mag-explore ng mga abot-kayang boarding houses at bedspace dito sa Pilipinas.</p>
          </div>

          <div className="auth-choice-grid">
            <button className="auth-submit-btn" onClick={onAuthSuccess}>
              Enter as Tenant
            </button>
            <button className="auth-submit-btn secondary" onClick={() => setView('landlord')}>
              Enter as Landlord
            </button>
          </div>

          <div className="auth-footer">
            <p>Simpleng paghahanap, mabilis na matutuluyan.</p>
            <button 
              className="how-to-use-btn" 
              onClick={() => setIsHowToUseOpen(true)}
              style={{ marginTop: '16px', width: '100%', padding: '12px', borderRadius: '12px', border: '1.5px solid var(--primary)', background: 'transparent', color: 'var(--primary)', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            >
              <Users size={18} /> Paano Gamitin?
            </button>
          </div>

          {isHowToUseOpen && (
            <div className="modal-overlay" style={{ zIndex: 1000 }} onClick={() => setIsHowToUseOpen(false)}>
              <div className="modal-content animate-slide-up" style={{ padding: '24px', maxWidth: '400px' }} onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <h3 style={{ margin: 0, color: 'var(--primary)' }}>Paano Gamitin?</h3>
                  <button onClick={() => setIsHowToUseOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={24} /></button>
                </div>

                <div className="how-to-use-tabs" style={{ display: 'flex', gap: '8px', marginBottom: '20px', background: '#f1f5f9', padding: '4px', borderRadius: '12px' }}>
                  <button 
                    style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', background: howToUseTab === 'tenant' ? 'white' : 'transparent', fontWeight: 'bold', color: howToUseTab === 'tenant' ? 'var(--primary)' : 'var(--text-muted)', cursor: 'pointer', boxShadow: howToUseTab === 'tenant' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none' }}
                    onClick={() => setHowToUseTab('tenant')}
                  >
                    Tenant
                  </button>
                  <button 
                    style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', background: howToUseTab === 'landlord' ? 'white' : 'transparent', fontWeight: 'bold', color: howToUseTab === 'landlord' ? 'var(--primary)' : 'var(--text-muted)', cursor: 'pointer', boxShadow: howToUseTab === 'landlord' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none' }}
                    onClick={() => setHowToUseTab('landlord')}
                  >
                    Landlord
                  </button>
                </div>

                {howToUseTab === 'tenant' ? (
                  <ul style={{ paddingLeft: '20px', fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: '1.8' }}>
                    <li><strong>Mag-browse:</strong> Humanap ng mga murang boarding house, bedspace, at studio apartment malapit sa iyong target location.</li>
                    <li><strong>Nearby Search:</strong> Gamitin ang "Nearby" tab para makita ang mga listings na pinakamalapit sa iyong kasalukuyang pwesto.</li>
                    <li><strong>Inquire Now:</strong> I-click ang button para direktang makatawag o makapag-email sa property owner.</li>
                    <li><strong>Verified Badge:</strong> Humanap ng <BadgeCheck size={14} style={{ display: 'inline', color: '#0066ff' }} /> icon para makasiguro na ang landlord ay dumaan sa aming validation.</li>
                  </ul>
                ) : (
                  <ul style={{ paddingLeft: '20px', fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: '1.8' }}>
                    <li><strong>Register:</strong> Gumawa ng Landlord account para makapagsimulang mag-post ng iyong mga paupahan.</li>
                    <li><strong>Easy Post:</strong> I-click ang <strong>(+)</strong> button at ilagay ang kumpletong detalye at magagandang litrato ng iyong property.</li>
                    <li><strong>Manage Tabs:</strong> Gamitin ang <strong>"My Listings"</strong> para sa mabilis na pag-edit o pag-update ng impormasyon.</li>
                    <li><strong>Be Verified:</strong> I-click ang <strong>"Get Verified"</strong> sa menu para mapataas ang tiwala ng mga customers sa iyong mga post.</li>
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <div className="auth-card animate-fade-in text-center">
        <div className="auth-header">
          <div className="auth-logo">
            <img src="/logo.png" alt="BudgetRentPH" />
          </div>
          <h2>Landlord Portal</h2>
          <p>{isLogin ? 'Manage your property listings.' : 'Simulan ang pagpapa-renta dito.'}</p>
        </div>

        <form onSubmit={handleLandlordAuth} className="auth-form">
          {!isLogin && (
            <>
              <div className="input-group">
                <User size={20} className="input-icon" />
                <input
                  type="text"
                  name="fullName"
                  placeholder="Owner / Full Name"
                  required
                  value={formData.fullName}
                  onChange={handleInputChange}
                />
              </div>
              <div className="input-group">
                <Phone size={20} className="input-icon" />
                <input
                  type="tel"
                  name="phone"
                  placeholder="Contact Number"
                  required
                  value={formData.phone}
                  onChange={handleInputChange}
                />
              </div>
              <div className="input-group">
                <Building2 size={20} className="input-icon" />
                <input
                  type="text"
                  name="propertyName"
                  placeholder="Business / Property Name"
                  required
                  value={formData.propertyName}
                  onChange={handleInputChange}
                />
              </div>
              
              <div className="input-group">
                <Globe size={20} className="input-icon" />
                <input
                  type="url"
                  name="socialLink"
                  placeholder="FB / IG Link"
                  value={formData.socialLink}
                  onChange={handleInputChange}
                />
              </div>

              <div className="input-group">
                <MessageCircle size={20} className="input-icon" />
                <input
                  type="tel"
                  name="whatsapp"
                  placeholder="WhatsApp Number"
                  value={formData.whatsapp}
                  onChange={handleInputChange}
                />
              </div>
            </>
          )}

          <div className="input-group">
            <Mail size={20} className="input-icon" />
            <input
              type="email"
              name="email"
              placeholder="Email Address"
              required
              value={formData.email}
              onChange={handleInputChange}
            />
          </div>

          <div className="input-group">
            <Lock size={20} className="input-icon" />
            <input
              type={showPassword ? "text" : "password"}
              name="password"
              placeholder="Password"
              required
              value={formData.password}
              onChange={handleInputChange}
            />
            <button 
              type="button" 
              className="password-toggle" 
              onClick={() => setShowPassword(!showPassword)}
              style={{ background: 'none', border: 'none', position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {!isLogin && (
            <div className="terms-checkbox-group" style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '8px 0 16px', textAlign: 'left', fontSize: '0.85rem' }}>
              <input 
                type="checkbox" 
                id="termsAgreed" 
                checked={termsAgreed}
                onChange={(e) => setTermsAgreed(e.target.checked)}
                required
              />
              <label htmlFor="termsAgreed" style={{ color: 'var(--text-muted)' }}>
                I agree to the <strong style={{ color: 'var(--primary)' }}>Terms and Policies</strong>
              </label>
            </div>
          )}

          {error && <div className="auth-error">{error}</div>}

          <button type="submit" className="auth-submit-btn landlord" disabled={loading}>
            {loading ? <Loader2 className="animate-spin" /> : (isLogin ? 'Sign In as Landlord' : 'Gumawa ng Account')}
          </button>

          <button type="button" className="auth-back-btn" onClick={() => setView('tenant')}>
            Bumalik sa Tenant View
          </button>
        </form>

        <div className="auth-footer">
          {isLogin ? (
            <p>Wala ka pang landlord account? <button onClick={() => setIsLogin(false)}>Mag-register na</button></p>
          ) : (
            <p>Meron ka na bang account? <button onClick={() => setIsLogin(true)}>Mag-login na</button></p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Auth;
