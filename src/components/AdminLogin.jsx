import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Mail, Lock, Shield, Loader2, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import './Auth.css'; // Reusing some auth styles

const AdminLogin = ({ onLoginSuccess, onBack }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Allow specific admin emails
      const isAdminEmail = email === 'admin@budgetrent.ph' || email === 'mendozajakong@gmail.com';

      // DEVELOPMENT BYPASS: If credentials match hardcoded, skip Supabase Auth for quick access
      if (isAdminEmail && password === 'admin123') {
        localStorage.setItem('budgetrent_admin_bypass', 'true');
        onLoginSuccess();
        return;
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      if (data.user.email !== 'admin@budgetrent.ph' && data.user.email !== 'mendozajakong@gmail.com') {
        await supabase.auth.signOut();
        throw new Error('This account does not have administrative privileges.');
      }

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
            <Shield className="text-primary" size={48} style={{ margin: '0 auto 16px' }} />
          </div>
          <h2>Admin Portal</h2>
          <p>Sign in to access the management dashboard.</p>
        </div>

        <form onSubmit={handleLogin} className="auth-form">
          <div className="input-group">
            <Mail size={20} className="input-icon" />
            <input
              type="email"
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
