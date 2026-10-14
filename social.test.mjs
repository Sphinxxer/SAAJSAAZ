import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {database} from '../scripts/sqlite-adapter.mjs';
import {hashPassword} from '../server/auth.mjs';
import {readConfiguration} from '../server/content.mjs';
import {handleRequest} from '../server/app.mjs';
import {instagramReelUrl,instagramEmbedUrl,validateReels} from '../src/social.mjs';
import defaults from '../data/events.json' with {type:'json'};
const now=Date.parse('2026-10-14T12:00:00+05:30'),origin='http://localhost:2000';
const reel=(id,caption='Reel caption')=>({id,url:'https://www.instagram.com/saajsaaz/reel/'+id+'/?igsh=shared',caption,enabled:true});
test('Instagram links are canonical, unique and limited to actual reel URLs',()=>{
  assert.equal(instagramReelUrl(reel('DedjlJVBLsP').url),'https://www.instagram.com/reel/DedjlJVBLsP/');
  assert.equal(instagramEmbedUrl(reel('DedjlJVBLsP').url),'https://www.instagram.com/reel/DedjlJVBLsP/embed/');
  for(const value of ['javascript:alert(1)','https://instagram.com.evil.test/reel/abcdef/','https://evil.test/','https://www.instagram.com/p/abcdef/','<script>alert(1)</script>','https://user:pass@www.instagram.com/reel/abcdef/','https://www.instagram.com:444/reel/abcdef/'])
    assert.throws(()=>instagramReelUrl(value));
  assert.throws(()=>validateReels([reel('DedjlJVBLsP'),{...reel('Deb2U_zuNMD'),id:'DedjlJVBLsP'}]));
  assert.throws(()=>validateReels([reel('DedjlJVBLsP'),{...reel('DedjlJVBLsP'),id:'different'}]));
  assert.throws(()=>validateReels([{...reel('DedjlJVBLsP'),caption:''}]));
  assert.deepEqual(validateReels([]),[]);
});
test('reels API protects writes, preserves order/visibility and keeps empty lists after restart',async()=>{
  const directory=await mkdtemp(path.join(tmpdir(),'saaj-social-'));
  const filename=path.join(directory,'events.db');
  let DB=database(filename);
  const env={DB,ADMIN_USERNAME:'admin',ADMIN_PASSWORD_HASH:await hashPassword('Test-only-password-2026!')};
  const call=(route,data,cookie='',source=origin)=>handleRequest(new Request(origin+route,{
    method:data?'POST':'GET',headers:{Origin:source,Cookie:cookie,...(data?{'Content-Type':'application/json'}:{})},
    ...(data?{body:JSON.stringify(data)}:{})
  }),env,now);
  try{
    assert.equal((await call('/api/admin/social',{reels:[]})).status,401);
    const login=await call('/api/admin/login',{username:'admin',password:'Test-only-password-2026!'});
    const cookie=login.headers.get('set-cookie').split(';')[0];
    const config=await (await call('/api/events')).json();
    assert.equal((await call('/api/admin/social',{revision:config._revision,reels:[]},cookie,'http://wrong.test')).status,403);
    const input={revision:config._revision,reels:[{...reel('Deb2U_zuNMD','<script>not HTML</script>'),enabled:false},reel('DedjlJVBLsP','Workshop moments')]};
    const saved=await call('/api/admin/social',input,cookie);assert.equal(saved.status,200);
    let next=await saved.json();
    assert.deepEqual(next.social.reels.map(r=>r.id),['Deb2U_zuNMD','DedjlJVBLsP']);
    assert.equal(next.social.reels[0].enabled,false);
    assert.equal((await call('/api/admin/social',input,cookie)).status,409);
    assert.equal((await call('/api/admin/social',{revision:next._revision,reels:[{...reel('DedjlJVBLsP'),url:'https://evil.test/'}]},cookie)).status,422);
    let html=await (await call('/')).text();
    assert.ok(html.includes('Workshop moments'));assert.ok(!html.includes('data-reel-id="Deb2U_zuNMD"'));
    next=await (await call('/api/admin/social',{revision:next._revision,reels:[]},cookie)).json();
    DB.close();DB=database(filename);env.DB=DB;
    const restarted=await (await call('/api/events')).json();
    assert.deepEqual(restarted.social.reels,[]);assert.equal(restarted._revision,next._revision);
    html=await (await call('/')).text();assert.ok(!html.includes('data-instagram-src='));
    assert.ok(html.includes('https://www.instagram.com/saajsaaz/'));
  }finally{
    DB.close();
    if(path.dirname(directory)!==tmpdir()||!path.basename(directory).startsWith('saaj-social-'))throw Error('Unsafe test directory.');
    await rm(directory,{recursive:true,force:true});
  }
});
test('homepage parity, scoped frames, dynamic event copy, factual FAQs and prices stay consistent',async()=>{
  const DB=database(),env={DB,ADMIN_USERNAME:'admin',ADMIN_PASSWORD_HASH:await hashPassword('Test-only-password-2026!')};
  const call=(route,data,cookie='')=>handleRequest(new Request(origin+route,{method:data?'POST':'GET',
    headers:{Origin:origin,Cookie:cookie,...(data?{'Content-Type':'application/json'}:{})},...(data?{body:JSON.stringify(data)}:{})}),env,now);
  try{
    const homepage=await call('/'),html=await homepage.text();
    const sections=['class="hero"','id="experience"','id="reels"','id="workshop"','id="passes"','id="events"','id="faq"','class="site-footer"'];
    const positions=sections.map(s=>html.indexOf(s));
    assert.ok(positions.every((position,index)=>position>=0&&(!index||position>positions[index-1])));
    assert.equal((html.match(/<details id="faq-answer-/g)||[]).length,5);
    assert.match(homepage.headers.get('content-security-policy'),/frame-src https:\/\/www\.instagram\.com/);
    const admin=await call('/admin');
    assert.ok(!admin.headers.get('content-security-policy').includes('instagram.com'));
    assert.ok(!html.includes('href="/admin"'));assert.ok(!html.includes('chatgpt.site'));
    const config=await (await call('/api/events')).json();
    const logged=await call('/api/admin/login',{username:'admin',password:'Test-only-password-2026!'}),cookie=logged.headers.get('set-cookie').split(';')[0];
    const input={revision:config._revision,name:'Updated event',headline:'A new headline',description:'A new description',intro:'A new introduction',city:'Merta City',
      venue:'Updated venue & courtyard',startDate:'2026-11-17',endDate:'2026-11-18',startTime:'18:00',endTime:'21:00',bookingEnabled:true,prices:{kids:350,adult:550},
      workshopDates:['2026-11-13','2026-11-14'],workshopDescriptions:['New learning session','New practice session']};
    const updated=await call('/api/admin/events/raas-garba-2026',input,cookie);assert.equal(updated.status,200);const next=await updated.json();
    const changed=await (await call('/')).text();
    for(const value of ['A new headline','A new description','Updated venue &amp; courtyard','17–18 November 2026','New learning session','13 November 2026','₹350','₹550'])
      assert.ok(changed.includes(value),value);
    const detail=await (await call('/events/raas-garba-2026/')).text();assert.match(detail,/A new introduction/);
    const quoted=await (await call('/api/booking/quote',{revision:next._revision,slug:'raas-garba-2026',quantities:{kids:1,adult:2}})).json();
    assert.equal(quoted.total,1450);assert.match(decodeURIComponent(quoted.url),/17–18 November 2026/);
    assert.equal((await call('/api/admin/events/raas-garba-2026',{...input,revision:next._revision,headline:''},cookie)).status,422);
  }finally{DB.close();}
});
test('adding the reels capability keeps existing organiser edits and drops stale hosted metadata',async()=>{
  const DB=database(),env={DB};
  try{
    const legacy=structuredClone(defaults);delete legacy.social;legacy.siteUrl='https://previous.chatgpt.site';
    legacy.events[0].title='Saved organiser title';legacy.events[0].passes[0].price=325;
    await DB.prepare('INSERT INTO event_settings (id,content,revision,updated_at) VALUES (?,?,?,?)').bind('website',JSON.stringify(legacy),4,now).run();
    const merged=await readConfiguration(env,defaults,now);
    assert.equal(merged.events[0].title,'Saved organiser title');assert.equal(merged.events[0].passes[0].price,325);
    assert.equal(merged.social.reels.length,3);assert.ok(!Object.hasOwn(merged,'siteUrl'));
    const again=await readConfiguration(env,defaults,now);assert.equal(again._revision,merged._revision);
  }finally{DB.close();}
});
