import React, { useMemo, useState } from 'react';
import { Phone, Mail, Users, PawPrint, Clock, CheckCircle2, MessageCircle, Trash2, ShieldAlert } from 'lucide-react';
import { HeroBudi } from './MascotSplash';
import BookingChat from './BookingChat';
import { tenantFromBooking } from '../lib/chatProfiles';
import './BookingsPage.css';

const FILTERS = [
  { key: 'pending', label: 'Pending' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'declined', label: 'Cancelled' },
  { key: 'successful', label: 'Successful' }
];

const peso = (n) => `₱${Number(n || 0).toLocaleString()}`;
const pretty = (s) => new Date(`${s}T00:00:00`).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
const nightsOf = (a, b) => Math.round((new Date(`${b}T00:00:00`) - new Date(`${a}T00:00:00`)) / 86400000);

// Lahat ng staycation booking requests para sa landlord (RLS ang naglilimita sa listings niya)
const BookingsPage = ({ bookings, properties, onSetStatus, onDismiss, unread = {}, onChatChanged }) => {
  const [filter, setFilter] = useState('pending');
  const [busyId, setBusyId] = useState(null);
  const [chat, setChat] = useState(null);

  const nameOf = useMemo(() => {
    const map = new Map(properties.map((p) => [p.id, p.name || p.title || p.location?.split(',')[0] || 'Staycation']));
    return (id) => map.get(id) || 'Staycation';
  }, [properties]);

  const counts = useMemo(() => ({
    pending: bookings.filter((b) => b.status === 'pending').length,
    confirmed: bookings.filter((b) => b.status === 'confirmed' && b.outcome !== 'successful').length,
    declined: bookings.filter((b) => b.status === 'declined').length,
    successful: bookings.filter((b) => b.outcome === 'successful').length
  }), [bookings]);

  // Successful = minarkahan ng landlord/tenant na successful; hindi na ito binibilang sa Confirmed
  const list = bookings.filter((b) => {
    if (filter === 'successful') return b.outcome === 'successful';
    if (filter === 'confirmed') return b.status === 'confirmed' && b.outcome !== 'successful';
    return b.status === filter;
  });

  const act = async (id, status) => {
    setBusyId(id);
    await onSetStatus(id, status);
    setBusyId(null);
  };

  const remove = async (b) => {
    if (!window.confirm(`Remove ${b.customer_name}’s booking from your list? This won’t affect the guest or the dates already booked.`)) return;
    setBusyId(b.id);
    await onDismiss(b.id);
    setBusyId(null);
  };

  return (
    <div className="page-section animate-fade-in bookings-page">
      <header className="hero branding-hero">
        <HeroBudi message={counts.pending > 0 ? `You have ${counts.pending} pending booking request${counts.pending > 1 ? 's' : ''}! 📬` : 'Booking requests from guests will show up here. 📬'} />
        <div className="hero-content">
          <span className="branding-kicker">Landlord</span>
          <h2>Bookings</h2>
          <p>Booking requests from guests (staycations and rentals)</p>
        </div>
      </header>

      <p className="bookings-policy"><ShieldAlert size={16} /> <span><b>Keep all transactions inside the app.</b> Reservations, payments and confirmations must be done here. Do not transact outside the app or move the conversation elsewhere. We can&apos;t protect or help with deals made outside the app.</span></p>

      <div className="bookings-tabs" role="tablist">
        {FILTERS.map((f) => (
          <button key={f.key} type="button" role="tab" aria-selected={filter === f.key}
            data-filter={f.key} className={filter === f.key ? 'active' : ''} onClick={() => setFilter(f.key)}>
            {f.label} <span>{counts[f.key]}</span>
          </button>
        ))}
      </div>

      {list.length === 0 && <p className="bookings-empty">No bookings here yet.</p>}

      <div className="bookings-list">
        {list.map((b) => (
          <article key={b.id} className={`booking-card ${b.outcome === 'successful' ? 'successful' : b.status}`}>
            <div className="booking-top">
              <div>
                <strong>{b.customer_name}</strong>
                <span>{nameOf(b.property_id)} • {b.kind === 'rent' ? 'Rental' : 'Staycation'}</span>
              </div>
              <em className={`booking-status ${b.outcome === 'successful' ? 'successful' : b.status}`}>{b.outcome === 'successful' ? 'Successful' : b.status === 'pending' ? 'Pending' : b.status === 'confirmed' ? 'Confirmed' : 'Cancelled'}</em>
            </div>

            <div className="booking-dates">
              <div><span>{b.kind === 'rent' ? 'Move-in / visit' : 'Check-in'}</span><strong>{pretty(b.check_in)}</strong></div>
              {b.check_out && <div><span>Check-out</span><strong>{pretty(b.check_out)}</strong></div>}
              {b.check_out && <div><span>Nights</span><strong>{nightsOf(b.check_in, b.check_out)}</strong></div>}
            </div>

            <div className="booking-meta">
              <span><Users size={12} /> {b.kind === 'rent' ? `${b.guests} ${b.guests > 1 ? 'people' : 'person'}` : `${b.adults || b.guests} adult${(b.adults || b.guests) > 1 ? 's' : ''}${b.children ? `, ${b.children} ${b.children > 1 ? 'children' : 'child'}` : ''}`}</span>
              {b.pets && <span><PawPrint size={12} /> With pets</span>}
              {b.arrival_time && <span><Clock size={12} /> {b.arrival_time}</span>}
              {b.purpose && <span>{b.purpose}</span>}
              {b.vehicles > 0 && <span>{b.vehicles} vehicle{b.vehicles > 1 ? 's' : ''}</span>}
              {b.payment_method && <span>Pays via {b.payment_method}</span>}
            </div>

            {b.kind !== 'rent' && Number(b.total_price) > 0 && (
              <p className="booking-price">
                Total {peso(b.total_price)}{Number(b.down_payment) > 0 && <> • Down payment {peso(b.down_payment)}</>}
              </p>
            )}
            {b.note && <p className="booking-note">"{b.note}"</p>}
            {b.emergency_name && <p className="booking-note">Emergency: {b.emergency_name} • {b.emergency_phone}</p>}

            <div className="booking-contact">
              <a href={`tel:${b.customer_phone}`}><Phone size={12} /> {b.customer_phone}</a>
              {b.customer_email && <a href={`mailto:${b.customer_email}`}><Mail size={12} /> {b.customer_email}</a>}
            </div>

            <div className="booking-actions">
              <button type="button" className="chat blue" onClick={() => setChat({ id: b.id, title: b.customer_name, other: tenantFromBooking(b) })}><MessageCircle size={14} /> Chat{unread[b.id] > 0 && <span className="chat-unread">{unread[b.id]}</span>}</button>
              {b.status === 'pending' ? (
                <button type="button" className="confirm" disabled={busyId === b.id} onClick={() => act(b.id, 'confirmed')}><CheckCircle2 size={14} /> Confirm</button>
              ) : onDismiss && (
                <button type="button" className="decline" disabled={busyId === b.id} onClick={() => remove(b)}><Trash2 size={14} /> Delete</button>
              )}
            </div>
          </article>
        ))}
      </div>
      {chat && <BookingChat bookingId={chat.id} role="owner" title={chat.title} other={chat.other} onRead={onChatChanged} onClose={() => { setChat(null); onChatChanged?.(); }} />}
    </div>
  );
};

export default BookingsPage;
