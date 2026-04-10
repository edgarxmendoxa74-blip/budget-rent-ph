import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Mail, Lock, User, ArrowRight, Loader2, Building2, Users, Phone, MessageCircle, Globe } from 'lucide-react';
import './Auth.css';

const Auth = ({ onAuthSuccess }) => {
  const [view, setView] = useState('tenant'); // 'tenant' or 'landlord'
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
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
          </div>
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
              type="password"
              name="password"
              placeholder="Password"
              required
              value={formData.password}
              onChange={handleInputChange}
            />
          </div>

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
