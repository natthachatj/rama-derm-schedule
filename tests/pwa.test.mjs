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
