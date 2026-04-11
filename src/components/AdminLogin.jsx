import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Mail, Lock, Shield, Loader2, ArrowLeft } from 'lucide-react';
import './Auth.css'; // Reusing some auth styles

const AdminLogin = ({ onLoginSuccess, onBack }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // DEVELOPMENT BYPASS: If Supabase auth fails, but credentials match the hardcoded ones
      // we allow access for development/demo purposes.
      if (email === 'admin@budgetrent.ph' && password === 'admin123') {
        console.log('Dev Login Triggered');
        localStorage.setItem('budgetrent_admin_bypass', 'true');
        onLoginSuccess();
        return;
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      if (data.user.email !== 'admin@budgetrent.ph') {
        await supabase.auth.signOut();
        throw new Error('This account does not have administrative privileges.');
      }

      onLoginSuccess();
    } catch (err) {
      setError(err.message + ". (Dev Tip: Try admin@budgetrent.ph / admin123)");
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
              type="password"
              placeholder="Master Password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && <div className="auth-error">{error}</div>}

          <button type="submit" className="auth-submit-btn" disabled={loading}>
            {loading ? <Loader2 className="animate-spin" /> : 'Enter Dashboard'}
          </button>

          <button type="button" className="auth-back-btn" onClick={onBack}>
            <ArrowLeft size={16} /> Back to Main Site
          </button>
        </form>

        <div className="auth-footer admin-creds" style={{ marginTop: '30px', padding: '15px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '12px' }}>
          <h4 style={{ color: '#92400e', fontSize: '0.85rem', marginBottom: '8px' }}>Admin Credentials:</h4>
          <p style={{ margin: '4px 0', fontSize: '0.8rem', color: '#b45309' }}>
            <strong>Email:</strong> admin@budgetrent.ph
          </p>
          <p style={{ margin: '4px 0', fontSize: '0.8rem', color: '#b45309' }}>
            <strong>Password:</strong> admin123
          </p>
          <p style={{ marginTop: '10px', fontSize: '0.75rem', color: '#d97706', fontStyle: 'italic' }}>
            * Note: This works even if the user is not yet created in Supabase (Dev Bypass).
          </p>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;
