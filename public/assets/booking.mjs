import {validateReels} from './social.mjs';
export const rupees = (value) => '₹' + new Intl.NumberFormat('en-IN', {
  maximumFractionDigits: 2
}).format(value);

export function quantity(raw) {
  if (typeof raw !== 'number' && typeof raw !== 'string') return null;
  if (typeof raw === 'string' && !/^\d+$/.test(raw)) return null;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

export function selection(event, values) {
  let count = 0;
  let totalPaise = 0;
  const lines = [];
  for (const pass of event.passes) {
    const value = quantity(values[pass.id] ?? 0);
    if (value === null) return { valid: false, count: 0, total: 0, lines: [] };
    const pricePaise = Math.round(pass.price * 100);
    count += value;
    totalPaise += value * pricePaise;
    if (!Number.isSafeInteger(count) || !Number.isSafeInteger(totalPaise))
      return { valid: false, count: 0, total: 0, lines: [] };
    if (value > 0) lines.push({ ...pass, quantity: value, subtotal: value * pricePaise / 100 });
  }
  return { valid: true, count, total: totalPaise / 100, lines };
}

export function bookingStatus(event, now = Date.now()) {
  const end = Date.parse(event.endsAt);
  if (!Number.isFinite(end) || now >= end) return 'completed';
  return event.bookingEnabled ? 'open' : 'closed';
}

export function eventDates(event, withYear = true) {
  const a = new Date(event.startsAt);
  const b = new Date(event.endsAt);
  const fmt = (d, options) => new Intl.DateTimeFormat('en-GB', {
    timeZone: event.timezone, ...options
  }).format(d);
  const ad = fmt(a, { day: 'numeric' });
  const bd = fmt(b, { day: 'numeric' });
  const am = fmt(a, { month: 'long' });
  const bm = fmt(b, { month: 'long' });
  const ay = fmt(a, { year: 'numeric' });
  const by = fmt(b, { year: 'numeric' });
  if (ay !== by) return ad + ' ' + am + ' ' + ay + ' – ' + bd + ' ' + bm + ' ' + by;
  const range = am === bm ? (ad === bd ? ad : ad + '–' + bd) + ' ' + am
    : ad + ' ' + am + ' – ' + bd + ' ' + bm;
  return range + (withYear ? ' ' + by : '');
}

export function passCoverage(event) {
  const parts = value => Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone:event.timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'
  }).formatToParts(new Date(value)).map(p=>[p.type,p.value]));
  const start=parts(event.startsAt),end=parts(event.endsAt);
  const day=p=>Date.UTC(Number(p.year),Number(p.month)-1,Number(p.day));
  const count=Math.round((day(end)-day(start))/86400000)+1;
  const period=Number(start.hour)>=16?'night':'day';
  return 'Each pass includes entry on '+(count===1?'the event '+period:count===2?'both event '+period+'s':'all '+count+' event '+period+'s')+'.';
}

export function eventTime(event) {
  const time = event.dailyTime
    .replace(/^(\d{1,2}(?::\d{2})?) (AM|PM)\s*[–-]\s*(\d{1,2}(?::\d{2})?) \2$/, '$1–$3 $2')
    .replace(/\s*[–-]\s*/, '–');
  const timezone = ['Asia/Kolkata', 'Asia/Calcutta'].includes(event.timezone) ? 'IST' : event.timezone;
  return time+' '+timezone;
}

export function whatsappMessage(event, selected) {
  if (!selected.valid || selected.count === 0) throw new Error('Choose at least one valid pass.');
  const passLabels = { kids: 'Kids', adult: 'Adults' };
  return [
    'Hi SAAJSAAZ! 👋',
    'I’d like to book passes for *' + event.title + '*.',
    '',
    '📅 *Dates:* ' + eventDates(event),
    '🕕 *Time:* ' + eventTime(event),
    '',
    '*Pass selection*',
    ...selected.lines.map(p => '• ' + (passLabels[p.id] ?? p.label) + ': ' + p.quantity + ' × ' + rupees(p.price) + ' = ' + rupees(p.subtotal)),
    '',
    '*Total passes: ' + selected.count + '*',
    '*Total amount: ' + rupees(selected.total) + '*',
    '',
    passCoverage(event),
    '',
    'Please share the payment steps and confirm my booking.'
  ].filter(x => x !== undefined).join('\n');
}

export function whatsappUrl(event, selected, now = Date.now()) {
  if (bookingStatus(event, now) !== 'open') throw new Error('Bookings are closed.');
  if (!/^[1-9]\d{7,14}$/.test(event.whatsapp)) throw new Error('Invalid WhatsApp contact.');
  return 'https://api.whatsapp.com/send?phone=' + event.whatsapp + '&text=' + encodeURIComponent(whatsappMessage(event, selected));
}

export function validateConfig(config) {
  if (!config || !Array.isArray(config.events) || !config.brand ||
      !/^[1-9]\d{7,14}$/.test(config.whatsapp)) throw new Error('Invalid website configuration.');
  if (config.social) validateReels(config.social.reels);
  if (config.dateSheet?.csvUrl) {
    const url = new URL(config.dateSheet.csvUrl);
    if (url.protocol !== 'https:' || url.hostname !== 'docs.google.com' ||
        !/^\/spreadsheets\/d\/e\/[^/]+\/pub$/.test(url.pathname) ||
        url.searchParams.get('output') !== 'csv')
      throw new Error('Use the published Google Sheets CSV link.');
  }
  const slugs = new Set();
  for (const event of config.events) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(event.slug) || slugs.has(event.slug))
      throw new Error('Event slugs must be unique and URL-safe.');
    slugs.add(event.slug);
    for (const key of ['title','displayTitle','year','headline','description','intro','dailyTime','timezone','city','venue','passNote'])
      if (typeof event[key] !== 'string' || !event[key].trim()) throw new Error('Missing event field: ' + key);
    new Intl.DateTimeFormat('en', { timeZone: event.timezone });
    if (![event.startsAt, event.endsAt].every(t => typeof t === 'string' &&
        /T.*(?:Z|[+-]\d{2}:\d{2})$/.test(t) && Number.isFinite(Date.parse(t))) ||
        Date.parse(event.startsAt) >= Date.parse(event.endsAt))
      throw new Error('Use valid start/end timestamps with explicit timezone offsets.');
    if (typeof event.bookingEnabled !== 'boolean' || !/^[1-9]\d{7,14}$/.test(event.whatsapp))
      throw new Error('Invalid event booking settings.');
    if (!Array.isArray(event.passes) || event.passes.length === 0) throw new Error('An event needs pass types.');
    const ids = new Set();
    for (const pass of event.passes) {
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(pass.id) || ids.has(pass.id) || !pass.label ||
          !Number.isFinite(pass.price) || pass.price <= 0 || !Number.isSafeInteger(Math.round(pass.price * 100)) ||
          Math.abs(pass.price * 100 - Math.round(pass.price * 100)) > 0.00001)
        throw new Error('Invalid or duplicate pass type for ' + event.slug);
      ids.add(pass.id);
    }
    if (event.workshop) {
      if (!event.workshop.title || !event.workshop.note || !Array.isArray(event.workshop.sessions))
        throw new Error('Invalid workshop.');
      for (const session of event.workshop.sessions)
        if (!/^\d{4}-\d{2}-\d{2}$/.test(session.date) ||
            new Date(session.date).toISOString().slice(0, 10) !== session.date || !session.description)
          throw new Error('Invalid workshop session.');
    }
  }
  if (config.featuredEvent && !slugs.has(config.featuredEvent)) throw new Error('Featured event does not exist.');
  return config;
}
