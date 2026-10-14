export const instagramProfile = 'https://www.instagram.com/saajsaaz/';

export function instagramReelUrl(value) {
  if (typeof value !== 'string' || value.length > 500) throw new Error('Enter a valid Instagram reel link.');
  let url;
  try { url = new URL(value.trim()); } catch { throw new Error('Enter a valid Instagram reel link.'); }
  if (url.protocol !== 'https:' || !['instagram.com','www.instagram.com'].includes(url.hostname) ||
      url.username || url.password || url.port)
    throw new Error('Use an HTTPS Instagram reel link.');
  const match = /^\/(?:[A-Za-z0-9_.]+\/)?reel\/([A-Za-z0-9_-]{5,64})\/?$/.exec(url.pathname);
  if (!match) throw new Error('Use a reel link, such as instagram.com/reel/…/.');
  return 'https://www.instagram.com/reel/' + match[1] + '/';
}

export function validateReels(value) {
  if (!Array.isArray(value) || value.length > 12) throw new Error('Choose up to 12 homepage reels.');
  const ids = new Set(), urls = new Set();
  return value.map(reel => {
    if (!reel || typeof reel.id !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(reel.id) || ids.has(reel.id))
      throw new Error('Each reel must have a unique identifier.');
    if (typeof reel.caption !== 'string' || !reel.caption.trim() || reel.caption.trim().length > 120)
      throw new Error('Enter a reel caption of 1–120 characters.');
    if (typeof reel.enabled !== 'boolean') throw new Error('Choose whether each reel is visible.');
    const url = instagramReelUrl(reel.url);
    if (urls.has(url)) throw new Error('This reel is already in the list.');
    ids.add(reel.id); urls.add(url);
    return {id:reel.id,url,caption:reel.caption.trim(),enabled:reel.enabled};
  });
}

export function instagramEmbedUrl(value) {
  const url = instagramReelUrl(value);
  return url + 'embed/';
}
