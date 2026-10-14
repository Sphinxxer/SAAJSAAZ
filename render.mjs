import { bookingStatus, eventDates, eventTime, rupees, passCoverage } from '../src/booking.mjs';
import {icon} from '../src/icons.mjs';
import {instagramProfile} from '../src/social.mjs';
import {renderExperience,renderReels,renderWorkshop,renderPasses,renderVenueFaq} from '../src/presentation.mjs';
export function renderSite(configuration, pathname) {
const config = configuration;
const origin = "";
const esc = value => String(value).replace(/[&<>"']/g, c => ({
  '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
}[c]));
const eventPath = event => '/events/' + event.slug + '/';
const contact = 'https://api.whatsapp.com/send?phone=' + config.whatsapp + '&text=' +
  encodeURIComponent('Hi SAAJSAAZ! I would like information about your events.');
const featured = config.events.find(e => e.slug === config.featuredEvent) || config.events[0];
const button = (url, label, attrs = '') => '<a class="button" href="' + esc(url) + '" ' + attrs + '><span data-action-label>' + esc(label) + '</span>' + icon('arrow') + '</a>';
const header = event => '<a class="skip-link" href="#main">Skip to content</a><header class="site-header"><div class="wrap header-inner">' +
  '<a class="wordmark" href="/" aria-label="SAAJSAAZ home">' + esc(config.brand) + '</a>' +
  '<button class="menu-toggle" id="menu-toggle" type="button" aria-expanded="false" aria-controls="main-nav">Menu</button>'+
  '<nav class="nav" id="main-nav" aria-label="Main navigation"><a href="/#events">Events</a><a href="/#experience">Experience</a>'+
  '<a href="/#workshop" data-workshop-link '+(featured?.workshop?'':'hidden')+'>Workshop</a><a href="/#reels" data-reels-link '+(config.social?.reels.some(r=>r.enabled)?'':'hidden')+'>Reels</a><a href="/#faq">FAQs</a>' +
  (event ? '<a class="button" data-featured-booking="' + esc(event.slug) + '" href="' + eventPath(event) + '#booking"><span data-action-label>' +
    (bookingStatus(event) === 'open' ? 'Book passes' : 'View events') + '</span></a>' : '<a class="button" href="/#events">View events</a>') +
  '</nav></div></header>';
const footer = () => '<footer class="site-footer" id="contact"><div class="wrap footer-inner"><div class="footer-brand">' +
  '<a class="wordmark" href="/">' + esc(config.brand) + '</a><p class="tagline">' + esc(config.tagline) + '</p></div>' +
  '<div class="footer-links"><a class="text-link" href="'+instagramProfile+'" target="_blank" rel="noopener noreferrer">Instagram '+icon('arrow')+'</a>'+
  '<a class="contact-link" href="' + esc(contact) + '" target="_blank" rel="noopener noreferrer">' + icon('whatsapp') +
  '<span>Contact on WhatsApp</span></a></div></div></footer>';

function page(title, description, pathname, body, event = featured) {
  const canonical = origin ? '<link rel="canonical" href="' + esc(origin + pathname) + '"><meta property="og:url" content="' + esc(origin + pathname) + '">' : '';
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<title>' + esc(title) + '</title><meta name="description" content="' + esc(description) + '">' +
    '<meta name="theme-color" content="#790b23"><meta property="og:type" content="website"><meta property="og:title" content="' + esc(title) + '">' +
    '<meta property="og:description" content="' + esc(description) + '">' + canonical +
    '<link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="/assets/styles.css"><link rel="stylesheet" href="/assets/festive.css"></head><body>' +
    header(event) + '<p class="schedule-notice" id="schedule-notice" role="status" hidden></p><main id="main" '+(pathname==='/'?'data-homepage':'')+'>' + body + '</main>' + footer() +
    (event?'<aside class="mobile-booking-bar" id="mobile-booking-bar" aria-label="Book event passes" hidden><div><strong data-title-for="'+esc(event.slug)+'">'+esc(event.title)+'</strong><span data-bar-price>From '+rupees(Math.min(...event.passes.map(p=>p.price)))+'</span></div>'+button(eventPath(event)+'#booking','Book passes','data-featured-booking="'+esc(event.slug)+'"')+'</aside>':'')+
    '<script id="site-data" type="application/json">' + JSON.stringify(config).replace(/</g, '\\u003c') + '</script>' +
    '<script type="module" src="/assets/app.mjs"></script></body></html>';
}

