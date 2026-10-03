import { supabase } from './supabase';
// Shared payment details + subscription plans (VerificationPage at SubscriptionLock)
export const PAYMENT_METHODS = [
  { method: 'GCash', name: 'EDGAR M.', number: '0917 123 4567', color: '#007dfe', qr: 'https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=GCash-09171234567' },
  { method: 'Maya', name: 'EDGAR M.', number: '0917 123 4567', color: '#c335e5', qr: 'https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=Maya-09171234567' },
  { method: 'Bank', name: 'EDGAR M.', number: '1234-5678-90', color: '#1e293b', qr: '' }
];

// Yearly lang ang Get Verified (walang monthly)
export const SUBSCRIPTION_PLANS = [
  { id: 'yearly', label: 'Yearly', price: 299, note: '12 months' }
];

// Facebook page na tumatanggap ng payment proofs (Messenger)
export const PAYMENT_PAGE_ID = '61592163454566';

// ---- Payment methods na sine-set ng super admin (table: app_settings, key 'payment_methods') ----
// Admin ang source of truth; kapag wala pa o pumalya ang basa, ang PAYMENT_METHODS sa taas ang gagamitin.
export const PAYMENT_SETTINGS_KEY = 'payment_methods';
const METHOD_COLORS = { gcash: '#007dfe', maya: '#c335e5', bank: '#1e293b', shopeepay: '#ee4d2d' };
const methodKey = (name) => String(name || '').toLowerCase().replace(/[^a-z]/g, '').replace(/^paymaya$/, 'maya');

// admin shape { method, accountName, accountNumber, qrUrl } -> shape ng mga pahina { method, name, number, color, qr }
export const fromAdminMethods = (list) => (Array.isArray(list) ? list : [])
  .filter((m) => m && String(m.method || '').trim())
  .map((m) => ({
    method: String(m.method).trim(),
    name: m.accountName || '',
    number: m.accountNumber || '',
    color: METHOD_COLORS[methodKey(m.method)] || '#0f766e',
    qr: m.qrUrl || ''
  }));

export const fetchPaymentMethods = async () => {
  try {
    const { data, error } = await supabase.from('app_settings').select('value').eq('key', PAYMENT_SETTINGS_KEY).maybeSingle();
    const mapped = error ? [] : fromAdminMethods(data?.value);
    return mapped.length ? mapped : PAYMENT_METHODS;
  } catch {
    return PAYMENT_METHODS;
  }
};
