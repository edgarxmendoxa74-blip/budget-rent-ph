import { supabase } from './supabase';

// Tenant account: walang email. Ang phone number ang pagkakakilanlan, kaya isang number = isang account.
// Sa loob, ang Supabase Auth ay gumagamit ng email na hango sa number (hindi ito totoong mailbox, walang ipinapadalang email).
// Ang account ay ginagawa ng Edge Function na "tenant-signup" (auto-confirmed, at hindi puwedeng gamitin ang admin emails).
export const TENANT_EMAIL_DOMAIN = 'tenant.budgetrent.ph';
export const MIN_AGE = 13;
// Flag (sessionStorage) na bagong sign-up lang ang tenant, para lumabas ang welcome message sa App
export const NEW_TENANT_KEY = 'budgetrent_new_tenant';

export const WORK_STATUSES = ['Estudyante', 'Empleyado', 'Self-employed / Negosyo', 'OFW', 'Walang trabaho ngayon', 'Iba pa'];
// English display labels (the stored values above must stay as is: saved in user metadata and validated by the tenant-signup Edge Function)
export const WORK_STATUS_LABELS = {
  Estudyante: 'Student',
  Empleyado: 'Employed',
  'Self-employed / Negosyo': 'Self-employed / Business',
  OFW: 'OFW',
  'Walang trabaho ngayon': 'Currently unemployed',
  'Iba pa': 'Other'
};
export const workStatusLabel = (value) => WORK_STATUS_LABELS[value] || value;

// 09171234567 / +63 917 123 4567 / 639171234567 -> "639171234567"; hindi valid = null
export const normalizePhone = (input) => {
  const digits = String(input || '').replace(/[\s\-()]/g, '');
  if (/^\+?639\d{9}$/.test(digits)) return digits.replace('+', '');
  if (/^09\d{9}$/.test(digits)) return `63${digits.slice(1)}`;
  return null;
};

export const tenantEmail = (canonicalPhone) => `${canonicalPhone}@${TENANT_EMAIL_DOMAIN}`;

// Address ng user sa sign up (tenant at landlord): street (optional), barangay, city/municipality, province
export const EMPTY_ADDRESS = { street: '', barangay: '', city: '', province: '' };
export const validateAddress = ({ barangay, city, province }) => {
  if (String(barangay || '').trim().length < 2) return 'Please enter your barangay.';
  if (String(city || '').trim().length < 2) return 'Please enter your city / municipality.';
  if (String(province || '').trim().length < 2) return 'Please enter your province.';
  return null;
};
export const formatAddress = ({ street, barangay, city, province }) =>
  [street, barangay, city, province].map((p) => String(p || '').trim()).filter(Boolean).join(', ');

