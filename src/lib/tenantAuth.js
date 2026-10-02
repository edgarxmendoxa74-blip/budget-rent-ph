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

const ageOf = (iso) => {
  const b = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(b.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  if (now.getMonth() < b.getMonth() || (now.getMonth() === b.getMonth() && now.getDate() < b.getDate())) age -= 1;
  return age;
};

// Ibinabalik ang mensahe ng error (Tagalog) o null kung okay
export const validateTenantSignup = ({ fullName, phone, birthday, workStatus, password }) => {
  if (String(fullName || '').trim().length < 2) return 'Please enter your full name.';
  if (!normalizePhone(phone)) return 'Please enter a valid Philippine mobile number (e.g. 09171234567).';
  const age = birthday ? ageOf(birthday) : null;
  if (age === null || age < MIN_AGE || age > 110) return `Please enter a valid birthday (you must be at least ${MIN_AGE} years old).`;
  if (!WORK_STATUSES.includes(workStatus)) return 'Please select your work status.';
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
      password: form.password
    }
  });
  if (error) throw new Error(await functionError(error));
  return signInTenant(form.phone, form.password);
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
