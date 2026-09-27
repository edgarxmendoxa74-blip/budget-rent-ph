import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Mail, Lock, User, ArrowRight, Loader2, Building2, Phone, MessageCircle, Globe, X, Heart, Eye, EyeOff, BadgeCheck, Lightbulb, Search, MapPin, PlusCircle, UserPlus, Pencil } from 'lucide-react';
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
        const { data, error } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: {
            emailRedirectTo: `${window.location.origin}?verified=true`,
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
        
        // Check if email confirmation is required
        if (data?.user?.identities?.length === 0) {
          throw new Error('User already exists with this email.');
        }
        
        if (data?.user?.email_confirmed_at === null && data?.user?.confirmation_sent_at) {
          alert('✅ Verification email sent! Please check your inbox and click the link to confirm your email.');
        } else if (data?.user?.email_confirmed_at) {
          alert('✅ Account created and email verified! You can now login.');
        } else {
          alert('✅ Account created! Please verify your email.');
        }
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

  const howToUseSteps = {
    tenant: [
      { icon: Search, title: 'Mag-browse', desc: 'Tingnan ang mga listahan ng murang boarding house, bedspace, at studio apartment sa buong Pilipinas.' },
      { icon: MapPin, title: 'Nearby Search', desc: 'I-tap ang "Nearby" tab para makita ang mga paupahan na pinakamalapit sa iyong kasalukuyang pwesto.' },
      { icon: Phone, title: 'Inquire Now', desc: 'I-tap ang "Inquire Now" button para direktang tumawag o mag-message sa property owner.' },
      { icon: BadgeCheck, title: 'Verified Badge', desc: 'Hanapin ang badge na ito para makasiguro na dumaan sa validation ang landlord.' },
    ],
    landlord: [
      { icon: UserPlus, title: 'Mag-register', desc: 'Gumawa ng libreng Landlord account gamit ang iyong email para makapagsimula.' },
      { icon: PlusCircle, title: 'Mag-post', desc: 'I-tap ang (+) button, tapos ilagay ang kumpletong detalye at malinaw na litrato ng iyong paupahan.' },
      { icon: Pencil, title: 'I-manage ang Listings', desc: 'Gamitin ang "My Listings" para mabilis na i-edit, i-update, o tanggalin ang iyong mga post.' },
      { icon: BadgeCheck, title: 'Maging Verified', desc: 'I-tap ang "Get Verified" sa profile para tumaas ang tiwala ng mga tenant sa iyong mga post.' },
    ],
  };

  if (view === 'tenant') {
    return (
      <div className="auth-container">
        <div className="auth-card animate-fade-in text-center">
          <div className="auth-header">
            <div className="auth-logo">
              <img src="/logo.png" alt="BudgetRentPH" />
            </div>
            <h2>BudgetRentPH</h2>
            <p className="auth-tagline">Mura. Malapit. Mapagkakatiwalaan.</p>
            <p className="auth-sub">Mag-explore ng mga abot-kayang boarding houses at bedspace dito sa Pilipinas.</p>
          </div>

          <div className="auth-choice-grid">
            <button className="auth-submit-btn" onClick={onAuthSuccess}>
              <User size={19} strokeWidth={2.4} /> Enter as Tenant
            </button>
            <button className="auth-submit-btn secondary" onClick={() => setView('landlord')}>
              <Building2 size={19} strokeWidth={2.4} /> Enter as Landlord
            </button>
          </div>

          <div className="auth-footer">
            <p>Simpleng paghahanap, mabilis na matutuluyan.</p>
            <button 
              className="how-to-use-btn" 
              onClick={() => setIsHowToUseOpen(true)}
            >
              <Lightbulb size={17} /> Paano Gamitin?
            </button>
          </div>

          {isHowToUseOpen && (
            <div className="modal-overlay centered" style={{ zIndex: 1000 }} onClick={() => setIsHowToUseOpen(false)}>
              <div className="how-to-use-modal animate-slide-up" onClick={e => e.stopPropagation()}>
                <div className="how-to-use-header">
                  <div className="how-to-use-icon">
                    <Lightbulb size={22} />
                  </div>
                  <div className="how-to-use-title">
                    <h3>Paano Gamitin?</h3>
                    <p>Mabilis na gabay sa paggamit ng BudgetRentPH</p>
                  </div>
                  <button className="how-to-use-close" onClick={() => setIsHowToUseOpen(false)} aria-label="Isara">
                    <X size={20} />
                  </button>
                </div>

                <div className="how-to-use-tabs">
                  <button 
                    className={howToUseTab === 'tenant' ? 'active' : ''}
                    onClick={() => setHowToUseTab('tenant')}
                  >
                    <Search size={15} /> Tenant
                  </button>
                  <button 
                    className={howToUseTab === 'landlord' ? 'active' : ''}
                    onClick={() => setHowToUseTab('landlord')}
                  >
                    <Building2 size={15} /> Landlord
                  </button>
                </div>

                <div className="how-to-use-steps">
                  {howToUseSteps[howToUseTab].map((step, index) => {
                    const StepIcon = step.icon;
                    return (
                      <div className="how-to-use-step" key={step.title}>
                        <div className="step-badge">{index + 1}</div>
                        <div className="step-icon"><StepIcon size={18} /></div>
                        <div className="step-body">
                          <strong>{step.title}</strong>
                          <p>{step.desc}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <button className="how-to-use-done" onClick={() => setIsHowToUseOpen(false)}>
                  Naintindihan, Salamat!
                </button>
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

          <button type="button" className="auth-back-btn auth-back-btn-yellow" onClick={() => setView('tenant')}>
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
