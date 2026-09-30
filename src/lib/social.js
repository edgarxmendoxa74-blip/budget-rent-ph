// Ginagawang Messenger chat link (m.me) ang Facebook link o username ng landlord.
// Tinatanggap: facebook.com/juan.delacruz, profile.php?id=1000..., facebook.com/people/Juan/1000..., m.me/juan, @juan, juan.delacruz
// Ibinabalik ang '' kung hindi makilala (hal. pangalan lang na may espasyo).
const RESERVED = new Set(['profile.php', 'people', 'pages', 'groups', 'share', 'p', 'watch', 'events', 'marketplace', 'photo', 'photo.php', 'story.php', 'permalink.php', 'login', 'sharer']);

export const toMessengerUrl = (raw) => {
  const value = String(raw || '').trim();
  if (!value) return '';

  let candidate = value.replace(/^@/, '');
  if (!/^https?:\/\//i.test(candidate)) {
    if (/\s/.test(candidate)) return '';
    candidate = /^(www\.|m\.)?(facebook|fb|messenger)\.com|^m\.me|^fb\.me/i.test(candidate)
      ? `https://${candidate}`
      : `https://facebook.com/${candidate}`;
  }

  let url;
  try {
    url = new URL(candidate);
  } catch {
    return '';
  }

  const rawHost = url.hostname.toLowerCase();
  if (rawHost === 'm.me' || rawHost.endsWith('messenger.com')) return url.toString();
  const host = rawHost.replace(/^(www|m|web|mobile)\./, '');
  if (host !== 'facebook.com' && host !== 'fb.com' && host !== 'fb.me') return '';

  const parts = url.pathname.split('/').filter(Boolean);
  if (parts[0] === 'profile.php') {
    const id = url.searchParams.get('id');
    return /^\d+$/.test(id || '') ? `https://m.me/${id}` : '';
  }
  if (parts[0] === 'people') {
    const id = parts[parts.length - 1];
    return /^\d+$/.test(id) ? `https://m.me/${id}` : '';
  }
  if (parts[0] && !RESERVED.has(parts[0].toLowerCase()) && /^[A-Za-z0-9.\-_]+$/.test(parts[0])) {
    return `https://m.me/${parts[0]}`;
  }
  // Hindi ma-convert (hal. share link): buksan na lang ang mismong Facebook page
  return url.toString();
};
