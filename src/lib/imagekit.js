// ImageKit para sa pag-display ng public images galing Supabase Storage (resize + WebP/AVIF + CDN).
// Naka-off kapag walang VITE_IMAGEKIT_URL; ibabalik lang ang orihinal na URL.
// Public buckets lang ang dumadaan dito; ang private (payment-proofs, signed URLs) ay hindi tugma sa prefix.

const IK_URL = (import.meta.env.VITE_IMAGEKIT_URL || '').replace(/\/+$/, '');
const SUPABASE_PUBLIC_PREFIX = `${(import.meta.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '')}/storage/v1/object/public/`;

export const ikImage = (src, width, quality = 80) => {
  if (!IK_URL || !src || typeof src !== 'string' || !src.startsWith(SUPABASE_PUBLIC_PREFIX)) return src;
  const path = src.slice(SUPABASE_PUBLIC_PREFIX.length);
  const tr = [width && `w-${Math.round(width)}`, `q-${quality}`].filter(Boolean).join(',');
  return `${IK_URL}/${path}?tr=${tr}`;
};
