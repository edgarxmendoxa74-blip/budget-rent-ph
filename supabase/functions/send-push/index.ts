// Nagpapadala ng push notification (FCM) sa phone ng users kahit nakasara ang app.
// Tinatawag ng database triggers (tingnan ang migration add_push_notifications.sql) kapag may bagong
// announcement, booking request, o chat message. Naka-protect ng x-push-secret header (galing sa push_config table).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CHANNEL_ID = 'budgetrent-alerts';
const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

const b64url = (data: ArrayBuffer | string) => {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(data);
  let s = '';
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

// OAuth access token mula sa Firebase service account (JWT na pinirmahan ng private key)
const getAccessToken = async (sa: { client_email: string; private_key: string }) => {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = b64url(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }));
  const pem = sa.private_key.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(`${header}.${claim}`));
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${header}.${claim}.${b64url(sig)}` }),
  });
  const json = await res.json();
  if (!json.access_token) throw new Error('FCM auth failed');
  return json.access_token as string;
};

const clip = (s: unknown, n: number) => String(s ?? '').slice(0, n);

// Sino ang makakatanggap at ano ang laman
const buildMessage = async (type: string, r: Record<string, any>): Promise<{ userIds: string[] | 'all'; title: string; body: string } | null> => {
  if (type === 'announcement') return { userIds: 'all', title: clip(r.title, 80), body: clip(r.body, 180) };

  if (type === 'booking') {
    const { data: prop } = await sb.from('properties').select('user_id, name').eq('id', r.property_id).maybeSingle();
    if (!prop?.user_id) return null;
    return { userIds: [prop.user_id], title: 'New booking request', body: `${clip(r.customer_name, 40)} sent a request for ${clip(prop.name, 60)}.` };
  }

  if (type === 'message') {
    if (r.auto) return null;
    const { data: bk } = await sb.from('booking_requests').select('user_id, property_id, customer_name').eq('id', r.booking_id).maybeSingle();
    if (!bk) return null;
    if (r.sender === 'guest') {
      const { data: prop } = await sb.from('properties').select('user_id').eq('id', bk.property_id).maybeSingle();
      if (!prop?.user_id) return null;
      return { userIds: [prop.user_id], title: clip(bk.customer_name, 40) || 'New message', body: clip(r.body, 140) };
    }
    if (!bk.user_id) return null; // guest na walang account: walang push
    return { userIds: [bk.user_id], title: 'The owner replied', body: clip(r.body, 140) };
  }
  return null;
};

Deno.serve(async (req) => {
  // Ang secret ay nasa private na push_config table (service role lang ang may access)
  const { data: cfg } = await sb.from('push_config').select('value').eq('key', 'push_secret').maybeSingle();
  if (!cfg?.value || req.headers.get('x-push-secret') !== cfg.value) return new Response('Unauthorized', { status: 401 });
  try {
    const { type, record } = await req.json();
    const msg = await buildMessage(type, record || {});
    if (!msg) return Response.json({ sent: 0 });

    let q = sb.from('device_tokens').select('token');
    if (msg.userIds !== 'all') q = q.in('user_id', msg.userIds);
    const { data: rows } = await q;
    const tokens = (rows || []).map((x) => x.token as string);
    if (!tokens.length) return Response.json({ sent: 0 });

    const sa = JSON.parse(Deno.env.get('FCM_SERVICE_ACCOUNT') || '{}');
    const access = await getAccessToken(sa);
    let sent = 0;
    await Promise.all(tokens.map(async (token) => {
      const res = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${access}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: {
            token,
            notification: { title: msg.title, body: msg.body },
            android: { priority: 'HIGH', notification: { channel_id: CHANNEL_ID, sound: 'default', icon: 'ic_stat_notify', color: '#0B3F82' } },
          },
        }),
      });
      if (res.ok) { sent += 1; return; }
      // Patay na token (na-uninstall ang app): tanggalin
      const err = await res.text();
      if (/UNREGISTERED|NOT_FOUND/.test(err)) await sb.from('device_tokens').delete().eq('token', token);
    }));
    return Response.json({ sent });
  } catch (e) {
    return new Response(String((e as Error).message || e), { status: 500 });
  }
});
