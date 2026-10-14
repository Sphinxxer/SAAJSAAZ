import {mkdir,copyFile,writeFile,rm,lstat,cp} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {build} from 'esbuild';
import defaults from '../data/events.json' with {type:'json'};
import {validateConfig} from '../src/booking.mjs';

validateConfig(defaults);
const root=fileURLToPath(new URL('../',import.meta.url));
async function clean(relative) {
  const target=path.resolve(root,relative);
  if(path.relative(root,target).replaceAll('\\','/')!==relative)throw Error('Unsafe build path.');
  if((await lstat(target).catch(()=>null))?.isSymbolicLink())throw Error('Build output is a symlink.');
  await rm(target,{recursive:true,force:true});
}
await clean('public/assets');
await mkdir(path.join(root,'public/assets'),{recursive:true});
for(const name of ['styles.css','festive.css','icons.mjs','booking.mjs','social.mjs','presentation.mjs','app.mjs','admin.css','admin.mjs'])
  await copyFile(path.join(root,'src',name),path.join(root,'public/assets',name));

await clean('.vercel/output');
const output=path.join(root,'.vercel/output');
const func=path.join(output,'functions/site.func');
await mkdir(func,{recursive:true});
await cp(path.join(root,'public'),path.join(output,'static'),{recursive:true});
await build({entryPoints:[path.join(root,'server/vercel.mjs')],outfile:path.join(func,'index.mjs'),
  bundle:true,platform:'node',format:'esm',target:'node24',minify:true,
  banner:{js:"import {createRequire} from 'node:module'; const require=createRequire(import.meta.url);"}});
await writeFile(path.join(func,'.vc-config.json'),JSON.stringify({
  runtime:'nodejs24.x',handler:'index.mjs',launcherType:'Nodejs',shouldAddHelpers:false,maxDuration:30
},null,2));
await writeFile(path.join(output,'config.json'),JSON.stringify({version:3,routes:[
  {src:'/.*',headers:{'X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin'},continue:true},
  {handle:'filesystem'},
  {src:'/(.*)',dest:'/site?__saajsaaz_path=$1'}
]},null,2));
console.log('Built Vercel static assets and the self-contained Node 24 function.');
