import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp,rm} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const dir=await mkdtemp(new URL('../.auth-test-usability-',import.meta.url));
await build({entryPoints:['lib/clinical/edit.ts','lib/clinical/usability.ts','lib/clinical/dashboard.ts','lib/clinical/service.ts','lib/clinical/model.ts','lib/clinical/research.ts'],outdir:dir,outbase:'.',bundle:true,platform:'node',target:'node22',format:'esm',packages:'external'});
const load=p=>import(pathToFileURL(`${dir}/lib/clinical/${p}.js`));
const {caseAttention,sortCaseRows,processingLabel,attention,registryValues,matchesFilters,filterDefinitions}=await load('usability');
const {dashboardChart,defaultCharts,chartColor}=await load('dashboard');
const {createClinicalService}=await load('service');
const {newRecord,defaultSettings,validateForm}=await load('model');
const {episodes,defaultResearchConfig}=await load('research');
const {editChanges,mergeEdit}=await load('edit');
after(()=>rm(dir,{recursive:true,force:true}));
const a=value=>({state:'recorded',value});
function fixture(){let actor={principal:'fellow1',owner:false,memberships:[{id:'f1',year:2026}]},rows=[],writes=[];const repo={list:async()=>structuredClone(rows),all:async()=>structuredClone(rows),get:async id=>structuredClone(rows.find(r=>r.id===id)||null),put:async(r,by,action)=>{rows=rows.filter(x=>x.id!==r.id).concat(structuredClone(r));writes.push({by,action})},settings:async()=>defaultSettings,revisions:async()=>[]};const api=createClinicalService({repository:repo,actor:async()=>actor,lock:async fn=>fn(),process:async r=>r,now:()=> '2026-11-08T06:00:00Z'});return {api,writes,get rows(){return rows},actor:v=>actor=v,owner:()=>actor={principal:'owner',owner:true,memberships:[]},seed:r=>rows.push(r)};}
test('own draft trash is recoverable and hidden from fellows, with audited owner-only restore',async()=>{const f=fixture(),r=await f.api.create('ravc',2026,'f1');await f.api.removeDraft(r.id,0);assert.equal(f.rows.length,1);assert.ok(f.rows[0].trashedAt);assert.deepEqual(await f.api.list(),[]);await assert.rejects(f.api.read(r.id));await assert.rejects(f.api.save(r.id,1,r));await assert.rejects(f.api.restoreDraft(r.id,1),/owner/);f.owner();assert.equal((await f.api.list())[0].trashedAt,'2026-11-08T06:00:00Z');await f.api.restoreDraft(r.id,1);assert.equal(f.rows[0].revision,2);assert.equal(f.rows[0].trashedAt,undefined);assert.equal((await f.api.read(r.id)).status,'draft');assert.deepEqual(f.writes.map(w=>w.action),['Draft created','Draft moved to trash','Owner restored draft']);});
test('other fellows and scheduling admins cannot trash or restore private drafts',async()=>{const f=fixture(),r=await f.api.create('ravc',2026,'f1');for(const actor of [{principal:'other',owner:false,memberships:[{id:'f2',year:2026}]},{principal:'schedule-admin',owner:false,memberships:[]}]){f.actor(actor);await assert.rejects(f.api.removeDraft(r.id,0));await assert.rejects(f.api.restoreDraft(r.id,0));}assert.equal(f.rows[0].revision,0);});
test('trash/restore reject stale revisions and submitted cases; no storage deletion is needed',async()=>{const f=fixture(),r=await f.api.create('ravc',2026,'f1');await assert.rejects(f.api.removeDraft(r.id,1));f.owner();await assert.rejects(f.api.restoreDraft(r.id,0));const s={...newRecord('ravc','owner','f1',2026),status:'submitted'};f.seed(s);await assert.rejects(f.api.removeDraft(s.id,0));await f.api.removeDraft(r.id,0);await assert.rejects(f.api.restoreDraft(r.id,0));assert.equal(f.rows.length,2);});
test('clinical filter values are returned only to the owner',async()=>{const f=fixture(),r=await f.api.create('ravc',2026,'f1');assert.equal((await f.api.list())[0].filterValues,undefined);f.owner();assert.ok((await f.api.list())[0].filterValues.material);});
test('attention names exact missing and invalid fields, excludes optional and hidden fields',()=>{const r=newRecord('nodule','owner','f1',2026);r.answers.nodule_B={state:'not_applicable',value:''};r.answers.nodule_C=a('-1');const issues=attention(r);assert.ok(!issues.some(e=>e.field==='nodule_B'));assert.ok(issues.some(e=>e.field==='nodule_C'&&e.section==='0'&&/valid number/.test(e.message)));assert.ok(!issues.some(e=>e.field==='nodule_DA'));assert.ok(!issues.some(e=>e.field==='nodule_E'));});
test('conditional missing fields appear only when their parent choice requires them',()=>{const r=newRecord('nodule','owner','f1',2026);assert.ok(!attention(r).some(e=>e.field==='nodule_CS'));r.answers.nodule_hyal=a('Yes');assert.ok(attention(r).some(e=>e.field==='nodule_CS'));r.answers.nodule_hyal=a('No');assert.ok(!attention(r).some(e=>e.field==='nodule_CS'));});
test('structured validation issues preserve event and assessment context',()=>{const r=newRecord('ravc','owner','f1',2026);r.events=[{id:crypto.randomUUID(),type:'History',title:'',date:'',datePrecision:'unknown',details:''}];const issue=attention(r)[0];assert.equal(issue.section,'events');assert.match(issue.message,/title/);});
test('filters use OR within a factor and AND across factors, with exact categories',()=>{const r=newRecord('ravc','owner','f1',2026);r.answers.ravc_W=a(['Nose','Cheek']);r.answers.ravc_K=a('HA');r.answers.ravc_AB=a(['Ultrasound guided']);const v=registryValues(r);assert.equal(matchesFilters(v,{area:['Nose','Temple'],material:['HA']}),true);assert.equal(matchesFilters(v,{area:['Nose'],material:['CaHA']}),false);assert.equal(matchesFilters(v,{material:['H']}),false);assert.equal(matchesFilters(v,{material:[]}),true);assert.equal(matchesFilters(v,{sex:['Not recorded']}),true);});
test('registry-specific choice factors and nodule hyaluronidase are available without typed searches',()=>{const r=newRecord('nodule','owner','f1',2026);r.answers.nodule_hyal=a('Yes');r.answers.nodule_N=a('Fictional brand');r.answers.nodule_BA=a('Hypoechoic');const v=registryValues(r);assert.deepEqual(v.agent,['Hyaluronidase']);assert.deepEqual(v.brand,['Fictional brand']);assert.deepEqual(v.nodule_BA,['Hypoechoic']);assert.ok(!filterDefinitions('ravc').some(d=>d.id==='nodule_BA'));});
test('default dashboard has six charts with known denominators and multi-finding counts',()=>{assert.equal(defaultCharts.length,6);const r={...newRecord('ravc','owner','f1',2026),status:'submitted'};r.answers.ravc_W=a(['Nose','Cheek']);const e={id:r.id,members:[r],date:''};const d=dashboardChart([e,{...e,id:'missing',members:[{...r,answers:{}}]}],'area');assert.equal(d.known,1);assert.equal(d.missing,1);assert.equal(d.rows.reduce((n,r)=>n+r.count,0),2);assert.ok(d.multi);});
test('linked episodes are counted once and conflicting single-valued chart answers are excluded',()=>{const r={...newRecord('ravc','owner','f1',2026),status:'submitted'};r.answers.ravc_D=a('40');const s={...structuredClone(r),id:crypto.randomUUID(),linkedCaseIds:[r.id],answers:{ravc_D:a('55')}};const items=episodes([r,s],defaultResearchConfig()).selected;assert.equal(items.length,1);const d=dashboardChart(items,'age');assert.equal(d.known,0);assert.equal(d.conflicting,1);});
test('outcome charts distinguish assessed three-month outcomes, unassessed latest recurrence and wound eligibility',()=>{const r={...newRecord('ravc','owner','f1',2026),status:'submitted',outcomes:{wound:'yes',firstTreatment:'2026-08-01',severity:'unknown',healing:{status:'healed',precision:'unknown',date:'',from:'',to:''},followups:[{id:crypto.randomUUID(),date:'2026-10-30',assessment:'assessed',sequelae:['None'],healing:'healed',recurrence:'no',notes:''}]}};const e={id:r.id,members:[r],date:'2026-08-01'};assert.equal(dashboardChart([e],'sequelae').rows[0].label,'No sequelae');assert.equal(dashboardChart([e],'healing').rows[0].label,'Healed');r.outcomes.followups.push({...r.outcomes.followups[0],id:crypto.randomUUID(),date:'2026-11-05',recurrence:'not_assessed'});assert.equal(dashboardChart([e],'recurrence').known,0);});
test('material colors remain stable across filtering and missing values are gray',()=>{assert.equal(chartColor('material','HA'),chartColor('material','HA'));assert.notEqual(chartColor('material','HA'),chartColor('material','CaHA'));assert.equal(chartColor('sex','Not recorded'),'#8b96a6');});

