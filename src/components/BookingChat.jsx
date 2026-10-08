import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, ArrowLeft, Send, Loader2, Trash2, CheckCircle2, XCircle, Wallet, Copy, ImagePlus, BadgeCheck, Undo2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { ikImage } from '../lib/imagekit';
import { profileFromUser } from '../lib/chatProfiles';
import { ChatAvatar, ProfileSheet } from './ChatProfile';
import './BookingChat.css';

const POLL_MS = 5000;
// Ilang mensahe lang ang puwedeng ipadala ng bawat panig (tenant at owner) sa bawat booking. Naka-enforce rin sa database.
export const MESSAGE_LIMIT = 6;
// Tenant: hanggang ilang araw mula nang mag-book puwedeng mag-cancel (naka-enforce rin sa database)
export const CANCEL_WINDOW_DAYS = 7;

// Para saan ang bayad, depende kung staycation o paupahan (rental)
const PAYMENT_PURPOSES = {
  staycation: ['Down payment', 'Reservation fee', 'Full payment', 'Security deposit', 'Other'],
  rental: ['Reservation fee', 'Security deposit', 'Advance rent', 'Down payment', 'First month rent', 'Other'],
};

const timeLabel = (iso) => new Date(iso).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

// Chat ng tenant (guest) at owner para sa isang booking.
// role = 'owner' (naka-login na landlord, RLS) o 'guest' (tenant). Ang tenant na may account ay direktang (RLS);
// kung may token (lumang guest booking) ay RPC.
// other = profile ng kausap ({ role, name, phone, ... }); lumalabas ang account details kapag pinindot ang avatar
const BookingChat = ({ bookingId, title, role, token, other, meName, initialBooking, onClose, onRead }) => {
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
  const [booking, setBooking] = useState(initialBooking || null);
  const [outcomeBusy, setOutcomeBusy] = useState(false);
  const [confirmOutcome, setConfirmOutcome] = useState(null); // 'successful' | 'cancelled' | null (modal ng kumpirmasyon)
  useEffect(() => {
    if (!direct) return undefined;
    let alive = true;
    supabase.from('booking_requests').select('*').eq('id', bookingId).maybeSingle()
      .then(({ data, error: err }) => { if (err) console.error('booking load failed', err); if (alive && data) setBooking(data); });
    return () => { alive = false; };
  }, [bookingId, direct]);

  const cancelDeadline = booking ? new Date(new Date(booking.created_at).getTime() + CANCEL_WINDOW_DAYS * 86400000) : null;
  const cancelOpen = !!cancelDeadline && new Date() <= cancelDeadline;

  const markOutcome = async (outcome) => {
    if (outcomeBusy) return;
    setConfirmOutcome(null);
    setOutcomeBusy(true);
    setError('');
    const { data, error: err } = await supabase.rpc('set_booking_outcome', { p_booking_id: bookingId, p_outcome: outcome });
    setOutcomeBusy(false);
    if (err) {
      if (/PAYMENT_SENT/.test(err.message || '')) return setError('A payment was already sent, so this booking can no longer be cancelled.');
      if (/CANCEL_WINDOW_PASSED/.test(err.message || '')) return setError(`Cancelling is only allowed within ${CANCEL_WINDOW_DAYS} days of booking.`);
      if (/ALREADY_SET/.test(err.message || '')) return setError('This booking already has a final status.');
      return setError('Could not update the booking. Please try again.');
    }
    setBooking((prev) => ({ ...(prev || {}), ...data }));
    onReadRef.current?.();
  };

  // Refund: tenant humihiling, landlord ang nag-aapruba/tumatanggi (siya rin ang nagbabalik ng pera)
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundReason, setRefundReason] = useState('');
  const [refundBusy, setRefundBusy] = useState(false);
  const [refundAgree, setRefundAgree] = useState(false);
  const [refundError, setRefundError] = useState('');
  const submitRefund = async (e) => {
    e.preventDefault();
    if (refundBusy) return;
    if (!refundAgree) return setRefundError('Please agree to the refund policy first.');
    if (!refundReason.trim()) return setRefundError('Please tell the landlord why you need a refund.');
    setRefundBusy(true);
    setRefundError('');
    const { data, error: err } = await supabase.rpc('request_booking_refund', { p_booking_id: bookingId, p_reason: refundReason });
    setRefundBusy(false);
    if (err) {
      if (/NO_PAYMENT/.test(err.message || '')) return setRefundError('No payment proof was sent for this booking yet.');
      if (/REFUND_ALREADY/.test(err.message || '')) return setRefundError('You already requested a refund for this booking.');
      return setRefundError('Could not send your request. Please try again.');
    }
    setBooking((prev) => ({ ...(prev || {}), ...data }));
    setRefundOpen(false);
    setRefundReason('');
    load();
  };
  const resolveRefund = async (approve) => {
    if (refundBusy) return;
    setRefundBusy(true);
    setError('');
    const { data, error: err } = await supabase.rpc('resolve_booking_refund', { p_booking_id: bookingId, p_approve: approve });
    setRefundBusy(false);
    if (err) return setError('Could not update the refund. Please try again.');
    setBooking((prev) => ({ ...(prev || {}), ...data }));
    load();
  };

  // Payment methods ng landlord (tenant lang ang may button)
  const [payOpen, setPayOpen] = useState(false);
  const [payLoading, setPayLoading] = useState(false);
  const [payMethods, setPayMethods] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const showPayments = async () => {
    setPayOpen(true);
    setPayLoading(true);
    const { data } = await supabase.rpc('get_booking_payment_methods', { p_booking_id: bookingId, p_token: direct ? null : token });
    setPayMethods(data || []);
    setPayLoading(false);
  };
  const copyNumber = async (m) => {
    try { await navigator.clipboard.writeText(m.account_number); setCopiedId(m.id); setTimeout(() => setCopiedId(null), 1500); } catch { /* ignore */ }
  };

  // "Ready for payment" form (tenant lang): proof image + detalye, napupunta sa chat bilang auto message
  const emptyForm = { purpose: '', name: '', phone: '', reference: '', method: '' };
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [proof, setProof] = useState(null);
  const [proofPreview, setProofPreview] = useState('');
  const [formBusy, setFormBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const setField = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const openForm = () => {
    setForm({ ...emptyForm, name: me.name && me.name !== 'You' ? me.name : '', phone: booking?.customer_phone || '', method: booking?.payment_method || '' });
    setFormError('');
    setFormOpen(true);
  };
  const resetProof = () => {
    if (proofPreview) URL.revokeObjectURL(proofPreview);
    setProof(null);
    setProofPreview('');
  };
  const closeForm = () => {
    if (formBusy) return;
    setFormOpen(false);
    resetProof();
  };
  const pickProof = (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (!/^image\/(jpeg|png|webp)$/.test(f.type)) return setFormError('Only JPG, PNG or WEBP images are allowed.');
    if (f.size > 5 * 1024 * 1024) return setFormError('Image is too large (max 5MB).');
    setFormError('');
    if (proofPreview) URL.revokeObjectURL(proofPreview);
    setProof(f);
    setProofPreview(URL.createObjectURL(f));
  };
  const submitPayment = async (e) => {
    e.preventDefault();
    if (formBusy) return;
    if (!proof) return setFormError('Please upload your proof of payment.');
    if (!form.purpose || !form.name.trim() || !form.phone.trim() || !form.reference.trim() || !form.method.trim()) return setFormError('Please fill in all fields.');
    setFormBusy(true);
    setFormError('');
    const ext = (proof.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
    const path = `${bookingId}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage.from('booking-payments').upload(path, proof, { contentType: proof.type });
    if (upErr) { setFormBusy(false); return setFormError('Upload failed. Check your connection and try again.'); }
    const imageUrl = supabase.storage.from('booking-payments').getPublicUrl(path).data.publicUrl;
    const { error: err } = await supabase.rpc('submit_payment_proof', {
      p_booking_id: bookingId, p_token: direct ? null : token, p_name: form.name, p_phone: form.phone,
      p_reference: form.reference, p_method: form.method, p_image_url: imageUrl, p_purpose: form.purpose,
    });
    setFormBusy(false);
    if (err) return setFormError('Could not send your payment details. Please try again.');
    setFormOpen(false);
    resetProof();
    load();
  };

  const load = useCallback(async () => {
    // Kunin ulit ang booking para lumabas agad ang bagong status (hal. successful pagkatapos ma-confirm ang bayad)
    if (direct) supabase.from('booking_requests').select('*').eq('id', bookingId).maybeSingle().then(({ data: b }) => { if (b) setBooking(b); });
    else supabase.rpc('get_guest_booking', { p_booking_id: bookingId, p_token: token }).then(({ data: b }) => { if (b) setBooking(b); });
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
  // May na-send nang payment proof: wala nang Cancel booking
  const paymentSent = messages.some((m) => m.image_url && !m.deleted_at);
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
  // Landlord: kumpirmahin na natanggap ang payment proof
  const [confirmingId, setConfirmingId] = useState(null);
  const confirmReceived = async (id) => {
    if (confirmingId) return;
    setConfirmingId(id);
    setError('');
    const { error: err } = await supabase.rpc('confirm_payment_received', { p_message_id: id });
    setConfirmingId(null);
    if (err) return setError('Could not confirm. Please try again.');
    load();
  };

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
          <button type="button" className="bchat-back" aria-label="Back" onClick={onClose}><ArrowLeft size={20} /></button>
          <ChatAvatar profile={otherProfile} size={38} onClick={() => setProfileOf('other')} />
          <div className="bchat-title">
            <strong>{title}</strong>
            <span>{role === 'owner' ? 'Chat with guest' : (otherProfile.host ? 'Chat with host' : 'Chat with owner')} · tap the photo for details</span>
          </div>
        </div>

        {booking && (
          <div className="bchat-outcome">
            {booking.outcome ? (
              <p className={`bchat-outcome-done ${booking.outcome}`}>
                {booking.outcome === 'successful' ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
                {booking.outcome === 'successful' ? 'Successful booking' : 'Cancelled booking'}
                {booking.outcome_by ? ` · marked by ${booking.outcome_by === 'owner' ? 'landlord' : 'tenant'}` : ''}
              </p>
            ) : direct && !paymentSent ? (
              <>
                <div className="bchat-outcome-btns">
                  <button type="button" className="no" disabled={outcomeBusy || !cancelOpen} onClick={() => setConfirmOutcome('cancelled')}><XCircle size={14} /> {role === 'owner' ? 'Cancelled booking' : 'Cancel booking'}</button>
                </div>
                <small>{cancelOpen ? `You can cancel until ${cancelDeadline.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })} (${CANCEL_WINDOW_DAYS} days after booking).` : `Cancelling is only allowed within ${CANCEL_WINDOW_DAYS} days of booking.`}</small>
              </>
            ) : null}
          </div>
        )}

        {booking?.refund_status && (
          <div className="bchat-refund">
            {booking.refund_status === 'requested' && <p><Undo2 size={14} /> {role === 'owner' ? 'Refund requested. See the message below.' : `Refund requested. Waiting for the ${otherProfile.host ? 'host' : 'landlord'}.`}</p>}
            {booking.refund_status === 'approved' && <p className="approved"><CheckCircle2 size={14} /> Refund confirmed{role === 'owner' ? ' — please send the money back to the tenant.' : ' — the landlord will send your refund.'}</p>}
            {booking.refund_status === 'declined' && <p className="declined"><XCircle size={14} /> Refund declined</p>}
          </div>
        )}

        <div className="bchat-body">
          {loading && <p className="bchat-empty"><Loader2 size={16} className="animate-spin" /></p>}
          {!loading && messages.length === 0 && <p className="bchat-empty">No messages yet. Start the conversation.</p>}
          {messages.map((m) => (
            <div key={m.id} className={`bchat-row ${m.sender === role ? 'mine' : 'theirs'}`}>
              <ChatAvatar profile={m.sender === role ? me : otherProfile} size={26} onClick={() => setProfileOf(m.sender === role ? 'me' : 'other')} />
              <div className={`bchat-msg ${m.sender === role ? 'mine' : 'theirs'}${m.deleted_at ? ' deleted' : ''}`}>
              <p style={{ whiteSpace: 'pre-wrap' }}>{m.deleted_at ? 'Na-delete ang mensahe' : m.body}</p>
              {m.image_url && !m.deleted_at && (
                <a href={ikImage(m.image_url, 1200)} target="_blank" rel="noreferrer" className="bchat-proof"><img src={ikImage(m.image_url, 440)} alt="Payment proof" loading="lazy" /></a>
              )}
              {m.auto && !m.deleted_at && m.body.startsWith('Refund requested.') && (booking?.refund_status === 'requested' ? (role === 'owner' && (
                <div className="bchat-refund-msg-btns">
                  <button type="button" className="bchat-confirm-btn" disabled={refundBusy} onClick={() => resolveRefund(true)}>{refundBusy ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />} Confirm refund</button>
                  <button type="button" className="bchat-decline-btn" disabled={refundBusy} onClick={() => resolveRefund(false)}>Decline</button>
                </div>
              )) : booking?.refund_status === 'approved' && <em className="bchat-received"><CheckCircle2 size={13} /> Refund confirmed</em>)}
              {m.image_url && !m.deleted_at && (m.confirmed_at ? (
                <em className="bchat-received"><CheckCircle2 size={13} /> Payment received</em>
              ) : role === 'owner' && (
                <button type="button" className="bchat-confirm-btn" disabled={confirmingId === m.id} onClick={() => confirmReceived(m.id)}>
                  {confirmingId === m.id ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />} Confirm received
                </button>
              ))}
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
        {role !== 'owner' && (
          <div className="bchat-actions">
            <button type="button" className="bchat-pay-btn" onClick={showPayments} aria-label="Show payment method"><Wallet size={16} /> <span>Payment method</span></button>
            {direct && !booking?.refund_status && <button type="button" className="bchat-refund-btn" onClick={() => { setRefundError(''); setRefundAgree(false); setRefundOpen(true); }}><Undo2 size={14} /> <span>Request refund</span></button>}
            <button type="button" className="bchat-ready-btn" onClick={openForm} disabled={!!booking?.outcome} title={booking?.outcome ? 'This booking is already closed' : undefined}><BadgeCheck size={16} /> Ready for payment</button>
          </div>
        )}
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
      {refundOpen && (
        <div className="bchat-confirm-overlay" onClick={() => !refundBusy && setRefundOpen(false)}>
          <form className="bchat-confirm bchat-pay bchat-payform animate-slide-up" role="dialog" aria-modal="true" onSubmit={submitRefund} onClick={(e) => e.stopPropagation()}>
            <div className="bchat-pay-head">
              <span className="bchat-pay-icon"><Undo2 size={20} /></span>
              <h3>Request refund</h3>
            </div>
            <label>Reason
              <textarea value={refundReason} maxLength={300} rows={4} onChange={(e) => setRefundReason(e.target.value)} placeholder="Tell the landlord why you need a refund" />
            </label>
            <div className="bchat-policy">
              <strong>Refund policy</strong>
              <ul>
                <li>Refunds apply only to payments sent through this app with a proof of payment.</li>
                <li>Your request is sent to the {otherProfile.host ? 'host' : 'landlord'} in this chat. They decide whether to confirm or decline it.</li>
                <li>If confirmed, the {otherProfile.host ? 'host' : 'landlord'} sends the refund directly to you through your original payment method.</li>
                <li>Refunds follow the cancellation and refund terms of the listing. Fees already used or services already given may not be refunded.</li>
                <li>You can request a refund only once per booking. Please give a clear and honest reason.</li>
                <li>Keep everything inside the app. Refunds arranged outside the app can&apos;t be tracked or supported.</li>
              </ul>
              <label className="bchat-policy-agree"><input type="checkbox" checked={refundAgree} onChange={(e) => setRefundAgree(e.target.checked)} /> I have read and agree to the refund policy</label>
            </div>
            {refundError && <p className="bchat-error" style={{ padding: '0 0 8px' }}>{refundError}</p>}
            <div className="bchat-confirm-actions">
              <button type="button" className="keep" onClick={() => setRefundOpen(false)} disabled={refundBusy}>Cancel</button>
              <button type="submit" className="go successful" disabled={refundBusy}>{refundBusy ? <Loader2 size={15} className="animate-spin" /> : null} Send request</button>
            </div>
          </form>
        </div>
      )}
      {payOpen && (
        <div className="bchat-confirm-overlay" onClick={() => setPayOpen(false)}>
          <div className="bchat-confirm bchat-pay animate-slide-up" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="bchat-pay-head">
              <span className="bchat-pay-icon"><Wallet size={20} /></span>
              <h3>Payment method</h3>
            </div>
            {payLoading ? <Loader2 size={20} className="animate-spin" /> : !payMethods?.length ? (
              <p>The {otherProfile.host ? 'host' : 'landlord'} hasn&apos;t added a payment method yet. Please ask them in the chat.</p>
            ) : (
              <ul className="bchat-pay-list">
                {payMethods.map((m) => (
                  <li key={m.id}>
                    <div className="bchat-pay-info">
                      <strong>{m.provider}</strong>
                      <span>{m.account_name}</span>
                      <b>{m.account_number}</b>
                      <button type="button" onClick={() => copyNumber(m)}><Copy size={13} /> {copiedId === m.id ? 'Copied!' : 'Copy number'}</button>
                    </div>
                    {m.qr_url && <a href={m.qr_url} target="_blank" rel="noreferrer" className="bchat-pay-qr"><img src={ikImage(m.qr_url, 320)} alt={`${m.provider} QR`} /><small>Tap to enlarge</small></a>}
                  </li>
                ))}
              </ul>
            )}
            <div className="bchat-confirm-actions"><button type="button" className="keep" onClick={() => setPayOpen(false)}>Close</button></div>
          </div>
        </div>
      )}
      {formOpen && (
        <div className="bchat-confirm-overlay" onClick={closeForm}>
          <form className="bchat-confirm bchat-pay bchat-payform animate-slide-up" role="dialog" aria-modal="true" onSubmit={submitPayment} onClick={(e) => e.stopPropagation()}>
            <div className="bchat-pay-head">
              <span className="bchat-pay-icon"><BadgeCheck size={20} /></span>
              <h3>Ready for payment</h3>
            </div>
            <label className="bchat-proof-pick">
              {proofPreview ? <img src={proofPreview} alt="Payment proof preview" /> : <span><ImagePlus size={26} /> Upload proof of payment</span>}
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={pickProof} hidden />
            </label>
            <label>Payment for
              <select value={form.purpose} onChange={setField('purpose')}>
                <option value="">Select...</option>
                {PAYMENT_PURPOSES[booking?.kind === 'staycation' ? 'staycation' : 'rental'].map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </label>
            <label>Reference number<input type="text" value={form.reference} maxLength={60} onChange={setField('reference')} placeholder="e.g. 1234 567 890" /></label>
            <label>Name<input type="text" value={form.name} maxLength={80} onChange={setField('name')} placeholder="Name of sender" /></label>
            <label>Phone number<input type="tel" inputMode="tel" value={form.phone} maxLength={20} onChange={setField('phone')} placeholder="09XX XXX XXXX" /></label>
            <label>Mode of payment<input type="text" value={form.method} maxLength={40} onChange={setField('method')} placeholder="GCash, Maya, Bank transfer..." /></label>
            {formError && <p className="bchat-error" style={{ padding: '0 0 8px' }}>{formError}</p>}
            <div className="bchat-confirm-actions">
              <button type="button" className="keep" onClick={closeForm} disabled={formBusy}>Cancel</button>
              <button type="submit" className="go successful" disabled={formBusy}>{formBusy ? <Loader2 size={15} className="animate-spin" /> : null} Submit</button>
            </div>
          </form>
        </div>
      )}
      {profileOf && <ProfileSheet profile={profileOf === 'me' ? me : otherProfile} isMe={profileOf === 'me'} onClose={() => setProfileOf(null)} />}
    </div>,
    document.body
  );
};

export default BookingChat;
