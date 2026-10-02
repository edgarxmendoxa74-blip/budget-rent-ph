import React, { useEffect, useState } from 'react';
import { CalendarCheck, MessageCircle, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getGuestBookings } from '../lib/guestBookings';
import BookingChat from './BookingChat';
import './BookingsPage.css';

const pretty = (s) => (s ? new Date(`${s}T00:00:00`).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : '—');
const STATUS = { pending: 'Naghihintay', confirmed: 'Confirmed', declined: 'Declined' };

// Mga booking ng tenant (guest) — nakikilala gamit ang token na naka-save sa device
const MyBookingsPage = ({ properties, unread = {}, onChatChanged }) => {
  const [saved] = useState(getGuestBookings);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(saved.length > 0);
  const [chat, setChat] = useState(null);

  useEffect(() => {
    if (saved.length === 0) return undefined;
    let alive = true;
    const load = async () => {
      const { data } = await supabase.rpc('get_guest_bookings', { p_tokens: saved.map((b) => b.token) });
      if (!alive) return;
      setRows(data || []);
      setLoading(false);
    };
    load();
    const t = setInterval(load, 20000);
    return () => { alive = false; clearInterval(t); };
  }, [saved]);

  const titleOf = (b) => saved.find((x) => x.id === b.id)?.title
    || properties.find((p) => p.id === b.property_id)?.name
    || 'Booking';
  const tokenOf = (b) => saved.find((x) => x.id === b.id)?.token;

  return (
    <div className="page-section animate-fade-in bookings-page">
      <header className="bookings-head">
        <span className="bookings-icon"><CalendarCheck size={22} /></span>
        <div>
          <h2>My Bookings</h2>
          <p>Mga booking request mo at chat sa owner</p>
        </div>
      </header>

      {loading && <p className="bookings-empty"><Loader2 size={18} className="animate-spin" /></p>}
      {!loading && rows.length === 0 && <p className="bookings-empty">Wala ka pang booking. Pindutin ang "Book Here" sa isang listing para magsimula.</p>}

      <div className="bookings-list">
        {rows.map((b) => (
          <article key={b.id} className={`booking-card ${b.status}`}>
            <div className="booking-top">
              <div>
                <strong>{titleOf(b)}</strong>
                <span>{b.kind === 'rent' ? 'Paupahan' : 'Staycation'}</span>
              </div>
              <em className={`booking-status ${b.status}`}>{STATUS[b.status] || b.status}</em>
            </div>

            <div className="booking-dates">
              <div><span>{b.kind === 'rent' ? 'Petsa' : 'Check-in'}</span><strong>{pretty(b.check_in)}</strong></div>
              {b.check_out && <div><span>Check-out</span><strong>{pretty(b.check_out)}</strong></div>}
              <div><span>{b.kind === 'rent' ? 'Tao' : 'Guests'}</span><strong>{b.guests}</strong></div>
            </div>

            <div className="booking-actions">
              <button type="button" className="confirm" onClick={() => setChat({ id: b.id, token: tokenOf(b), title: titleOf(b) })}>
                <MessageCircle size={16} /> Chat sa owner{unread[b.id] > 0 && <span className="chat-unread">{unread[b.id]}</span>}
              </button>
            </div>
          </article>
        ))}
      </div>

      {chat && <BookingChat bookingId={chat.id} token={chat.token} role="guest" title={chat.title} onRead={onChatChanged} onClose={() => { setChat(null); onChatChanged?.(); }} />}
    </div>
  );
};

export default MyBookingsPage;
