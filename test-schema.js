import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY not found in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testConnection() {
  console.log('Testing Supabase connection...');
  
  try {
    const { data, error } = await supabase
      .from('properties')
      .select('count', { count: 'exact', head: true });

    if (error) {
      console.error('Connection failed/Properties table error:', error.message);
      if (error.code === 'PGRST116') {
        console.log('Note: Table might be empty or restricted, but reachable.');
      }
    } else {
      console.log('Successfully connected to Supabase!');
      console.log(`Found ${data.count} properties in the database.`);
    }

    const { data: vData, error: vError } = await supabase
      .from('verification_requests')
      .select('count', { count: 'exact', head: true });

    if (vError) {
      console.error('Verification Requests table error:', vError.message);
    } else {
      console.log(`Found ${vData.count} verification requests.`);
    }

  } catch (err) {
    console.error('Unexpected error:', err.message);
  }
}

testConnection();
