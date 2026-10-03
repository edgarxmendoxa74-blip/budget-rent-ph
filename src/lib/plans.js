import { supabase } from './supabase';
import { SUBSCRIPTION_PLANS } from './paymentMethods';

const noteFor = (months) => (months % 12 === 0 ? `${months / 12} year${months === 12 ? '' : 's'}` : `${months} month${months === 1 ? '' : 's'}`);

// Kumukuha ng editable plans sa DB; kapag wala pa ang table, default ang gagamitin
export const fetchPlans = async () => {
  try {
    const { data, error } = await supabase.from('subscription_plans').select('id,label,price,months');
    if (error || !data?.length) return SUBSCRIPTION_PLANS.map(p => ({ ...p, months: p.id === 'yearly' ? 12 : 1 }));
    return ['yearly']
      .map(id => data.find(p => p.id === id))
      .filter(Boolean)
      .map(p => ({ id: p.id, label: p.label, price: Number(p.price), months: p.months, note: noteFor(p.months) }));
  } catch {
    return SUBSCRIPTION_PLANS.map(p => ({ ...p, months: p.id === 'yearly' ? 12 : 1 }));
  }
};
