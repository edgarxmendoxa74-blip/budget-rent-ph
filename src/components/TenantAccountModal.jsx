import React from 'react';
import { createPortal } from 'react-dom';
import { X, Phone, Cake, Briefcase, CalendarDays, LogOut } from 'lucide-react';
import { workStatusLabel } from '../lib/tenantAuth';
import './TenantAccountModal.css';

const prettyDate = (s) => {
  if (!s) return '—';
  const d = new Date(s.length <= 10 ? `${s}T00:00:00` : s);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' });
};

const ageOf = (iso) => {
  const b = new Date(`${iso}T00:00:00`);
  if (!iso || Number.isNaN(b.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  if (now.getMonth() < b.getMonth() || (now.getMonth() === b.getMonth() && now.getDate() < b.getDate())) age -= 1;
  return age;
};

// My Account ng tenant: mga detalyeng inilagay niya sa sign up. Si Budi (emoji) ang avatar.
const TenantAccountModal = ({ user, onClose, onLogout }) => {
  const meta = user?.user_metadata || {};
  const phone = /^639\d{9}$/.test(meta.phone || '') ? `0${meta.phone.slice(2)}` : (meta.phone || '—');
  const age = ageOf(meta.birthday);

  const rows = [
    { Icon: Phone, label: 'Mobile number', value: phone },
    { Icon: Cake, label: 'Birthday', value: meta.birthday ? `${prettyDate(meta.birthday)}${age !== null ? ` (${age} years old)` : ''}` : '—' },
    { Icon: Briefcase, label: 'Work status', value: meta.work_status ? workStatusLabel(meta.work_status) : '—' },
    { Icon: CalendarDays, label: 'Member since', value: prettyDate(user?.created_at) }
  ];

  return createPortal(
    <div className="tacct-overlay" onClick={onClose}>
      <div className="tacct animate-slide-up" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="My Account">
        <button type="button" className="tacct-close" aria-label="Close" onClick={onClose}><X size={18} /></button>

        <div className="tacct-head">
          <span className="tacct-avatar" role="img" aria-label="Budi">🐻</span>
          <h3>{meta.full_name || 'Tenant'}</h3>
          <span className="tacct-role">Tenant</span>
        </div>

        <ul className="tacct-list">
          {rows.map((row) => {
            const RowIcon = row.Icon;
            return (
              <li key={row.label}>
                <span className="tacct-icon"><RowIcon size={16} /></span>
                <div>
                  <small>{row.label}</small>
                  <strong>{row.value}</strong>
                </div>
              </li>
            );
          })}
        </ul>

        <p className="tacct-note">These are the details you entered when you signed up. You log in with your mobile number (no email).</p>

        <button type="button" className="tacct-logout" onClick={onLogout}><LogOut size={16} /> Log Out</button>
      </div>
    </div>,
    document.body
  );
};

export default TenantAccountModal;
