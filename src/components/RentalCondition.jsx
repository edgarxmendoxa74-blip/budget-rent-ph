// Kondisyon ng bahay / kuwarto na sine-set ng landlord para sa rentals (hindi staycation). Nakikita ng tenant.
export const CONDITIONS = [
  { value: 'good', label: 'Well maintained', hint: 'Maayos, walang kailangang ayusin', color: '#166534', bg: '#dcfce7' },
  { value: 'minor', label: 'Slightly damaged', hint: 'Medyo sira, maliliit lang ang sira', color: '#92400e', bg: '#fef3c7' },
  { value: 'repair', label: 'Needs repair', hint: 'May kailangang ayusin', color: '#b91c1c', bg: '#fee2e2' }
];
export const conditionInfo = (v) => CONDITIONS.find((c) => c.value === v) || null;

// Dropdown (kapareho ng CR: Shared/Private) at optional na detalye ng sira. Shared by the Add and Edit forms.
export const ConditionSelect = ({ value, onChange, groupClass = 'form-group', selectProps = {} }) => (
  <div className={groupClass}>
    <label>Condition</label>
    <select {...selectProps} value={value.house_condition || ''} onChange={(e) => onChange('house_condition', e.target.value)}>
      <option value="">Select</option>
      {CONDITIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
    </select>
  </div>
);

export const ConditionNotes = ({ value, onChange, groupClass = 'form-group' }) => (
  value.house_condition && value.house_condition !== 'good' ? (
    <div className={groupClass}>
      <label>What needs fixing? (optional)</label>
      <textarea rows="3" maxLength={300} placeholder="e.g. Leaking faucet in the CR, cracked wall near the window" value={value.condition_notes || ''} onChange={(e) => onChange('condition_notes', e.target.value)} />
    </div>
  ) : null
);

// Normalize form values for the database payload
export const conditionPayload = (v, isRental) => {
  if (!isRental || !conditionInfo(v.house_condition)) return { house_condition: null, condition_notes: null };
  return {
    house_condition: v.house_condition,
    condition_notes: v.house_condition === 'good' ? null : ((v.condition_notes || '').trim().slice(0, 300) || null)
  };
};

// Sino ang pwedeng tumira: both | female | male (rentals lang)
export const GENDERS = [
  { value: 'both', label: 'Both (Male & Female)' },
  { value: 'female', label: 'Female only' },
  { value: 'male', label: 'Male only' }
];
export const genderLabel = (v) => (v === 'female' ? 'Female only' : v === 'male' ? 'Male only' : null);
// Laging may text para sa tenant (kasama ang Both)
export const genderText = (v) => genderLabel(v) || 'Male & Female';

export const GenderSelect = ({ value, onChange, groupClass = 'form-group', selectProps = {} }) => (
  <div className={groupClass}>
    <label>Allowed tenants</label>
    <select {...selectProps} value={value.allowed_gender || 'both'} onChange={(e) => onChange('allowed_gender', e.target.value)}>
      {GENDERS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
    </select>
  </div>
);

export const genderPayload = (v, isRental) => ({ allowed_gender: isRental && ['female', 'male'].includes(v.allowed_gender) ? v.allowed_gender : 'both' });

// Rentals na maraming kwarto: per room o buong bahay lang, at ilan na ang occupied na kwarto
export const roomsInfo = (item) => {
  const total = Math.max(1, parseInt(item?.rooms, 10) || 1);
  const whole = item?.rental_mode === 'whole';
  const occupied = whole ? 0 : Math.min(total, Math.max(0, parseInt(item?.occupied_rooms, 10) || 0));
  return { total, whole, occupied, free: total - occupied, multi: total > 1 && !whole, tracked: !whole && total > 1 && occupied > 0 };
};

export const RoomsFields = ({ value, onChange, groupClass = 'form-group' }) => {
  const { total, whole } = roomsInfo(value);
  return (
    <>
      <div className={groupClass}>
        <label>Rented as</label>
        <select value={value.rental_mode === 'whole' ? 'whole' : 'rooms'} onChange={(e) => onChange('rental_mode', e.target.value)}>
          <option value="rooms">Per room</option>
          <option value="whole">Whole house only</option>
        </select>
      </div>
      {!whole && total > 1 && (
        <div className={groupClass}>
          <label>Occupied rooms (out of {total})</label>
          <input type="number" min="0" max={total} value={value.occupied_rooms ?? 0} onChange={(e) => onChange('occupied_rooms', e.target.value)} />
        </div>
      )}
    </>
  );
};

export const roomsPayload = (v, isRental) => {
  const { total, whole } = roomsInfo(v);
  if (!isRental) return { rental_mode: 'rooms', occupied_rooms: 0 };
  return { rental_mode: whole ? 'whole' : 'rooms', occupied_rooms: whole || total <= 1 ? 0 : Math.min(total, Math.max(0, parseInt(v.occupied_rooms, 10) || 0)) };
};

export const CONDITION_COLUMN_RE = /house_condition|condition_notes|allowed_gender|rental_mode|occupied_rooms/i;
export const CONDITION_COLUMNS = ['house_condition', 'condition_notes', 'allowed_gender', 'rental_mode', 'occupied_rooms'];
