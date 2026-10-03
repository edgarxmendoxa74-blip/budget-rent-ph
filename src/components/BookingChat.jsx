import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Send, Loader2, Trash2, CheckCircle2, XCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { profileFromUser } from '../lib/chatProfiles';
import { ChatAvatar, ProfileSheet } from './ChatProfile';
import './BookingChat.css';

const POLL_MS = 5000;
// Ilang mensahe lang ang puwedeng ipadala ng bawat panig (tenant at owner) sa bawat booking. Naka-enforce rin sa database.
export const MESSAGE_LIMIT = 3;
// Tenant: hanggang ilang araw mula nang mag-book puwedeng mag-cancel (naka-enforce rin sa database)
export const CANCEL_WINDOW_DAYS = 7;

const timeLabel = (iso) => new Date(iso).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

// Chat ng tenant (guest) at owner para sa isang booking.
// role = 'owner' (naka-login na landlord, RLS) o 'guest' (tenant). Ang tenant na may account ay direktang (RLS);
// kung may token (lumang guest booking) ay RPC.
// other = profile ng kausap ({ role, name, phone, ... }); lumalabas ang account details kapag pinindot ang avatar
const BookingChat = ({ bookingId, title, role, token, other, meName, onClose, onRead }) => {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState(null);
  const endRef = useRef(null);
  const [me, setMe] = useState(() => ({ role: role === 'owner' ? 'landlord' : 'tenant', name: meName || 'You' }));
  const [profileOf, setProfileOf] = useState(null); // 'me' | 'other' | null
  const otherProfile = other || { role: role === 'owner' ? 'tenant' : 'landlord', name: title };
  const direct = role === 'owner' || !token; // direktang table access (RLS) kumpara sa token RPC
  const onReadRef = useRef(onRead);
  useEffect(() => { onReadRef.current = onRead; });

  // Outcome ng booking (Successful / Cancelled). Para sa naka-login lang; ang token guest ay walang buttons.
  const [booking, setBooking] = useState(null);
  const [outcomeBusy, setOutcomeBusy] = useState(false);
  const [confirmOutcome, setConfirmOutcome] = useState(null); // 'successful' | 'cancelled' | null (modal ng kumpirmasyon)
  useEffect(() => {
    if (!direct) return undefined;
    let alive = true;
    supabase.from('booking_requests').select('*').eq('id', bookingId).maybeSingle()
      .then(({ data }) => { if (alive && data) setBooking(data); });
    return () => { alive = false; };
  }, [bookingId, direct]);

  const cancelDeadline = booking ? new Date(new Date(booking.created_at).getTime() + CANCEL_WINDOW_DAYS * 86400000) : null;
  const cancelOpen = role === 'owner' || (cancelDeadline && new Date() <= cancelDeadline);

  const markOutcome = async (outcome) => {
    if (outcomeBusy) return;
    setConfirmOutcome(null);
    setOutcomeBusy(true);
    setError('');
    const { data, error: err } = await supabase.rpc('set_booking_outcome', { p_booking_id: bookingId, p_outcome: outcome });
    setOutcomeBusy(false);
    if (err) {
      if (/CANCEL_WINDOW_PASSED/.test(err.message || '')) return setError(`Cancelling is only allowed within ${CANCEL_WINDOW_DAYS} days of booking.`);
      if (/ALREADY_SET/.test(err.message || '')) return setError('This booking already has a final status.');
      return setError('Could not update the booking. Please try again.');
    }
    setBooking((prev) => ({ ...(prev || {}), ...data }));
    onReadRef.current?.();
  };

  const load = useCallback(async () => {
    const { data, error: err } = direct
      ? await supabase.from('booking_messages').select('*').eq('booking_id', bookingId).order('created_at')
      : await supabase.rpc('get_guest_messages', { p_booking_id: bookingId, p_token: token });
    if (!err) {
      setMessages(data || []);
      // Markahang nabasa ang mga mensahe ng kausap
      const incoming = role === 'owner' ? 'guest' : 'owner';
      if ((data || []).some((m) => m.sender === incoming && !m.read_at)) {
        if (direct) await supabase.from('booking_messages').update({ read_at: new Date().toISOString() }).eq('booking_id', bookingId).eq('sender', incoming).is('read_at', null);
        else await supabase.rpc('mark_guest_read', { p_booking_id: bookingId, p_token: token });
        onReadRef.current?.();
      }
    }
    setLoading(false);
  }, [bookingId, role, token, direct]);

  useEffect(() => {
    const first = setTimeout(load, 0);
    const t = setInterval(load, POLL_MS);
    // Direktang (RLS): realtime; token guest: polling lang
    const channel = direct
      ? supabase.channel(`bchat-${bookingId}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'booking_messages', filter: `booking_id=eq.${bookingId}` }, () => load())
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'booking_messages', filter: `booking_id=eq.${bookingId}` }, () => load())
        .subscribe()
      : null;
    return () => { clearTimeout(first); clearInterval(t); if (channel) supabase.removeChannel(channel); };
  }, [load, direct, bookingId]);

  // Sariling profile mula sa naka-login na account (kung may session)
  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (alive && data?.session?.user) setMe(profileFromUser(data.session.user, role));
    });
    return () => { alive = false; };
  }, [role]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [messages.length]);

  // Hindi binibilang ang awtomatikong mensahe ng booking details
  const sentCount = messages.filter((m) => m.sender === role && !m.auto).length;
  const remaining = Math.max(0, MESSAGE_LIMIT - sentCount);
  const limitReached = remaining === 0;

  const send = async (e) => {
    e.preventDefault();
    const body = text.trim();
    if (!body || sending || limitReached) return;
    setSending(true);
    setError('');
    const { error: err } = direct
      ? await supabase.from('booking_messages').insert({ booking_id: bookingId, sender: role === 'owner' ? 'owner' : 'guest', body })
      : await supabase.rpc('send_guest_message', { p_booking_id: bookingId, p_token: token, p_body: body });
    setSending(false);
    if (err) {
      if (/limit/i.test(err.message || '')) { load(); return setError(`You’ve reached the limit of ${MESSAGE_LIMIT} messages.`); }
      return setError('Message not sent. Please try again.');
    }
    setText('');
    load();
  };

  // Soft delete: nananatili ang row (bilang pa rin sa limit) pero nabubura ang laman
  const removeMessage = async (id) => {
    if (deletingId || !window.confirm('I-delete ang mensaheng ito? Hindi na ito mababawi, at bibilangin pa rin ito sa limit mo.')) return;
    setDeletingId(id);
    setError('');
    const { error: err } = await supabase.rpc('delete_chat_message', { p_message_id: id, p_token: direct ? null : token });
    setDeletingId(null);
    if (err) return setError('Hindi na-delete ang mensahe. Subukan ulit.');
    load();
  };

  return createPortal(
    <div className="bchat-overlay" onClick={onClose}>
      <div className="bchat animate-slide-up" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Chat">
        <div className="bchat-head">
          <ChatAvatar profile={otherProfile} size={38} onClick={() => setProfileOf('other')} />
          <div className="bchat-title">
            <strong>{title}</strong>
            <span>{role === 'owner' ? 'Chat with guest' : 'Chat with owner'} · tap the photo for details</span>
          </div>
          <button type="button" aria-label="Close" onClick={onClose}><X size={18} /></button>
        </div>

        {booking && (
          <div className="bchat-outcome">
            {booking.outcome ? (
              <p className={`bchat-outcome-done ${booking.outcome}`}>
                {booking.outcome === 'successful' ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
                {booking.outcome === 'successful' ? 'Successful booking' : 'Cancelled booking'}
                {booking.outcome_by ? ` · marked by ${booking.outcome_by === 'owner' ? 'landlord' : 'tenant'}` : ''}
              </p>
            ) : (
              <>
                <div className="bchat-outcome-btns">
                  <button type="button" className="ok" disabled={outcomeBusy} onClick={() => setConfirmOutcome('successful')}><CheckCircle2 size={14} /> Successful booking</button>
                  <button type="button" className="no" disabled={outcomeBusy || !cancelOpen} onClick={() => setConfirmOutcome('cancelled')}><XCircle size={14} /> {role === 'owner' ? 'Cancelled booking' : 'Cancel booking'}</button>
                </div>
                {role !== 'owner' && (
                  <small>{cancelOpen ? `You can cancel until ${cancelDeadline.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })} (${CANCEL_WINDOW_DAYS} days after booking).` : `Cancelling is only allowed within ${CANCEL_WINDOW_DAYS} days of booking.`}</small>
                )}
              </>
            )}
          </div>
        )}

        <p className="bchat-limit-note">Note: The tenant and the landlord can each send a maximum of {MESSAGE_LIMIT} replies in this chat.</p>

        <div className="bchat-body">
          {loading && <p className="bchat-empty"><Loader2 size={16} className="animate-spin" /></p>}
          {!loading && messages.length === 0 && <p className="bchat-empty">No messages yet. Start the conversation.</p>}
          {messages.map((m) => (
            <div key={m.id} className={`bchat-row ${m.sender === role ? 'mine' : 'theirs'}`}>
              <ChatAvatar profile={m.sender === role ? me : otherProfile} size={30} onClick={() => setProfileOf(m.sender === role ? 'me' : 'other')} />
              <div className={`bchat-msg ${m.sender === role ? 'mine' : 'theirs'}${m.deleted_at ? ' deleted' : ''}`}>
              <p style={{ whiteSpace: 'pre-wrap' }}>{m.deleted_at ? 'Na-delete ang mensahe' : m.body}</p>
              <span>
                {timeLabel(m.created_at)}
                {m.sender === role && !m.auto && !m.deleted_at && (
                  <button type="button" className="bchat-del" aria-label="I-delete ang mensahe" disabled={deletingId === m.id} onClick={() => removeMessage(m.id)}>
                    {deletingId === m.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                  </button>
                )}
              </span>
              </div>
            </div>
          ))}
          <div ref={endRef} />
        </div>

        {error && <p className="bchat-error">{error}</p>}
        <p className="bchat-note" style={{ fontWeight: 700 }}>
          {limitReached
            ? `You’ve reached the limit of ${MESSAGE_LIMIT} messages. Please wait for the ${role === 'owner' ? 'guest' : 'owner'} to reply.`
            : `Messages left: ${remaining} of ${MESSAGE_LIMIT}`}
        </p>
        <form className="bchat-form" onSubmit={send}>
          <input type="text" value={text} maxLength={500} disabled={limitReached} placeholder={limitReached ? 'Limit reached' : 'Type a message...'} onChange={(e) => setText(e.target.value)} />
          <button type="submit" disabled={sending || limitReached || !text.trim()} aria-label="Send">
            {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
          </button>
        </form>
        <p className="bchat-note">Never share passwords or bank details. This chat updates automatically.</p>
      </div>
      {confirmOutcome && (
        <div className="bchat-confirm-overlay" onClick={() => setConfirmOutcome(null)}>
          <div className="bchat-confirm animate-slide-up" role="alertdialog" aria-modal="true" aria-labelledby="bchat-confirm-title" onClick={(e) => e.stopPropagation()}>
            <span className={`bchat-confirm-icon ${confirmOutcome}`}>{confirmOutcome === 'cancelled' ? <XCircle size={26} /> : <CheckCircle2 size={26} />}</span>
            <h3 id="bchat-confirm-title">{confirmOutcome === 'cancelled' ? 'Cancel this booking?' : 'Mark as successful?'}</h3>
            <p>
              {confirmOutcome === 'cancelled'
                ? 'Are you sure you want to cancel (delete) this booking? This frees up the dates and cannot be undone.'
                : 'Are you sure you want to mark this booking as successful? This cannot be undone.'}
            </p>
            <div className="bchat-confirm-actions">
              <button type="button" className="keep" onClick={() => setConfirmOutcome(null)} disabled={outcomeBusy}>{confirmOutcome === 'cancelled' ? 'No, keep it' : 'Not yet'}</button>
              <button type="button" className={`go ${confirmOutcome}`} onClick={() => markOutcome(confirmOutcome)} disabled={outcomeBusy}>
                {outcomeBusy ? <Loader2 size={15} className="animate-spin" /> : null} {confirmOutcome === 'cancelled' ? 'Yes, cancel it' : 'Yes, confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
      {profileOf && <ProfileSheet profile={profileOf === 'me' ? me : otherProfile} isMe={profileOf === 'me'} onClose={() => setProfileOf(null)} />}
    </div>,
    document.body
  );
};

export default BookingChat;
