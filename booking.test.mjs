import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { bookingStatus, eventDates, quantity, selection, validateConfig, whatsappMessage, whatsappUrl, passCoverage } from '../src/booking.mjs';
import { updateEvent } from '../server/content.mjs';

const config = JSON.parse(await readFile(new URL('../data/events.json', import.meta.url), 'utf8'));
const event = config.events[0];
const before = Date.parse('2026-10-14T12:00:00+05:30');

test('configured event preserves the published booking details', () => {
  validateConfig(config);
  assert.equal(eventDates(event), '17–18 October 2026');
  assert.equal(event.whatsapp, '919460222677');
  assert.equal(selection(event, { kids:1, adult:2 }).total, 1297);
  assert.equal(selection(event, { kids:2, adult:0 }).total, 598);
  assert.equal(selection(event, { kids:0, adult:3 }).total, 1497);
});
test('invalid, empty, unsafe, negative and fractional quantities cannot book', () => {
  for (const value of ['', '-1', '1.5', '1e2', ' 2 ', 'Infinity', 'NaN', Number.MAX_SAFE_INTEGER + 1, {}, null, true])
    assert.equal(quantity(value), null, String(value));
  assert.equal(quantity('0'), 0);
  assert.equal(quantity('02'), 2);
  assert.equal(selection(event, { kids:'1.5', adult:2 }).valid, false);
  assert.equal(selection(event, { kids:Number.MAX_SAFE_INTEGER, adult:1 }).valid, false);
  assert.throws(() => whatsappUrl(event, selection(event, {}), before), /at least one/);
});
test('WhatsApp URL safely round-trips full quantities, prices, dates and total', () => {
  const selected = selection(event, { kids:1, adult:2 });
  const url = new URL(whatsappUrl(event, selected, before));
  assert.equal(url.origin, 'https://api.whatsapp.com');
  assert.equal(url.pathname, '/send');
  assert.equal(url.searchParams.get('phone'), '919460222677');
  const message = url.searchParams.get('text');
  assert.equal(message, whatsappMessage(event, selected));
  assert.equal(message, [
    'Hi SAAJSAAZ! 👋',
    'I’d like to book passes for *Raas Garba 2026*.',
    '',
    '📅 *Dates:* 17–18 October 2026',
    '🕕 *Time:* 6–9 PM IST',
    '',
    '*Pass selection*',
    '• Kids: 1 × ₹299 = ₹299',
    '• Adults: 2 × ₹499 = ₹998',
    '',
    '*Total passes: 3*',
    '*Total amount: ₹1,297*',
    '',
    passCoverage(event),
    '',
    'Please share the payment steps and confirm my booking.'
  ].join('\n'));
  assert.ok(!message.includes('Booking confirmed'));
  for (const [values, expected, omitted, total] of [
    [{ kids:2 }, '• Kids: 2 × ₹299 = ₹598', '• Adults:', '₹598'],
    [{ adult:3 }, '• Adults: 3 × ₹499 = ₹1,497', '• Kids:', '₹1,497']
  ]) {
    const single = new URL(whatsappUrl(event, selection(event, values), before)).searchParams.get('text');
    assert.ok(single.includes(expected));
    assert.ok(!single.includes(omitted));
    assert.ok(single.includes('*Total amount: ' + total + '*'));
  }
});

test('WhatsApp formatting follows organiser edits and preserves minute and AM/PM distinctions', () => {
  const updated = updateEvent(config, event.slug, {
    name:'New Garba 2027', startDate:'2027-02-05', endDate:'2027-02-06',
    startTime:'18:30', endTime:'21:15', bookingEnabled:true,
    prices:{kids:350,adult:550}, workshopDates:['2027-02-03','2027-02-04']
  }).events[0];
  const message = new URL(whatsappUrl(updated, selection(updated, {kids:1,adult:2}), before)).searchParams.get('text');
  for (const expected of ['*New Garba 2027*', '5–6 February 2027', '6:30–9:15 PM IST',
    '• Kids: 1 × ₹350 = ₹350', '• Adults: 2 × ₹550 = ₹1,100', '*Total amount: ₹1,450*', passCoverage(updated)])
    assert.ok(message.includes(expected), expected);
  assert.ok(whatsappMessage({...updated,dailyTime:'10:30 AM – 1 PM'}, selection(updated,{adult:1})).includes('10:30 AM–1 PM IST'));
  assert.ok(whatsappMessage({...updated,dailyTime:'9 AM – 11 AM'}, selection(updated,{adult:1})).includes('9–11 AM IST'));
  assert.ok(whatsappMessage({...updated,timezone:'Europe/London'}, selection(updated,{adult:1})).includes('6:30–9:15 PM Europe/London'));
});
test('bookings close precisely at 9 PM IST on 18 October', () => {
  const end = Date.parse('2026-10-18T21:00:00+05:30');
  assert.equal(new Date(end).toISOString(), '2026-10-18T15:30:00.000Z');
  assert.equal(bookingStatus(event, end - 1), 'open');
  assert.equal(bookingStatus(event, end), 'completed');
  assert.equal(bookingStatus(event, end + 1), 'completed');
  assert.throws(() => whatsappUrl(event, selection(event, { adult:1 }), end), /closed/);
  assert.equal(bookingStatus({ ...event, bookingEnabled:false }, before), 'closed');
});
test('future events work with different pass types, prices, contacts and dates', () => {
  const future = { ...event, slug:'test-future-event', title:'Test future event',
    startsAt:'2027-01-31T18:00:00+05:30', endsAt:'2027-02-01T21:00:00+05:30',
    passes:[{ id:'family', label:'Family pass', price:1200 }], whatsapp:'919460222678', workshop:undefined };
  validateConfig({ ...config, events:[event, future] });
  assert.equal(eventDates(future), '31 January – 1 February 2027');
  const message = new URL(whatsappUrl(future, selection(future, { family:2 }), before));
  assert.equal(message.searchParams.get('phone'), '919460222678');
  assert.ok(message.searchParams.get('text').includes('Family pass: 2 × ₹1,200 = ₹2,400'));
  assert.throws(() => validateConfig({ ...config, events:[event,event] }), /unique/);
  assert.throws(() => validateConfig({ ...config, events:[{ ...event, passes:[{id:'kids',label:'Kids pass',price:-299}] }] }), /Invalid/);
});

test('pass coverage follows the configured local calendar range instead of stale two-day copy', () => {
  assert.equal(passCoverage(event),'Each pass includes entry on both event nights.');
  const three={...event,endsAt:'2026-10-19T21:00:00+05:30'};
  assert.equal(passCoverage(three),'Each pass includes entry on all 3 event nights.');
  assert.ok(whatsappMessage(three,selection(three,{adult:1})).includes('all 3 event nights'));
  assert.equal(passCoverage({...event,startsAt:'2026-10-17T09:00:00+05:30',endsAt:'2026-10-17T12:00:00+05:30'}),'Each pass includes entry on the event day.');
  assert.equal(passCoverage({...event,timezone:'America/New_York',startsAt:'2026-10-31T18:00:00-04:00',endsAt:'2026-11-02T21:00:00-05:00'}),'Each pass includes entry on all 3 event nights.');
});
