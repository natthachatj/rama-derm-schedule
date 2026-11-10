import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp,rm} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const dir=await mkdtemp(new URL('../.auth-test-cohorts-',import.meta.url));
await build({entryPoints:['lib/schedule-api.ts','lib/schedule.ts'],outdir:dir,outbase:'.',bundle:true,platform:'node',target:'node22',format:'esm',packages:'external'});
const {seed,makeYear}=await import(pathToFileURL(`${dir}/lib/schedule.js`));
const {createScheduleApi}=await import(pathToFileURL(`${dir}/lib/schedule-api.js`));
after(()=>rm(dir,{recursive:true,force:true}));
function fixture(){
 const state=seed();state.years.push(makeYear(2027,3));for(const y of state.years)y.published=structuredClone(y.draft);
 state.activities=state.years.map(y=>({id:`activity-${y.year}`,year:y.year,title:`Programme ${y.year}`,visibility:'public',status:'scheduled',createdBy:'admin',responsible:[],history:[]}));
 let user={userId:'fellow',displayName:'Fellow',email:'unused@example.test',fullName:null,localAccess:{admin:false,memberships:[{year:2027,id:state.years[1].fellows[0].id}]}};
 const api=createScheduleApi({load:async()=>({state,revision:0}),save:async()=>true,getUser:async()=>user,adminEmail:()=> 'admin@example.test'});
 return {state,api,user:u=>user=u,view:async()=> (await api.GET()).json()};
}
test('password fellow receives only assigned cohort including published activities, never another year draft',async()=>{
 const f=fixture(),v=await f.view();assert.equal(v.role,'fellow');assert.deepEqual(v.years.map(y=>y.year),[2027]);assert.ok(v.years[0].published);assert.equal(v.years[0].draft,undefined);assert.deepEqual(v.activities.map(a=>a.year),[2027]);
 const response=await f.api.POST(new Request('https://example.test/api/schedule',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'leave',year:2026,revision:0,items:[]})}));assert.equal(response.status,400);assert.match((await response.json()).error,/fellow access/);
});
test('Google fellow cohort scope follows verified matching email, including historical assigned years',async()=>{
 const f=fixture();f.state.years[0].fellows[0].email='fellow@example.test';f.user({userId:'google',displayName:'Fellow',email:'FELLOW@example.test',fullName:null});let v=await f.view();assert.deepEqual(v.years.map(y=>y.year),[2026]);
 f.state.years[1].fellows[1].email='fellow@example.test';v=await f.view();assert.deepEqual(v.years.map(y=>y.year),[2026,2027]);
});
test('administrators retain all years and drafts; public published-schedule access is preserved',async()=>{
 const f=fixture();f.user({userId:'admin',displayName:'Admin',email:'admin@example.test',fullName:null});let v=await f.view();assert.equal(v.role,'admin');assert.deepEqual(v.years.map(y=>y.year),[2026,2027]);assert.ok(v.years.every(y=>y.draft));assert.equal(v.activities.length,2);
 f.user(null);v=await f.view();assert.equal(v.role,'public');assert.equal(v.years.length,2);assert.ok(v.years.every(y=>!y.draft));
});
