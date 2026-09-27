import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import './EmailVerification.css';

/**
 * EmailVerificationHandler Component
 * Handles email verification when user clicks link from email
 * Shows status messages and redirects on success
 */
const EmailVerificationHandler = ({ onVerificationComplete }) => {
  const [verificationStatus, setVerificationStatus] = useState(null); // 'loading', 'success', 'error'
  const [message, setMessage] = useState('');
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    const checkEmailVerification = async () => {
      // Check if there's a token in URL (from email verification link)
      const params = new URLSearchParams(window.location.search);
      const token = params.get('token_hash');
      const type = params.get('type');

      // If this is an email verification link
      if (type === 'email' && token) {
        setShowModal(true);
        setVerificationStatus('loading');
        setMessage('Verifying your email address...');

        try {
          // Supabase automatically verifies when token is in URL
          // Just confirm the session
          const { data: { session }, error } = await supabase.auth.getSession();

          if (error) {
            throw error;
          }

          if (session?.user?.email_confirmed_at) {
            setVerificationStatus('success');
            setMessage('Your email has been verified successfully.');

            setTimeout(() => {
              if (onVerificationComplete) {
                onVerificationComplete(true);
              }
              window.history.replaceState({}, document.title, window.location.pathname);
              setShowModal(false);
            }, 4000);
          } else {
            setVerificationStatus('success');
            setMessage('Your verification link has been processed. You can now sign in.');
            setTimeout(() => {
              if (onVerificationComplete) {
                onVerificationComplete(true);
              }
              window.history.replaceState({}, document.title, window.location.pathname);
              setShowModal(false);
            }, 4000);
          }
        } catch (error) {
          console.error('Verification error:', error);
          setVerificationStatus('error');
          setMessage(`Verification failed: ${error.message}`);
        }
      }

      // Check if verified parameter is in URL (manual redirect handling)
      if (params.get('verified') === 'true') {
        setShowModal(true);
        setVerificationStatus('success');
        setMessage('Your email is now verified. You can sign in to your account.');

        setTimeout(() => {
          window.history.replaceState({}, document.title, window.location.pathname);
          setShowModal(false);
        }, 4000);
      }
    };

    checkEmailVerification();
  }, [onVerificationComplete]);

  if (!showModal) {
    return null;
  }

  return (
    <div className="ev-overlay">
      <div className="ev-card">
        <div className="ev-brand">
          <img src="/logo.png" alt="BudgetRentPH" />
          <span>Budget<em>Rent</em>PH</span>
        </div>

        {verificationStatus === 'loading' && (
          <>
            <div className="ev-icon loading">
              <Loader2 size={36} />
            </div>
            <h3>Verifying Email</h3>
            <p className="ev-message">{message}</p>
          </>
        )}

        {verificationStatus === 'success' && (
          <>
            <div className="ev-icon success">
              <CheckCircle size={40} />
            </div>
            <h3>Email Verified</h3>
            <p className="ev-message">{message}</p>

            <div className="ev-welcome-note">
              <strong>Congratulations! 🎉</strong>
              <p>
                Welcome to <strong style={{ display: 'inline', color: 'var(--primary)' }}>BudgetRentPH</strong>!
                Your account is officially verified. Explore affordable boarding houses, bed spaces,
                and staycation spots near you.
              </p>
            </div>

            <p className="ev-note">Taking you to the home page…</p>
          </>
        )}

        {verificationStatus === 'error' && (
          <>
            <div className="ev-icon error">
              <AlertCircle size={38} />
            </div>
            <h3>Verification Failed</h3>
            <p className="ev-message">{message}</p>
            <div className="ev-actions">
              <button className="ev-btn primary" onClick={() => setShowModal(false)}>
                Close
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default EmailVerificationHandler;