const ageOf = (iso) => {
  const b = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(b.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  if (now.getMonth() < b.getMonth() || (now.getMonth() === b.getMonth() && now.getDate() < b.getDate())) age -= 1;
  return age;
};

// Ibinabalik ang mensahe ng error (Tagalog) o null kung okay
export const validateTenantSignup = ({ fullName, phone, birthday, workStatus, password, ...address }) => {
  if (String(fullName || '').trim().length < 2) return 'Please enter your full name.';
  if (!normalizePhone(phone)) return 'Please enter a valid Philippine mobile number (e.g. 09171234567).';
  const age = birthday ? ageOf(birthday) : null;
  if (age === null || age < MIN_AGE || age > 110) return `Please enter a valid birthday (you must be at least ${MIN_AGE} years old).`;
  if (!WORK_STATUSES.includes(workStatus)) return 'Please select your work status.';
  const addressProblem = validateAddress(address);
  if (addressProblem) return addressProblem;
  if (String(password || '').length < 6) return 'Password must be at least 6 characters.';
  return null;
};

const functionError = async (error) => {
  try {
    const body = await error.context?.json?.();
    if (body?.error) return body.error;
  } catch { /* walang detalye */ }
  return 'Unable to create an account right now. Please try again later.';
};

export const signUpTenant = async (form) => {
  const problem = validateTenantSignup(form);
  if (problem) throw new Error(problem);
  const phone = normalizePhone(form.phone);
  const { error } = await supabase.functions.invoke('tenant-signup', {
    body: {
      fullName: form.fullName.trim(),
      phone,
      birthday: form.birthday,
      workStatus: form.workStatus,
      street: form.street.trim(),
      barangay: form.barangay.trim(),
      city: form.city.trim(),
      province: form.province.trim(),
      password: form.password
    }
  });
  if (error) throw new Error(await functionError(error));
  return signInTenant(form.phone, form.password);
};

// ---------- Edit ng tenant profile: isang beses lang kada buwan ----------
export const PROFILE_EDIT_INTERVAL_DAYS = 30;

// Petsa kung kailan puwede ulit mag-edit; null kung puwede na ngayon
export const nextProfileEditDate = (meta) => {
  const last = meta?.profile_edited_at ? new Date(meta.profile_edited_at) : null;
  if (!last || Number.isNaN(last.getTime())) return null;
  const next = new Date(last.getTime() + PROFILE_EDIT_INTERVAL_DAYS * 24 * 60 * 60 * 1000);
  return next > new Date() ? next : null;
};

// Facebook link o username -> "https://www.facebook.com/<name>". Blank = '' (optional), hindi valid = null
export const normalizeFacebook = (input) => {
  const raw = String(input || '').trim();
  if (!raw) return '';
  if (/^[A-Za-z0-9.]{5,50}$/.test(raw)) return `https://www.facebook.com/${raw}`;
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    if (!/(^|\.)(facebook\.com|fb\.com|fb\.me)$/i.test(url.hostname)) return null;
    const path = url.pathname.replace(/\/+$/, '');
    if (!path || path === '/') return null;
    const id = path === '/profile.php' ? `profile.php?id=${url.searchParams.get('id') || ''}` : path.slice(1);
    if (!id || id === 'profile.php?id=' || id.length > 120) return null;
    return `https://www.facebook.com/${id}`;
  } catch {
    return null;
  }
};

export const validateTenantProfile = ({ fullName, birthday, workStatus, facebook }) => {
  if (String(fullName || '').trim().length < 2) return 'Please enter your full name.';
  const age = birthday ? ageOf(birthday) : null;
  if (age === null || age < MIN_AGE || age > 110) return `Please enter a valid birthday (you must be at least ${MIN_AGE} years old).`;
  if (!WORK_STATUSES.includes(workStatus)) return 'Please select your work status.';
  if (normalizeFacebook(facebook) === null) return 'Please enter a valid Facebook profile link (e.g. facebook.com/juan.delacruz).';
  return null;
};

// Sine-save sa user metadata. Binabasa muna ang pinakabagong metadata sa server para sigurado ang buwanang limit.
export const updateTenantProfile = async (form) => {
  const problem = validateTenantProfile(form);
  if (problem) throw new Error(problem);
  const { data: current, error: readError } = await supabase.auth.getUser();
  if (readError || !current?.user) throw new Error('Unable to verify your account right now. Please try again.');
  const next = nextProfileEditDate(current.user.user_metadata);
  if (next) throw new Error(`You can edit your profile once a month. Next edit: ${next.toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })}.`);
  const { error } = await supabase.auth.updateUser({
    data: {
      full_name: form.fullName.trim(),
      birthday: form.birthday,
      work_status: form.workStatus,
      facebook: normalizeFacebook(form.facebook),
      profile_edited_at: new Date().toISOString()
    }
  });
  if (error) throw new Error(error.message || 'Unable to save your profile right now.');
};

export const signInTenant = async (phoneInput, password) => {
  const phone = normalizePhone(phoneInput);
  if (!phone) throw new Error('Please enter a valid Philippine mobile number (e.g. 09171234567).');
  const { data, error } = await supabase.auth.signInWithPassword({ email: tenantEmail(phone), password });
  if (error) {
    throw new Error(/invalid login/i.test(error.message || '') ? 'Incorrect mobile number or password.' : error.message);
  }
  return data;
};
