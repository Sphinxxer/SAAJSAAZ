import {handleRequest} from './app.mjs';
import {getEnvironment} from './turso.mjs';

const limit=16384;
async function requestBody(req) {
  if (req.body !== undefined) {
    const bytes=Buffer.isBuffer(req.body)?req.body:Buffer.from(typeof req.body==='string'?req.body:JSON.stringify(req.body));
    if(bytes.length>limit)throw Error('too-large');
    return bytes;
  }
  const chunks=[];let size=0;
  for await(const chunk of req) {
    const bytes=Buffer.from(chunk);size+=bytes.length;
    if(size>limit)throw Error('too-large');
    chunks.push(bytes);
  }
  return Buffer.concat(chunks);
}

export function createHandler(environment=getEnvironment) {
  return async(req,res)=>{
    try {
      const headers=new Headers();
      for(const [name,value] of Object.entries(req.headers)) {
        if(value!==undefined)headers.set(name,Array.isArray(value)?value.join(','):value);
      }
      // Vercel overwrites X-Forwarded-For. Do not trust caller-supplied CF headers.
      headers.set('cf-connecting-ip',process.env.VERCEL
        ? (headers.get('x-forwarded-for')||'unknown').split(',')[0].trim()
        : req.socket?.remoteAddress||'local');
      const protocol=process.env.VERCEL?'https':(headers.get('x-forwarded-proto')==='https'?'https':'http');
      const origin=protocol+'://'+headers.get('host');
      const incoming=new URL(req.url,origin);
      const url=new URL(incoming);
      // Build Output API routing carries the original path into this function.
      if(incoming.pathname==='/site') {
        const path=incoming.searchParams.get('__saajsaaz_path');
        if(path===null) {res.writeHead(404).end('Not found.');return;}
        url.pathname='/'+path.replace(/^\/+/, '');
      }
      url.searchParams.delete('__saajsaaz_path');
      const method=req.method==='HEAD'?'GET':req.method;
      const request=new Request(url,{method,headers,
        ...(['GET','HEAD'].includes(req.method)?{}:{body:await requestBody(req)})});
      const response=await handleRequest(request,await environment());
      res.writeHead(response.status,Object.fromEntries(response.headers));
      res.end(req.method==='HEAD'?undefined:Buffer.from(await response.arrayBuffer()));
    } catch(error) {
      const status=error.message==='too-large'?413:503;
      res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
      res.end(JSON.stringify({error:status===413?'Request is too large.':'The service is temporarily unavailable. Check the deployment environment settings.'}));
    }
  };
}

export default createHandler();
