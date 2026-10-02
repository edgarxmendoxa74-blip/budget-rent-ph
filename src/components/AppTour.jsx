import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { House, TreePalm, Search, Navigation, Heart, CalendarCheck, Bell, Plus, ClipboardList, BadgeCheck, FileSignature, X } from 'lucide-react';
import { TOUR_SEEN_KEY } from '../lib/tour';
import './AppTour.css';

const TENANT_STEPS = [
  { Icon: House, tone: 'navy', title: 'Welcome sa BudgetRentPH!', text: 'Mura. Malapit. Mapagkakatiwalaan. Sandali lang ito — ituturo namin kung paano gamitin ang app.' },
  { Icon: TreePalm, tone: 'gold', title: 'Paupahan o Staycation', text: 'Sa Home, piliin ang category sa itaas: Paupahan para sa buwan-buwan na upa, o Staycation para sa bakasyon at overnight stay.' },
  { Icon: Search, tone: 'navy', title: 'Hanapin ang bagay sa budget mo', text: 'I-type ang lugar o budget (hal. 4000) sa search. Sa Staycation, piliin din ang petsa (When) at bilang ng bisita (Who).' },
  { Icon: Navigation, tone: 'gold', title: 'Nearby: mga bahay malapit sa iyo', text: 'Pindutin ang Nearby sa ibaba, i-ON ang Location ng phone. Awtomatikong ii-scan ang paligid mo at lalabas sa mapa ang mga bahay at makikita ang layo at ruta.' },
  { Icon: Heart, tone: 'red', title: 'I-save ang paborito', text: 'Pindutin ang ❤ sa listing para mapunta sa Wishlist mo. Doon mo ulit makikita ang mga na-save.' },
  { Icon: CalendarCheck, tone: 'green', title: 'Mag-inquire o mag-book', text: 'Buksan ang listing at pindutin ang Inquire (paupahan) o Book (staycation). Puwede kang mag-email, tumawag, o mag-Reserve Slot sa owner.' },
  { Icon: Bell, tone: 'gold', title: 'Notifications', text: 'Pindutin ang bell sa itaas para sa mga update mula sa BudgetRentPH. Puwede mong i-delete ang mga notification na hindi mo na kailangan.' },
];

const LANDLORD_STEPS = [
  { Icon: House, tone: 'navy', title: 'Welcome, Landlord!', text: 'Ituturo namin kung paano mag-post at mag-manage ng mga listing mo.' },
  { Icon: Plus, tone: 'gold', title: 'Mag-post ng listing', text: 'Pindutin ang malaking + sa gitna ng ibaba. Ilagay ang detalye, litrato, at i-pin ang lokasyon sa mapa para makita ka ng mga tenant sa Nearby.' },
  { Icon: ClipboardList, tone: 'navy', title: 'My Listings', text: 'Dito lahat ng listing mo. I-toggle ang Available / Occupied, i-edit ang detalye, o i-delete ang listing.' },
  { Icon: BadgeCheck, tone: 'green', title: 'Get Verified', text: 'Mag-verify ng account para makuha ang badge at mas magtiwala ang mga tenant sa iyo. Nasa menu (☰) ito.' },
  { Icon: FileSignature, tone: 'gold', title: 'Agreement Draft', text: 'Gumawa ng kontrata para sa tenant mo sa menu (☰) at i-download bilang PNG.' },
  { Icon: Bell, tone: 'gold', title: 'Notifications', text: 'Pindutin ang bell sa itaas para sa mga update mula sa BudgetRentPH.' },
];

const AppTour = ({ isLandlord, onClose }) => {
  const steps = isLandlord ? LANDLORD_STEPS : TENANT_STEPS;
  const [i, setI] = useState(0);
  const step = steps[i];
  const last = i === steps.length - 1;
  const Icon = step.Icon;

  const finish = () => {
    try { localStorage.setItem(TOUR_SEEN_KEY, 'true'); } catch { /* private mode */ }
    onClose();
  };

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') finish(); };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return createPortal(
    <div className="tour-overlay" role="dialog" aria-modal="true" aria-label="App tour">
      <div className="tour-card animate-slide-up">
        <button type="button" className="tour-close" aria-label="Isara ang tour" onClick={finish}><X size={18} /></button>

        <div className="tour-body" key={i}>
          <span className={`tour-icon ${step.tone}`}><Icon size={40} strokeWidth={2.2} /></span>
          <h3>{step.title}</h3>
          <p>{step.text}</p>
        </div>

        <div className="tour-dots" aria-hidden="true">
          {steps.map((_, n) => <span key={n} className={n === i ? 'on' : ''} />)}
        </div>

        <div className="tour-actions">
          {last ? (
            <button type="button" className="tour-next" onClick={finish}>Simulan na!</button>
          ) : (
            <>
              <button type="button" className="tour-skip" onClick={finish}>Skip</button>
              {i > 0 && <button type="button" className="tour-back" onClick={() => setI(i - 1)}>Back</button>}
              <button type="button" className="tour-next" onClick={() => setI(i + 1)}>Next</button>
            </>
          )}
        </div>
        <span className="tour-count">{i + 1} / {steps.length}</span>
      </div>
    </div>,
    document.body
  );
};

export default AppTour;