function eventRow(event) {
  const status = bookingStatus(event);
  return '<article class="event-row" data-event-slug="' + esc(event.slug) + '" data-status="' + status + '">' +
    '<div><h3><a data-title-for="' + esc(event.slug) + '" href="' + eventPath(event) + '">' + esc(event.title) + '</a></h3>' +
    '<p class="event-status" data-event-status ' + (status === 'open' ? 'hidden' : '') + '>' +
    (status === 'completed' ? 'Event completed · Bookings closed' : 'Bookings closed') + '</p></div>' +
    '<p class="row-date" data-row-date-for="' + esc(event.slug) + '">' + esc(eventDates(event, false)) + ' · ' + esc(event.city) + '</p>' +
    '<p class="row-price">' + event.passes.map(p => esc(p.shortLabel || p.label.replace(/\s+pass$/i, '')) + ' ' + rupees(p.price)).join(' · ') + '</p>' +
    button(eventPath(event), status === 'completed' ? 'View details' : 'View event', 'data-event-action') + '</article>';
}

function home() {
  let hero = '';
  if (featured) {
    hero = '<section class="hero" aria-labelledby="hero-heading"><div class="wrap hero-inner"><div class="hero-copy"><div class="hero-heading-group"><p class="event-eyebrow" data-title-for="'+esc(featured.slug)+'">'+esc(featured.title)+'</p><h1 id="hero-heading">' +
      esc(featured.headline).replace(' Garba', '<br>Garba') + '</h1><p class="hero-description" data-description-for="'+featured.slug+'">' + esc(featured.description) + '</p></div><div class="hero-facts-group">' +
      '<div class="event-facts"><p class="fact">' + icon('calendar') + '<span data-date-for="' + esc(featured.slug) + '">' + esc(eventDates(featured)) + '</span></p>' +
      '<p class="fact">' + icon('clock') + '<span data-time-for="' + esc(featured.slug) + '">' + esc(eventTime(featured)) + '</span></p></div>' +
      '<p class="hero-prices fact">'+icon('ticket')+'<span data-hero-prices>'+featured.passes.map(p=>esc(p.shortLabel||p.label)+' '+rupees(p.price)).join(' · ')+'</span></p>'+
      '<p class="hero-venue fact">'+icon('location')+'<span data-venue-for="'+featured.slug+'">'+esc(featured.venue)+'</span></p>'+
      '<p class="hero-pass-note" data-coverage-for="'+esc(featured.slug)+'">'+esc(passCoverage(featured))+'</p><div class="hero-actions">'+
      button(bookingStatus(featured)==='open'?eventPath(featured)+'#booking':'/#events',bookingStatus(featured)==='open'?'Book passes':'View events','data-featured-booking="'+featured.slug+'"')+
      (featured.workshop?'<a class="text-link" href="#workshop">Discover the workshop '+icon('arrow')+'</a>':'')+
      '</div></div></div><div class="hero-illustration"><img src="/images/garba-hero.webp" srcset="/images/garba-hero-small.webp 640w, /images/garba-hero-medium.webp 960w, /images/garba-hero.webp 1374w" sizes="(max-width:640px) 100vw, 60vw" width="1374" height="1145" alt="" fetchpriority="high"></div></div></section>';
  }
  const events = [...config.events].sort((a, b) => {
    const aPast = bookingStatus(a) === 'completed';
    const bPast = bookingStatus(b) === 'completed';
    return aPast !== bPast ? Number(aPast) - Number(bPast) :
      aPast ? Date.parse(b.startsAt) - Date.parse(a.startsAt) : Date.parse(a.startsAt) - Date.parse(b.startsAt);
  });
  const section=(id,content,classes='')=>'<section class="home-section '+classes+'" id="'+id+'"><div class="wrap" data-content-section="'+id+'">'+content+'</div></section>';
  return hero+
    (featured?section('experience',renderExperience(featured))+
      section('reels',renderReels(config.social,featured),'reels-section')+
      section('workshop',renderWorkshop(featured,true),'home-workshop')+
      section('passes',renderPasses(featured),'home-passes'):'')+
    '<section class="wrap events home-section" id="events" aria-labelledby="events-heading"><h2 class="section-title" id="events-heading">Events</h2>'+
    events.map(eventRow).join('')+'<p class="more-events">More events will be announced here.</p></section>'+
    (featured?section('faq',renderVenueFaq(featured),'venue-faq'):'');
}