test('case completeness flags optional sex, deduplicates required gaps and accepts explicit unavailable states',()=>{
 const r=newRecord('ravc','owner','f1',2026);
 assert.ok(!attention(r).some(i=>i.field==='ravc_sex'));
 assert.ok(caseAttention(r).some(i=>i.field==='ravc_sex'&&i.section==='0'));
 assert.equal(new Set(caseAttention(r).map(i=>i.field)).size,caseAttention(r).length);
 for(const state of ['unknown','not_applicable']){r.answers.ravc_sex={state,value:''};assert.ok(!caseAttention(r).some(i=>i.field==='ravc_sex'));}
 r.answers.ravc_sex=a('Female');assert.ok(!caseAttention(r).some(i=>i.field==='ravc_sex'));
 r.answers.ravc_sex=a('  ');assert.ok(caseAttention(r).some(i=>i.field==='ravc_sex'));
});
test('owner list includes named completeness issues and visit chronology; fellow receipts never leak them',async()=>{
 const f=fixture(),r=await f.api.create('ravc',2026,'f1');r.answers.ravc_Q=a('2024-06-01');f.seed({...r,id:'historical',historical:true});
 let rows=await f.api.list();for(const row of rows){assert.equal(row.missingInformation,undefined);assert.equal(row.visitDate,undefined);assert.equal(row.summary,undefined);}
 f.owner();rows=await f.api.list();assert.equal(rows.find(r=>r.id==='historical').visitDate,'2024-06-01');assert.ok(rows[0].missingInformation.some(i=>i.field==='ravc_sex'));
});
test('chronological sorting uses selected dates, unknowns last in both directions, stable ties and no mutation',()=>{
 const rows=[{id:'unknown',visitDate:'',created:'2026-11-08'},{id:'b',visitDate:'2024-01-01',created:'2026-10-01'},{id:'a',visitDate:'2024-01-01',created:'2026-09-01'},{id:'new',visitDate:'2026-01-01',created:'2026-08-01'},{id:'bad',visitDate:'invalid'}];
 const original=structuredClone(rows);
 assert.deepEqual(sortCaseRows(rows).map(r=>r.id),['new','a','b','bad','unknown']);
 assert.deepEqual(sortCaseRows(rows,'visit','asc').map(r=>r.id),['a','b','new','bad','unknown']);
 assert.deepEqual(sortCaseRows(rows,'created','desc').map(r=>r.id),['unknown','b','a','new','bad']);
 assert.deepEqual(rows,original);
 assert.equal(processingLabel('complete'),'Sheet/PDF updated');
});

