import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp,rm} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const dir=await mkdtemp(new URL('../.auth-test-',import.meta.url));
await build({entryPoints:['app/clinical/api.ts'],outfile:dir+'/api.mjs',bundle:true,platform:'node',format:'esm'});
const {clinicalApi,setClinicalIdentity}=await import(pathToFileURL(dir+'/api.mjs'));
after(()=>rm(dir,{recursive:true,force:true}));
test('clinical GETs coalesce and session metadata is scoped to identity and preview',async()=>{const original=globalThis.fetch;let requests=0;globalThis.fetch=async()=>{requests++;return Response.json({owner:requests===1})};try{
 setClinicalIdentity('owner:1');await Promise.all([clinicalApi('session'),clinicalApi('session')]);assert.equal(requests,1);await clinicalApi('session');assert.equal(requests,1);
 await clinicalApi('session',undefined,true);assert.equal(requests,2);setClinicalIdentity('fellow:1');assert.equal((await clinicalApi('session')).owner,false);assert.equal(requests,3);
 await Promise.all([clinicalApi('records'),clinicalApi('records')]);assert.equal(requests,4);await clinicalApi('records');assert.equal(requests,5);
 }finally{globalThis.fetch=original}});
