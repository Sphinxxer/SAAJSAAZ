import http from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {handleRequest} from '../server/app.mjs';
import {database} from './sqlite-adapter.mjs';
import {hashPassword,randomToken} from '../server/auth.mjs';
const storage=new URL('../.local-data/',import.meta.url);
await mkdir(storage,{recursive:true});
const credentialsFile=new URL('admin.json',storage);
let credentials;
try{credentials=JSON.parse(await readFile(credentialsFile,'utf8'));}
catch(error){
  if(error.code!=='ENOENT')throw error;
  const password=randomToken().slice(0,24);
  credentials={ADMIN_USERNAME:'admin',ADMIN_PASSWORD_HASH:await hashPassword(password)};
  await writeFile(credentialsFile,JSON.stringify(credentials),{flag:'wx',mode:0o600});
  console.log('Initial organiser username: admin');
  console.log('Initial organiser password: '+password);
  console.log('Keep this password safely. It is shown only when first setting up.');
}
const env={...credentials,DB:database(fileURLToPath(new URL('events.db',storage)))};
const server=http.createServer(async(req,res)=>{
  if(!['localhost:2000','127.0.0.1:2000'].includes(req.headers.host)){
    res.writeHead(403).end('Use localhost:2000.');return;
  }
  try{
    const url=new URL(req.url,'http://'+req.headers.host);
    if(/^\/(?:assets\/[a-z.-]+|images\/[a-z0-9-]+\.(?:webp|png)|favicon.svg|robots.txt|feather-license.txt)$/.test(url.pathname)){
      const bytes=await readFile(new URL('../public'+url.pathname,import.meta.url));
      res.writeHead(200,{'Content-Type':url.pathname.endsWith('.css')?'text/css':url.pathname.endsWith('.mjs')?'text/javascript':url.pathname.endsWith('.svg')?'image/svg+xml':url.pathname.endsWith('.webp')?'image/webp':url.pathname.endsWith('.png')?'image/png':'text/plain','X-Content-Type-Options':'nosniff'}).end(bytes);return;
    }
    const chunks=[];let length=0;
    for await(const chunk of req){
      length+=chunk.length;
      if(length>16384){res.writeHead(413).end('Request too large.');return;}
      chunks.push(chunk);
    }
    const request=new Request(url,{method:req.method,headers:req.headers,...(req.method==='GET'||req.method==='HEAD'?{}:{body:Buffer.concat(chunks)})});
    const response=await handleRequest(request,env);
    res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
  }catch(error){
    if(error.code==='ENOENT')res.writeHead(404).end('Not found.');
    else res.writeHead(500).end('The local website could not respond.');
  }
});
server.on('error',error=>{console.error(error.code==='EADDRINUSE'?'Port 2000 is already in use.':'Could not start the local website.');process.exitCode=1;env.DB.close();});
server.listen(2000,'127.0.0.1',()=>console.log('SAAJSAAZ: http://localhost:2000\nAdmin: http://localhost:2000/admin'));
function shutdown(){server.close(()=>{env.DB.close();process.exit(0);});}
process.on('SIGINT',shutdown);process.on('SIGTERM',shutdown);
