import { supabase } from './supabase';

// Libre ang unang 5 listings. Ang "Pro Listings" plan (₱249 kada 2 buwan) ay para sa 6-10 listings.
// Ina-activate ng admin pagkatapos ng bayad (table: landlord_plans). Tingnan ang migration add_listing_plan.sql.
export const FREE_LISTING_LIMIT = 5;
export const PRO_LISTING_LIMIT = 10;
export const PRO_PLAN = { id: 'pro', label: 'Pro Listings', price: 249, months: 2, note: '2 months' };

// Verified Tenant: ₱50 kada 1 taon. Ina-activate ng admin (table: tenant_verifications, migration add_tenant_verification.sql)
export const TENANT_PLAN = { id: 'tenant', label: 'Verified Tenant', price: 50, months: 12, note: '1 year' };

// Petsa kung hanggang kailan verified ang tenant; null kung hindi verified / wala pa ang migration
export const fetchTenantVerifiedUntil = async (userId) => {
  if (!userId) return null;
  try {
    const { data, error } = await supabase.from('tenant_verifications').select('verified_until').eq('user_id', userId).maybeSingle();
    if (error || !data?.verified_until) return null;
    return new Date(data.verified_until) > new Date() ? data.verified_until : null;
  } catch {
    return null;
  }
};

export const isProActive =(plan) => Boolean(plan?.expires_at) && new Date(plan.expires_at) > new Date();
export const listingLimitFor = (plan) => (isProActive(plan) ? PRO_LISTING_LIMIT : FREE_LISTING_LIMIT);

// Plan ng landlord; null kung wala pa o kung hindi pa na-run ang migration (limit na 5 ang iiral sa app)
export const fetchMyPlan = async (userId) => {
  if (!userId) return null;
  try {
    const { data, error } = await supabase.from('landlord_plans').select('plan, expires_at').eq('user_id', userId).maybeSingle();
    return error ? null : data;
  } catch {
    return null;
  }
};

export const countMyListings = async (userId) => {
  const { count, error } = await supabase.from('properties').select('id', { count: 'exact', head: true }).eq('user_id', userId);
  return error ? 0 : (count || 0);
};

export const isLimitError = (error) => /LISTING_LIMIT_REACHED/i.test(error?.message || '');
