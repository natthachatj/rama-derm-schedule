import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const dir=await mkdtemp(new URL('../.auth-test-priority-',import.meta.url));
await build({entryPoints:['lib/priority-inbox.ts','lib/schedule-api.ts','lib/schedule.ts','lib/clinical/service.ts','lib/clinical/model.ts'],outdir:dir,outbase:'.',bundle:true,platform:'node',target:'node22',format:'esm',packages:'external'});
const load=p=>import(pathToFileURL(`${dir}/${p}.js`));
const {clinicalApprovalItems,sortPriorityItems,firstVisitLabel,scheduleApprovalItems}=await load('lib/priority-inbox');
const {createScheduleApi}=await load('lib/schedule-api'),{seed}=await load('lib/schedule');
const {createClinicalService}=await load('lib/clinical/service'),{newRecord,defaultSettings}=await load('lib/clinical/model');
after(()=>rm(dir,{recursive:true,force:true}));
test('clinical inbox contains only new pending submissions and a narrow metadata projection',()=>{
 const base={id:'a',kind:'ravc',fellow:'f1',year:2026,status:'submitted',created:'2026-10-01',submittedAt:'2026-11-08',answers:{name:'SECRET'},folderId:'PRIVATE'};
 const items=clinicalApprovalItems([base,{...base,id:'draft',status:'draft'},{...base,id:'history',historical:true},{...base,id:'approved',status:'approved'},{...base,id:'trash',trashedAt:'x'}]);
 assert.equal(items.length,1);assert.equal(items[0].submitted,'2026-11-08');assert.equal(items[0].answers,undefined);assert.equal(items[0].folderId,undefined);assert.ok(!JSON.stringify(items).includes('SECRET'));
});
test('clinical inbox authorization and approval use the same record state',async()=>{
 let owner=false;let r={...newRecord('ravc','owner','f1',2026),status:'submitted'};
 const repo={list:async()=>[r],all:async()=>[r],get:async()=>r,put:async next=>r=next,settings:async()=>defaultSettings};
 const api=createClinicalService({repository:repo,actor:async()=>({owner,principal:owner?'owner':'fellow',memberships:[{id:'f1',year:2026}]}),lock:fn=>fn(),process:async r=>r});
 await assert.rejects(api.inbox(),/owner/);owner=true;assert.equal((await api.inbox()).length,1);await api.approve(r.id,0);assert.equal((await api.inbox()).length,0);assert.ok(r.answers);
});
test('priority modes are deterministic, do not mutate input, and keep clinical items out of date urgency',()=>{
 const rows=[{id:'new',kind:'clinical',title:'case',fellow:'f',year:2026,submitted:'2026-11-08T08:00:00Z'},{id:'old',kind:'clinical',title:'case',fellow:'f',year:2026,submitted:'2026-11-01'},{id:'soon',kind:'leave',title:'leave',fellow:'f',year:2026,submitted:'2026-11-07',date:'2026-11-09'},{id:'future',kind:'presentation',title:'slides',fellow:'f',year:2026,submitted:'2026-11-08',date:'2026-12-01'}];
 const before=structuredClone(rows);assert.deepEqual(sortPriorityItems(rows,'time','2026-11-08').map(r=>r.id),['soon','old','future','new']);assert.deepEqual(sortPriorityItems(rows,'newest','2026-11-08').map(r=>r.id),['new','future','soon','old']);assert.deepEqual(rows,before);
});
test('schedule inbox respects academic year and pending leave state',()=>{
 const y=seed().years[0],l={id:'leave',year:y.year,requester:y.fellows[0].id,status:'pending',created:'2026-11-08',items:[],days:[{date:'2026-11-10',period:'full'}]};
 assert.equal(scheduleApprovalItems(y,[l,{...l,id:'approved',status:'approved'},{...l,id:'oldyear',year:y.year-1}],[],[]).length,1);assert.equal(scheduleApprovalItems(y,[l],[],[])[0].date,'2026-11-10');
});
test('first-visit dates are readable, independent of timezone, and reject impossible dates',()=>{assert.equal(firstVisitLabel('2026-10-24'),'24 Oct 2026');assert.equal(firstVisitLabel('2026-02-30'),'Date not recorded');assert.equal(firstVisitLabel(''),'Date not recorded');});
test('appearance is saved to the acting account only; other preferences are private and public cannot write',async()=>{
 let state=seed(),revision=0,user={userId:'account-a',displayName:'A',email:'a@example.test',fullName:null,localAccess:{admin:false,memberships:[]}};
 const api=createScheduleApi({load:async()=>({state:structuredClone(state),revision}),save:async(s,r)=>{assert.equal(r,revision);state=s;revision++;return true;},getUser:async()=>user,adminEmail:()=> 'admin@example.test'});
 const post=body=>api.POST(new Request('http://app.test/api/schedule',{method:'POST',headers:{'Content-Type':'application/json',Origin:'http://app.test'},body:JSON.stringify({revision,...body})}));
 let response=await post({action:'appearance',theme:'dark',userId:'account-b'});assert.equal(response.status,200);assert.equal(state.appearance['account-a'],'dark');assert.equal(state.appearance['account-b'],undefined);assert.equal((await response.json()).appearance,'dark');
 user={...user,userId:'account-b'};let data=await (await api.GET()).json();assert.equal(data.appearance,'system');assert.equal(data.appearanceMap,undefined);assert.ok(!JSON.stringify(data).includes('account-a'));
 await post({action:'appearance',theme:'light'});user={...user,userId:'account-a'};assert.equal((await (await api.GET()).json()).appearance,'dark');
 assert.equal((await post({action:'appearance',theme:'invalid'})).status,400);user=null;assert.equal((await post({action:'appearance',theme:'dark'})).status,400);
});
