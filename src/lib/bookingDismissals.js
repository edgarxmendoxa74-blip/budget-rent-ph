import { supabase } from './supabase';

// "Burahin" sa Inbox/Bookings = itatago lang sa listahan ng gumawa ng aksyon (booking_dismissals).
// Hindi nabubura ang booking mismo, kaya buo pa rin ang record ng kabilang panig at ang mga booked na petsa.
export const fetchDismissedIds = async () => {
  const { data, error } = await supabase.from('booking_dismissals').select('booking_id');
  return error ? new Set() : new Set((data || []).map((r) => r.booking_id));
};

export const dismissBooking = async (bookingId) => {
  const { error } = await supabase.from('booking_dismissals').insert({ booking_id: bookingId });
  if (error && error.code !== '23505') throw error; // 23505 = nakatago na dati
};