test('hiding reminders preserves missing fields, clinical answers, processing and owner-only visibility',async()=>{
 const f=fixture(),r=await f.api.create('ravc',2026,'f1');await assert.rejects(f.api.caseOption(r.id,0,'reminders',true),/owner/);
 f.owner();await assert.rejects(f.api.caseOption(r.id,0,['reminders'],true),/Invalid/);await assert.rejects(f.api.caseOption(r.id,0,'reminders','true'),/Invalid/);const before=caseAttention(r);let next=await f.api.caseOption(r.id,0,'reminders',true);
 assert.equal(next.remindersHidden,true);assert.deepEqual(caseAttention(next),before);assert.deepEqual(next.answers,r.answers);assert.equal(next.processing,'draft');
 assert.equal((await f.api.list())[0].remindersHidden,true);await assert.rejects(f.api.caseOption(r.id,0,'reminders',false),/changed/);
 next=await f.api.caseOption(r.id,1,'reminders',false);assert.equal(next.remindersHidden,false);assert.ok(f.writes.some(w=>/hid card reminders/.test(w.action)));
 f.actor({principal:'fellow1',owner:false,memberships:[{id:'f1',year:2026}]});assert.equal((await f.api.list())[0].remindersHidden,undefined);
});
test('historical timeline waiver is owner-only, reversible and audited; never allowed on new records',async()=>{
 const f=fixture(),r={...newRecord('ravc','owner','historical',2026),historical:true,status:'submitted'};f.seed(r);
 await assert.rejects(f.api.caseOption(r.id,0,'managementUnavailable',true),/owner/);f.owner();
 const newCase=await f.api.create('ravc',2026,'f1');await assert.rejects(f.api.caseOption(newCase.id,0,'managementUnavailable',true),/historical/);
 assert.ok(caseAttention(r).some(i=>i.field==='events'));
 let next=await f.api.caseOption(r.id,0,'managementUnavailable',true);assert.deepEqual(next.events,[]);assert.equal(next.timelineStatus,undefined);assert.equal(next.managementUnavailable.actor,'owner');
 assert.ok(!caseAttention(next).some(i=>i.field==='events'));assert.equal(next.processing,'pending');
 next=await f.api.caseOption(r.id,1,'managementUnavailable',false);assert.equal(next.managementUnavailable,undefined);assert.ok(caseAttention(next).some(i=>i.field==='events'));
 assert.ok(f.writes.some(w=>/historical management timeline unavailable/.test(w.action)));
});
test('management requirement accepts actual treatment or explicit no treatment; exemptions never hide invalid entries',()=>{
 const r=newRecord('nodule','owner','f1',2026),missing=f=>validateForm(f,true).errors.filter(e=>e.field==='events');
 assert.ok(missing(r).length);r.timelineStatus='none';assert.equal(missing(r).length,0);
 r.events=[{id:crypto.randomUUID(),type:'Treatment',title:'Treatment',date:'',datePrecision:'unknown',details:'Observation and review'}];assert.ok(missing(r).some(e=>/conflicts/.test(e.message)));
 r.timelineStatus='recorded';assert.equal(missing(r).length,0);
 r.events[0].amount='text';assert.ok(validateForm(r,true,{},true,true).errors.some(e=>/numerical amount/.test(e.message)));
 assert.ok(validateForm({...newRecord('nodule','owner','f1',2026),managementUnavailable:{at:'x',actor:'forged'}},true,{},true).errors.some(e=>e.field==='events'));
});