function booking(event) {
  const open = bookingStatus(event) === 'open';
  const statusText = bookingStatus(event) === 'completed' ? 'This event has finished. Bookings are closed.' :
    'Bookings are currently closed. Contact the SAAJSAAZ team for information.';
  return '<section class="booking" id="booking" aria-labelledby="booking-heading"><h2 id="booking-heading">Choose your passes</h2><p class="booking-event-context"><strong data-title-for="'+esc(event.slug)+'">'+esc(event.title)+'</strong><span data-date-for="'+esc(event.slug)+'">'+esc(eventDates(event))+'</span></p>' +
    '<p id="booking-status" class="closed-notice" role="status" ' + (open ? 'hidden' : '') + '>' + statusText + '</p>' +
    '<form id="booking-form" data-slug="' + esc(event.slug) + '" novalidate><div class="pass-list">' +
    event.passes.map(pass => '<div class="pass-row"><label class="pass-label" for="quantity-' + esc(pass.id) + '">' + esc(pass.label) + '</label>' +
      '<span class="pass-price">' + rupees(pass.price) + '</span><p class="pass-row-benefit" data-coverage-for="'+esc(event.slug)+'">'+esc(passCoverage(event))+(event.workshop?' Workshop eligible.':'')+'</p><div class="quantity">' +
      '<button class="step" type="button" data-direction="-1" aria-label="Remove one ' + esc(pass.label.toLowerCase()) + '" disabled>' + icon('minus') + '</button>' +
      '<input class="qty-input" id="quantity-' + esc(pass.id) + '" name="' + esc(pass.id) + '" data-pass="' + esc(pass.id) +
      '" type="text" inputmode="numeric" pattern="[0-9]*" value="0" autocomplete="off" aria-describedby="booking-error" ' + (open ? '' : 'disabled') + '>' +
      '<button class="step" type="button" data-direction="1" aria-label="Add one ' + esc(pass.label.toLowerCase()) + '" ' + (open ? '' : 'disabled') +
      '>' + icon('plus') + '</button></div></div>').join('') + '</div>' +
    '<p id="booking-error" class="form-error" role="alert" hidden></p>' +
    '<div class="booking-summary" id="booking-summary" role="status" aria-live="polite" aria-atomic="true"><span data-count>0 passes</span>' +
    '<span>Total <strong class="total" data-total>₹0</strong></span></div>' +
    '<button class="button booking-cta" type="submit" disabled><span>Continue on WhatsApp</span>' + icon('arrow') + '</button>' +
    '<p class="booking-note">Opens WhatsApp in a new tab. Payment and booking confirmation are handled by the SAAJSAAZ team there.</p>' +
    '<div class="copy-booking" id="copy-booking" hidden><button type="button" class="copy-message-button">Copy booking message</button><p class="copy-status" role="status" aria-live="polite"></p><label for="booking-message" hidden>Booking message — select and copy</label><textarea id="booking-message" readonly hidden></textarea></div>'+
    '<noscript><p class="form-error">Enable JavaScript to choose quantities, or use Contact on WhatsApp to request passes.</p></noscript></form></section>';
}

function eventPage(event) {
  let html = '<div class="wrap detail-top"><section class="event-info" aria-labelledby="event-heading"><h1 id="event-heading" data-title-for="' + esc(event.slug) + '">' + esc(event.title) + '</h1>' +
    '<p class="event-intro" data-intro-for="'+event.slug+'">' + esc(event.intro) + '</p><div class="detail-facts">' +
    '<p class="fact">' + icon('calendar') + '<span data-date-for="' + esc(event.slug) + '">' + esc(eventDates(event)) + '</span></p>' +
    '<p class="fact">' + icon('clock') + '<span data-time-for="' + esc(event.slug) + '">' + esc(eventTime(event)) + '</span></p>' +
    '<p class="fact">' + icon('location') + '<span data-venue-for="'+event.slug+'">' + esc(event.venue) + '</span></p></div>' +
    '<p class="pass-note" data-coverage-for="'+esc(event.slug)+'">' + esc(passCoverage(event)) + '</p></section>' + booking(event) + '</div>';
  if (event.workshop) {
    html += '<section class="workshop"><div class="wrap" data-content-section="workshop">'+renderWorkshop(event)+'</div></section>';
  }
  return html + '<section class="wrap home-section venue-faq" data-content-section="faq">'+renderVenueFaq(event)+'</section>';
}

if (pathname === "/") return page("SAAJSAAZ — Events & Celebrations", "Discover SAAJSAAZ events and celebrations in Merta City. Choose your passes and arrange booking on WhatsApp.", "/", home());
const event = config.events.find(e => pathname === eventPath(e));
if (event) return page(event.title + " — SAAJSAAZ", event.description, eventPath(event), eventPage(event), event);
return page("Page not found — SAAJSAAZ","Explore SAAJSAAZ events.",pathname,'<section class="wrap not-found"><h1>Let’s find your next celebration.</h1><p>This page could not be found.</p>' + button("/#events","Explore events") + "</section>");
}
