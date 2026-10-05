import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Phone, CalendarCheck, Send, Info, Loader2, CheckCircle2, ArrowLeft, PawPrint, MessageCircle } from 'lucide-react';
import { CallGateModal } from './CallGate';
import BookingChat from './BookingChat';
import { landlordFromProperty } from '../lib/chatProfiles';
import { newId, rememberGuestBooking } from '../lib/guestBookings';
import { supabase } from '../lib/supabase';
import { validatePhone } from '../lib/validation';
import './ListingActionSheet.css';
import { ikImage } from '../lib/imagekit';

const pad = (n) => String(n).padStart(2, '0');
const toDateInput = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (dateStr, days) => {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + days);
  return toDateInput(d);
};
const nightsBetween = (a, b) => Math.round((new Date(`${b}T00:00:00`) - new Date(`${a}T00:00:00`)) / 86400000);
const CUSTOMER_KEY = 'budgetrent_customer_info';
const readCustomer = () => {
  try { return JSON.parse(localStorage.getItem(CUSTOMER_KEY)) || {}; } catch { return {}; }
};
const peso = (n) => `₱${Number(n || 0).toLocaleString()}`;
const prettyDate = (s) => (s ? new Date(`${s}T00:00:00`).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : '—');
const PURPOSES = ['Family getaway', 'Barkada trip', 'Couple / Honeymoon', 'Celebration / Event', 'Work / Remote', 'Other'];
const PAY_METHODS = ['GCash', 'Maya', 'Bank transfer', 'Cash'];
const ARRIVAL_TIMES = ['Before 12 PM', '12 PM - 2 PM', '2 PM - 4 PM', '4 PM - 6 PM', '6 PM - 8 PM', 'After 8 PM'];

