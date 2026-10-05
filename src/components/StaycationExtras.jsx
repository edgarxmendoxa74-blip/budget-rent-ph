import React from 'react';

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
        <label>Guests allowed</label>
        <div style={{ display: 'flex', gap: 10 }}>
          <input type="number" min="1" placeholder="Max adults" value={value.max_adults ?? ''} onChange={(e) => onChange('max_adults', e.target.value)} />
          <input type="number" min="0" placeholder="Max children" value={value.max_children ?? ''} onChange={(e) => onChange('max_children', e.target.value)} />
        </div>
        <span style={hint}>Max number of adults and children you allow per booking.</span>
      </div>

      <div className={groupClass}>
        <label>What&apos;s included</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {STAY_FEATURES.map((f) => {
            const on = features.includes(f);
            return (
              <button
                key={f}
                type="button"
                onClick={() => toggle(f)}
                aria-pressed={on}
                style={{
                  padding: '7px 12px', borderRadius: 999, fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer',
                  border: `1.5px solid ${on ? '#0f766e' : '#cbd5e1'}`,
                  background: on ? '#ccfbf1' : '#fff',
                  color: on ? '#0f766e' : '#475569'
                }}
              >
                {on ? '✓ ' : ''}{f}
              </button>
            );
          })}
        </div>
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
