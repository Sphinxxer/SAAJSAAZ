import {instagramReelUrl} from './social.mjs';
import {eventDates,passCoverage,rupees,selection,validateConfig,whatsappMessage} from './booking.mjs';
const message = document.getElementById('admin-message');
const showMessage = (text,kind='error') => {
  message.hidden = !text;
  message.textContent = text;
  message.dataset.kind = kind;
};
async function request(url,body) {
  const response = await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),credentials:'same-origin',cache:'no-store'});
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Could not save. Please try again.');
  return data;
}
const login = document.getElementById('login-form');
if (login) login.addEventListener('submit',async event=>{
  event.preventDefault();
  const button = login.querySelector('button');
  button.disabled = true;
  showMessage('');
  try {
    await request('/api/admin/login',{username:login.elements.username.value,password:login.elements.password.value});
    window.location.assign('/admin');
  } catch (error) {showMessage(error.message);}
  finally {button.disabled = false;}
});

const editor = document.getElementById('event-form');
if (editor) {
  let configuration = JSON.parse(document.getElementById('admin-data').textContent);
  const picker = document.getElementById('event-select');
  let activeSlug=picker.value,savedEventFields='',eventDirty=false,socialDirty=false;
  const dirtyStatus=document.getElementById('dirty-status');
  const updateDirtyStatus=()=>{
    const value=eventDirty&&socialDirty?'Unsaved event and reel changes':eventDirty?'Unsaved event changes':socialDirty?'Unsaved reel changes':'All changes saved';
    if(dirtyStatus.textContent!==value)dirtyStatus.textContent=value;
    dirtyStatus.dataset.dirty=String(eventDirty||socialDirty);
  };
  function eventBody(){
    const selected=configuration.events.find(e=>e.slug===activeSlug);
    return {
      ...Object.fromEntries(copyFields.map(key=>[key,document.getElementById(key).value])),
      name:document.getElementById('event-name').value,
      startDate:document.getElementById('start-date').value,endDate:document.getElementById('end-date').value,
      startTime:document.getElementById('start-time').value,endTime:document.getElementById('end-time').value,
      bookingEnabled:document.getElementById('booking-enabled').checked,
      prices:Object.fromEntries(selected.passes.map(pass=>[pass.id,Number(document.getElementById('price-'+pass.id).value)])),
      workshopDates:selected.workshop?.sessions.map((_,index)=>document.getElementById('workshop-date-'+index).value),
      workshopDescriptions:selected.workshop?.sessions.map((_,index)=>document.getElementById('workshop-description-'+index).value)
    };
  }
  function reviewDraft(){
    const body=eventBody(),original=configuration.events.find(e=>e.slug===activeSlug);
    eventDirty=JSON.stringify(body)!==savedEventFields;updateDirtyStatus();
    document.getElementById('date-review-notice').hidden=body.startDate===original.startsAt.slice(0,10)&&body.endDate===original.endsAt.slice(0,10);
    const summary=document.getElementById('draft-summary'),message=document.getElementById('draft-message');
    summary.replaceChildren();
    try{
      const displayTime=time=>{const [h,m]=time.split(':').map(Number);return(h%12||12)+(m?':'+String(m).padStart(2,'0'):'')+(h<12?' AM':' PM');};
      if(!body.startTime||!body.endTime||body.endTime<=body.startTime)throw Error();
      const draft={...original,title:body.name.trim(),...Object.fromEntries(copyFields.map(key=>[key,body[key]])),
        startsAt:body.startDate+'T'+body.startTime+':00+05:30',endsAt:body.endDate+'T'+body.endTime+':00+05:30',
        dailyTime:displayTime(body.startTime)+' – '+displayTime(body.endTime),bookingEnabled:body.bookingEnabled,
        passes:original.passes.map(p=>({...p,price:body.prices[p.id]})),
        ...(original.workshop?{workshop:{...original.workshop,sessions:original.workshop.sessions.map((s,i)=>({...s,date:body.workshopDates[i],description:body.workshopDescriptions[i]}))}}:{})};
      validateConfig({...configuration,events:[draft],featuredEvent:draft.slug});
      for(const value of [draft.title,eventDates(draft)+' · '+draft.dailyTime+' IST',draft.venue,
        draft.passes.map(p=>p.label+' '+rupees(p.price)).join(' · '),passCoverage(draft),
        ...(draft.workshop?[draft.workshop.title+': '+draft.workshop.sessions.map(s=>s.date).join(' · ')]:[]),
        draft.bookingEnabled?'Accepting booking requests':'Booking requests closed']){
        const p=document.createElement('p');p.textContent=value;summary.append(p);
      }
      message.textContent=whatsappMessage(draft,selection(draft,Object.fromEntries(draft.passes.map(p=>[p.id,1]))));
    }catch{summary.textContent='Complete valid dates, times, event details and prices to preview.';message.textContent='';}
  }
  const copyFields=['headline','description','intro','city','venue'];
  const field = (label,id,type,value) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'admin-field';
    const title = document.createElement('label');
    title.htmlFor = id; title.textContent = label;
    const input = document.createElement('input');
    input.id = id; input.type = type; input.value = value; input.required = true;
    if (type === 'number') {input.min='0.01';input.step='0.01';input.inputMode='decimal';}
    wrapper.append(title,input);
    return wrapper;
  };
  function populate() {
    activeSlug=picker.value;
    const event = configuration.events.find(e=>e.slug === picker.value);
    document.getElementById('event-name').value = event.title;
    document.getElementById('start-date').value = event.startsAt.slice(0,10);
    document.getElementById('end-date').value = event.endsAt.slice(0,10);
    document.getElementById('start-time').value = event.startsAt.slice(11,16);
    document.getElementById('end-time').value = event.endsAt.slice(11,16);
    document.getElementById('booking-enabled').checked = event.bookingEnabled;
    copyFields.forEach(key=>document.getElementById(key).value=event[key]);
    const workshop = document.getElementById('workshop-inputs');
    workshop.replaceChildren();
    document.getElementById('workshop-fields').hidden = !event.workshop;
    document.querySelector('[data-workshop-editor-link]').hidden = !event.workshop;
    event.workshop?.sessions.forEach((session,index)=>{
      workshop.append(field('Workshop day '+(index+1),'workshop-date-'+index,'date',session.date));
      const description=field('Day '+(index+1)+' description','workshop-description-'+index,'text',session.description);
      description.querySelector('input').maxLength=240;workshop.append(description);
    });
    const prices = document.getElementById('price-inputs');
    prices.replaceChildren();
    event.passes.forEach(pass=>prices.append(field(pass.label+' (₹)','price-'+pass.id,'number',pass.price)));
    savedEventFields=JSON.stringify(eventBody());reviewDraft();
  }
  picker.addEventListener('change',()=>{
    if(eventDirty&&!window.confirm('Discard unsaved event changes and switch events?')){picker.value=activeSlug;return;}
    showMessage('');populate();
  });
  populate();
  editor.addEventListener('input',reviewDraft);editor.addEventListener('change',reviewDraft);
  editor.addEventListener('submit',async event=>{
    event.preventDefault();
    const button = document.getElementById('save-event');
    const selected = configuration.events.find(e=>e.slug === picker.value);
    const body = {revision:configuration._revision,...eventBody()};
    const saveButtons=[button,document.getElementById('save-reels')];saveButtons.forEach(n=>n.disabled=true);
    showMessage('');
    try {
      configuration = await request('/api/admin/events/'+selected.slug,body);
      const option = [...picker.options].find(option=>option.value === selected.slug);
      option.textContent = configuration.events.find(e=>e.slug === selected.slug).title;
      populate();
      showMessage('Changes saved. The website and booking details are updated.','success');
    } catch (error) {showMessage(error.message);}
    finally {saveButtons.forEach(n=>n.disabled=false);}
  });
  const socialForm=document.getElementById('social-form');
  const socialMessage=document.getElementById('social-message');
  const reelList=document.getElementById('reel-editor-list');
  let draft=structuredClone(configuration.social?.reels||[]);
  const socialFeedback=(text,kind='error')=>{
    socialMessage.textContent=text;socialMessage.hidden=!text;socialMessage.dataset.kind=kind;
  };
  function captureReels(){
    draft=[...reelList.querySelectorAll('[data-reel-id]')].map(row=>({
      id:row.dataset.reelId,url:row.querySelector('[data-reel-url]').value,
      caption:row.querySelector('[data-reel-caption]').value,enabled:row.querySelector('[data-reel-enabled]').checked
    }));
    socialDirty=JSON.stringify(draft)!==JSON.stringify(configuration.social?.reels||[]);updateDirtyStatus();
  }
  function populateReels(focusId,focusAction){
    socialDirty=JSON.stringify(draft)!==JSON.stringify(configuration.social?.reels||[]);updateDirtyStatus();
    reelList.replaceChildren();
    if(!draft.length){
      const empty=document.createElement('p');empty.className='admin-empty';empty.textContent='No reels selected. Add a reel to show it on the homepage.';reelList.append(empty);
    }
    draft.forEach((reel,index)=>{
      const row=document.createElement('fieldset');row.className='reel-editor';row.dataset.reelId=reel.id;
      const legend=document.createElement('legend');legend.textContent='Reel '+(index+1);
      const url=field('Instagram reel link','reel-url-'+reel.id,'url',reel.url);
      url.querySelector('input').dataset.reelUrl='';url.querySelector('input').maxLength=500;
      const caption=field('Caption','reel-caption-'+reel.id,'text',reel.caption);
      caption.querySelector('input').dataset.reelCaption='';caption.querySelector('input').maxLength=120;
      const toggle=document.createElement('label');toggle.className='admin-toggle';
      const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.checked=reel.enabled;checkbox.dataset.reelEnabled='';
      toggle.append(checkbox,document.createTextNode('Show on homepage'));
      const actions=document.createElement('div');actions.className='reel-editor-actions';
      for(const [action,label,disabled] of [['up','Move up',index===0],['down','Move down',index===draft.length-1],['remove','Remove',false]]){
        const button=document.createElement('button');button.type='button';button.className='admin-text-button';button.dataset.action=action;button.textContent=label;
        button.setAttribute('aria-label',label+' reel '+(index+1));button.disabled=disabled;
        button.addEventListener('click',()=>{
          captureReels();socialFeedback('');
          if(action==='remove')draft.splice(index,1);
          else {const other=index+(action==='up'?-1:1);[draft[index],draft[other]]=[draft[other],draft[index]];}
          populateReels(action==='remove'?null:reel.id,action);
          if(action==='remove')document.getElementById('add-reel').focus();
        });actions.append(button);
      }
      row.append(legend,url,caption,toggle,actions);reelList.append(row);
    });
    document.getElementById('add-reel').disabled=draft.length>=12;
    if(focusId){
      const row=[...reelList.querySelectorAll('[data-reel-id]')].find(row=>row.dataset.reelId===focusId);
      const target=focusAction?row.querySelector('[data-action="'+focusAction+'"]'):row.querySelector('input');
      (target?.disabled?row.querySelector('input'):target)?.focus();
    }
  }
  document.getElementById('add-reel').addEventListener('click',()=>{
    captureReels();if(draft.length>=12)return;
    const id=crypto.randomUUID();draft.push({id,url:'',caption:'',enabled:true});populateReels(id);socialFeedback('');
  });
  socialForm.addEventListener('submit',async event=>{
    event.preventDefault();captureReels();socialFeedback('');
    const buttons=[document.getElementById('save-reels'),document.getElementById('save-event')];
    buttons.forEach(n=>n.disabled=true);
    try{
      const reels=draft.map(reel=>({...reel,url:instagramReelUrl(reel.url)}));
      configuration=await request('/api/admin/social',{revision:configuration._revision,reels});
      draft=structuredClone(configuration.social.reels);populateReels();
      socialFeedback('Reels saved. The homepage showcase is updated.','success');
    }catch(error){socialFeedback(error.message);}
    finally{buttons.forEach(n=>n.disabled=false);}
  });
  populateReels();
  socialForm.addEventListener('input',captureReels);socialForm.addEventListener('change',captureReels);
  window.addEventListener('beforeunload',event=>{
    if(eventDirty||socialDirty){event.preventDefault();event.returnValue='';}
  });
  document.addEventListener('click',event=>{
    const link=event.target.closest('a');
    if(link&&!link.getAttribute('href')?.startsWith('#')&&link.target!=='_blank'&&(eventDirty||socialDirty)&&
      !window.confirm('Leave without saving your changes?'))event.preventDefault();
  });
  document.getElementById('logout').addEventListener('click',async()=>{
    if((eventDirty||socialDirty)&&!window.confirm('Discard unsaved changes and sign out?'))return;
    try {await request('/api/admin/logout',{});eventDirty=false;socialDirty=false;window.location.assign('/admin');}
    catch (error) {showMessage(error.message);}
  });
}
