import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Phone, Mail, CalendarCheck, Send, Info, BookmarkCheck } from 'lucide-react';
import './ListingActionSheet.css';

const pad = (n) => String(n).padStart(2, '0');
const toDateInput = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (dateStr, days) => {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + days);
  return toDateInput(d);
};
const nightsBetween = (a, b) => Math.round((new Date(`${b}T00:00:00`) - new Date(`${a}T00:00:00`)) / 86400000);
const peso = (n) => `₱${Number(n || 0).toLocaleString()}`;

// Inquire (Find Rent) at Book (Staycation): gumagawa ng handang mensahe at ipinapadala sa owner.
// Request lang ito — ang owner pa rin ang magkukumpirma. Wala pang online payment o booking system.
const ListingActionSheet = ({ item, kind, onClose, onViewDetails }) => {
  const isBook = kind === 'book';
  const today = toDateInput(new Date());
  const capacity = Math.max(1, Number(item?.rooms) || 1) * 2;

  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [guests, setGuests] = useState(Math.min(2, capacity));
  const [extra, setExtra] = useState('');

  const name = item?.name || item?.title || item?.location?.split(',')[0] || 'listing';
  const nights = isBook && checkIn && checkOut ? nightsBetween(checkIn, checkOut) : 0;
  const datesValid = !isBook || nights >= 1;
  const total = nights * (Number(item?.price) || 0);

  const message = useMemo(() => {
    const note = extra.trim() ? `\n${extra.trim()}` : '';
    if (isBook) {
      return `Kumusta po! Gusto ko pong mag-book ng "${name}" (${item?.location || ''}).\n` +
        `Check-in: ${checkIn || '—'}\nCheck-out: ${checkOut || '—'}${nights ? ` (${nights} gabi)` : ''}\n` +
        `Guests: ${guests}\n${nights ? `Tinatayang total: ${peso(total)} (${peso(item?.price)}/gabi)\n` : ''}` +
        `Available po ba sa mga petsang ito? Salamat po!${note}`;
    }
    return `Kumusta po! Interesado po ako sa "${name}" sa ${item?.location || ''} (${peso(item?.price)}/buwan).\n` +
      `Available pa po ba? Puwede po bang malaman ang mga detalye at kung kailan ako puwedeng makapunta? Salamat po!${note}`;
  }, [isBook, name, item, checkIn, checkOut, nights, guests, total, extra]);

  const phone = String(item?.contact || '').trim();
  const email = String(item?.email || '').trim();
  const encoded = encodeURIComponent(message);

  // Reserve slot (staycation lang): ipinapadala sa WhatsApp ng owner kung meron, kung wala ay SMS
  const reserveMessage = useMemo(() => {
    const note = extra.trim() ? `
${extra.trim()}` : '';
    return `Kumusta po! Gusto ko pong mag-RESERVE ng slot sa "${name}" (${item?.location || ''}).
` +
      `Check-in: ${checkIn || '—'}
Check-out: ${checkOut || '—'}${nights ? ` (${nights} gabi)` : ''}
` +
      `Guests: ${guests}
${nights ? `Tinatayang total: ${peso(total)}
` : ''}` +
      `Paki-confirm po kung puwede pa at paano ang reservation. Salamat po!${note}`;
  }, [name, item, checkIn, checkOut, nights, guests, total, extra]);
  const waNumber = String(item?.owner_whatsapp || '').replace(/D/g, '');
  const reserveHref = waNumber
    ? `https://wa.me/${waNumber}?text=${encodeURIComponent(reserveMessage)}`
    : phone ? `sms:${phone}?&body=${encodeURIComponent(reserveMessage)}` : null;

  const options = [
    email && { key: 'mail', label: 'Email Owner', Icon: Mail, href: `mailto:${email}?subject=${encodeURIComponent(`${isBook ? 'Booking request' : 'Inquiry'}: ${name}`)}&body=${encoded}` },
    isBook && reserveHref && { key: 'reserve', label: 'Reserve Slot', Icon: BookmarkCheck, href: reserveHref },
    phone && { key: 'call', label: 'Call Owner', Icon: Phone, href: `tel:${phone}` }
  ].filter(Boolean);

  // Portal sa body para nasa ibabaw ng bottom nav at hindi maipit sa animated na parent
  return createPortal(
    <div className="act-overlay" onClick={onClose}>
      <div className="act-sheet animate-slide-up" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={isBook ? 'Book' : 'Inquire'}>
        <button type="button" className="act-close" aria-label="Isara" onClick={onClose}><X size={18} /></button>

        <div className="act-head">
          <span className={`act-badge ${isBook ? 'stay' : 'rent'}`}>{isBook ? <CalendarCheck size={20} /> : <Send size={20} />}</span>
          <div>
            <h3>{isBook ? 'Mag-book' : 'Mag-inquire'}</h3>
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

        {isBook && /^(occupied|accommodated|rented|unavailable)$/i.test(String(item?.availability || '').trim()) && (
          <p className="act-hint"><Info size={14} /> Occupied ngayon ang staycation na ito, pero puwede ka pa ring mag-reserve ng slot para sa ibang petsa.</p>
        )}

        {isBook && (
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
            <label className="wide">
              Guests
              <select value={guests} onChange={(e) => setGuests(Number(e.target.value))}>
                {Array.from({ length: capacity }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>{n} guest{n > 1 ? 's' : ''}</option>
                ))}
              </select>
            </label>
            {nights >= 1 && (
              <div className="act-total wide">
                <span>{nights} gabi × {peso(item?.price)}</span>
                <strong>≈ {peso(total)}</strong>
              </div>
            )}
          </div>
        )}

        <label className="act-extra">
          Dagdag na mensahe (optional)
          <input type="text" maxLength={200} placeholder={isBook ? 'hal. May kasamang bata' : 'hal. Puwede po ba akong pumunta bukas?'} value={extra} onChange={(e) => setExtra(e.target.value)} />
        </label>

        <div className="act-preview" aria-label="Mensaheng ipapadala">{message}</div>

        <p className="act-send-label">Ipadala sa owner gamit ang:</p>
        <div className={`act-options${options.length > 2 ? ' stacked' : ''}`}>
          {options.length === 0 && <p className="act-empty">Walang contact info ang owner na ito.</p>}
          {options.map((opt) => {
            const { key, label, href } = opt;
            const Icon = opt.Icon;
            return (
            <a
              key={key}
              href={datesValid || key === 'call' ? href : undefined}
              className={`act-option ${key} ${datesValid || key === 'call' ? '' : 'disabled'}`}
              aria-disabled={!(datesValid || key === 'call')}
            >
              <Icon size={18} /> {label}
            </a>
            );
          })}
        </div>

        {!datesValid && <p className="act-hint"><Info size={14} /> Pumili muna ng check-in at check-out para maipadala ang booking request.</p>}
        <p className="act-note"><Info size={14} /> Request lang ito — ang owner pa rin ang magkukumpirma ng {isBook ? 'booking' : 'availability'}. Walang bayad na kinukuha dito.</p>

        <button type="button" className="act-details" onClick={() => { onClose(); onViewDetails(item); }}>Tingnan ang buong detalye</button>
      </div>
    </div>,
    document.body
  );
};

export default ListingActionSheet;
