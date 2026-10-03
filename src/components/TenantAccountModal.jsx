import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Phone, Cake, Briefcase, CalendarDays, LogOut, Link2, Pencil, Lock, Loader2, BadgeCheck, Check } from 'lucide-react';
import { workStatusLabel, WORK_STATUSES, nextProfileEditDate, normalizeFacebook, updateTenantProfile } from '../lib/tenantAuth';
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

const fbLabel = (url) => String(url || '').replace(/^https?:\/\/(www\.)?facebook\.com\//i, '');

// My Account ng tenant: mga detalyeng inilagay niya sa sign up. Si Budi (emoji) ang avatar.
// Puwedeng i-edit ang profile (pangalan, birthday, work status, Facebook) — isang beses lang kada buwan.
const TenantAccountModal = ({ user, onClose, onLogout, onGetVerified, verifiedUntil }) => {
  const meta = user?.user_metadata || {};
  const phone = /^639\d{9}$/.test(meta.phone || '') ? `0${meta.phone.slice(2)}` : (meta.phone || '—');
  const age = ageOf(meta.birthday);
  const lockedUntil = nextProfileEditDate(meta);

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({ fullName: '', birthday: '', workStatus: '', facebook: '' });
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const startEdit = () => {
    setForm({
      fullName: meta.full_name || '',
      birthday: meta.birthday || '',
      workStatus: meta.work_status || '',
      facebook: fbLabel(meta.facebook)
    });
    setError('');
    setSaved(false);
    setEditing(true);
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await updateTenantProfile(form);
      setEditing(false);
      setSaved(true);
    } catch (err) {
      setError(err.message || 'Unable to save your profile right now.');
    } finally {
      setSaving(false);
    }
  };

  const fb = normalizeFacebook(meta.facebook) || '';
  const rows = [
    { Icon: Phone, label: 'Mobile number', value: phone },
    { Icon: Cake, label: 'Birthday', value: meta.birthday ? `${prettyDate(meta.birthday)}${age !== null ? ` (${age} years old)` : ''}` : '—' },
    { Icon: Briefcase, label: 'Work status', value: meta.work_status ? workStatusLabel(meta.work_status) : '—' },
    {
      Icon: Link2,
      label: 'Facebook',
      value: fb
        ? <a href={fb} target="_blank" rel="noopener noreferrer">{fbLabel(fb)}</a>
        : '—'
    },
    { Icon: CalendarDays, label: 'Member since', value: prettyDate(user?.created_at) }
  ];

  return createPortal(
    <div className="tacct-overlay" onClick={onClose}>
      <div className="tacct animate-slide-up" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="My Account">
        <button type="button" className="tacct-close" aria-label="Close" onClick={onClose}><X size={18} /></button>

        <div className="tacct-head">
          <span className="tacct-avatar" role="img" aria-label="Budi">🐻</span>
          <h3>{meta.full_name || 'Tenant'}</h3>
          <span className="tacct-role">{verifiedUntil ? 'Verified Tenant' : 'Tenant'}{verifiedUntil && <BadgeCheck size={14} style={{ marginLeft: 4, verticalAlign: '-2px' }} />}</span>
          {verifiedUntil && <small className="tacct-verified-until">Verified until {prettyDate(verifiedUntil)}</small>}
        </div>

        {editing ? (
          <form className="tacct-form" onSubmit={save}>
            <label>
              <span>Full name</span>
              <input type="text" value={form.fullName} onChange={set('fullName')} maxLength={80} autoComplete="name" required />
            </label>
            <label>
              <span>Birthday</span>
              <input type="date" value={form.birthday} onChange={set('birthday')} max={new Date().toISOString().slice(0, 10)} required />
            </label>
            <label>
              <span>Work status</span>
              <select value={form.workStatus} onChange={set('workStatus')} required>
                <option value="">Select…</option>
                {WORK_STATUSES.map((w) => <option key={w} value={w}>{workStatusLabel(w)}</option>)}
              </select>
            </label>
            <label>
              <span>Facebook link <em>(optional)</em></span>
              <input type="text" inputMode="url" value={form.facebook} onChange={set('facebook')} maxLength={150} placeholder="facebook.com/your.name" autoCapitalize="none" autoCorrect="off" />
            </label>
            <p className="tacct-warn"><Lock size={13} /><span>You can only edit your profile <b>once a month</b>, so please double-check before saving. Your mobile number can’t be changed.</span></p>
            {error && <p className="tacct-error" role="alert">{error}</p>}
            <div className="tacct-actions">
              <button type="button" className="tacct-cancel" onClick={() => setEditing(false)} disabled={saving}>Cancel</button>
              <button type="submit" className="tacct-save" disabled={saving}>{saving ? <><Loader2 size={16} className="animate-spin" /> Saving…</> : 'Save changes'}</button>
            </div>
          </form>
        ) : (
          <>
            {onGetVerified && !verifiedUntil && (
              <button type="button" className="tacct-gv" onClick={onGetVerified}>
                <span className="tacct-gv-icon"><BadgeCheck size={24} /></span>
                <span className="tacct-gv-text">
                  <strong>Tap to get verified</strong>
                  <span>Only ₱50 for 1 year. A verified badge shows landlords they can trust you, so they respond faster and feel safe renting to you.</span>
                </span>
                <span className="tacct-gv-check"><Check size={16} strokeWidth={3.5} /></span>
              </button>
            )}
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

            {saved && <p className="tacct-success" role="status">Profile updated. You can edit again in 30 days.</p>}

            <button type="button" className="tacct-edit" onClick={startEdit} disabled={Boolean(lockedUntil)}>
              {lockedUntil ? <><Lock size={15} /> Edit again on {prettyDate(lockedUntil.toISOString())}</> : <><Pencil size={15} /> Edit profile</>}
            </button>
            <p className="tacct-note">You log in with your mobile number (no email). Profile edits are limited to once a month.</p>

            <button type="button" className="tacct-logout" onClick={onLogout}><LogOut size={16} /> Log Out</button>
          </>
        )}
      </div>
    </div>,
    document.body
  );
};

export default TenantAccountModal;
