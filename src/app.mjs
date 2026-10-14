import {bookingStatus,eventDates,eventTime,quantity,rupees,selection,passCoverage} from './booking.mjs';
import {escapeHtml,renderExperience,renderReels,renderWorkshop,renderPasses,renderVenueFaq} from './presentation.mjs';
let configuration=JSON.parse(document.getElementById('site-data').textContent);
const events=configuration.events;
const notice=document.getElementById('schedule-notice');
let ready=true, submitting=false, quoteNotice='',refreshBooking=()=>{},refreshMobileBar=()=>{},clearQuote=()=>{};
const text=(node,value)=>{if(node && node.textContent!==value)node.textContent=value;};
function applyConfiguration(next){
  const changed=next._revision!==configuration._revision;
  const socialChanged=JSON.stringify(next.social)!==JSON.stringify(configuration.social);
  configuration=next;
  if(changed)clearQuote();
  for(const event of events){
    const updated=next.events.find(e=>e.slug===event.slug);
    if(!updated)continue;
    Object.assign(event,updated);
    const nodes=selector=>document.querySelectorAll(selector);
    nodes('[data-title-for="'+event.slug+'"]').forEach(n=>text(n,event.title));
    nodes('[data-date-for="'+event.slug+'"]').forEach(n=>text(n,eventDates(event)));
    nodes('[data-time-for="'+event.slug+'"]').forEach(n=>text(n,eventTime(event)));
    nodes('[data-venue-for="'+event.slug+'"]').forEach(n=>text(n,event.venue));
    nodes('[data-description-for="'+event.slug+'"]').forEach(n=>text(n,event.description));
    nodes('[data-intro-for="'+event.slug+'"]').forEach(n=>text(n,event.intro));
    nodes('[data-coverage-for="'+event.slug+'"]').forEach(n=>text(n,passCoverage(event)+(n.classList.contains('pass-row-benefit')&&event.workshop?' Workshop eligible.':'')));
    if(event.slug===configuration.featuredEvent)text(document.querySelector('[data-hero-prices]'),event.passes.map(p=>(p.shortLabel||p.label)+' '+rupees(p.price)).join(' · '));
    if(document.querySelector('#mobile-booking-bar [data-title-for="'+event.slug+'"]'))text(document.querySelector('[data-bar-price]'),'From '+rupees(Math.min(...event.passes.map(p=>p.price))));
    nodes('[data-year-for="'+event.slug+'"]').forEach(n=>text(n,event.year));
    nodes('[data-row-date-for="'+event.slug+'"]').forEach(n=>text(n,eventDates(event,false)+' · '+event.city));
    text(document.querySelector('[data-event-slug="'+event.slug+'"] .row-price'),event.passes.map(p=>(p.shortLabel||p.label)+' '+rupees(p.price)).join(' · '));
    nodes('[data-workshop-for="'+event.slug+'"]').forEach(n=>{
      const s=event.workshop?.sessions[Number(n.dataset.sessionIndex)];
      if(s){n.dateTime=s.date;text(n,new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(s.date+'T12:00:00Z')));}
    });
  }
  if(changed)refreshPresentation(socialChanged);
  ready=true;notice.hidden=true;refreshBooking();availability();
}
function refreshPresentation(socialChanged){
  const home=Boolean(document.querySelector('[data-homepage]'));
  const event=events.find(e=>e.slug===(form?.dataset.slug||configuration.featuredEvent))||events[0];
  if(!event)return;
  const openFaqs=[...document.querySelectorAll('.faq-list details[open]')].map(n=>n.id);
  const focused=document.activeElement?.closest('details')?.id;
  const sections={
    workshop:()=>renderWorkshop(event,home),
    faq:()=>renderVenueFaq(event),
    ...(home?{experience:()=>renderExperience(event),passes:()=>renderPasses(event)}:{})
  };
  for(const [id,render] of Object.entries(sections)){
    const element=document.querySelector('[data-content-section="'+id+'"]');
    if(element)element.innerHTML=render();
  }
  for(const id of openFaqs){const element=document.getElementById(id);if(element)element.open=true;}
  if(focused)document.getElementById(focused)?.querySelector('summary')?.focus({preventScroll:true});
  if(home){
    document.getElementById('hero-heading').innerHTML=escapeHtml(event.headline).replace(' Garba','<br>Garba');
    if(socialChanged){
      const section=document.getElementById('reels'),position=section.querySelector('.reel-list')?.scrollLeft||0;
      section.innerHTML=renderReels(configuration.social,event);
      const list=section.querySelector('.reel-list');if(list)list.scrollLeft=position;
      prepareReels();
    }
  }
  document.querySelectorAll('[data-reels-link]').forEach(n=>n.hidden=!(configuration.social?.reels.some(r=>r.enabled)));
  if(form){
    document.querySelector('meta[property="og:title"]')?.setAttribute('content',event.title+' — SAAJSAAZ');
    for(const selector of ['meta[name="description"]','meta[property="og:description"]'])
      document.querySelector(selector)?.setAttribute('content',event.description);
  }
}
function availability(){
  for(const event of events){
    const status=bookingStatus(event),row=document.querySelector('[data-event-slug="'+event.slug+'"]');
    if(row){row.dataset.status=status;const label=row.querySelector('[data-event-status]');label.hidden=status==='open';text(label,status==='completed'?'Event completed · Bookings closed':'Bookings closed');}
    document.querySelectorAll('[data-featured-booking="'+event.slug+'"]').forEach(n=>{n.href=status==='open'?'/events/'+event.slug+'/#booking':'/#events';text(n.querySelector('[data-action-label]'),status==='open'?'Book passes':'View events');});
  }
  refreshMobileBar();
}
async function reloadConfiguration(){
  try{const response=await fetch('/api/events',{cache:'no-store'});if(!response.ok)throw Error();applyConfiguration(await response.json());}
  catch{ready=false;notice.hidden=false;text(notice,'Unable to check current event details. Please refresh before booking.');refreshBooking();}
}
const form=document.getElementById('booking-form');
if(form){
  const event=events.find(e=>e.slug===form.dataset.slug);
  const inputs=[...form.querySelectorAll('[data-pass]')],button=form.querySelector('[type="submit"]');
  const error=document.getElementById('booking-error'),closed=document.getElementById('booking-status');
  const copyPanel=document.getElementById('copy-booking'),copyArea=document.getElementById('booking-message');
  let verifiedMessage='';
  clearQuote=()=>{verifiedMessage='';copyPanel.hidden=true;copyArea.value='';copyArea.hidden=true;copyPanel.querySelector('label').hidden=true;text(copyPanel.querySelector('.copy-status'),'');};
  const values=()=>Object.fromEntries(inputs.map(n=>[n.dataset.pass,n.value]));
  refreshBooking=()=>{
    const open=ready&&bookingStatus(event)==='open',chosen=selection(event,values());
    closed.hidden=bookingStatus(event)==='open';
    text(closed,bookingStatus(event)==='completed'?'This event has finished. Bookings are closed.':'Bookings are currently closed. Contact the SAAJSAAZ team for information.');
    for(const input of inputs){
      input.disabled=!open||submitting;
      const value=quantity(input.value);
      input.setAttribute('aria-invalid',value===null?'true':'false');
      const row=input.closest('.pass-row');
      text(row.querySelector('.pass-price'),rupees(event.passes.find(p=>p.id===input.dataset.pass).price));
      row.querySelectorAll('.step').forEach(n=>n.disabled=!open||submitting||value===null||(n.dataset.direction==='-1'&&value===0));
    }
    const message=!chosen.valid?'Enter whole quantities of zero or more.':quoteNotice;
    error.hidden=!message;text(error,message);
    text(form.querySelector('[data-count]'),chosen.count+' '+(chosen.count===1?'pass':'passes'));
    text(form.querySelector('[data-total]'),rupees(chosen.total));
    button.disabled=!open||submitting||!chosen.valid||chosen.count===0;
    text(button.querySelector('span'),submitting?'Checking details…':'Continue on WhatsApp');
    button.setAttribute('aria-busy',String(submitting));
    if(!open)clearQuote();
    document.title=event.title+' — SAAJSAAZ';
  };
  inputs.forEach(n=>n.addEventListener('input',()=>{clearQuote();quoteNotice='';refreshBooking();}));
  form.querySelectorAll('.step').forEach(n=>n.addEventListener('click',()=>{
    const input=n.closest('.quantity').querySelector('input'),current=quantity(input.value);
    if(current!==null)input.value=String(Math.max(0,current+Number(n.dataset.direction)));
    clearQuote();quoteNotice='';refreshBooking();
  }));
  form.addEventListener('submit',async e=>{
    e.preventDefault();if(button.disabled)return;
    clearQuote();submitting=true;quoteNotice='';refreshBooking();
    let whatsappTab;
    try{
      whatsappTab=window.open('about:blank','_blank');
      if(whatsappTab)whatsappTab.opener=null;
      const response=await fetch('/api/booking/quote',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({slug:event.slug,revision:configuration._revision,quantities:values()})});
      const result=await response.json();
      if(!response.ok){if(result.configuration)applyConfiguration(result.configuration);throw Error(result.error||'Please try again.');}
      verifiedMessage=new URL(result.url).searchParams.get('text');
      copyPanel.hidden=false;copyArea.value=verifiedMessage;
      if(!whatsappTab)throw Error('Allow pop-ups to open WhatsApp, or copy your booking message below.');
      if(whatsappTab.closed)throw Error('The WhatsApp tab was closed. Continue again to open a new tab.');
      whatsappTab.location.replace(result.url);
    }catch(error){whatsappTab?.close();quoteNotice=error.message;}
    finally{submitting=false;refreshBooking();}
  });
  copyPanel.querySelector('button').addEventListener('click',async()=>{
    if(!verifiedMessage)return;
    try{
      await navigator.clipboard.writeText(verifiedMessage);
      text(copyPanel.querySelector('.copy-status'),'Booking message copied. Paste it into WhatsApp to contact our team.');
    }catch{
      copyPanel.querySelector('label').hidden=false;copyArea.hidden=false;copyArea.focus();copyArea.select();
      text(copyPanel.querySelector('.copy-status'),'Select and copy the message below, then paste it into WhatsApp.');
    }
  });
  refreshBooking();
}
availability();
const mobileBar=document.getElementById('mobile-booking-bar');
if(mobileBar){
  const current=events.find(e=>mobileBar.querySelector('[data-title-for="'+e.slug+'"]'));
  const trigger=document.querySelector('.hero-actions')||document.querySelector('.event-info');
  refreshMobileBar=()=>{
    const bookingRect=form?.getBoundingClientRect();
    const bookingVisible=bookingRect&&bookingRect.top<innerHeight&&bookingRect.bottom>0;
    const show=ready&&bookingStatus(current)==='open'&&trigger&&trigger.getBoundingClientRect().bottom<0&&!bookingVisible;
    mobileBar.hidden=!show;document.body.classList.toggle('has-booking-bar',Boolean(show));
  };
  let queued=false;
  const schedule=()=>{if(!queued){queued=true;requestAnimationFrame(()=>{queued=false;refreshMobileBar();});}};
  document.addEventListener('scroll',schedule,{passive:true});window.addEventListener('resize',schedule);refreshMobileBar();
}
const menu=document.getElementById('menu-toggle'),nav=document.getElementById('main-nav');
function closeMenu(){menu?.setAttribute('aria-expanded','false');if(nav)nav.dataset.open='false';}
menu?.addEventListener('click',()=>{
  const open=menu.getAttribute('aria-expanded')!=='true';
  menu.setAttribute('aria-expanded',String(open));nav.dataset.open=String(open);
});
nav?.addEventListener('click',event=>{if(event.target.closest('a'))closeMenu();});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&menu?.getAttribute('aria-expanded')==='true'){closeMenu();menu.focus();}});
document.addEventListener('click',event=>{if(!event.target.closest('.site-header'))closeMenu();});
let reelObserver=null,reelResize=null;
function prepareReels(){
  reelObserver?.disconnect();
  reelResize?.disconnect();
  const frames=[...document.querySelectorAll('iframe[data-instagram-src]')];
  const load=frame=>{frame.src=frame.dataset.instagramSrc;delete frame.dataset.instagramSrc;};
  if('IntersectionObserver' in window){
    reelObserver=new IntersectionObserver(entries=>{
      for(const entry of entries)if(entry.isIntersecting){load(entry.target);reelObserver.unobserve(entry.target);}
    },{rootMargin:'200px'});
    frames.forEach(frame=>reelObserver.observe(frame));
  }else frames.forEach(load);
  const list=document.getElementById('reel-list');
  if(!list)return;
  const controls=document.querySelector('.reel-controls');
  const update=()=>{
    controls.hidden=list.scrollWidth<=list.clientWidth+2;
    controls.querySelector('[data-reel-direction="-1"]').disabled=list.scrollLeft<2;
    controls.querySelector('[data-reel-direction="1"]').disabled=list.scrollLeft+list.clientWidth>=list.scrollWidth-2;
  };
  controls.querySelectorAll('button').forEach(button=>button.addEventListener('click',()=>{
    const card=list.querySelector('.reel-card');
    list.scrollBy({left:Number(button.dataset.reelDirection)*(card.getBoundingClientRect().width+parseFloat(getComputedStyle(list).columnGap)),
      behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth'});
  }));
  list.addEventListener('keydown',event=>{
    if(event.target!==list||!['ArrowLeft','ArrowRight'].includes(event.key))return;
    event.preventDefault();controls.querySelector('[data-reel-direction="'+(event.key==='ArrowLeft'?-1:1)+'"]').click();
  });
  list.addEventListener('scroll',update,{passive:true});
  reelResize=new ResizeObserver(update);reelResize.observe(list);update();
}
prepareReels();
if('IntersectionObserver' in window){
  const observer=new IntersectionObserver(entries=>{
    for(const entry of entries)if(entry.isIntersecting){entry.target.classList.add('section-arrived');observer.unobserve(entry.target);}
  },{threshold:.08});
  document.querySelectorAll('.home-section').forEach(section=>observer.observe(section));
}
setInterval(()=>{availability();refreshBooking();},15000);
setInterval(reloadConfiguration,60000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)reloadConfiguration();});
