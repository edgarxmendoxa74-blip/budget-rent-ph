import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Phone, CalendarCheck, Send, Info, Loader2, CheckCircle2, ArrowLeft, PawPrint, MessageCircle } from 'lucide-react';
import { CallGateModal } from './CallGate';
import BookingChat from './BookingChat';
import { newId, rememberGuestBooking } from '../lib/guestBookings';
import { supabase } from '../lib/supabase';
import { validatePhone } from '../lib/validation';
import './ListingActionSheet.css';

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
const ARRIVAL_TIMES = ['Before 12 PM', '12 PM - 2 PM', '2 PM - 4 PM', '4 PM - 6 PM', '6 PM - 8 PM', 'After 8 PM'];

// Book Here para sa Staycation (petsa, guests, presyo) at Find Rent (petsa ng lipat/bisita).
// Nase-save sa booking_requests, lumalabas sa Bookings ng landlord, at may chat ang tenant at owner.
// Request lang ito — ang owner pa rin ang magkukumpirma. Wala pang online payment.
const ListingActionSheet = ({ item, kind, onClose, onViewDetails }) => {
  const isBook = kind === 'book';
  const today = toDateInput(new Date());
  const capacity = Math.max(1, Number(item?.rooms) || 1) * 2;

  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [adults, setAdults] = useState(Math.min(2, capacity));
  const [children, setChildren] = useState(0);
  const [pets, setPets] = useState(false);
  const [arrival, setArrival] = useState('');
  const [extra, setExtra] = useState('');
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
    if (cleanName.length < 2) return setSendError('Ilagay ang buong pangalan mo.');
    if (!phoneCheck.isValid) return setSendError('Maglagay ng valid na PH number (hal. 09171234567).');
    if (cleanEmail && !/^\S+@\S+\.\S+$/.test(cleanEmail)) return setSendError('Hindi valid ang email.');
    if (isBook && !agree) return setSendError('I-check muna na sumasang-ayon ka sa house rules at booking terms.');
    if (!isBook && !rentDate) return setSendError('Pumili ng petsa ng lipat o pagbisita.');
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
      ? { ...common, kind: 'staycation', check_in: checkIn, check_out: checkOut, guests, adults, children, pets, arrival_time: arrival || null, total_price: total, down_payment: downPayment }
      : { ...common, kind: 'rent', check_in: rentDate, check_out: null, guests: occupants, adults: occupants, children: 0, pets: false, total_price: Number(item?.price) || 0, down_payment: 0 };
    const { error } = await supabase.from('booking_requests').insert(payload);
    setSending(false);
    if (error) return setSendError(error.message || 'Hindi naipadala. Subukan ulit.');
    rememberGuestBooking({ id, token, title: name, kind: payload.kind });
    setPlaced({ id, token });
    setSent(true);
  };

  const callOption = phone && (
    <a href={`tel:${phone}`} onClick={(e) => { e.preventDefault(); setCallGateOpen(true); }} className="act-option call">
      <Phone size={18} /> Call Owner
    </a>
  );

  const header = (
    <>
      <button type="button" className="act-close" aria-label="Isara" onClick={onClose}><X size={18} /></button>
      <div className="act-head">
        <span className={`act-badge ${isBook ? 'stay' : 'rent'}`}>{isBook ? <CalendarCheck size={20} /> : <Send size={20} />}</span>
        <div>
          <h3>{isBook ? (step === 2 && !sent ? 'Confirm & Book' : 'Book Here') : 'Mag-inquire'}</h3>
          <p>{name}</p>
        </div>
      </div>
      <div className="act-summary">
        <img src={item?.image || '/placeholder.png'} alt="" />
        <div>
          <strong>{peso(item?.price)}<em>{isBook ? '/gabi' : '/buwan'}</em></strong>
          <span>{item?.location}</span>
        </div>
      </div>
    </>
  );

  const breakdown = nights >= 1 && (
    <div className="act-breakdown">
      <div><span>{peso(item?.price)} × {nights} gabi</span><strong>{peso(total)}</strong></div>
      {downPayment > 0 && <div><span>Down payment (para ma-secure ang booking)</span><strong>{peso(downPayment)}</strong></div>}
      {downPayment > 0 && <div><span>Balance pagdating</span><strong>{peso(total - downPayment)}</strong></div>}
      <div className="total"><span>Total</span><strong>{peso(total)}</strong></div>
    </div>
  );

  // ---------- Staycation: Book Here ----------
  if (isBook) {
    return createPortal(
      <div className="act-overlay" onClick={onClose}>
        <div className="act-sheet animate-slide-up" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Book Here">
          {header}

          {sent ? (
            <div className="act-success">
              <CheckCircle2 size={44} color="#059669" />
              <h4>Naipadala na ang booking request!</h4>
              <p>{prettyDate(checkIn)} → {prettyDate(checkOut)} • {nights} gabi • {guests} guest{guests > 1 ? 's' : ''}</p>
              <p>Maghintay ng kumpirmasyon ng owner. Tatawagan ka nila sa {custPhone}. Wala pang bayad na kinuha.</p>
              <button type="button" className="act-option reserve" style={{ width: '100%', border: 'none', cursor: 'pointer', marginTop: 10 }} onClick={() => setChatOpen(true)}>
                <MessageCircle size={18} /> Mag-chat sa owner
              </button>
              <button type="button" className="act-details" onClick={onClose}>Isara</button>
            </div>
          ) : step === 1 ? (
            <>
              {/^(occupied|accommodated|rented|unavailable)$/i.test(String(item?.availability || '').trim()) && (
                <p className="act-hint"><Info size={14} /> Occupied ngayon ang staycation na ito, pero puwede ka pa ring mag-book para sa ibang petsa.</p>
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
                  <select value={adults} onChange={(e) => { const v = Number(e.target.value); setAdults(v); setChildren((c) => Math.min(c, capacity - v)); }}>
                    {Array.from({ length: capacity }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </label>
                <label>
                  Children
                  <select value={children} onChange={(e) => setChildren(Number(e.target.value))}>
                    {Array.from({ length: capacity - adults + 1 }, (_, i) => i).map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </label>
                {petsAllowed && (
                  <label className="act-check wide">
                    <input type="checkbox" checked={pets} onChange={(e) => setPets(e.target.checked)} />
                    <span><PawPrint size={14} /> May kasamang alagang hayop</span>
                  </label>
                )}
              </div>

              {overlaps && <p className="act-hint"><Info size={14} /> Booked na ang ilan sa mga petsang ito. Pumili ng ibang petsa.</p>}
              {bookedRanges.length > 0 && (
                <p className="act-hint"><Info size={14} /> Booked na: {bookedRanges.map((r) => `${prettyDate(r.check_in)} → ${prettyDate(r.check_out)}`).join(', ')}</p>
              )}
              {breakdown}
              {!datesValid && !overlaps && <p className="act-hint"><Info size={14} /> Pumili muna ng check-in at check-out.</p>}

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
              <button type="button" className="act-back" onClick={() => { setStep(1); setSendError(''); }}><ArrowLeft size={14} /> Baguhin ang petsa</button>

              <div className="act-trip">
                <div><span>Check-in</span><strong>{prettyDate(checkIn)}</strong></div>
                <div><span>Check-out</span><strong>{prettyDate(checkOut)}</strong></div>
                <div><span>Guests</span><strong>{adults} adult{adults > 1 ? 's' : ''}{children ? `, ${children} bata` : ''}{pets ? ' + pet' : ''}</strong></div>
              </div>

              {breakdown}

              <h4 className="act-section-title">Detalye ng guest</h4>
              <div className="act-form">
                <label className="wide">
                  Buong pangalan
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
                  Oras ng pagdating
                  <select value={arrival} onChange={(e) => setArrival(e.target.value)}>
                    <option value="">Hindi pa sigurado</option>
                    {ARRIVAL_TIMES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </label>
                <label className="wide">
                  Mensahe sa owner (optional)
                  <input type="text" maxLength={200} placeholder="hal. Celebration po ito / may kasamang bata" value={extra} onChange={(e) => setExtra(e.target.value)} />
                </label>
              </div>

              <label className="act-check agree">
                <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
                <span>Sumasang-ayon ako sa house rules ng owner{downPayment > 0 ? ` at sa down payment na ${peso(downPayment)} para ma-secure ang booking` : ''}.</span>
              </label>

              <button type="button" className="act-option reserve" style={{ width: '100%', border: 'none', cursor: 'pointer', marginTop: 12 }}
                disabled={sending} onClick={sendRequest}>
                {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />} Send Booking Request
              </button>
              {sendError && <p className="act-hint" style={{ color: '#dc2626' }}><Info size={14} /> {sendError}</p>}
              <p className="act-note"><Info size={14} /> Request lang ito — ang owner pa rin ang magkukumpirma ng booking. Wala pang bayad na kinukuha dito.</p>
            </>
          )}

          <button type="button" className="act-details" onClick={() => { onClose(); onViewDetails(item); }}>Tingnan ang buong detalye</button>
        </div>
        {callGateOpen && <CallGateModal phone={phone} propertyId={item?.id} ownerEmail={email} onClose={() => setCallGateOpen(false)} />}
        {chatOpen && placed && <BookingChat bookingId={placed.id} token={placed.token} role="guest" title={name} onClose={() => setChatOpen(false)} />}
      </div>,
      document.body
    );
  }

  // ---------- Find Rent: Book Here ----------
  // Portal sa body para nasa ibabaw ng bottom nav at hindi maipit sa animated na parent
  return createPortal(
    <div className="act-overlay" onClick={onClose}>
      <div className="act-sheet animate-slide-up" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Book Here">
        {header}

        {sent ? (
          <div className="act-success">
            <CheckCircle2 size={44} color="#059669" />
            <h4>Naipadala na ang booking request!</h4>
            <p>Petsa: {prettyDate(rentDate)} • {occupants} tao</p>
            <p>Maghintay ng sagot ng owner. Puwede mo siyang i-chat dito para sa mga tanong.</p>
            <button type="button" className="act-option reserve" style={{ width: '100%', border: 'none', cursor: 'pointer', marginTop: 10 }} onClick={() => setChatOpen(true)}>
              <MessageCircle size={18} /> Mag-chat sa owner
            </button>
            <button type="button" className="act-details" onClick={onClose}>Isara</button>
          </div>
        ) : (
          <>
            <div className="act-form">
              <label className="wide">
                Gustong petsa ng lipat o pagbisita
                <input type="date" min={today} value={rentDate} onChange={(e) => setRentDate(e.target.value)} />
              </label>
              <label className="wide">
                Ilang tao ang titira
                <select value={occupants} onChange={(e) => setOccupants(Number(e.target.value))}>
                  {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n} tao</option>)}
                </select>
              </label>
              <label className="wide">
                Buong pangalan
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
                Mensahe sa owner (optional)
                <input type="text" maxLength={200} placeholder="hal. Puwede po ba akong pumunta bukas?" value={extra} onChange={(e) => setExtra(e.target.value)} />
              </label>
            </div>

            <div className="act-options stacked">
              <button type="button" className="act-option reserve" style={{ border: 'none', cursor: 'pointer' }} disabled={sending} onClick={sendRequest}>
                {sending ? <Loader2 size={18} className="animate-spin" /> : <CalendarCheck size={18} />} Book Here
              </button>
              {callOption}
            </div>
            {sendError && <p className="act-hint" style={{ color: '#dc2626' }}><Info size={14} /> {sendError}</p>}
            <p className="act-note"><Info size={14} /> Request lang ito — ang owner pa rin ang magkukumpirma ng availability. Walang bayad na kinukuha dito.</p>
          </>
        )}

        <button type="button" className="act-details" onClick={() => { onClose(); onViewDetails(item); }}>Tingnan ang buong detalye</button>
      </div>
      {callGateOpen && <CallGateModal phone={phone} propertyId={item?.id} ownerEmail={email} onClose={() => setCallGateOpen(false)} />}
      {chatOpen && placed && <BookingChat bookingId={placed.id} token={placed.token} role="guest" title={name} onClose={() => setChatOpen(false)} />}
    </div>,
    document.body
  );
};

export default ListingActionSheet;
