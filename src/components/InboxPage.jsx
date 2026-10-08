import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { MessageCircle, Loader2, Trash2, ShieldAlert } from 'lucide-react';
import { HeroBudi } from './MascotSplash';
import { fetchDismissedIds, dismissBooking } from '../lib/bookingDismissals';
import { supabase } from '../lib/supabase';
import BookingChat, { MESSAGE_LIMIT } from './BookingChat';
import { landlordFromProperty } from '../lib/chatProfiles';
import './BookingsPage.css';

const pretty = (s) => (s ? new Date(`${s}T00:00:00`).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : '—');
const STATUS = { pending: 'Pending', confirmed: 'Confirmed', declined: 'Cancelled' };

const timeAgo = (iso) => {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.round(hrs / 24)}d`;
};

// Inbox ng tenant: lahat ng booking requests niya at ang usapan nila ng owner (RLS: sarili niyang bookings lang)
const InboxPage = ({ properties, unread = {}, onChatChanged }) => {
  const [rows, setRows] = useState([]);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [chat, setChat] = useState(null);
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    const [{ data: bookings }, { data: msgs }, dismissed] = await Promise.all([
      supabase.from('booking_requests').select('*').order('created_at', { ascending: false }).limit(100),
      supabase.from('booking_messages').select('id, booking_id, sender, body, created_at').order('created_at', { ascending: false }).limit(500),
      fetchDismissedIds()
    ]);
    setRows((bookings || []).filter((b) => !dismissed.has(b.id)));
    setMessages(msgs || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    const first = setTimeout(load, 0);
    const t = setInterval(load, 20000);
    return () => { clearTimeout(first); clearInterval(t); };
  }, [load]);

  // Pinakabagong mensahe at bilang ng naipadala mo, bawat booking
  const byBooking = useMemo(() => {
    const map = new Map();
    messages.forEach((m) => {
      const entry = map.get(m.booking_id) || { last: m, mine: 0 };
      if (m.sender === 'guest') entry.mine += 1;
      map.set(m.booking_id, entry);
    });
    return map;
  }, [messages]);

  const items = useMemo(() => rows
    .map((b) => ({ b, info: byBooking.get(b.id) }))
    .sort((x, y) => new Date(y.info?.last.created_at || y.b.created_at) - new Date(x.info?.last.created_at || x.b.created_at)),
  [rows, byBooking]);

  const confirmRemove = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await dismissBooking(toDelete.b.id);
      setRows((list) => list.filter((x) => x.id !== toDelete.b.id));
      setToDelete(null);
      onChatChanged?.();
    } catch {
      alert('Couldn’t delete. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  const titleOf = (b) => {
    const p = properties.find((x) => x.id === b.property_id);
    return p?.name || p?.title || p?.location?.split(',')[0] || 'Booking';
  };

  return (
    <div className="page-section animate-fade-in bookings-page">
      <header className="hero branding-hero">
        <HeroBudi message={items.length > 0 ? 'Here are your bookings and the owners’ replies! 📬' : 'Your bookings and owner replies will show up here. 📬'} />
        <div className="hero-content">
          <span className="branding-kicker">Tenant/Guest</span>
          <h2>Inbox</h2>
          <p>Your booking requests and conversations with owners</p>
        </div>
      </header>

      <p className="bookings-policy"><ShieldAlert size={16} /> <span><b>Keep all transactions inside the app.</b> Reservations, payments and confirmations must be done here. Do not transact outside the app or move the conversation elsewhere. We can&apos;t protect or help with deals made outside the app.</span></p>

      {loading && <p className="bookings-empty"><Loader2 size={18} className="animate-spin" /></p>}
      {!loading && items.length === 0 && <p className="bookings-empty">Your Inbox is empty. Tap "Book Here" on a listing to get started.</p>}

      <div className="bookings-list">
        {items.map(({ b, info }) => (
          <article key={b.id} className={`booking-card inbox-card ${b.status}${unread[b.id] > 0 ? ' has-unread' : ''}`}>
            <div className="booking-top">
              <div>
                <strong>{titleOf(b)}</strong>
                <span>{b.kind === 'rent' ? 'Rental' : 'Staycation'} • {pretty(b.check_in)}{b.check_out ? ` → ${pretty(b.check_out)}` : ''}</span>
              </div>
              <em className={`booking-status ${b.status}`}>{STATUS[b.status] || b.status}</em>
            </div>

            <p className="inbox-last">
              {info
                ? <><b>{info.last.sender === 'owner' ? 'Owner' : 'You'}:</b> {info.last.body} <span>{timeAgo(info.last.created_at)}</span></>
                : <i>Request sent. No messages yet.</i>}
            </p>

            <div className="booking-actions">
              <button type="button" className="chat" onClick={() => setChat({ id: b.id, booking: b, title: titleOf(b), other: landlordFromProperty(properties.find((x) => x.id === b.property_id)) })}>
                <MessageCircle size={14} /> {info ? 'Open conversation' : 'Message the owner'}
                {unread[b.id] > 0 && <span className="chat-unread">{unread[b.id]}</span>}
              </button>
              <button type="button" className="decline" onClick={() => setToDelete({ b, title: titleOf(b) })}><Trash2 size={14} /> Delete conversation</button>
            </div>
            <p className="inbox-limit">Your messages: {Math.min(info?.mine || 0, MESSAGE_LIMIT)} of {MESSAGE_LIMIT}</p>
          </article>
        ))}
      </div>

      {toDelete && (
        <div className="inbox-modal-backdrop" onClick={() => !deleting && setToDelete(null)}>
          <div className="inbox-modal" role="dialog" aria-modal="true" aria-labelledby="inbox-del-title" onClick={(e) => e.stopPropagation()}>
            <div className="inbox-modal-icon"><Trash2 size={22} /></div>
            <h3 id="inbox-del-title">Delete conversation?</h3>
            <p>Are you sure you want to delete <b>{toDelete.title}</b> from your Inbox? This won’t affect the owner.</p>
            <div className="inbox-modal-actions">
              <button type="button" className="cancel" onClick={() => setToDelete(null)} disabled={deleting}>Cancel</button>
              <button type="button" className="danger" onClick={confirmRemove} disabled={deleting}>
                {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {chat && (
        <BookingChat
          bookingId={chat.id}
          initialBooking={chat.booking}
          role="guest"
          title={chat.title}
          other={chat.other}
          onRead={() => { onChatChanged?.(); load(); }}
          onClose={() => { setChat(null); onChatChanged?.(); load(); }}
        />
      )}
    </div>
  );
};

export default InboxPage;