test('fellow save cannot forge the historical timeline waiver',async()=>{
 const f=fixture(),r={...newRecord('nodule','fellow1','f1',2026),historical:true};f.seed(r);
 await assert.rejects(f.api.save(r.id,0,{...r,managementUnavailable:{at:'forged',actor:'owner'}},true));
 assert.equal(f.rows[0].managementUnavailable,undefined);assert.equal(f.rows[0].status,'draft');
});

test('management status merges as an events-section field without losing unrelated events or owner settings',()=>{
 const base=newRecord('nodule','owner','f1',2026),mine={...structuredClone(base),timelineStatus:'none'},latest={...structuredClone(base),remindersHidden:true,managementUnavailable:{at:'2026-11-08',actor:'owner'}};
 const changes=editChanges(base,mine,'events');assert.deepEqual(changes,[{key:'timeline:status',value:'none'}]);
 const merged=mergeEdit(base,latest,{section:'events',baseRevision:0,changes});assert.equal(merged.record.timelineStatus,'none');assert.equal(merged.record.remindersHidden,true);assert.deepEqual(merged.record.managementUnavailable,latest.managementUnavailable);
 latest.timelineStatus='recorded';latest.revision=1;assert.ok(mergeEdit(base,latest,{section:'events',baseRevision:0,changes}).conflict);
 assert.throws(()=>mergeEdit(base,base,{section:'0',baseRevision:0,changes}));
});
