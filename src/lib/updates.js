// Kukuha ng YouTube video id sa kahit anong karaniwang link (watch, youtu.be, shorts, embed)
export const youtubeId = (url = '') => {
  const m = String(url).match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/))([\w-]{11})/);
  return m ? m[1] : null;
};

// Thumbnail na inilagay ng admin; kung wala, gamitin ang YouTube thumbnail
export const updateThumbnail = (u) =>
  u.thumbnail_url || (youtubeId(u.video_url) ? `https://img.youtube.com/vi/${youtubeId(u.video_url)}/hqdefault.jpg` : '');
