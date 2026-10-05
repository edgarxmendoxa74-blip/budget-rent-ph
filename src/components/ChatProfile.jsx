import React from 'react';
import { X, Phone, Mail, Link2, MessageCircle, Briefcase, Store, CalendarDays, BadgeCheck } from 'lucide-react';
import { initialsOf } from '../lib/chatProfiles';
import { normalizeFacebook, workStatusLabel } from '../lib/tenantAuth';
import './ChatProfile.css';

// Maliit na avatar na puwedeng pindutin: Budi (gold) para sa tenant, larawan o initials (navy) para sa landlord
export const ChatAvatar = ({ profile, size = 30, onClick }) => {
  const isTenant = profile?.role === 'tenant';
  const label = `${profile?.name || 'Account'} — view account details`;
  return (
    <button
      type="button"
      className={`chatav ${isTenant ? 'tenant' : 'landlord'}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      {isTenant
        ? <span className="chatav-emoji" style={{ fontSize: Math.round(size * 0.58) }}>🐻</span>
        : /^https:\/\//.test(profile?.avatar || '')
          ? <img src={profile.avatar} alt="" loading="lazy" referrerPolicy="no-referrer" />
          : initialsOf(profile?.name)}
    </button>
  );
};

const prettyDate = (s) => {
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' });
};

const digits = (v) => String(v || '').replace(/[^\d+]/g, '');

// Account details ng kausap (o ng sarili) — lumalabas sa loob ng chat
export const ProfileSheet = ({ profile, isMe, onClose }) => {
  if (!profile) return null;
  const isTenant = profile.role === 'tenant';
  const fb = normalizeFacebook(profile.facebook);
  const phone = digits(profile.phone);
  const wa = digits(profile.whatsapp).replace(/^\+/, '').replace(/^0/, '63');
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email || '');

  const rows = [
    profile.business && { Icon: Store, label: 'Business name', value: profile.business },
    profile.phone && { Icon: Phone, label: 'Mobile number', value: profile.phone, href: phone ? `tel:${phone}` : null },
    emailOk && { Icon: Mail, label: 'Email', value: profile.email, href: `mailto:${profile.email}` },
    fb && { Icon: Link2, label: 'Facebook', value: fb.replace(/^https:\/\/www\.facebook\.com\//, ''), href: fb, external: true },
    wa.length >= 10 && { Icon: MessageCircle, label: 'WhatsApp', value: profile.whatsapp, href: `https://wa.me/${wa}`, external: true },
    profile.workStatus && { Icon: Briefcase, label: 'Work status', value: workStatusLabel(profile.workStatus) },
    profile.memberSince && prettyDate(profile.memberSince) && { Icon: CalendarDays, label: 'Member since', value: prettyDate(profile.memberSince) }
  ].filter(Boolean);

  return (
    <div className="cprof-overlay" onClick={onClose}>
      <div className="cprof animate-slide-up" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Account details">
        <button type="button" className="cprof-close" aria-label="Close" onClick={onClose}><X size={18} /></button>
        <div className="cprof-head">
          <ChatAvatar profile={profile} size={76} onClick={() => {}} />
          <h3>{profile.name}{isMe ? ' (You)' : ''}</h3>
          <span className={`cprof-role ${isTenant ? 'tenant' : 'landlord'}`}>
            {isTenant ? 'Tenant' : (profile.host ? 'Host' : 'Landlord')}
            {profile.verified && <em><BadgeCheck size={13} /> Verified</em>}
          </span>
        </div>

        {rows.length === 0 ? (
          <p className="cprof-empty">No more details to show.</p>
        ) : (
          <ul className="cprof-list">
            {rows.map((row) => {
              const { label, value, href, external } = row;
              const RowIcon = row.Icon;
              return (
              <li key={label}>
                <span className="cprof-icon"><RowIcon size={16} /></span>
                <div>
                  <small>{label}</small>
                  {href
                    ? <a href={href} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>{value}</a>
                    : <strong>{value}</strong>}
                </div>
              </li>
              );
            })}
          </ul>
        )}
        <p className="cprof-note">Shown only to people in this booking conversation.</p>
      </div>
    </div>
  );
};
