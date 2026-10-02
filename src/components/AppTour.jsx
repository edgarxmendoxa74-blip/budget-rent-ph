import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { House, TreePalm, Search, Navigation, Heart, CalendarCheck, Bell, Plus, ClipboardList, BadgeCheck, FileSignature, X } from 'lucide-react';
import { TOUR_SEEN_KEY } from '../lib/tour';
import './AppTour.css';

const TENANT_STEPS = [
  { Icon: House, tone: 'navy', title: 'Welcome to BudgetRentPH!', text: 'Affordable. Nearby. Trustworthy. This will only take a moment — we’ll show you how to use the app.' },
  { Icon: TreePalm, tone: 'gold', title: 'Rentals or Staycations', text: 'On Home, pick a category at the top: Rentals for monthly rent, or Staycation for vacations and overnight stays.' },
  { Icon: Search, tone: 'navy', title: 'Find a place within your budget', text: 'Type a location or budget (e.g. 4000) in the search. For Staycations, also pick the dates (When) and number of guests (Who).' },
  { Icon: Navigation, tone: 'gold', title: 'Nearby: homes close to you', text: 'Tap Nearby at the bottom and turn ON your phone’s Location. We’ll automatically scan your area and show homes on the map, with the distance and route.' },
  { Icon: Heart, tone: 'red', title: 'Save your favorites', text: 'Tap the ❤ on a listing to add it to your Wishlist. You can find your saved listings there anytime.' },
  { Icon: CalendarCheck, tone: 'green', title: 'Inquire or book', text: 'Open a listing and tap Inquire (rentals) or Book (staycations). You can email, call, or Reserve a Slot with the owner.' },
  { Icon: Bell, tone: 'gold', title: 'Notifications', text: 'Tap the bell at the top for updates from BudgetRentPH. You can delete notifications you no longer need.' },
];

const LANDLORD_STEPS = [
  { Icon: House, tone: 'navy', title: 'Welcome, Landlord!', text: 'We’ll show you how to post and manage your listings.' },
  { Icon: Plus, tone: 'gold', title: 'Post a listing', text: 'Tap the big + at the bottom center. Add the details and photos, and pin the location on the map so tenants can find you in Nearby.' },
  { Icon: ClipboardList, tone: 'navy', title: 'My Listings', text: 'All your listings are here. Toggle Available / Occupied, edit the details, or delete a listing.' },
  { Icon: BadgeCheck, tone: 'green', title: 'Get Verified', text: 'Verify your account to get a badge and earn more trust from tenants. You’ll find it in the menu (☰).' },
  { Icon: FileSignature, tone: 'gold', title: 'Agreement Draft', text: 'Create a contract for your tenant from the menu (☰) and download it as a PNG.' },
  { Icon: Bell, tone: 'gold', title: 'Notifications', text: 'Tap the bell at the top for updates from BudgetRentPH.' },
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
        <button type="button" className="tour-close" aria-label="Close tour" onClick={finish}><X size={18} /></button>

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
            <button type="button" className="tour-next" onClick={finish}>Let’s go!</button>
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
