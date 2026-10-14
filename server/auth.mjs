const encoder = new TextEncoder();
const hex = value => [...new Uint8Array(value)].map(n => n.toString(16).padStart(2,'0')).join('');
const unhex = value => Uint8Array.from(value.match(/../g) || [], n => parseInt(n,16));
export const digest = async value => hex(await crypto.subtle.digest('SHA-256',encoder.encode(value)));
export const randomToken = () => btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))))
  .replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');

export async function hashPassword(password, salt = crypto.getRandomValues(new Uint8Array(16))) {
  const key = await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveBits']);
  const bits = await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt,iterations:100000},key,256);
  return 'pbkdf2:100000:' + hex(salt) + ':' + hex(bits);
}
export async function verifyPassword(password, stored) {
  if (typeof password !== 'string' || password.length > 256 ||
      !/^pbkdf2:100000:[a-f0-9]{32}:[a-f0-9]{64}$/.test(stored || '')) return false;
  const [, , salt, expected] = stored.split(':');
  const actual = (await hashPassword(password,unhex(salt))).split(':')[3];
  let difference = 0;
  for (let i = 0; i < expected.length; i++) difference |= expected.charCodeAt(i) ^ actual.charCodeAt(i);
  return difference === 0;
}
export function sessionCookie(request, token, maxAge = 28800) {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return 'saaj_admin=' + token + '; Path=/; HttpOnly; SameSite=Strict; Max-Age=' + maxAge + secure;
}
export function cookieToken(request) {
  const cookie = request.headers.get('cookie') || '';
  const value = cookie.split(';').map(c=>c.trim()).find(c=>c.startsWith('saaj_admin='))?.slice(11);
  return /^[A-Za-z0-9_-]{43}$/.test(value || '') ? value : null;
}
export async function authenticated(request, env, now = Date.now()) {
  const token = cookieToken(request);
  if (!token) return false;
  const result = await env.DB.prepare('SELECT expires_at FROM admin_sessions WHERE token_hash = ?')
    .bind(await digest(token + ':' + env.ADMIN_PASSWORD_HASH)).first();
  return Boolean(result && result.expires_at > now);
}
