// Gumagawa ng tenant account na walang email: ang phone number ang identity.
// Ang Supabase Auth ay nangangailangan ng email, kaya gumagamit ng hango sa number (walang ipinapadalang email).
// Isang number = isang account (unique ang auth email). Auto-confirmed ito, at para sa tenant lang, kaya hindi nito
// nagagalaw ang email verification ng landlord o ang admin access.
//
// Deploy:  supabase functions deploy tenant-signup
import { createClient } from 'npm:@supabase/supabase-js@2'

const TENANT_EMAIL_DOMAIN = 'tenant.budgetrent.ph'
const MIN_AGE = 13
const WORK_STATUSES = ['Estudyante', 'Empleyado', 'Self-employed / Negosyo', 'OFW', 'Walang trabaho ngayon', 'Iba pa']

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

const reply = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const ageOf = (iso: string) => {
  const b = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(b.getTime())) return null
  const now = new Date()
  let age = now.getFullYear() - b.getFullYear()
  if (now.getMonth() < b.getMonth() || (now.getMonth() === b.getMonth() && now.getDate() < b.getDate())) age -= 1
  return age
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return reply(405, { error: 'Method not allowed' })

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return reply(400, { error: 'Invalid request' })
  }

  const fullName = String(body.fullName ?? '').trim()
  const phone = String(body.phone ?? '')
  const birthday = String(body.birthday ?? '')
  const workStatus = String(body.workStatus ?? '')
  const password = String(body.password ?? '')

  if (fullName.length < 2 || fullName.length > 80) return reply(400, { error: 'Please enter your full name.' })
  if (!/^639\d{9}$/.test(phone)) return reply(400, { error: 'Please enter a valid Philippine mobile number.' })
  const age = birthday ? ageOf(birthday) : null
  if (age === null || age < MIN_AGE || age > 110) return reply(400, { error: 'Invalid birthday.' })
  if (!WORK_STATUSES.includes(workStatus)) return reply(400, { error: 'Please select your work status.' })
  if (password.length < 6 || password.length > 72) return reply(400, { error: 'Password must be 6 to 72 characters.' })

  const url = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !serviceKey) return reply(500, { error: 'The server is not set up yet.' })

  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
  const { error } = await admin.auth.admin.createUser({
    email: `${phone}@${TENANT_EMAIL_DOMAIN}`,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, phone, birthday, work_status: workStatus, user_role: 'tenant' }
  })

  if (error) {
    if (/already|registered|exists/i.test(error.message)) {
      return reply(409, { error: 'This number already has an account. Please log in instead.' })
    }
    console.error('tenant-signup failed:', error.message)
    return reply(500, { error: 'Unable to create an account right now. Please try again later.' })
  }

  return reply(200, { ok: true })
})
