import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import {createClient} from '@libsql/client';
import {schema,databaseAdapter} from '../server/turso.mjs';
import {hashPassword} from '../server/auth.mjs';
import {createHandler} from '../.vercel/output/functions/site.func/index.mjs';

const output=new URL('../.vercel/output/',import.meta.url);
const configuration=JSON.parse(await readFile(new URL('config.json',output),'utf8'));
assert.equal(configuration.version,3);
assert.equal(configuration.routes.at(-1).dest,'/site?__saajsaaz_path=$1');
const functionConfig=JSON.parse(await readFile(new URL('functions/site.func/.vc-config.json',output),'utf8'));
assert.equal(functionConfig.runtime,'nodejs24.x');
for(const file of ['assets/app.mjs','assets/admin.mjs','assets/festive.css','images/garba-hero.webp','robots.txt'])
  assert.ok((await stat(new URL('static/'+file,output))).size>0);

const client=createClient({url:':memory:'});
try {
  await client.batch(schema,'write');
  const handler=createHandler(async()=>({DB:databaseAdapter(client),ADMIN_USERNAME:'Admin',ADMIN_PASSWORD_HASH:await hashPassword('build-check-only')}));
  async function call(route,body) {
    const req={url:'/site?__saajsaaz_path='+encodeURIComponent(route.replace(/^\//,'')),method:body?'POST':'GET',
      headers:{host:'build.test',origin:'http://build.test',...(body?{'content-type':'application/json'}:{})},socket:{remoteAddress:'local'},body};
    let status,bytes;
    await handler(req,{writeHead(s){status=s;return this;},end(b){bytes=b;}});
    return {status,content:Buffer.from(bytes).toString()};
  }
  const home=await call('/');assert.equal(home.status,200);assert.match(home.content,/garba-hero.webp/);
  const config=JSON.parse((await call('/api/events')).content);
  const current=config.events.find(e=>e.slug===config.featuredEvent);
  const quantities=Object.fromEntries(current.passes.map((pass,index)=>[pass.id,index===1?2:1]));
  const quote=await call('/api/booking/quote',{slug:config.featuredEvent,revision:config._revision,quantities});
  // After the configured event ends, the correct quote response is bookings closed.
  const isOpen=current.bookingEnabled&&Date.now()<Date.parse(current.endsAt);
  assert.equal(quote.status,isOpen?200:409);
  if(isOpen)assert.equal(JSON.parse(quote.content).total,current.passes.reduce((sum,pass)=>sum+pass.price*quantities[pass.id],0));
  assert.equal((await call('/api/admin/login',{username:'Admin',password:'build-check-only'})).status,200);
  console.log('Vercel output and bundled homepage, booking and login checks passed.');
} finally {client.close();}
