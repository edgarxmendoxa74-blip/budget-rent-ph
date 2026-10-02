// Paghahanap ng lugar sa listings: lalawigan, bayan/lungsod, at barangay.
// Ang address ng listing ay karaniwang "Barangay, Bayan/City, Probinsya" (tingnan ang PropertyForm).

const STOPWORDS = new Set([
  'brgy', 'brg', 'barangay', 'bgy', 'city', 'lungsod', 'bayan', 'municipality', 'munisipyo',
  'province', 'probinsya', 'lalawigan', 'of', 'ng', 'sa', 'the', 'ph', 'philippines', 'pilipinas'
]);

// Lowercase, walang accent (ñ → n), "Sta." → "santa", walang bantas
export const normalizePlace = (value) =>
  String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\bsta\.?(?=\s|$)/g, 'santa')
    .replace(/\bsto\.?(?=\s|$)/g, 'santo')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const tokensOf = (value) =>
  normalizePlace(value).split(' ').filter((t) => t && !STOPWORDS.has(t));

// Lahat ng salita sa tinype ay dapat nasa pangalan o address ("Bonuan Dagupan", "Dagupan, Pangasinan", "Brgy. Bonuan")
export const matchesPlaceQuery = (item, query) => {
  const raw = String(query || '').trim();
  if (!raw) return true;
  const haystack = normalizePlace(`${item.name || item.title || ''} ${item.location || ''}`);
  const tokens = tokensOf(raw);
  if (!tokens.length) return haystack.includes(normalizePlace(raw));
  return tokens.every((t) => haystack.includes(t));
};

// Hatiin ang address sa barangay / bayan / lalawigan (mula sa dulo, kaya gumagana rin sa mahabang address)
export const parseLocation = (location) => {
  const parts = String(location || '')
    .split(',')
    .map((p) => p.trim())
    .filter((p) => p && !/^\d+$/.test(p) && !/^(philippines|pilipinas)$/i.test(p) && !/^region\b/i.test(p));
  if (parts.length >= 3) {
    return { barangay: parts[parts.length - 3].replace(/^(brgy\.?|brg\.?|bgy\.?|barangay)\s+/i, ''), bayan: parts[parts.length - 2], lalawigan: parts[parts.length - 1] };
  }
  if (parts.length === 2) return { bayan: parts[0], lalawigan: parts[1] };
  if (parts.length === 1) return { bayan: parts[0] };
  return {};
};

export const PLACE_LEVELS = {
  lalawigan: 'Province',
  bayan: 'Town / City',
  barangay: 'Barangay'
};

// Listahan ng mga lugar na may listing, may bilang ng listing sa bawat isa
export const buildPlaceIndex = (listings) => {
  const map = new Map();
  const add = (level, label, context, query) => {
    if (!label) return;
    const key = `${level}|${normalizePlace(label)}|${normalizePlace(context)}`;
    const entry = map.get(key);
    if (entry) entry.count += 1;
    else map.set(key, { level, label, context, query, count: 1, norm: normalizePlace(label) });
  };
  listings.forEach((item) => {
    const { barangay, bayan, lalawigan } = parseLocation(item.location);
    if (lalawigan) add('lalawigan', lalawigan, '', lalawigan);
    if (bayan) add('bayan', bayan, lalawigan || '', lalawigan ? `${bayan}, ${lalawigan}` : bayan);
    if (barangay) add('barangay', barangay, [bayan, lalawigan].filter(Boolean).join(', '), [barangay, bayan].filter(Boolean).join(', '));
  });
  return [...map.values()];
};

const LEVEL_ORDER = { lalawigan: 0, bayan: 1, barangay: 2 };

export const suggestPlaces = (index, query, limit = 7) => {
  const tokens = tokensOf(query);
  if (!tokens.length) return [];
  const first = tokens[0];
  const scored = index
    .map((entry) => {
      const hay = `${entry.norm} ${normalizePlace(entry.context)}`;
      if (!tokens.every((t) => hay.includes(t))) return null;
      const starts = entry.norm.startsWith(first) ? 0 : entry.norm.includes(first) ? 1 : 2;
      return { entry, starts };
    })
    .filter(Boolean)
    .sort((a, b) => a.starts - b.starts
      || LEVEL_ORDER[a.entry.level] - LEVEL_ORDER[b.entry.level]
      || b.entry.count - a.entry.count);
  return scored.slice(0, limit).map((s) => s.entry);
};
