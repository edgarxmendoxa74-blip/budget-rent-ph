import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { isAdminEmail } from '../lib/admin';
import { Mail, Lock, Shield, Loader2, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import './Auth.css'; // Reusing some auth styles

const REMEMBER_KEY = 'budgetrent_admin_email';

// Email lang ang sine-save sa device; ang password ay hawak ng password manager ng browser (hindi plain text sa app)
const readSavedEmail = () => { try { return localStorage.getItem(REMEMBER_KEY) || ''; } catch { return ''; } };

const AdminLogin = ({ onLoginSuccess, onBack }) => {
  const [email, setEmail] = useState(readSavedEmail);
  const [remember, setRemember] = useState(() => Boolean(readSavedEmail()));
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showPassword, setShowPassword] = useState(false);

  // Hilingin sa browser na i-save ang password (Chrome/Edge); sa iba, gumagana ang normal na save prompt
  const savePassword = async () => {
    try {
      if (window.PasswordCredential && navigator.credentials?.store) {
        await navigator.credentials.store(new window.PasswordCredential({ id: email, password, name: 'Admin' }));
      }
    } catch { /* hindi suportado — okay lang */ }
  };

  const rememberEmail = () => {
    try {
      if (remember) localStorage.setItem(REMEMBER_KEY, email.trim());
      else localStorage.removeItem(REMEMBER_KEY);
    } catch { /* ignore */ }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Allow specific admin emails
      const isLegacyBypassEmail = email === 'admin@budgetrent.ph' || email === 'mendozajakong@gmail.com';

      // DEVELOPMENT BYPASS: If credentials match hardcoded, skip Supabase Auth for quick access
      if (isLegacyBypassEmail && password === 'admin123') {
        localStorage.setItem('budgetrent_admin_bypass', 'true');
        rememberEmail();
        if (remember) await savePassword();
        onLoginSuccess();
        return;
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      if (!isAdminEmail(data.user.email)) {
        await supabase.auth.signOut();
        throw new Error('This account does not have administrative privileges.');
      }

      rememberEmail();
      if (remember) await savePassword();
      onLoginSuccess();
    } catch (err) {
      setError(err.message + ". (Check your Email/Password)");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container admin-login-page">
      <div className="auth-card animate-fade-in text-center">
        <div className="auth-header">
          <div className="auth-logo">
            <img src="/logo.png" alt="BudgetRentPH" style={{ width: '70px', height: '70px', objectFit: 'contain', margin: '0 auto 12px' }} />
          </div>
          <h2>Admin Portal</h2>
          <p>Sign in to access the management dashboard.</p>
        </div>

        <form onSubmit={handleLogin} className="auth-form" autoComplete="on">
          <div className="input-group">
            <Mail size={20} className="input-icon" />
            <input
              type="email"
              name="email"
              autoComplete="username"
              placeholder="Admin Email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="input-group">
            <Lock size={20} className="input-icon" />
            <input
              type={showPassword ? "text" : "password"}
              name="password"
              autoComplete="current-password"
              placeholder="Master Password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.88rem', color: 'var(--text-muted)', cursor: 'pointer', textAlign: 'left' }}>
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} style={{ width: 16, height: 16, margin: 0 }} />
            Save email &amp; password sa device na ito
          </label>

          {error && <div className="auth-error">{error}</div>}

          <button type="submit" className="auth-submit-btn" disabled={loading}>
            {loading ? <Loader2 className="animate-spin" /> : 'Enter Dashboard'}
          </button>

          <button type="button" className="auth-back-btn" onClick={onBack}>
            <ArrowLeft size={16} /> Back to Main Site
          </button>
        </form>


      </div>
    </div>
  );
};

export default AdminLogin;
