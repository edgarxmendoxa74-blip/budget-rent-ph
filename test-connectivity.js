import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://utdarqyhkiexotouqjkz.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0ZGFycXloa2lleG90b3Vxamt6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3NjAxODEsImV4cCI6MjA5MTMzNjE4MX0.cPQmNILfU7qD_0CGUvRKQGTbXc3QmY2YSjj46E5YWdg';

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  console.log('Testing Supabase Connectivity...');
  const { data, error } = await supabase.from('properties').select('count', { count: 'exact', head: true });
  if (error) {
    console.error('Error:', error.message);
  } else {
    console.log('Success! Properties count:', data.count);
  }
}

test();