// Book Here para sa Staycation (petsa, guests, presyo) at Find Rent (petsa ng lipat/bisita).
// Nase-save sa booking_requests, lumalabas sa Bookings ng landlord, at may chat ang tenant at owner.
// Request lang ito — ang owner pa rin ang magkukumpirma. Wala pang online payment.
const ListingActionSheet = ({ item, kind, onClose, onViewDetails, fullPage }) => {
  const isBook = kind === 'book';
  const today = toDateInput(new Date());
  const setAdultsMax = Number(item?.max_adults) || 0;
  const setChildrenMax = Number(item?.max_children);
  const hasLimits = setAdultsMax > 0;
  const capacity = hasLimits ? setAdultsMax + Math.max(0, setChildrenMax || 0) : Math.max(1, Number(item?.rooms) || 1) * 2;
  const adultsMax = hasLimits ? setAdultsMax : capacity;
  const childrenMaxFor = (a) => (hasLimits ? Math.max(0, setChildrenMax || 0) : capacity - a);

  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [adults, setAdults] = useState(Math.min(2, adultsMax));
  const [children, setChildren] = useState(0);
  const [pets, setPets] = useState(false);
  const [arrival, setArrival] = useState('');
  const [extra, setExtra] = useState('');
  const [purpose, setPurpose] = useState('');
  const [vehicles, setVehicles] = useState(0);
  const [payMethod, setPayMethod] = useState('');
  const [emName, setEmName] = useState('');
  const [emPhone, setEmPhone] = useState('');
  const [agree, setAgree] = useState(false);
  const [step, setStep] = useState(1); // staycation: 1 = petsa at guests, 2 = detalye ng guest
  const [callGateOpen, setCallGateOpen] = useState(false);
  const [custName, setCustName] = useState(() => readCustomer().name || '');
  const [custPhone, setCustPhone] = useState(() => readCustomer().phone || '');
  const [custEmail, setCustEmail] = useState(() => readCustomer().email || '');
  const [bookedRanges, setBookedRanges] = useState([]);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [sendError, setSendError] = useState('');
  const [rentDate, setRentDate] = useState('');
  const [occupants, setOccupants] = useState(1);
  const [placed, setPlaced] = useState(null); // { id, token } ng naipadalang booking
  const [chatOpen, setChatOpen] = useState(false);

  // Tenant account: i-prefill ang pangalan at number mula sa account (puwede pa ring baguhin)
  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      const meta = data?.session?.user?.user_metadata;
      if (!alive || meta?.user_role !== 'tenant') return;
      const local = /^639\d{9}$/.test(meta.phone || '') ? `0${meta.phone.slice(2)}` : (meta.phone || '');
      setCustName((v) => v || meta.full_name || '');
      setCustPhone((v) => v || local);
    });
    return () => { alive = false; };
  }, []);

  // Mga petsang confirmed na (petsa lang, walang personal info)
  useEffect(() => {
    if (!isBook || !item?.id) return;
    let alive = true;
    supabase.rpc('get_booked_ranges', { p_property_id: item.id }).then(({ data, error }) => {
      if (alive && !error) setBookedRanges(data || []);
    });
    return () => { alive = false; };
  }, [isBook, item?.id]);

  const name = item?.name || item?.title || item?.location?.split(',')[0] || 'listing';
  const nights = isBook && checkIn && checkOut ? nightsBetween(checkIn, checkOut) : 0;
  const overlaps = isBook && nights >= 1 && bookedRanges.some((r) => checkIn < r.check_out && checkOut > r.check_in);
  const datesValid = !isBook || (nights >= 1 && !overlaps);
  const total = nights * (Number(item?.price) || 0);
  const downPayment = Math.min(Number(item?.down_payment) || 0, total || Infinity);
  const guests = adults + children;
  const petsAllowed = item?.pets_allowed === true || /^(true|yes|allowed)$/i.test(String(item?.pets_allowed || ''));

  const phone = String(item?.contact || '').trim();
  const email = String(item?.email || '').trim();

  const sendRequest = async () => {
    const cleanName = custName.trim();
    const phoneCheck = validatePhone(custPhone);
    const cleanEmail = custEmail.trim();
    if (cleanName.length < 2) return setSendError('Please enter your full name.');
    if (!phoneCheck.isValid) return setSendError('Enter a valid PH number (e.g. 09171234567).');
    if (cleanEmail && !/^\S+@\S+\.\S+$/.test(cleanEmail)) return setSendError('Invalid email address.');
    let emergencyPhone = null;
    if (isBook && (emName.trim() || emPhone.trim())) {
      const emCheck = validatePhone(emPhone);
      if (emName.trim().length < 2 || !emCheck.isValid) return setSendError('Enter your emergency contact name and a valid PH number, or leave both blank.');
      emergencyPhone = emCheck.sanitized;
    }
    if (isBook && !agree) return setSendError('Please confirm that you agree to the house rules and booking terms.');
    if (!isBook && !rentDate) return setSendError('Pick a move-in or visit date.');
    setSending(true);
    setSendError('');
    try { localStorage.setItem(CUSTOMER_KEY, JSON.stringify({ name: cleanName, phone: phoneCheck.sanitized, email: cleanEmail })); } catch { /* ignore */ }
    const id = newId();
    const token = newId();
    const common = {
      id,
      guest_token: token,
      property_id: item.id,
      owner_email: email || null,
      customer_name: cleanName.slice(0, 80),
      customer_phone: phoneCheck.sanitized,
      customer_email: cleanEmail || null,
      note: extra.trim() || null
    };
    const payload = isBook
      ? { ...common, kind: 'staycation', check_in: checkIn, check_out: checkOut, guests, adults, children, pets, arrival_time: arrival || null, total_price: total, down_payment: downPayment, purpose: purpose || null, vehicles, payment_method: downPayment > 0 ? (payMethod || null) : null, emergency_name: emergencyPhone ? emName.trim().slice(0, 80) : null, emergency_phone: emergencyPhone }
      : { ...common, kind: 'rent', check_in: rentDate, check_out: null, guests: occupants, adults: occupants, children: 0, pets: false, total_price: Number(item?.price) || 0, down_payment: 0 };
    const { error } = await supabase.from('booking_requests').insert(payload);
    setSending(false);
    if (error) return setSendError(error.message || "Couldn't send. Please try again.");
    rememberGuestBooking({ id, token, title: name, kind: payload.kind });
    setPlaced({ id, token });
    setSent(true);
    setChatOpen(true); // kusang bubukas ang chat para makita agad ang booking details na naipadala
  };

  const callOption = phone && (
    <a href={`tel:${phone}`} onClick={(e) => { e.preventDefault(); setCallGateOpen(true); }} className="act-option call">
      <Phone size={18} /> Call {isBook ? 'Host' : 'Owner'}
    </a>
  );

  const header = (
    <>
      <button type="button" className="act-close" aria-label={fullPage ? "Back" : "Close"} onClick={onClose}>{fullPage ? <ArrowLeft size={18} /> : <X size={18} />}</button>
      <div className="act-head">
        <span className={`act-badge ${isBook ? 'stay' : 'rent'}`}>{isBook ? <CalendarCheck size={20} /> : <Send size={20} />}</span>
        <div>
          <h3>{isBook ? (step === 2 && !sent ? 'Confirm & Book' : 'Book Here') : 'Inquire'}</h3>
          <p>{name}</p>
        </div>
      </div>
      <div className="act-summary">
        <img src={ikImage(item?.image, 240) || '/placeholder.png'} alt="" />
        <div>
          <strong>{peso(item?.price)}<em>{isBook ? '/night' : '/month'}</em></strong>
          <span>{item?.location}</span>
        </div>
      </div>
    </>
  );

  const breakdown = nights >= 1 && (
    <div className="act-breakdown">
      <div><span>{peso(item?.price)} × {nights} night{nights > 1 ? 's' : ''}</span><strong>{peso(total)}</strong></div>
      {downPayment > 0 && <div><span>Down payment (to secure the booking)</span><strong>{peso(downPayment)}</strong></div>}
      {downPayment > 0 && <div><span>Balance due on arrival</span><strong>{peso(total - downPayment)}</strong></div>}
      <div className="total"><span>Total</span><strong>{peso(total)}</strong></div>
    </div>
  );

  // ---------- Staycation: Book Here ----------
  if (isBook) {
    return createPortal(
      <div className={`act-overlay${fullPage ? " full" : ""}`} onClick={onClose}>
        <div className="act-sheet animate-slide-up" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Book Here">
          {header}

          {sent ? (
            <div className="act-success">
              <CheckCircle2 size={44} color="#059669" />
              <h4>Booking request sent!</h4>
              <p>{prettyDate(checkIn)} → {prettyDate(checkOut)} • {nights} night{nights > 1 ? 's' : ''} • {guests} guest{guests > 1 ? 's' : ''}</p>
              <p>Please wait for the host to confirm. They&apos;ll call you at {custPhone}. No payment has been taken.</p>
              <button type="button" className="act-option reserve" style={{ width: '100%', border: 'none', cursor: 'pointer', marginTop: 10 }} onClick={() => setChatOpen(true)}>
                <MessageCircle size={18} /> Chat with host
              </button>
              <button type="button" className="act-details" onClick={onClose}>Close</button>
            </div>
          ) : step === 1 ? (
            <>
              {/^(occupied|accommodated|rented|unavailable)$/i.test(String(item?.availability || '').trim()) && (
                <p className="act-hint"><Info size={14} /> This staycation is currently occupied, but you can still book other dates.</p>
              )}

              <div className="act-form">
                <label>
                  Check-in
                  <input type="date" min={today} value={checkIn} onChange={(e) => {
                    const v = e.target.value;
                    setCheckIn(v);
                    if (v && (!checkOut || nightsBetween(v, checkOut) < 1)) setCheckOut(addDays(v, 1));
                  }} />
                </label>
                <label>
                  Check-out
                  <input type="date" min={checkIn ? addDays(checkIn, 1) : addDays(today, 1)} value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />
                </label>
                <label>
                  Adults
                  <select value={adults} onChange={(e) => { const v = Number(e.target.value); setAdults(v); setChildren((c) => Math.min(c, childrenMaxFor(v))); }}>
                    {Array.from({ length: adultsMax }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </label>
                <label>
                  Children
                  <select value={children} onChange={(e) => setChildren(Number(e.target.value))}>
                    {Array.from({ length: childrenMaxFor(adults) + 1 }, (_, i) => i).map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </label>
                {petsAllowed && (
                  <label className="act-check wide">
                    <input type="checkbox" checked={pets} onChange={(e) => setPets(e.target.checked)} />
                    <span><PawPrint size={14} /> Bringing a pet</span>
                  </label>
                )}
              </div>

              {overlaps && <p className="act-hint"><Info size={14} /> Some of these dates are already booked. Please pick other dates.</p>}
              {bookedRanges.length > 0 && (
                <p className="act-hint"><Info size={14} /> Already booked: {bookedRanges.map((r) => `${prettyDate(r.check_in)} → ${prettyDate(r.check_out)}`).join(', ')}</p>
              )}
              {breakdown}
              {!datesValid && !overlaps && <p className="act-hint"><Info size={14} /> Pick your check-in and check-out dates first.</p>}

              <div className="act-options stacked" style={{ marginTop: 14 }}>
                <button type="button" className="act-option reserve" style={{ border: 'none', cursor: 'pointer' }}
                  disabled={!datesValid} onClick={() => setStep(2)}>
                  <CalendarCheck size={18} /> Book Here
                </button>
                {callOption}
              </div>
            </>
          ) : (
            <>
              <button type="button" className="act-back" onClick={() => { setStep(1); setSendError(''); }}><ArrowLeft size={14} /> Change dates</button>

              <div className="act-trip">
                <div><span>Check-in</span><strong>{prettyDate(checkIn)}</strong></div>
                <div><span>Check-out</span><strong>{prettyDate(checkOut)}</strong></div>
                <div><span>Guests</span><strong>{adults} adult{adults > 1 ? 's' : ''}{children ? `, ${children} child${children > 1 ? 'ren' : ''}` : ''}{pets ? ' + pet' : ''}</strong></div>
              </div>

              {breakdown}

              <h4 className="act-section-title">Guest details</h4>
              <div className="act-form">
                <label className="wide">
                  Full name
                  <input type="text" maxLength={80} autoComplete="name" placeholder="Juan Dela Cruz" value={custName} onChange={(e) => setCustName(e.target.value)} />
                </label>
                <label>
                  Contact number
                  <input type="tel" inputMode="tel" maxLength={16} autoComplete="tel" placeholder="09171234567" value={custPhone} onChange={(e) => setCustPhone(e.target.value)} />
                </label>
                <label>
                  Email (optional)
                  <input type="email" maxLength={120} autoComplete="email" placeholder="juan@email.com" value={custEmail} onChange={(e) => setCustEmail(e.target.value)} />
                </label>
                <label className="wide">
                  Arrival time
                  <select value={arrival} onChange={(e) => setArrival(e.target.value)}>
                    <option value="">Not sure yet</option>
                    {ARRIVAL_TIMES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </label>
                <label className="wide">
                  Purpose of stay
                  <select value={purpose} onChange={(e) => setPurpose(e.target.value)}>
                    <option value="">Select (optional)</option>
                    {PURPOSES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </label>
                <label>
                  Vehicles (parking)
                  <select value={vehicles} onChange={(e) => setVehicles(Number(e.target.value))}>
                    {[0, 1, 2, 3, 4].map((n) => <option key={n} value={n}>{n === 0 ? 'None' : n}</option>)}
                  </select>
                </label>
                {downPayment > 0 && (
                  <label>
                    Pay down payment via
                    <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
                      <option value="">Not sure yet</option>
                      {PAY_METHODS.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </label>
                )}
                <label>
                  Emergency contact (optional)
                  <input type="text" maxLength={80} placeholder="Name" value={emName} onChange={(e) => setEmName(e.target.value)} />
                </label>
                <label>
                  Emergency number
                  <input type="tel" inputMode="tel" maxLength={16} placeholder="09171234567" value={emPhone} onChange={(e) => setEmPhone(e.target.value)} />
                </label>
                <label className="wide">
                  Message to host (optional)
                  <input type="text" maxLength={200} placeholder="e.g. It's a celebration / bringing kids" value={extra} onChange={(e) => setExtra(e.target.value)} />
                </label>
              </div>

              {item?.house_rules && (
                <>
                  <h4 className="act-section-title">House rules</h4>
                  <p style={{ margin: '0 0 10px', whiteSpace: 'pre-line', fontSize: '0.85rem', color: '#475569' }}>{item.house_rules}</p>
                </>
              )}
              {item?.cancellation_policy && (
                <>
                  <h4 className="act-section-title">Cancellation policy</h4>
                  <p style={{ margin: '0 0 10px', whiteSpace: 'pre-line', fontSize: '0.85rem', color: '#475569' }}>{item.cancellation_policy}</p>
                </>
              )}

              <label className="act-check agree">
                <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
                <span>I agree to the host&apos;s house rules{item?.cancellation_policy ? ', cancellation policy' : ''}{downPayment > 0 ? ` and the ${peso(downPayment)} down payment to secure the booking` : ''}. I will present a valid ID upon check-in.</span>
              </label>

              <button type="button" className="act-option reserve" style={{ width: '100%', border: 'none', cursor: 'pointer', marginTop: 12 }}
                disabled={sending} onClick={sendRequest}>
                {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />} Send Booking Request
              </button>
              {sendError && <p className="act-hint" style={{ color: '#dc2626' }}><Info size={14} /> {sendError}</p>}
              <p className="act-note"><Info size={14} /> This is only a request — the host will still confirm the booking. No payment is taken here.</p>
            </>
          )}

          {onViewDetails && <button type="button" className="act-details" onClick={() => { onClose(); onViewDetails(item); }}>View full details</button>}
        </div>
        {callGateOpen && <CallGateModal phone={phone} propertyId={item?.id} ownerEmail={email} onClose={() => setCallGateOpen(false)} />}
        {chatOpen && placed && <BookingChat bookingId={placed.id} token={placed.token} role="guest" title={name} other={landlordFromProperty(item)} meName={custName} onClose={() => setChatOpen(false)} />}
      </div>,
      document.body
    );
  }

  // ---------- Find Rent: Book Here ----------
  // Portal sa body para nasa ibabaw ng bottom nav at hindi maipit sa animated na parent
  return createPortal(
    <div className={`act-overlay${fullPage ? " full" : ""}`} onClick={onClose}>
      <div className="act-sheet animate-slide-up" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Book Here">
        {header}

        {sent ? (
          <div className="act-success">
            <CheckCircle2 size={44} color="#059669" />
            <h4>Booking request sent!</h4>
            <p>Date: {prettyDate(rentDate)} • {occupants} {occupants > 1 ? 'people' : 'person'}</p>
            <p>Please wait for the owner&apos;s reply. You can chat with them here if you have questions.</p>
            <button type="button" className="act-option reserve" style={{ width: '100%', border: 'none', cursor: 'pointer', marginTop: 10 }} onClick={() => setChatOpen(true)}>
              <MessageCircle size={18} /> Chat with owner
            </button>
            <button type="button" className="act-details" onClick={onClose}>Close</button>
          </div>
        ) : (
          <>
            <div className="act-form">
              <label className="wide">
                Preferred move-in or visit date
                <input type="date" min={today} value={rentDate} onChange={(e) => setRentDate(e.target.value)} />
              </label>
              <label className="wide">
                Number of occupants
                <select value={occupants} onChange={(e) => setOccupants(Number(e.target.value))}>
                  {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n} {n > 1 ? 'people' : 'person'}</option>)}
                </select>
              </label>
              <label className="wide">
                Full name
                <input type="text" maxLength={80} autoComplete="name" placeholder="Juan Dela Cruz" value={custName} onChange={(e) => setCustName(e.target.value)} />
              </label>
              <label>
                Contact number
                <input type="tel" inputMode="tel" maxLength={16} autoComplete="tel" placeholder="09171234567" value={custPhone} onChange={(e) => setCustPhone(e.target.value)} />
              </label>
              <label>
                Email (optional)
                <input type="email" maxLength={120} autoComplete="email" placeholder="juan@email.com" value={custEmail} onChange={(e) => setCustEmail(e.target.value)} />
              </label>
              <label className="wide">
                Message to owner (optional)
                <input type="text" maxLength={200} placeholder="e.g. Can I drop by tomorrow?" value={extra} onChange={(e) => setExtra(e.target.value)} />
              </label>
            </div>

            <div className="act-options stacked">
              <button type="button" className="act-option reserve" style={{ border: 'none', cursor: 'pointer' }} disabled={sending} onClick={sendRequest}>
                {sending ? <Loader2 size={18} className="animate-spin" /> : <CalendarCheck size={18} />} Book Here
              </button>
            </div>
            {sendError && <p className="act-hint" style={{ color: '#dc2626' }}><Info size={14} /> {sendError}</p>}
            <p className="act-note"><Info size={14} /> This is only a request — the owner will still confirm availability. No payment is taken here.</p>
          </>
        )}

        {onViewDetails && <button type="button" className="act-details" onClick={() => { onClose(); onViewDetails(item); }}>View full details</button>}
      </div>
      {callGateOpen && <CallGateModal phone={phone} propertyId={item?.id} ownerEmail={email} onClose={() => setCallGateOpen(false)} />}
      {chatOpen && placed && <BookingChat bookingId={placed.id} token={placed.token} role="guest" title={name} other={landlordFromProperty(item)} meName={custName} onClose={() => setChatOpen(false)} />}
    </div>,
    document.body
  );
};

export default ListingActionSheet;
