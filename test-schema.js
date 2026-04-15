import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'YOUR_BOGUS_URL';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'YOUR_BOGUS_KEY';

// I need to read the env vars from .env.local or similar.
