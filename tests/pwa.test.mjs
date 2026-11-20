import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import vm from 'node:vm';
const worker=readFileSync('public/sw.js','utf8');
function harness(fetchImpl=async()=>({online:true})){
 const handlers={},writes=[];
 const offline={offline:true};
 vm.runInNewContext(worker,{URL,fetch:fetchImpl,caches:{open:async()=>({addAll:async paths=>writes.push(...paths)}),match:async()=>offline,keys:async()=>[],delete:async()=>true},self:{location:{origin:'https://example.test'},addEventListener:(name,fn)=>handlers[name]=fn}});
 function request(path,mode='navigate',method='GET'){
  let response;
  handlers.fetch({request:{url:`https://example.test${path}`,mode,method},respondWith:value=>response=value});
  return response;
 }
 return {handlers,writes,offline,request};
}
test('worker ignores records, authentication, exports and mutations',()=>{
 const h=harness();
 for(const path of ['/api/schedule','/api/clinical/cases','/auth/google/callback','/auth/logout','/setup/import','/export.pdf'])assert.equal(h.request(path),undefined,path);
 assert.equal(h.request('/','navigate','POST'),undefined);
 assert.equal(h.request('/','cors'),undefined);
});
test('online navigation uses network; offline navigation uses only the public notice',async()=>{
 const h=harness();assert.deepEqual(await h.request('/'),{online:true});
 const offline=harness(async()=>{throw Error('offline')});
 for(const path of ['/','/login','/password'])assert.equal(await offline.request(path),offline.offline);
});
test('precache contains only offline notice and public icons',async()=>{
 const h=harness();let pending;h.handlers.install({waitUntil:p=>pending=p});await pending;
 assert.deepEqual(h.writes,['/offline.html','/icons/app-192.png','/icons/app-512.png']);
 for(const path of h.writes)assert.ok(existsSync(`public${path}`));
 const manifest=JSON.parse(readFileSync('public/manifest.webmanifest','utf8'));
 assert.equal(manifest.name,'RAMA Derm Sx');assert.equal(manifest.display,'standalone');
 for(const icon of manifest.icons)assert.ok(existsSync(`public${icon.src}`));
});
test('build assets cache only exact public paths, leaving private lookalikes to the network',async()=>{
 const handlers={},stored=new Map();let downloads=0;
 const source=worker.replace('/*BUILD_ASSETS*/ []',JSON.stringify(['/assets/app-abc123.js']));
 const cache={match:async key=>stored.get(key),put:async(key,response)=>stored.set(key,response)};
 vm.runInNewContext(source,{URL,caches:{open:async()=>cache},fetch:async()=>{downloads++;return {ok:true,redirected:false,clone(){return this}}},self:{location:{origin:'https://example.test'},addEventListener:(name,fn)=>handlers[name]=fn}});
 function request(path){let response;handlers.fetch({request:{url:'https://example.test'+path,method:'GET',mode:'cors'},respondWith:r=>response=r});return response}
 await request('/assets/app-abc123.js');await request('/assets/app-abc123.js');assert.equal(downloads,1);
 for(const path of ['/api/clinical/record.js','/assets/private.json','/assets/not-in-build.js','/auth/logout'])assert.equal(request(path),undefined);
});
