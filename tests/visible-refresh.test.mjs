import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp,rm} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const dir=await mkdtemp(new URL('../.auth-test-',import.meta.url));
await build({entryPoints:['lib/visible-refresh.ts'],outfile:dir+'/visible-refresh.mjs',bundle:true,platform:'node',format:'esm'});
const {startVisibleRefresh,acceptsSnapshot}=await import(pathToFileURL(dir+'/visible-refresh.mjs'));
after(()=>rm(dir,{recursive:true,force:true}));
function fixture(initial='visible'){
 let requests=0;const listeners=new Map(),wakeListeners=new Map();
 const source={visibilityState:initial,addEventListener:(t,f)=>listeners.set(t,f),removeEventListener:t=>listeners.delete(t)};
 const wake={addEventListener:(t,f)=>wakeListeners.set(t,f),removeEventListener:t=>wakeListeners.delete(t)};
 const stop=startVisibleRefresh(source,()=>requests++,wake);
 return {get requests(){return requests},stop,visibility(value){source.visibilityState=value;listeners.get('visibilitychange')?.()},wake(type){wakeListeners.get(type)?.()},listeners,wakeListeners};
}
test('checks on open and return; repeated visibility events do not poll',()=>{const f=fixture();assert.equal(f.requests,1);f.visibility('visible');assert.equal(f.requests,1);f.visibility('hidden');f.wake('focus');f.wake('online');assert.equal(f.requests,1);f.visibility('visible');assert.equal(f.requests,2);f.stop()});
test('focus, reconnection and restored pages check only while visible',()=>{const f=fixture('hidden');assert.equal(f.requests,0);f.wake('pageshow');assert.equal(f.requests,0);f.visibility('visible');for(const t of ['focus','online','pageshow'])f.wake(t);assert.equal(f.requests,4);f.stop();assert.equal(f.listeners.size,0);assert.equal(f.wakeListeners.size,0);f.wake('focus');assert.equal(f.requests,4)});
test('older refresh responses cannot overwrite a newer successful save',()=>{assert.equal(acceptsSnapshot(12,11),false);assert.equal(acceptsSnapshot(12,12),true);assert.equal(acceptsSnapshot(12,13),true);assert.equal(acceptsSnapshot(12,NaN),false)});
