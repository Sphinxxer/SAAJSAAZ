import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {Readable} from 'node:stream';
import {createClient} from '@libsql/client';
import {databaseAdapter,schema} from '../server/turso.mjs';
import {createHandler} from '../server/vercel.mjs';
import {hashPassword} from '../server/auth.mjs';

async function invoke(handler,route,body,extra={}) {
  const query='/site?__saajsaaz_path='+encodeURIComponent(route.replace(/^\//,''));
  const req=Readable.from(body===undefined?[]:[JSON.stringify(body)]);
  req.url=query;req.method=body===undefined?'GET':'POST';req.socket={remoteAddress:'127.0.0.1'};
  req.headers={host:'example.test','x-forwarded-proto':'https',origin:'https://example.test',
    ...(body===undefined?{}:{'content-type':'application/json'}),...extra};
  let status,headers,bytes;
  const res={writeHead(s,h){status=s;headers=h;return this;},end(b){bytes=b;}};
  await handler(req,res);
  const content=bytes?Buffer.from(bytes).toString():'';
  return {status,headers,content,json:()=>JSON.parse(content)};
}

test('Vercel transport and libSQL adapter preserve login, quote, edits, conflicts and restart persistence',async()=>{
  const directory=await mkdtemp(path.join(tmpdir(),'saaj-vercel-'));
  const url=pathToFileURL(path.join(directory,'test.db')).href;
  let client=createClient({url});
  try {
    await client.batch(schema,'write');
    let env={DB:databaseAdapter(client),ADMIN_USERNAME:'Admin',ADMIN_PASSWORD_HASH:await hashPassword('test-only-password')};
    const handler=createHandler(async()=>env);
    const homepage=await invoke(handler,'/');
    assert.equal(homepage.status,200);assert.match(homepage.content,/garba-hero.webp/);
    const anonymous=await invoke(handler,'/api/admin/events');assert.equal(anonymous.status,401);
    const config=(await invoke(handler,'/api/events')).json();
    const quote={slug:config.featuredEvent,revision:config._revision,quantities:{kids:1,adult:2}};
    const result=(await invoke(handler,'/api/booking/quote',quote)).json();
    assert.equal(result.total,1297);assert.equal(result.count,3);
    assert.match(new URL(result.url).searchParams.get('text'),/👋/);
    const logged=await invoke(handler,'/api/admin/login',{username:'Admin',password:'test-only-password'});
    assert.equal(logged.status,200);assert.match(logged.headers['set-cookie'],/Secure/);
    const cookie=logged.headers['set-cookie'].split(';')[0];
    const event=config.events[0];
    const edit={revision:config._revision,name:event.title,startDate:'2026-10-17',endDate:'2026-10-18',startTime:'18:00',endTime:'21:00',bookingEnabled:true,prices:{kids:350,adult:550},workshopDates:['2026-10-13','2026-10-14']};
    assert.equal((await invoke(handler,'/api/admin/events/'+event.slug,edit,{cookie,origin:'https://evil.test'})).status,403);
    const saved=await invoke(handler,'/api/admin/events/'+event.slug,edit,{cookie});
    assert.equal(saved.status,200);assert.equal(saved.json()._revision,config._revision+1);
    assert.equal((await invoke(handler,'/api/admin/events/'+event.slug,edit,{cookie})).status,409);
    assert.equal((await invoke(handler,'/api/booking/quote',quote)).status,409);
    client.close();client=createClient({url});await client.batch(schema,'write');
    env={...env,DB:databaseAdapter(client)};
    const restored=(await invoke(handler,'/api/events')).json();
    assert.equal(restored.events[0].passes[0].price,350);
    assert.equal((await invoke(handler,'/api/booking/quote',{...quote,revision:restored._revision})).json().total,1450);
    assert.match((await invoke(handler,'/admin',undefined,{cookie})).content,/id="event-form"/);
    assert.equal((await invoke(handler,'/events/'+event.slug)).status,308);
    assert.equal((await invoke(handler,'/missing')).status,404);
    const statement=env.DB.prepare('UPDATE event_settings SET revision = revision + 1 WHERE id = ? AND revision = ?').bind('website',1);
    assert.equal((await statement.run()).meta.changes,0);
    // A failing batch rolls back earlier operations, preserving atomic session writes.
    await assert.rejects(env.DB.batch([
      env.DB.prepare('INSERT INTO admin_sessions VALUES (?, ?)').bind('rollback-marker',1),
      env.DB.prepare('INSERT INTO missing_table VALUES (?)').bind(1)
    ]));
    assert.equal(await env.DB.prepare('SELECT * FROM admin_sessions WHERE token_hash = ?').bind('rollback-marker').first(),null);
  } finally {
    client.close();
    await rm(directory,{recursive:true,force:true,maxRetries:3,retryDelay:100}).catch(error=>{
      // Native libSQL can retain Windows file handles until the test worker exits.
      // This affects disposal of a temporary fixture, not persistence assertions.
      if(process.platform!=='win32'||error.code!=='EBUSY')throw error;
    });
  }
});

test('Vercel transport supports parsed bodies and HEAD; configuration failure and oversized bodies fail safely',async()=>{
  const client=createClient({url:':memory:'});await client.batch(schema,'write');
  try {
    const handler=createHandler(async()=>({DB:databaseAdapter(client)}));
    const req={url:'/site?__saajsaaz_path=api%2Fevents',method:'HEAD',headers:{host:'example.test'},socket:{remoteAddress:'local'}};
    let status,body;const res={writeHead(s){status=s;return this;},end(b){body=b;}};
    await handler(req,res);assert.equal(status,200);assert.equal(body,undefined);
    req.method='POST';req.url='/site?__saajsaaz_path=api%2Fbooking%2Fquote';req.headers['content-type']='application/json';
    req.body={slug:'raas-garba-2026',revision:1,quantities:{kids:1,adult:2}};
    await handler(req,res);assert.equal(status,200);assert.equal(JSON.parse(body).total,1297);
    req.body='x'.repeat(16385);await handler(req,res);assert.equal(status,413);
    const unavailable=createHandler(async()=>{throw Error('secret-test-token');});
    const response=await invoke(unavailable,'/');assert.equal(response.status,503);
    assert.doesNotMatch(response.content,/secret-test-token/);
  } finally {client.close();}
});
