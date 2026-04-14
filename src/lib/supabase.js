import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const PRESERVED_LOCAL_KEYS = [
  'budgetrent_admin_bypass',
  'budgetrent_hidden_properties',
  'budgetrent_payment_methods',
];

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

export const clearSupabaseSessionStorage = () => {
  const preservedEntries = PRESERVED_LOCAL_KEYS
    .map((key) => [key, localStorage.getItem(key)])
    .filter(([, value]) => value !== null);

  Object.keys(localStorage).forEach((key) => {
    if (key.startsWith('sb-')) localStorage.removeItem(key);
  });

  preservedEntries.forEach(([key, value]) => {
    localStorage.setItem(key, value);
  });
};

export const isJwtError = (error) => {
  const message = error?.message?.toLowerCase() || '';
  return (
    message.includes('jwt') ||
    message.includes('token') ||
    message.includes('session') ||
    error?.code === 'PGRST301'
  );
};

export const recoverFromJwtError = async (error) => {
  if (!isJwtError(error)) return false;

  try {
    await supabase.auth.signOut({ scope: 'local' });
  } catch {
    // Ignore local sign-out failures and still clear stale storage.
  }

  clearSupabaseSessionStorage();
  return true;
};

export const validateCurrentSession = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return null;

  const { error } = await supabase.auth.getUser(session.access_token);
  if (error) {
    await recoverFromJwtError(error);
    return null;
  }

  return session;
};

supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'TOKEN_REFRESHED') {
    console.log('[Supabase] Token refreshed successfully.');
  }

  if (event === 'SIGNED_OUT' || (!session && event === 'INITIAL_SESSION')) {
    clearSupabaseSessionStorage();
  }
});
