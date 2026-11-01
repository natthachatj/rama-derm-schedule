import {spawnSync} from 'node:child_process';
import {build} from 'esbuild';
import {mkdirSync,writeFileSync,rmSync} from 'node:fs';
const result=spawnSync(process.execPath,['node_modules/vite/bin/vite.js','build','--config','netlify/vite.config.ts'],{stdio:'inherit'});if(result.status!==0)process.exit(result.status||1);
rmSync('netlify-functions',{recursive:true,force:true});mkdirSync('netlify-functions',{recursive:true});
await build({entryPoints:['netlify/functions/app.ts'],outfile:'netlify-functions/app.mjs',bundle:true,platform:'node',target:'node22',format:'esm',sourcemap:false,packages:'bundle',banner:{js:"import { createRequire as __ramaCreateRequire } from 'node:module'; const require = __ramaCreateRequire(import.meta.url);"}});
console.log('Netlify frontend and server function built. No deployment was performed.');
