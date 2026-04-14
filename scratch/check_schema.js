const url = 'https://utdarqyhkiexotouqjkz.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0ZGFycXloa2lleG90b3Vxamt6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3NjAxODEsImV4cCI6MjA5MTMzNjE4MX0.cPQmNILfU7qD_0CGUvRKQGTbXc3QmY2YSjj46E5YWdg';

async function check() {
  const res = await fetch(`${url}/rest/v1/profiles?select=*&limit=1`, {
    headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
  });
  const data = await res.json();
  console.log('Columns:', Object.keys(data[0] || {}));
  console.log('Sample:', JSON.stringify(data[0], null, 2));
}
check();
