import React, { useEffect, useRef, useState } from 'react';

export const STAY_FEATURES = ['Air-conditioned', 'Toiletries', 'TV', 'Refrigerator', 'Washing machine', 'Heater'];

// Fill-up fields for Staycation listings (landlord sets these). Shared by the Add and Edit forms.
// value: { max_adults, max_children, stay_features, house_rules, cancellation_policy }
const StaycationExtras = ({ value, onChange, groupClass = 'form-group' }) => {
  const features = Array.isArray(value.stay_features) ? value.stay_features : [];
  const toggle = (f) => onChange('stay_features', features.includes(f) ? features.filter((x) => x !== f) : [...features, f]);
  const hint = { display: 'block', fontSize: '0.75rem', color: '#64748b', marginTop: 4 };

  return (
    <>
      <div className={groupClass}>
        <label>Max adults</label>
        <input type="number" min="1" placeholder="Max adults" value={value.max_adults ?? ''} onChange={(e) => onChange('max_adults', e.target.value)} />
        <span style={hint}>Max number of adults you allow per booking. Max children is set above, beside CR.</span>
      </div>

      <div className={groupClass}>
        <label>House rules</label>
        <textarea rows="3" maxLength={1000} placeholder={'e.g. No smoking inside\nCheck-in 2 PM, check-out 12 NN\nNo loud noise after 10 PM'} value={value.house_rules || ''} onChange={(e) => onChange('house_rules', e.target.value)} />
        <span style={hint}>One rule per line. Guests must agree to these when booking.</span>
      </div>

      <div className={groupClass}>
        <label>Cancellation policy</label>
        <textarea rows="3" maxLength={1000} placeholder={'e.g. Free cancellation up to 3 days before check-in\nDown payment is non-refundable within 3 days'} value={value.cancellation_policy || ''} onChange={(e) => onChange('cancellation_policy', e.target.value)} />
      </div>
    </>
  );
};

// Max children: katabi ng CR sa Add/Edit forms (staycation lang)
export const MaxChildrenInput = ({ value, onChange, groupClass = 'form-group' }) => (
  <div className={groupClass}>
    <label>Max children</label>
    <input type="number" min="0" placeholder="0" value={value.max_children ?? ''} onChange={(e) => onChange('max_children', e.target.value)} />
  </div>
);

// "What's included": dropdown na kapareho ng Pets Allowed, may checklist na bumubukas. Katabi ng Pets Allowed sa Add/Edit forms.
export const StayFeaturesSelect = ({ value, onChange, groupClass = 'form-group' }) => {
  const features = Array.isArray(value.stay_features) ? value.stay_features : [];
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('touchstart', close);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('touchstart', close); };
  }, [open]);
  const toggle = (f) => onChange('stay_features', features.includes(f) ? features.filter((x) => x !== f) : [...features, f]);
  const summary = features.length === 0 ? 'None' : features.length === 1 ? features[0] : `${features.length} selected`;
  return (
    <div className={groupClass} ref={ref} style={{ position: 'relative' }}>
      <label>What&apos;s included</label>
      <select value="x" aria-haspopup="listbox" aria-expanded={open} onChange={() => {}}
        onMouseDown={(e) => { e.preventDefault(); setOpen((o) => !o); }}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') { e.preventDefault(); setOpen((o) => !o); } }}>
        <option value="x">{summary}</option>
      </select>
      {open && (
        <div role="listbox" aria-multiselectable="true" style={{ position: 'absolute', zIndex: 20, top: '100%', left: 0, minWidth: '100%', width: 230, marginTop: 4, padding: 6, background: '#fff', border: '1.5px solid #cbd5e1', borderRadius: 12, boxShadow: '0 12px 30px rgba(0, 38, 82, 0.18)' }}>
          {STAY_FEATURES.map((f) => (
            <label key={f} style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, fontSize: '0.88rem', fontWeight: 600, color: '#334155', cursor: 'pointer' }}>
              <input type="checkbox" checked={features.includes(f)} onChange={() => toggle(f)} style={{ width: 16, height: 16, padding: 0, accentColor: '#0f766e' }} />
              {f}
            </label>
          ))}
        </div>
      )}
    </div>
  );
};

// Normalize form values for the database payload
export const stayPayload = (v, isStay) => {
  const toInt = (x, min) => {
    const n = parseInt(x, 10);
    return Number.isFinite(n) ? Math.max(min, n) : null;
  };
  if (!isStay) return { max_adults: null, max_children: null, stay_features: [], house_rules: null, cancellation_policy: null };
  return {
    max_adults: toInt(v.max_adults, 1),
    max_children: toInt(v.max_children, 0),
    stay_features: Array.isArray(v.stay_features) ? v.stay_features : [],
    house_rules: (v.house_rules || '').trim() || null,
    cancellation_policy: (v.cancellation_policy || '').trim() || null
  };
};

export const STAY_COLUMN_RE = /max_adults|max_children|stay_features|house_rules|cancellation_policy/i;
export const STAY_COLUMNS = ['max_adults', 'max_children', 'stay_features', 'house_rules', 'cancellation_policy'];

export default StaycationExtras;
