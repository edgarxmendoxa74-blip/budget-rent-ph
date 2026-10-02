import React from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2 } from 'lucide-react';
import './WelcomeModal.css';

// Lumalabas pagkatapos mag-sign up ng tenant
const WelcomeModal = ({ name, phone, onClose }) => {
  const firstName = String(name || '').trim().split(/\s+/)[0];
  return createPortal(
    <div className="welcome-overlay" role="dialog" aria-modal="true" aria-label="Welcome">
      <div className="welcome-card animate-slide-up">
        <span className="welcome-icon"><CheckCircle2 size={46} strokeWidth={2.2} /></span>
        <h3>Congratulations{firstName ? `, ${firstName}` : ''}! 🎉</h3>
        <p className="welcome-lead">Your account is ready!</p>
        <p>Welcome to <strong>BudgetRentPH</strong>. You're all set to find rentals and staycations.</p>
        {phone && <p className="welcome-phone">Your mobile number: <strong>{phone}</strong><br />You'll use this to log in.</p>}
        <ul className="welcome-tips">
          <li>Turn on your phone's <b>Location</b> to see rentals near you and the route to get there.</li>
          <li>Tap <b>Book Here</b> on a listing to send a request.</li>
          <li>Owner replies will appear in your <b>Inbox</b>.</li>
        </ul>
        <button type="button" className="welcome-btn" onClick={onClose}>Let's go!</button>
      </div>
    </div>,
    document.body
  );
};

export default WelcomeModal;
