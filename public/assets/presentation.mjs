import {bookingStatus,eventDates,rupees,passCoverage} from './booking.mjs';
import {instagramProfile,instagramEmbedUrl} from './social.mjs';
import {icon} from './icons.mjs';

export const escapeHtml = value => String(value).replace(/[&<>"']/g,c=>({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[c]));
const arrow = icon('arrow');
export const eventPath = event => '/events/' + event.slug + '/';
export const dateLabel = date => new Intl.DateTimeFormat('en-GB',{
  day:'numeric',month:'long',year:'numeric',timeZone:'UTC'
}).format(new Date(date+'T12:00:00Z'));
export const mapUrl = event => 'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(event.venue);
export function bookingLink(event) {
  const open = bookingStatus(event) === 'open';
  return '<a class="button" data-featured-booking="'+escapeHtml(event.slug)+'" href="'+
    (open?eventPath(event)+'#booking':'/#events')+'"><span data-action-label>'+
    (open?'Book passes':'View events')+'</span>'+arrow+'</a>';
}
export function renderExperience(event) {
  return '<div class="section-heading"><h2>Circle up. Let’s play Garba.</h2><p>Music, festive colours and a dance circle to share with your people.</p></div>'+
    '<div class="experience-grid"><article><img src="/images/garba-drum.webp" width="640" height="320" alt="" loading="lazy"><h3>Dandiya &amp; beats</h3><p>Follow the rhythm, tap your dandiya and celebrate with friends and family.</p></article>'+
    '<article><img src="/images/garba-garment.webp" width="640" height="320" alt="" loading="lazy"><h3>Bring your festive look</h3><p>Chaniya choli, kediyu or your favourite festive outfit—wear what makes you feel ready to celebrate.</p></article>'+
    '<article><img src="/images/garba-dandiya.webp" width="640" height="320" alt="" loading="lazy"><h3>'+(event.workshop?'Learn the Garba steps':'Join the dance circle')+'</h3><p>'+
    (event.workshop?'New to Garba? Learn the steps at our workshop, exclusively for event pass holders.':'Bring your energy and enjoy the celebration with your people.')+'</p></article></div>';
}
export function renderReels(social,event) {
  const reels = (social?.reels || []).filter(reel=>reel.enabled);
  if (!reels.length) return '';
  return '<div class="reels-heading"><div><h2>See SAAJSAAZ in motion</h2><p>Garba steps, workshop moments and celebrations from @saajsaaz.</p></div>'+
    '<a class="text-link" href="'+instagramProfile+'" target="_blank" rel="noopener noreferrer">View Instagram profile'+arrow+'</a></div>'+
    '<div class="reel-list" id="reel-list" role="region" aria-label="SAAJSAAZ Instagram reels" tabindex="0">'+
    reels.map(reel=>'<article class="reel-card" data-reel-id="'+escapeHtml(reel.id)+'"><div class="reel-frame">'+
      '<iframe data-instagram-src="'+escapeHtml(instagramEmbedUrl(reel.url))+'" title="'+escapeHtml(reel.caption)+' — Instagram reel" loading="lazy" allow="fullscreen" referrerpolicy="strict-origin-when-cross-origin"></iframe>'+
      '</div><h3>'+escapeHtml(reel.caption)+'</h3><a class="text-link reel-fallback" href="'+escapeHtml(reel.url)+'" target="_blank" rel="noopener noreferrer">Watch on Instagram'+arrow+'</a></article>').join('')+'</div>'+
    '<div class="reel-controls" aria-label="Reel navigation"><button type="button" data-reel-direction="-1" aria-label="Previous reels" aria-controls="reel-list">'+arrow+'</button>'+
    '<button type="button" data-reel-direction="1" aria-label="Next reels" aria-controls="reel-list">'+arrow+'</button></div>'+
    '<div class="reels-conversion"><h3>Ready for the dance circle?</h3>'+bookingLink(event)+'</div>';
}
export function renderWorkshop(event,home=false) {
  if (!event.workshop) return '';
  return '<div class="workshop-header"><div><h2>'+escapeHtml(event.workshop.title)+'</h2><p class="section-intro">Find your steps before the big nights. Learn the rhythm and practise with confidence.</p></div>'+
    (home?bookingLink(event):'')+'</div><div class="workshop-sessions">'+event.workshop.sessions.map((session,index)=>
      '<div class="workshop-session"><span class="session-number">Day '+String(index+1).padStart(2,'0')+'</span><time data-workshop-for="'+escapeHtml(event.slug)+'" data-session-index="'+index+'" datetime="'+session.date+'">'+
      dateLabel(session.date)+'</time><p>'+escapeHtml(session.description)+'</p></div>').join('')+'</div>'+
    '<p class="workshop-note">'+escapeHtml(event.workshop.note)+'</p>';
}
export function renderPasses(event) {
  return '<div class="section-heading"><h2>Choose your pass.</h2><p>'+escapeHtml(passCoverage(event))+' Payment and confirmation happen with our team on WhatsApp.</p></div>'+
    '<div class="pass-benefits-grid">'+event.passes.map(pass=>'<article class="pass-benefit"><div><h3>'+escapeHtml(pass.label)+'</h3><p class="benefit-price">'+rupees(pass.price)+' <span>/ pass</span></p></div>'+
    '<ul><li>Entry on '+escapeHtml(eventDates(event))+'</li><li>'+escapeHtml(passCoverage(event))+'</li>'+
    (event.workshop?'<li>Workshop eligibility with a valid event pass</li>':'')+'</ul></article>').join('')+'</div>'+
    '<div class="pass-bottom">'+bookingLink(event)+'<p>Opening WhatsApp sends a booking request. Your booking is confirmed only by the SAAJSAAZ team after arranging payment.</p></div>';
}
export function renderVenueFaq(event) {
  const workshopDates = event.workshop?.sessions.map(s=>dateLabel(s.date)).join(' and ');
  const answers = [
    ['When is the event?',eventDates(event)+' · '+event.dailyTime+' (India time).'],
    ...(event.workshop?[
      ['When is the workshop?',workshopDates+'. '+event.workshop.sessions.map(s=>s.description).join(' · ')+'.'],
      ['Can anyone attend the workshop?',event.workshop.note]
    ]:[]),
    ['How do I book a pass?','Choose pass quantities, continue on WhatsApp, then arrange payment and confirmation with the SAAJSAAZ team. Opening WhatsApp does not confirm a booking.'],
    ['Where is the event'+(event.workshop?' and workshop':'')+' venue?',event.venue]
  ];
  return '<div class="venue-panel"><h2>Meet us in '+escapeHtml(event.city)+'</h2><p>'+escapeHtml(event.venue)+'</p>'+
    '<a class="text-link" href="'+escapeHtml(mapUrl(event))+'" target="_blank" rel="noopener noreferrer">Find the venue on Maps'+arrow+'</a></div>'+
    '<div class="faq-panel"><h2>Quick answers.</h2><div class="faq-list">'+answers.map(([question,answer],index)=>
    '<details id="faq-answer-'+index+'"><summary>'+escapeHtml(question)+icon('chevron')+'</summary><p>'+escapeHtml(answer)+'</p></details>').join('')+'</div></div>';
}
