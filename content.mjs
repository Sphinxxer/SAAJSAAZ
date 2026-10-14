import { validateConfig } from '../src/booking.mjs';
import { validateReels } from '../src/social.mjs';

function contentText(value,label,limit) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > limit)
    throw new Error('Enter '+label+' of 1–'+limit+' characters.');
  return value.trim();
}
export function updateSocial(configuration,input) {
  const result = {...configuration,social:{reels:validateReels(input.reels)}};
  delete result._revision;
  validateConfig(result);
  return result;
}

function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      !Number.isFinite(Date.parse(value + 'T00:00:00Z')) ||
      new Date(value + 'T00:00:00Z').toISOString().slice(0,10) !== value)
    throw new Error('Choose valid event and workshop dates.');
  return value;
}
function validTime(value) {
  if (typeof value !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value))
    throw new Error('Choose valid start and end times.');
  return value;
}
function displayTime(value) {
  const [hours,minutes] = value.split(':').map(Number);
  return (hours % 12 || 12) + (minutes ? ':' + String(minutes).padStart(2,'0') : '') + (hours < 12 ? ' AM' : ' PM');
}
export function updateEvent(configuration, slug, input) {
  const original = configuration.events.find(e=>e.slug === slug);
  if (!original) throw new Error('Event not found.');
  if (!input || typeof input.name !== 'string' || !input.name.trim() || input.name.trim().length > 120)
    throw new Error('Enter an event name of 1–120 characters.');
  if (typeof input.bookingEnabled !== 'boolean') throw new Error('Choose the booking status.');
  const startDate = validDate(input.startDate), endDate = validDate(input.endDate);
  const startTime = validTime(input.startTime), endTime = validTime(input.endTime);
  if (endTime <= startTime) throw new Error('Daily end time must be after the start time.');
  const startsAt = startDate + 'T' + startTime + ':00+05:30';
  const endsAt = endDate + 'T' + endTime + ':00+05:30';
  if (Date.parse(startsAt) >= Date.parse(endsAt)) throw new Error('Event end date must be after or the same as the start date.');
  const year = startDate.slice(0,4);
  const title = input.name.trim();
  const displayTitle = title.replace(new RegExp('\\s+' + year + '$'),'') || title;
  const updated = { ...original,title,displayTitle,year,startsAt,endsAt,
    dailyTime:displayTime(startTime) + ' – ' + displayTime(endTime), bookingEnabled:input.bookingEnabled,
    passes:original.passes.map(pass=>{
      const price = input.prices?.[pass.id];
      if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0 ||
          Math.abs(price * 100 - Math.round(price * 100)) > 0.00001 ||
          !Number.isSafeInteger(Math.round(price * 100)))
        throw new Error('Enter a positive pass price with no more than two decimal places.');
      return {...pass,price};
    })
  };
  for (const [key,label,limit] of [
    ['headline','a headline',180],['description','a description',1000],
    ['intro','an introduction',1000],['city','a city name',120],['venue','a venue address',500]
  ]) {
    if (input[key] !== undefined) updated[key] = contentText(input[key],label,limit);
  }
  if (original.workshop) {
    if (!Array.isArray(input.workshopDates) || input.workshopDates.length !== original.workshop.sessions.length)
      throw new Error('Choose all workshop dates.');
    if (input.workshopDescriptions !== undefined && (!Array.isArray(input.workshopDescriptions) ||
        input.workshopDescriptions.length !== original.workshop.sessions.length))
      throw new Error('Enter a description for every workshop session.');
    updated.workshop = {...original.workshop,sessions:original.workshop.sessions.map((session,index)=>({
      ...session,date:validDate(input.workshopDates[index]),
      description:input.workshopDescriptions === undefined ? session.description :
        contentText(input.workshopDescriptions[index],'a workshop description',240)
    }))};
  }
  const result = {...configuration,events:configuration.events.map(e=>e.slug === slug ? updated : e)};
  delete result._revision;
  delete result.dateSheet;
  validateConfig(result);
  return result;
}

export async function readConfiguration(env, defaults, now = Date.now()) {
  let record = await env.DB.prepare('SELECT content, revision FROM event_settings WHERE id = ?').bind('website').first();
  if (!record) {
    const initial = {...defaults};
    delete initial.dateSheet;
    await env.DB.prepare('INSERT INTO event_settings (id, content, revision, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO NOTHING')
      .bind('website',JSON.stringify(initial),1,now).run();
    record = await env.DB.prepare('SELECT content, revision FROM event_settings WHERE id = ?').bind('website').first();
  }
  // Merge only missing capabilities/new slugs. An intentionally empty reel list
  // belongs to the organiser and must never be reseeded.
  for (let attempt = 0; attempt < 3; attempt++) {
    const configuration = validateConfig(JSON.parse(record.content));
    const additions = defaults.events.filter(event=>!configuration.events.some(saved=>saved.slug===event.slug));
    const needsSocial = !Object.hasOwn(configuration,'social') && defaults.social;
    const hasOldOrigin = Object.hasOwn(configuration,'siteUrl');
    if (!additions.length && !needsSocial && !hasOldOrigin)
      return {...configuration,_revision:record.revision};
    const merged = {...configuration,events:[...configuration.events,...additions]};
    if (needsSocial) merged.social = structuredClone(defaults.social);
    delete merged.siteUrl;
    validateConfig(merged);
    await env.DB.prepare('UPDATE event_settings SET content = ?, revision = revision + 1, updated_at = ? WHERE id = ? AND revision = ?')
      .bind(JSON.stringify(merged),now,'website',record.revision).run();
    record = await env.DB.prepare('SELECT content, revision FROM event_settings WHERE id = ?').bind('website').first();
  }
  throw new Error('Configuration is being updated. Try again.');
}
