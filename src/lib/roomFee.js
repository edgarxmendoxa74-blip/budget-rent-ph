import { supabase } from './supabase';

// Listing na may 8 o higit pang rooms: ₱50 na bayad (isang beses kada listing). Ina-approve ng admin ang resibo.
// Walang bagong table: nakaimbak sa verification_requests (message: "Plan: Room Fee" at "Listing ID: <id>").
export const ROOM_FEE_THRESHOLD = 8;
export const ROOM_FEE_PLAN = { id: 'rooms', label: 'Room Fee', price: 50, note: 'one-time per listing' };

export const needsRoomFee = (rooms) => (parseInt(rooms, 10) || 0) >= ROOM_FEE_THRESHOLD;

// 'approved' | 'pending' | null para sa listing na ito
export const fetchRoomFeeStatus = async (userId, listingId) => {
  if (!userId || !listingId) return null;
  try {
    const { data, error } = await supabase
      .from('verification_requests')
      .select('status, message')
      .eq('user_id', userId)
      .like('message', `%Plan: ${ROOM_FEE_PLAN.label}%`);
    if (error) return null;
    const mine = (data || []).filter((r) => new RegExp(`Listing ID:\\s*${listingId}(\\s|$)`).test(r.message || ''));
    if (mine.some((r) => r.status === 'approved')) return 'approved';
    if (mine.some((r) => r.status === 'pending')) return 'pending';
    return null;
  } catch {
    return null;
  }
};
