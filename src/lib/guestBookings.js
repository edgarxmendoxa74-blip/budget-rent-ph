// Ang guest (tenant na walang account) ay kinikilala sa booking/chat gamit ang token na naka-save sa device niya.
const KEY = 'budgetrent_guest_bookings';

export const getGuestBookings = () => {
  try {
    const list = JSON.parse(localStorage.getItem(KEY));
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
};

// { id, token, title, kind }
export const rememberGuestBooking = (entry) => {
  try {
    localStorage.setItem(KEY, JSON.stringify([entry, ...getGuestBookings().filter((b) => b.id !== entry.id)].slice(0, 50)));
  } catch { /* ignore */ }
};

export const newId = () => (crypto?.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
  const r = (Math.random() * 16) | 0;
  return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
}));
