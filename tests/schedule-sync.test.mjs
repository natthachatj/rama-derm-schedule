import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp,rm} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const dir=await mkdtemp(new URL('../.auth-test-',import.meta.url));
await build({entryPoints:['lib/schedule-sync.ts','lib/schedule-api.ts','lib/schedule.ts'],outdir:dir,outbase:'.',bundle:true,platform:'node',format:'esm'});
const {createScheduleSync}=await import(pathToFileURL(dir+'/lib/schedule-sync.js'));
const {createScheduleApi}=await import(pathToFileURL(dir+'/lib/schedule-api.js'));
const {seed}=await import(pathToFileURL(dir+'/lib/schedule.js'));
after(()=>rm(dir,{recursive:true,force:true}));
function fixture(){let revision=1,accessKey='fellow',downloads=0,checks=0;const data=[];const sync=createScheduleSync({onData:d=>data.push(d),fetch:async path=>{if(path.endsWith('/version')){checks++;return Response.json({revision,accessKey})}downloads++;return Response.json({revision,accessKey,years:[],user:{id:accessKey}})}});return {sync,data,get downloads(){return downloads},get checks(){return checks},change(){revision++},identity(value){accessKey=value}}}
test('unchanged versions avoid downloads, changes download once, overlapping checks coalesce',async()=>{const f=fixture();await Promise.all([f.sync.check(),f.sync.check(),f.sync.check()]);assert.equal(f.checks,1);assert.equal(f.downloads,1);await f.sync.check();assert.equal(f.checks,2);assert.equal(f.downloads,1);f.change();await f.sync.check();assert.equal(f.downloads,2);f.sync.accept({revision:1,accessKey:'fellow'});assert.equal(f.data.at(-1).revision,2)});
test('expired or changed account downloads the new view even with an unchanged revision',async()=>{const f=fixture();await f.sync.check();f.identity('public');await f.sync.check();assert.equal(f.downloads,2);assert.equal(f.data.at(-1).accessKey,'public')});
test('tabs share only matching account views in memory',async()=>{const listeners=new Set();const channel={postMessage:()=>{},addEventListener:(t,fn)=>listeners.add(fn),removeEventListener:(t,fn)=>listeners.delete(fn)};const seen=[];const sync=createScheduleSync({channel,onData:d=>seen.push(d),fetch:async()=>Response.json({})});sync.accept({revision:1,accessKey:'me'});listeners.forEach(fn=>fn({data:{type:'snapshot',data:{revision:99,accessKey:'other',secret:true}}}));assert.equal(seen.length,1);listeners.forEach(fn=>fn({data:{type:'snapshot',data:{revision:2,accessKey:'me'}}}));assert.equal(seen.at(-1).revision,2);sync.close();assert.equal(listeners.size,0)});
test('version response is small, private and changes with identity independently of workspace revision',async()=>{const state=seed();state.years[0].fellows[0].email='fellow@test.org';let user=null;const api=createScheduleApi({load:async()=>({state,revision:10}),save:async()=>true,getUser:async()=>user,adminEmail:()=> 'admin@test.org'});const response=await api.VERSION();assert.equal(response.headers.get('cache-control'),'no-store');const publicVersion=await response.json();assert.deepEqual(Object.keys(publicVersion).sort(),['accessKey','revision']);user={userId:'one',email:'fellow@test.org',displayName:'One',fullName:null};const fellowVersion=await(await api.VERSION()).json();assert.notEqual(publicVersion.accessKey,fellowVersion.accessKey);assert.equal(fellowVersion.revision,publicVersion.revision);const full=await(await api.GET()).json();assert.equal(full.accessKey,fellowVersion.accessKey);assert.equal(full.role,'fellow');assert.equal(full.years[0].draft,undefined)});
test('a newly opened tab can reuse a peer snapshot only after verifying its scope and revision',async()=>{
 let listener,downloads=0;const rendered=[];
 const channel={postMessage:()=>{},addEventListener:(t,fn)=>listener=fn,removeEventListener:()=>{}};
 const sync=createScheduleSync({channel,onData:d=>rendered.push(d),fetch:async path=>{if(path.endsWith('/version'))return Response.json({revision:4,accessKey:'me'});downloads++;return Response.json({revision:4,accessKey:'me'})}});
 listener({data:{type:'snapshot',data:{revision:4,accessKey:'me'}}});assert.equal(rendered.length,0);
 await sync.check();assert.equal(downloads,0);assert.equal(rendered.length,1);sync.close();
});
