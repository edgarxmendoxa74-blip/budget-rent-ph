import { isAdminEmail } from '../lib/admin';
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import { showBudiSplash } from '../lib/budiSplash';
import { signUpTenant, signInTenant, validateTenantSignup, WORK_STATUSES, workStatusLabel, NEW_TENANT_KEY } from '../lib/tenantAuth';
import { Mail, Lock, Cake, Briefcase, User, ArrowRight, Loader2, Building2, Phone, MessageCircle, Globe, X, Heart, Eye, EyeOff, BadgeCheck, Lightbulb, Search, MapPin, PlusCircle, UserPlus, Pencil, CheckCircle2 } from 'lucide-react';
import './Auth.css';

// Facebook page shown below the auth card (text only, not a link)
const FacebookPageNote = () => (
  <div className="auth-connect animate-fade-in">
    <div className="auth-connect-note">
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        <path fill="currentColor" d="M24 12.07C24 5.41 18.63 0 12 0S0 5.41 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.89v2.25h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07z" />
      </svg>
      <span>
        <small>Follow our FB page</small>
        <strong>BudgetRenthPh</strong>
      </span>
    </div>
  </div>
);

// Network failure (offline / nagpalit ng WiFi) → malinaw na mensahe imbes na "Failed to fetch"
const friendlyAuthError = (err) => {
  const msg = err?.message || '';
  if (/failed to fetch|network|load failed/i.test(msg)) {
    return 'No internet connection. Check your WiFi or mobile data, then try again.';
  }
  return msg;
};

const REMEMBER_EMAIL_KEY = 'budgetrent_landlord_email';
const TENANT_PHONE_KEY = 'budgetrent_tenant_phone';
const readRememberedPhone = () => {
  try { return localStorage.getItem(TENANT_PHONE_KEY) || ''; } catch { return ''; }
};
const readRememberedEmail = () => {
  try { return localStorage.getItem(REMEMBER_EMAIL_KEY) || ''; } catch { return ''; }
};

