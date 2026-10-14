import defaults from '../data/events.json' with {type:'json'};
import { selection, whatsappUrl } from '../src/booking.mjs';
import { authenticated, cookieToken, digest, randomToken, sessionCookie, verifyPassword } from './auth.mjs';
import { readConfiguration, updateEvent, updateSocial } from './content.mjs';
import { renderSite } from './render.mjs';
import { renderAdmin, renderAdminLogin } from './admin-render.mjs';

const security = {
  'Cache-Control':'no-store',
  'X-Content-Type-Options':'nosniff',
  'Referrer-Policy':'strict-origin-when-cross-origin',
  'X-Frame-Options':'DENY',
  'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'self'"
};
const json = (data,status=200,extra={}) => Response.json(data,{status,headers:{...security,...extra}});
const html = (content,status=200,admin=false,reels=false) => new Response(content,{status,headers:{
  ...security,'Content-Type':'text/html; charset=utf-8',...(admin?{'X-Robots-Tag':'noindex, nofollow'}:{}),
  ...(reels?{'Content-Security-Policy':security['Content-Security-Policy']+"; frame-src https://www.instagram.com"}:{})
}});
async function body(request) {
  if (!request.headers.get('content-type')?.startsWith('application/json'))
    throw new Error('Send a JSON request.');
  if (Number(request.headers.get('content-length') || 0) > 16384) throw new Error('Request is too large.');
  const reader = request.body?.getReader();
  if (!reader) throw new Error('Invalid request.');
  let length = 0;
  const chunks = [];
  for (;;) {
    const {done,value} = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > 16384) { await reader.cancel(); throw new Error('Request is too large.'); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {bytes.set(chunk,offset);offset+=chunk.byteLength;}
  const text = new TextDecoder().decode(bytes);
  const parsed = JSON.parse(text);
  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') throw new Error('Invalid request.');
  return parsed;
}
function sameOrigin(request) {
  return request.headers.get('origin') === new URL(request.url).origin;
}
async function login(request,env,now) {
  if (!env.ADMIN_USERNAME || !env.ADMIN_PASSWORD_HASH) return json({error:'Organiser access is being configured.'},503);
  const input = await body(request);
  const key = await digest(request.headers.get('cf-connecting-ip') || 'local');
  const attempts = await env.DB.prepare('SELECT attempts, last_attempt_at FROM admin_login_attempts WHERE key = ?').bind(key).first();
  if (attempts && attempts.attempts >= 8 && attempts.last_attempt_at > now - 900000)
    return json({error:'Too many sign-in attempts. Try again in 15 minutes.'},429,{'Retry-After':'900'});
  const passwordCorrect = await verifyPassword(input.password,env.ADMIN_PASSWORD_HASH);
  const usernameCorrect = input.username === env.ADMIN_USERNAME;
  if (!passwordCorrect || !usernameCorrect) {
    await env.DB.prepare('INSERT INTO admin_login_attempts (key, attempts, last_attempt_at) VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET attempts = CASE WHEN last_attempt_at < ? THEN 1 ELSE attempts + 1 END, last_attempt_at = ?')
      .bind(key,now,now-900000,now).run();
    return json({error:'Username or password is incorrect.'},401);
  }
  const token = randomToken();
  await env.DB.batch([
    env.DB.prepare('DELETE FROM admin_login_attempts WHERE key = ?').bind(key),
    env.DB.prepare('DELETE FROM admin_sessions WHERE expires_at <= ?').bind(now),
    env.DB.prepare('INSERT INTO admin_sessions (token_hash, expires_at) VALUES (?, ?)').bind(await digest(token + ':' + env.ADMIN_PASSWORD_HASH),now+28800000)
  ]);
  return json({ok:true},200,{'Set-Cookie':sessionCookie(request,token)});
}

export async function handleRequest(request,env,now=Date.now()) {
  const url = new URL(request.url);
  const pathname = url.pathname;
  try {
    if (!env.DB) return json({error:'The event database is temporarily unavailable.'},503);
    if (pathname.startsWith('/api/admin/') && request.method === 'POST' && !sameOrigin(request))
      return json({error:'Request origin is not allowed.'},403);
    if (pathname === '/api/admin/login' && request.method === 'POST') return await login(request,env,now);
    if (pathname === '/api/admin/logout' && request.method === 'POST') {
      const token = cookieToken(request);
      if (token) await env.DB.prepare('DELETE FROM admin_sessions WHERE token_hash = ?').bind(await digest(token + ':' + env.ADMIN_PASSWORD_HASH)).run();
      return json({ok:true},200,{'Set-Cookie':sessionCookie(request,'',0)});
    }
    if ((pathname === '/admin' || pathname === '/admin/') && request.method === 'GET') {
      const allowed = await authenticated(request,env,now);
      return html(allowed ? renderAdmin(await readConfiguration(env,defaults,now)) : renderAdminLogin(),200,true);
    }
    if (pathname === '/api/events' && request.method === 'GET')
      return json(await readConfiguration(env,defaults,now));
    if (pathname === '/api/booking/quote' && request.method === 'POST') {
      const input = await body(request);
      const configuration = await readConfiguration(env,defaults,now);
      if (input.revision !== configuration._revision)
        return json({error:'Event details have changed. Review them and continue again.',configuration},409);
      const event = configuration.events.find(e=>e.slug === input.slug);
      if (!event) return json({error:'Event not found.'},404);
      if (!input.quantities || typeof input.quantities !== 'object' || Array.isArray(input.quantities))
        return json({error:'Choose valid pass quantities.'},422);
      const chosen = selection(event,input.quantities);
      if (!chosen.valid || chosen.count === 0) return json({error:'Choose at least one valid pass.'},422);
      try { return json({url:whatsappUrl(event,chosen,now),total:chosen.total,count:chosen.count}); }
      catch { return json({error:'Bookings are closed.',configuration},409); }
    }
    if (pathname.startsWith('/api/admin/')) {
      if (!await authenticated(request,env,now)) return json({error:'Sign in to manage events.'},401);
      if (pathname === '/api/admin/events' && request.method === 'GET')
        return json(await readConfiguration(env,defaults,now));
      const match = /^\/api\/admin\/events\/([a-z0-9]+(?:-[a-z0-9]+)*)$/.exec(pathname);
      if ((match || pathname === '/api/admin/social') && request.method === 'POST') {
        const input = await body(request);
        const configuration = await readConfiguration(env,defaults,now);
        if (input.revision !== configuration._revision)
          return json({error:'Another organiser updated these details. Reload the event before saving.'},409);
        let updated;
        try { updated = match ? updateEvent(configuration,match[1],input) : updateSocial(configuration,input); }
        catch (error) { return json({error:error.message},422); }
        const result = await env.DB.prepare('UPDATE event_settings SET content = ?, revision = revision + 1, updated_at = ? WHERE id = ? AND revision = ?')
          .bind(JSON.stringify(updated),now,'website',input.revision).run();
        if (!result.meta?.changes) return json({error:'The event was updated elsewhere. Reload before saving.'},409);
        return json(await readConfiguration(env,defaults,now));
      }
      return json({error:'Not found.'},404);
    }
    if (request.method !== 'GET') return json({error:'Method not allowed.'},405,{'Allow':'GET'});
    const configuration = await readConfiguration(env,defaults,now);
    if (pathname === '/') return html(renderSite(configuration,'/'),200,false,true);
    const match = /^\/events\/([a-z0-9]+(?:-[a-z0-9]+)*)(\/?)$/.exec(pathname);
    if (match && configuration.events.some(e=>e.slug === match[1])) {
      if (!match[2]) return new Response(null,{status:308,headers:{...security,Location:pathname+'/'}});
      return html(renderSite(configuration,pathname));
    }
    return html(renderSite(configuration,pathname),404);
  } catch (error) {
    if (error instanceof SyntaxError || error.message === 'Send a JSON request.' ||
        error.message === 'Invalid request.' || error.message === 'Request is too large.')
      return json({error:'Invalid request.'},400);
    return json({error:'The service is temporarily unavailable. Please try again.'},503);
  }
}
