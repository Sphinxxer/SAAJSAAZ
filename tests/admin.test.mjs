import test from 'node:test';
import assert from 'node:assert/strict';
import {database} from '../scripts/sqlite-adapter.mjs';
import {hashPassword} from '../server/auth.mjs';
import {handleRequest} from '../server/app.mjs';
const now=Date.parse('2026-10-14T12:00:00+05:30');
const origin='https://example.test';
const password='Test-only-password-2026!';
function request(path,body,cookie='',extra={}){
  return new Request(origin+path,{method:body?'POST':'GET',headers:{Origin:origin,...(body?{'Content-Type':'application/json'}:{}),Cookie:cookie,...extra},...(body?{body:JSON.stringify(body)}:{})});
}
test('protected persistent editor, validation, session security and current booking quotes',async()=>{
  const DB=database(),env={DB,ADMIN_USERNAME:'admin',ADMIN_PASSWORD_HASH:await hashPassword(password)};
  const call=(path,body,cookie='',extra={},time=now)=>handleRequest(request(path,body,cookie,extra),env,time);
  try{
    assert.equal((await call('/api/admin/events')).status,401);
    assert.equal((await call('/api/admin/events/raas-garba-2026',{})).status,401);
    assert.equal((await call('/api/admin/login',{username:'admin',password},{},{Origin:'https://bad.test'})).status,403);
    assert.equal((await call('/api/admin/login',{username:'admin',password:'bad'})).status,401);
    const logged=await call('/api/admin/login',{username:'admin',password});
    assert.equal(logged.status,200);
    const header=logged.headers.get('set-cookie');
    assert.match(header,/HttpOnly/);assert.match(header,/Secure/);assert.match(header,/SameSite=Strict/);
    const cookie=header.split(';')[0];
    assert.match(await (await call('/admin',undefined,cookie)).text(),/id="event-form"/);
    let config=await (await call('/api/events')).json();
    const quote={slug:'raas-garba-2026',revision:config._revision,quantities:{kids:1,adult:2}};
    let response=await call('/api/booking/quote',quote);
    const initial=await response.json();assert.equal(initial.total,1297);
    assert.match(decodeURIComponent(initial.url),/17–18 October 2026/);
    for(const quantities of [{kids:0,adult:0},{kids:-1},{kids:1.5},{kids:'bad'}])
      assert.equal((await call('/api/booking/quote',{...quote,quantities})).status,422);
    const input={revision:config._revision,name:'New & Updated Event',startDate:'2026-11-17',endDate:'2026-11-18',startTime:'18:00',endTime:'21:00',bookingEnabled:true,prices:{kids:350,adult:550},workshopDates:['2026-11-13','2026-11-14']};
    for(const bad of [{...input,endDate:'2026-11-16'},{...input,startDate:'2026-02-30'},{...input,prices:{kids:-1,adult:550}},{...input,name:''},{...input,prices:{kids:1.111,adult:550}}])
      assert.equal((await call('/api/admin/events/raas-garba-2026',bad,cookie)).status,422);
    response=await call('/api/admin/events/raas-garba-2026',input,cookie);assert.equal(response.status,200);
    config=await response.json();assert.equal(config._revision,2);
    const publicHtml=await (await call('/events/raas-garba-2026/')).text();
    assert.match(publicHtml,/New &amp; Updated Event/);assert.match(publicHtml,/₹550/);assert.match(publicHtml,/17–18 November 2026/);
    assert.equal((await call('/api/admin/events/raas-garba-2026',input,cookie)).status,409);
    assert.equal((await call('/api/booking/quote',quote)).status,409);
    const revised=await (await call('/api/booking/quote',{...quote,revision:2})).json();
    assert.equal(revised.total,1450);assert.match(decodeURIComponent(revised.url),/New & Updated Event/);
    assert.equal((await call('/events/raas-garba-2026')).status,308);
    assert.equal((await call('/unknown')).status,404);
    assert.equal((await call('/api/admin/events',undefined,cookie,{},now+28800001)).status,401);
    env.ADMIN_PASSWORD_HASH=await hashPassword('rotated-password');
    assert.equal((await call('/api/admin/events',undefined,cookie)).status,401);
    env.ADMIN_PASSWORD_HASH=await hashPassword(password);
    const again=await call('/api/admin/login',{username:'admin',password}),freshCookie=again.headers.get('set-cookie').split(';')[0];
    await call('/api/admin/events/raas-garba-2026',{...input,revision:2,bookingEnabled:false},freshCookie);
    assert.equal((await call('/api/booking/quote',{...quote,revision:3})).status,409);
    await call('/api/admin/logout',{},freshCookie);
    assert.equal((await call('/api/admin/events',undefined,freshCookie)).status,401);
    for(let i=0;i<8;i++)assert.equal((await call('/api/admin/login',{username:'admin',password:'wrong'})).status,401);
    assert.equal((await call('/api/admin/login',{username:'admin',password})).status,429);
  }finally{DB.close();}
});
