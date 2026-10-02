import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Send, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import './BookingChat.css';

const POLL_MS = 5000;

const timeLabel = (iso) => new Date(iso).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

// Chat ng tenant (guest) at owner para sa isang booking.
// role = 'owner' (naka-login na landlord, RLS) o 'guest' (token ng device, RPC)
const BookingChat = ({ bookingId, title, role, token, onClose, onRead }) => {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const endRef = useRef(null);
  const onReadRef = useRef(onRead);
  useEffect(() => { onReadRef.current = onRead; });

  const load = useCallback(async () => {
    const { data, error: err } = role === 'owner'
      ? await supabase.from('booking_messages').select('*').eq('booking_id', bookingId).order('created_at')
      : await supabase.rpc('get_guest_messages', { p_booking_id: bookingId, p_token: token });
    if (!err) {
      setMessages(data || []);
      // Markahang nabasa ang mga mensahe ng kausap
      const incoming = role === 'owner' ? 'guest' : 'owner';
      if ((data || []).some((m) => m.sender === incoming && !m.read_at)) {
        if (role === 'owner') await supabase.from('booking_messages').update({ read_at: new Date().toISOString() }).eq('booking_id', bookingId).eq('sender', 'guest').is('read_at', null);
        else await supabase.rpc('mark_guest_read', { p_booking_id: bookingId, p_token: token });
        onReadRef.current?.();
      }
    }
    setLoading(false);
  }, [bookingId, role, token]);

  useEffect(() => {
    const first = setTimeout(load, 0);
    const t = setInterval(load, POLL_MS);
    // Owner: realtime (RLS); guest: polling lang
    const channel = role === 'owner'
      ? supabase.channel(`bchat-${bookingId}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'booking_messages', filter: `booking_id=eq.${bookingId}` }, () => load())
        .subscribe()
      : null;
    return () => { clearTimeout(first); clearInterval(t); if (channel) supabase.removeChannel(channel); };
  }, [load, role, bookingId]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [messages.length]);

  const send = async (e) => {
    e.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setError('');
    const { error: err } = role === 'owner'
      ? await supabase.from('booking_messages').insert({ booking_id: bookingId, sender: 'owner', body })
      : await supabase.rpc('send_guest_message', { p_booking_id: bookingId, p_token: token, p_body: body });
    setSending(false);
    if (err) return setError('Hindi naipadala ang mensahe. Subukan ulit.');
    setText('');
    load();
  };

  return createPortal(
    <div className="bchat-overlay" onClick={onClose}>
      <div className="bchat animate-slide-up" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Chat">
        <div className="bchat-head">
          <div>
            <strong>{title}</strong>
            <span>{role === 'owner' ? 'Chat sa guest' : 'Chat sa owner'}</span>
          </div>
          <button type="button" aria-label="Isara" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="bchat-body">
          {loading && <p className="bchat-empty"><Loader2 size={16} className="animate-spin" /></p>}
          {!loading && messages.length === 0 && <p className="bchat-empty">Wala pang mensahe. Magsimula ng usapan.</p>}
          {messages.map((m) => (
            <div key={m.id} className={`bchat-msg ${m.sender === role ? 'mine' : 'theirs'}`}>
              <p>{m.body}</p>
              <span>{timeLabel(m.created_at)}</span>
            </div>
          ))}
          <div ref={endRef} />
        </div>

        {error && <p className="bchat-error">{error}</p>}
        <form className="bchat-form" onSubmit={send}>
          <input type="text" value={text} maxLength={500} placeholder="Mag-type ng mensahe..." onChange={(e) => setText(e.target.value)} />
          <button type="submit" disabled={sending || !text.trim()} aria-label="Send">
            {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
          </button>
        </form>
        <p className="bchat-note">Huwag magbahagi ng password o bank details. Awtomatikong nag-a-update ang chat.</p>
      </div>
    </div>,
    document.body
  );
};

export default BookingChat;
