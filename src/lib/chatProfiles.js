// Mga profile ng kausap sa booking chat (para sa avatar at "account details" na lumalabas kapag pinindot ang icon).
// Hugis: { role: 'tenant' | 'landlord', name, business, phone, email, facebook, whatsapp, workStatus, verified, avatar, memberSince }

const displayPhone = (value) => {
  const v = String(value || '').trim();
  return /^639\d{9}$/.test(v) ? `0${v.slice(2)}` : v;
};

// Landlord, mula sa listing (properties row)
export const landlordFromProperty = (p) => ({
  role: 'landlord',
  name: p?.owner_name || p?.owner_business_name || 'Owner',
  business: p?.owner_business_name || '',
  phone: displayPhone(p?.contact),
  email: p?.email || '',
  facebook: p?.owner_facebook || '',
  whatsapp: p?.owner_whatsapp || '',
  host: /staycation/i.test(String(p?.type || p?.category || '')),
  verified: Boolean(p?.is_verified),
  avatar: p?.owner_avatar || ''
});

// Tenant, mula sa booking request (ito lang ang detalyeng nasa booking)
export const tenantFromBooking = (b) => ({
  role: 'tenant',
  name: b?.customer_name || 'Guest',
  phone: displayPhone(b?.customer_phone),
  email: b?.customer_email || ''
});

// Sarili, mula sa naka-login na user (user_metadata)
export const profileFromUser = (user, role) => {
  const meta = user?.user_metadata || {};
  if (role === 'owner') {
    return {
      role: 'landlord',
      name: meta.full_name || meta.property_name || 'You',
      business: meta.property_name || '',
      phone: displayPhone(meta.phone),
      email: meta.business_email || user?.email || '',
      facebook: meta.facebook || '',
      whatsapp: meta.whatsapp || '',
      avatar: meta.avatar_url || ''
    };
  }
  return {
    role: 'tenant',
    name: meta.full_name || 'You',
    phone: displayPhone(meta.phone),
    email: '',
    facebook: meta.facebook || '',
    workStatus: meta.work_status || '',
    memberSince: user?.created_at || ''
  };
};

export const initialsOf = (name) => {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
};
