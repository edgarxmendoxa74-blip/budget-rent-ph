import { useEffect, useState } from 'react';
import { supabase } from './supabase';

export const HERO_SETTINGS_KEY = 'hero_section';

// Default na laman hangga't wala pang na-save ang super admin
export const DEFAULT_HERO = {
  title: 'Welcome to BudgetRentPH',
  subtitle: 'Affordable. Nearby. Trustworthy.',
  slides: [
    { enabled: true, image: '/boarding.png', title: 'Para sa mga Filipino', description: 'Naghahanap ng paupahan o staycation? Dito mo mahahanap ang bahay at kwarto na pasok sa budget mo.' },
    { enabled: true, image: '/studio.png', title: 'Para sa mga Landlord', description: 'May paupahan ka ba? I-post ito dito at makarating sa mas maraming tenant na naghahanap.' },
    { enabled: true, image: '/bedspace.png', title: 'Mas madaling maghanap', description: 'Hindi mo na kailangang libutin ang lugar. Hanapin ang bahay na gusto mo sa isang app lang.' },
    { enabled: true, image: '/studio.png', title: 'Staycation na pasok sa budget', description: 'Maghanap ng staycation para sa barkada o pamilya sa presyong kaya mo.' },
    { enabled: true, image: '/boarding.png', title: 'Mapagkakatiwalaang landlord', description: 'May verified badge ang mga landlord, kaya mas panatag ka sa uupahan mo.' }
  ]
};

export function mergeHero(value) {
  const v = value || {};
  return {
    title: v.title || DEFAULT_HERO.title,
    subtitle: v.subtitle ?? DEFAULT_HERO.subtitle,
    slides: DEFAULT_HERO.slides.map((d, i) => ({ ...d, ...(v.slides?.[i] || {}), image: v.slides?.[i]?.image || d.image, enabled: v.slides?.[i]?.enabled !== false }))
  };
}

export function useHeroSection() {
  const [hero, setHero] = useState(DEFAULT_HERO);
  useEffect(() => {
    let alive = true;
    supabase.from('app_settings').select('value').eq('key', HERO_SETTINGS_KEY).maybeSingle()
      .then(({ data }) => { if (alive && data?.value) setHero(mergeHero(data.value)); });
    return () => { alive = false; };
  }, []);
  return hero;
}

// Standard size ng slide image: 16:9 (1280x720)
export const HERO_IMAGE_W = 1280;
export const HERO_IMAGE_H = 720;

// Ini-crop sa gitna papuntang 16:9 at nire-resize para pareho ang sukat ng lahat ng slide
export async function cropHeroImage(file) {
  const bitmap = await createImageBitmap(file);
  const target = HERO_IMAGE_W / HERO_IMAGE_H;
  let sw = bitmap.width;
  let sh = bitmap.height;
  if (sw / sh > target) sw = Math.round(sh * target);
  else sh = Math.round(sw / target);
  const sx = Math.round((bitmap.width - sw) / 2);
  const sy = Math.round((bitmap.height - sh) / 2);
  const canvas = document.createElement('canvas');
  canvas.width = HERO_IMAGE_W;
  canvas.height = HERO_IMAGE_H;
  canvas.getContext('2d').drawImage(bitmap, sx, sy, sw, sh, 0, 0, HERO_IMAGE_W, HERO_IMAGE_H);
  bitmap.close?.();
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.85));
  if (!blob) throw new Error('Hindi ma-process ang image.');
  return blob;
}