const Auth = ({ onAuthSuccess }) => {
  const [view, setView] = useState('tenant'); // 'tenant' or 'landlord'
  // Suggestion bago pumasok bilang tenant: null | 'denied' | 'off'
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [termsAgreed, setTermsAgreed] = useState(false);
  const [isHowToUseOpen, setIsHowToUseOpen] = useState(false);
  const [howToUseTab, setHowToUseTab] = useState('tenant');
  const [showPassword, setShowPassword] = useState(false);
  // Confirmation modal pagkatapos ng matagumpay na landlord sign up: { email, verified }
  const [signupSuccess, setSignupSuccess] = useState(null);
  // Email lang ang naaalala ng app (hindi ang password). Ang password ay hawak ng password manager ng browser/phone.
  const [rememberEmail, setRememberEmail] = useState(() => {
    try { return localStorage.getItem(REMEMBER_EMAIL_KEY) !== null; } catch { return false; }
  });

  // Lock page scroll and allow Escape to close while the guide is open
  useEffect(() => {
    if (!isHowToUseOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setIsHowToUseOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isHowToUseOpen]);
  
  // Tenant account: walang email — pangalan, number, birthday, work status, at password
  const [tenantLogin, setTenantLogin] = useState(true);
  const [tenantFormOpen, setTenantFormOpen] = useState(false); // lalabas lang ang tenant form pag pinindot ang "Enter as Tenant"
  const [tenantLoading, setTenantLoading] = useState(false);
  const [tenantError, setTenantError] = useState(null);
  const [tenantForm, setTenantForm] = useState(() => ({ fullName: '', phone: readRememberedPhone(), birthday: '', workStatus: '', password: '' }));
  // Number lang ang naaalala ng app (hindi ang password). Ang password ay hawak ng password manager ng browser/phone.
  const [rememberPhone, setRememberPhone] = useState(() => readRememberedPhone() !== '');
  const handleTenantChange = (e) => setTenantForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const [formData, setFormData] = useState({
    email: readRememberedEmail(),
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
      if (isAdminEmail(formData.email)) {
        throw new Error('This account is for the Admin Dashboard only and can\'t be used in the app.');
      }
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email: formData.email,
          password: formData.password,
        });
        if (error) throw error;
        showBudiSplash();
        try {
          if (rememberEmail) localStorage.setItem(REMEMBER_EMAIL_KEY, formData.email);
          else localStorage.removeItem(REMEMBER_EMAIL_KEY);
        } catch { /* private mode: okay lang */ }
        // Hilingin sa browser na i-save ang password (Chrome/Edge/Android). Hindi ito sine-save ng app.
        try {
          if (window.PasswordCredential && navigator.credentials?.store) {
            await navigator.credentials.store(new window.PasswordCredential({ id: formData.email, password: formData.password, name: formData.email }));
          }
        } catch { /* hindi suportado */ }
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
        
        setSignupSuccess({ email: formData.email, verified: Boolean(data?.user?.email_confirmed_at) });
      }
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const howToUseSteps = {
    tenant: [
      { icon: Search, title: 'Browse', desc: 'Explore listings of affordable boarding houses, bedspaces, and studio apartments across the Philippines.' },
      { icon: MapPin, title: 'Nearby Search', desc: 'Tap the "Nearby" tab to see the rentals closest to your current location.' },
      { icon: Phone, title: 'Inquire Now', desc: 'Tap the "Inquire Now" button to call or message the property owner directly.' },
      { icon: BadgeCheck, title: 'Verified Badge', desc: 'Look for this badge to make sure the landlord has been validated.' },
    ],
    landlord: [
      { icon: UserPlus, title: 'Register', desc: 'Create a free Landlord account with your email to get started.' },
      { icon: PlusCircle, title: 'Post', desc: 'Tap the (+) button, then add complete details and clear photos of your rental.' },
      { icon: Pencil, title: 'Manage Listings', desc: 'Use "My Listings" to quickly edit, update, or delete your posts.' },
      { icon: BadgeCheck, title: 'Get Verified', desc: 'Tap "Get Verified" on your profile to build tenants\' trust in your posts.' },
    ],
  };

  // Mag-sign up / mag-login ang tenant. Kapag nag-login na, kusang papasok ang App.
  const handleTenantSubmit = async (e) => {
    e?.preventDefault();
    setTenantError(null);
    if (!tenantLogin) {
      const problem = validateTenantSignup(tenantForm);
      if (problem) return setTenantError(problem);
      if (!termsAgreed) return setTenantError('You must agree to the Terms and Policies to create an account.');
    } else if (!tenantForm.phone || !tenantForm.password) {
      return setTenantError('Please enter your mobile number and password.');
    }
    setTenantLoading(true);
    try {
      if (tenantLogin) {
        await signInTenant(tenantForm.phone, tenantForm.password);
        showBudiSplash();
      } else {
        try { sessionStorage.setItem(NEW_TENANT_KEY, '1'); } catch { /* private mode: okay lang */ }
        await signUpTenant(tenantForm);
      }
      try {
        if (rememberPhone) localStorage.setItem(TENANT_PHONE_KEY, tenantForm.phone);
        else localStorage.removeItem(TENANT_PHONE_KEY);
      } catch { /* private mode: okay lang */ }
      // Hilingin sa browser na i-save ang password (Chrome/Edge/Android). Hindi ito sine-save ng app.
      try {
        if (window.PasswordCredential && navigator.credentials?.store) {
          await navigator.credentials.store(new window.PasswordCredential({ id: tenantForm.phone, password: tenantForm.password, name: tenantForm.fullName || tenantForm.phone }));
        }
      } catch { /* hindi suportado */ }
      onAuthSuccess?.();
    } catch (err) {
      try { sessionStorage.removeItem(NEW_TENANT_KEY); } catch { /* ignore */ }
      setTenantError(friendlyAuthError(err));
    } finally {
      setTenantLoading(false);
    }
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
            <p className="auth-tagline">Affordable. Nearby. Trustworthy.</p>
            <p className="auth-sub">Find affordable boarding houses, bedspaces, and apartments near you.</p>
          </div>

          {!tenantFormOpen ? (
            <div className="auth-form">
              <button type="button" className="auth-submit-btn" onClick={() => setTenantFormOpen(true)}>
                <User size={19} strokeWidth={2.4} /> Enter as Tenant/Guest
              </button>
              <button type="button" className="auth-submit-btn secondary" onClick={() => setView('landlord')}>
                <Building2 size={19} strokeWidth={2.4} /> Log in as Landlord
              </button>
            </div>
          ) : (
          <>
          <form className="auth-form" onSubmit={handleTenantSubmit}>
            {!tenantLogin && (
              <>
                <div className="input-group">
                  <User size={20} className="input-icon" />
                  <input type="text" name="fullName" autoComplete="name" placeholder="Full name" maxLength={80} value={tenantForm.fullName} onChange={handleTenantChange} />
                </div>
              </>
            )}
            <div className="input-group">
              <Phone size={20} className="input-icon" />
              <input type="tel" name="phone" inputMode="tel" autoComplete="username" placeholder="Mobile number (09171234567)" maxLength={16} value={tenantForm.phone} onChange={handleTenantChange} />
            </div>
            {!tenantLogin && (
              <>
                <label className="auth-field-label" htmlFor="tenant-birthday">Birthday</label>
                <div className="input-group">
                  <Cake size={20} className="input-icon" />
                  <input id="tenant-birthday" type="date" name="birthday" max={new Date().toISOString().slice(0, 10)} value={tenantForm.birthday} onChange={handleTenantChange} />
                </div>
                <div className="input-group">
                  <Briefcase size={20} className="input-icon" />
                  <select name="workStatus" value={tenantForm.workStatus} onChange={handleTenantChange}>
                    <option value="">Work status</option>
                    {WORK_STATUSES.map((w) => <option key={w} value={w}>{workStatusLabel(w)}</option>)}
                  </select>
                </div>
              </>
            )}
            <div className="input-group">
              <Lock size={20} className="input-icon" />
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                autoComplete={tenantLogin ? 'current-password' : 'new-password'}
                placeholder="Password"
                value={tenantForm.password}
                onChange={handleTenantChange}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                style={{ background: 'none', border: 'none', position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {tenantLogin && (
              <div className="remember-row">
                <input type="checkbox" id="rememberPhone" checked={rememberPhone} onChange={(e) => setRememberPhone(e.target.checked)} />
                <label htmlFor="rememberPhone">Remember my number on this device</label>
              </div>
            )}

            {!tenantLogin && (
              <div className="terms-checkbox-group" style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '4px 0 8px', textAlign: 'left', fontSize: '0.85rem' }}>
                <input type="checkbox" id="tenantTermsAgreed" checked={termsAgreed} onChange={(e) => setTermsAgreed(e.target.checked)} />
                <label htmlFor="tenantTermsAgreed" style={{ color: 'var(--text-muted)' }}>
                  I agree to the <strong style={{ color: 'var(--primary)' }}>Terms and Policies</strong>
                </label>
              </div>
            )}

            {tenantError && <div className="auth-error">{tenantError}</div>}

            <button type="submit" className="auth-submit-btn" disabled={tenantLoading}>
              {tenantLoading ? <Loader2 size={19} className="animate-spin" /> : <User size={19} strokeWidth={2.4} />}
              {tenantLogin ? ' Log in as Tenant' : ' Create Tenant Account'}
            </button>
            <button type="button" className="auth-back-btn auth-back-btn-yellow" onClick={() => { setTenantFormOpen(false); setTenantError(null); }}>
              Back
            </button>
          </form>

          <div className="auth-footer">
            {tenantLogin ? (
              <p>Don't have an account yet? <button type="button" onClick={() => { setTenantLogin(false); setTenantError(null); }}>Sign up</button></p>
            ) : (
              <p>Already have an account? <button type="button" onClick={() => { setTenantLogin(true); setTenantError(null); }}>Log in</button></p>
            )}
            <p style={{ fontSize: '0.72rem' }}>No email needed — just your mobile number. One number, one account.</p>
          </div>
          </>
          )}

          <div className="auth-footer">
            <p>Simple search, quick move-in.</p>
            <button 
              className="how-to-use-btn" 
              onClick={() => setIsHowToUseOpen(true)}
            >
              <Lightbulb size={17} /> How to Use
            </button>
          </div>

          {/* Portal to body: .auth-card's backdrop-filter would otherwise trap the fixed overlay inside the card */}
          {isHowToUseOpen && createPortal(
            <div className="modal-overlay centered how-to-use-overlay" onClick={() => setIsHowToUseOpen(false)}>
              <div
                className="how-to-use-modal animate-slide-up"
                role="dialog"
                aria-modal="true"
                aria-labelledby="how-to-use-heading"
                onClick={e => e.stopPropagation()}
              >
                <div className="how-to-use-header">
                  <div className="how-to-use-icon">
                    <Lightbulb size={22} />
                  </div>
                  <div className="how-to-use-title">
                    <h3 id="how-to-use-heading">How to Use</h3>
                    <p>A quick guide to using BudgetRentPH</p>
                  </div>
                  <button type="button" className="how-to-use-close" onClick={() => setIsHowToUseOpen(false)} aria-label="Close">
                    <X size={20} />
                  </button>
                </div>

                <div className="how-to-use-tabs">
                  <button
                    type="button"
                    className={howToUseTab === 'tenant' ? 'active' : ''}
                    onClick={() => setHowToUseTab('tenant')}
                  >
                    <Search size={15} /> Tenant
                  </button>
                  <button
                    type="button"
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

                <button type="button" className="how-to-use-done" onClick={() => setIsHowToUseOpen(false)}>
                  Got it, thanks!
                </button>
              </div>
            </div>,
            document.body
          )}
        </div>

        <FacebookPageNote />
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
          <p>{isLogin ? 'Manage your property listings.' : 'Start renting out your property here.'}</p>
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
              id="landlord-email"
              autoComplete="username"
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
              id="landlord-password"
              autoComplete={isLogin ? 'current-password' : 'new-password'}
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

          {isLogin && (
            <div className="remember-row">
              <input
                type="checkbox"
                id="rememberEmail"
                checked={rememberEmail}
                onChange={(e) => setRememberEmail(e.target.checked)}
              />
              <label htmlFor="rememberEmail">Remember my email on this device</label>
            </div>
          )}

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
            {loading ? <Loader2 className="animate-spin" /> : (isLogin ? 'Sign In as Landlord' : 'Create Account')}
          </button>

          <button type="button" className="auth-back-btn auth-back-btn-yellow" onClick={() => setView('tenant')}>
            Back to Tenant View
          </button>
        </form>

        <div className="auth-footer">
          {isLogin ? (
            <p>Don't have a landlord account yet? <button onClick={() => setIsLogin(false)}>Register now</button></p>
          ) : (
            <p>Already have an account? <button onClick={() => setIsLogin(true)}>Log in</button></p>
          )}
        </div>
      </div>

      {signupSuccess && createPortal(
        <div className="signup-success-overlay" role="dialog" aria-modal="true" aria-label="Account created">
          <div className="signup-success-card animate-slide-up">
            <span className="signup-success-icon"><CheckCircle2 size={44} strokeWidth={2.2} /></span>
            <h3>Sign up successful!</h3>
            {signupSuccess.verified ? (
              <p>Your email is verified and your Landlord account is ready. You can now log in.</p>
            ) : (
              <>
                <p>We sent a verification link to <strong>{signupSuccess.email}</strong>.</p>
                <p>Open the email and click the link to activate your account. Can't find it? Check your <b>Spam</b> folder too.</p>
              </>
            )}
            <button
              type="button"
              className="auth-submit-btn landlord"
              onClick={() => { setSignupSuccess(null); setIsLogin(true); setFormData((d) => ({ ...d, password: '' })); }}
            >
              OK, log in
            </button>
          </div>
        </div>,
        document.body
      )}

      <FacebookPageNote />
    </div>
  );
};

export default Auth;
