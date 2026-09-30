// Mga email na pinapayagang pumasok sa Admin Dashboard.
// Ito ay UI gate lang; ang totoong proteksyon ng data ay dapat nasa Supabase RLS policies.
const ADMIN_EMAILS = [
  'admin@budgetrent.ph',
  'mendozajakong@gmail.com',
  'webnegosyo@budget43.com'
];

// Case-insensitive: nilo-lowercase ng Supabase ang emails
export const isAdminEmail = (email) =>
  ADMIN_EMAILS.includes(String(email || '').trim().toLowerCase());
