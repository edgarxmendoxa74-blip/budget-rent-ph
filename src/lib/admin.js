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

// Dito lang bubukas ang Admin Dashboard (palitan lang ito para ilipat ang URL)
export const ADMIN_PATH = '/superadmin';
export const isAdminPath = () => window.location.pathname.replace(/\/+$/, '') === ADMIN_PATH;
