import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

// Global JWT error recovery — clears stale tokens and reloads if JWT is bad
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'TOKEN_REFRESHED') {
    console.log('[Supabase] Token refreshed successfully.');
  }
  if (event === 'SIGNED_OUT' || (!session && event === 'INITIAL_SESSION')) {
    // Only clear non-admin keys to preserve admin bypass
    const adminBypass = localStorage.getItem('budgetrent_admin_bypass');
    // Remove all supabase keys
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('sb-')) localStorage.removeItem(key);
    });
    if (adminBypass) localStorage.setItem('budgetrent_admin_bypass', adminBypass);
  }
});
