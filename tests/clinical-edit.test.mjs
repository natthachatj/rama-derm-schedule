import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const dir=await mkdtemp(new URL('../.auth-test-edit-',import.meta.url));
await build({entryPoints:['lib/clinical/edit.ts','lib/clinical/service.ts','lib/clinical/model.ts','lib/clinical/outcomes.ts'],outdir:dir,outbase:'.',bundle:true,platform:'node',target:'node22',format:'esm',packages:'external'});
const load=p=>import(pathToFileURL(`${dir}/${p}.js`));
const {editChanges,mergeEdit}=await load('lib/clinical/edit');
const {createClinicalService}=await load('lib/clinical/service');
const {newRecord,defaultSettings}=await load('lib/clinical/model');
const {emptyOutcomes}=await load('lib/clinical/outcomes');
after(()=>rm(dir,{recursive:true,force:true}));
const answer=value=>({state:'recorded',value});
function record(){return {...newRecord('ravc','owner','f1',2026),status:'approved',processing:'complete',folderId:'original-folder',pdfId:'original-pdf'}}
function fixture(initial=record()){
 let current=structuredClone(initial),versions=[structuredClone(initial)],writes=[],owner=true,processCalls=0,reads=0,loseResponse=false;
 const repo={get:async()=>{reads++;return structuredClone(current)},list:async()=>[current],all:async()=>[current],revisions:async()=>structuredClone(versions),put:async(r,actor,action)=>{writes.push({actor,action,record:structuredClone(r)});current=structuredClone(r);versions.push(structuredClone(r));if(loseResponse){loseResponse=false;throw Error('Connection lost after commit')}},settings:async()=>defaultSettings};
 const service=createClinicalService({actor:async()=>({principal:owner?'owner':'fellow',owner,memberships:[{year:2026,id:'f1',name:'Fellow'}]}),repository:repo,lock:async fn=>fn(),process:async r=>{processCalls++;return r},now:()=> '2026-11-08T01:00:00Z'});
 return {service,repo,writes,get current(){return current},get processCalls(){return processCalls},get reads(){return reads},set owner(v){owner=v},set loseResponse(v){loseResponse=v},external(fn){current=fn(structuredClone(current));versions.push(structuredClone(current))},set versions(v){versions=v}};
}
function request(base,draft,section,patch={}){return {section,baseRevision:base.revision,changes:editChanges(base,draft,section),...patch}}
test('section save needs no reason, writes automatic audit labels and keeps Sheet/PDF processing separate',async()=>{
 const base=record();base.answers.ravc_D=answer('45');const f=fixture(base),draft=structuredClone(base);draft.answers.ravc_D=answer('46');const result=await f.service.edit(base.id,request(base,draft,'0'));
 assert.equal(result.record.answers.ravc_D.value,'46');assert.equal(result.record.status,'approved');assert.equal(result.record.revision,1);assert.equal(result.record.processing,'pending');assert.equal(result.record.folderId,'original-folder');assert.equal(result.record.pdfId,'original-pdf');assert.equal(f.processCalls,0);assert.match(f.writes[0].action,/Age/);assert.ok(!f.writes[0].action.includes('46'));
});
test('stale owner edit automatically merges unrelated changes and metadata from processing',async()=>{
 const base=record();base.answers.ravc_D=answer('45');const f=fixture(base),draft=structuredClone(base);draft.answers.ravc_D=answer('46');f.external(r=>({...r,revision:1,processing:'complete',pdfId:'new-pdf',answers:{...r.answers,ravc_K:answer('HA')}}));
 const result=await f.service.edit(base.id,request(base,draft,'0'));assert.equal(result.record.answers.ravc_K.value,'HA');assert.equal(result.record.answers.ravc_D.value,'46');assert.equal(result.record.pdfId,'new-pdf');assert.equal(result.record.revision,2);
});
test('same-field conflicts preserve both values without writes and require a revision-bound choice',async()=>{
 const base=record();base.answers.ravc_D=answer('45');const f=fixture(base),draft=structuredClone(base);draft.answers.ravc_D=answer('46');f.external(r=>({...r,revision:1,answers:{...r.answers,ravc_D:answer('47')}}));
 const input=request(base,draft,'0'),result=await f.service.edit(base.id,input);assert.equal(f.writes.length,0);assert.equal(result.conflict.items[0].mine.value,'46');assert.equal(result.conflict.items[0].latest.value,'47');
 const done=await f.service.edit(base.id,{...input,resolveRevision:1,resolutions:{'answer:ravc_D':'mine'}});assert.equal(done.record.answers.ravc_D.value,'46');assert.equal(done.record.revision,2);
});
test('keep latest is a no-op; a new race invalidates an earlier conflict choice',async()=>{
 const base=record();base.answers.ravc_D=answer('45');const draft=structuredClone(base);draft.answers.ravc_D=answer('46');const f=fixture(base);f.external(r=>({...r,revision:1,answers:{...r.answers,ravc_D:answer('47')}}));const input=request(base,draft,'0');
 const kept=await f.service.edit(base.id,{...input,resolveRevision:1,resolutions:{'answer:ravc_D':'latest'}});assert.equal(kept.record.answers.ravc_D.value,'47');assert.equal(f.writes.length,0);
 f.external(r=>({...r,revision:2,answers:{...r.answers,ravc_D:answer('48')}}));const again=await f.service.edit(base.id,{...input,resolveRevision:1,resolutions:{'answer:ravc_D':'mine'}});assert.equal(again.conflict.revision,2);assert.equal(f.writes.length,0);
});
test('lost save response retries idempotently and never repeats the clinical audit write',async()=>{
 const base=record(),f=fixture(base),draft=structuredClone(base);draft.answers.ravc_D=answer('46');const input=request(base,draft,'0');f.loseResponse=true;
 await assert.rejects(f.service.edit(base.id,input),/Connection lost/);assert.equal(f.current.answers.ravc_D.value,'46');const retry=await f.service.edit(base.id,input);assert.equal(retry.unchanged,true);assert.equal(f.writes.length,1);
});
test('fellow requests are rejected before clinical reads; draft records keep their separate workflow',async()=>{
 const base=record(),f=fixture(base);f.owner=false;await assert.rejects(f.service.edit(base.id,{section:'0',baseRevision:0,changes:[]}),/owner/);assert.equal(f.reads,0);
 const draft={...base,status:'draft'},d=fixture(draft);await assert.rejects(d.service.edit(draft.id,{section:'0',baseRevision:0,changes:[]}),/submitted/);assert.equal(d.writes.length,0);
});
test('section scopes reject unrelated answers, metadata injection, mismatched event IDs and duplicate changes',async()=>{
 const base=record(),f=fixture(base);
 for(const input of [
 {section:'0',baseRevision:0,changes:[{key:'answer:ravc_K',value:answer('HA')}]},
 {section:'0',baseRevision:0,changes:[{key:'folderId',value:'outside'}]},
 {section:'events',baseRevision:0,changes:[{key:'event:'+crypto.randomUUID(),value:{id:crypto.randomUUID()}}]},
 {section:'0',baseRevision:0,changes:[{key:'answer:ravc_D',value:answer('1')},{key:'answer:ravc_D',value:answer('2')}]}
 ])await assert.rejects(f.service.edit(base.id,input));
 assert.equal(f.writes.length,0);
});
test('unrelated legacy validation gaps do not block a correction, but new invalid changes are rejected',async()=>{
 const base=record();base.answers.ravc_Q=answer('not-a-date');const f=fixture(base),draft=structuredClone(base);draft.answers.ravc_complication_type=answer('Vascular complication');const done=await f.service.edit(base.id,request(base,draft,'2'));assert.equal(done.record.answers.ravc_Q.value,'not-a-date');
 const invalid=structuredClone(f.current);invalid.answers.ravc_D=answer('-1');await assert.rejects(f.service.edit(base.id,request(f.current,invalid,'0')),/valid number/);assert.equal(f.writes.length,1);
});
test('quick follow-up merges concurrent visits without changing outcome profile or dated events',async()=>{
 const base=record();base.outcomes=emptyOutcomes();base.outcomes.firstTreatment='2026-08-01';const f=fixture(base),draft=structuredClone(base);
 const visit=id=>({id,date:'2026-11-01',healing:'not_assessed',assessment:'assessed',sequelae:['None'],recurrence:'no',notes:''});draft.outcomes.followups.push(visit(crypto.randomUUID()));f.external(r=>({...r,revision:1,outcomes:{...r.outcomes,followups:[{...visit(crypto.randomUUID()),date:'2026-10-01'}]}}));
 const done=await f.service.edit(base.id,request(base,draft,'followup'));assert.equal(done.record.outcomes.followups.length,2);assert.equal(done.record.outcomes.firstTreatment,'2026-08-01');assert.deepEqual(done.record.events,base.events);
});
test('concurrent edits/deletion of the same visit produce a conflict and do not silently remove newer findings',()=>{
 const base=record();base.outcomes=emptyOutcomes();const visit={id:crypto.randomUUID(),date:'2026-11-01',healing:'not_assessed',assessment:'assessed',sequelae:['None'],recurrence:'no',notes:''};base.outcomes.followups=[visit];const draft=structuredClone(base);draft.outcomes.followups=[];const latest=structuredClone(base);latest.revision=1;latest.outcomes.followups[0].sequelae=['Scarring'];const result=mergeEdit(base,latest,request(base,draft,'outcomes'));assert.equal(result.conflict.items[0].mine,null);assert.deepEqual(result.conflict.items[0].latest.sequelae,['Scarring']);
});
test('audit notes are optional and no-change requests do not write a revision',async()=>{
 const base=record(),f=fixture(base);const noop=await f.service.edit(base.id,request(base,base,'0'));assert.equal(noop.unchanged,true);assert.equal(f.writes.length,0);
 const draft=structuredClone(base);draft.answers.ravc_D=answer('46');await f.service.edit(base.id,request(base,draft,'0',{note:'Verified against the source record'}));assert.match(f.writes[0].action,/Verified against/);
});
test('missing or ambiguous base history fails safely instead of force-overwriting the case',async()=>{
 const base=record(),f=fixture(base),draft=structuredClone(base);draft.answers.ravc_D=answer('46');f.external(r=>({...r,revision:2}));f.versions=[];await assert.rejects(f.service.edit(base.id,request(base,draft,'0')),/original saved version/);
 const different=structuredClone(base);different.answers.ravc_D=answer('99');f.versions=[base,different];await assert.rejects(f.service.edit(base.id,request(base,draft,'0')),/conflicting history/);assert.equal(f.writes.length,0);
});
